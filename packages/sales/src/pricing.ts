import Decimal from "decimal.js";
import { ServiceError, type Money, type RoundingPolicy } from "@agntia-ventas/contracts";
import {
  addMoney,
  applyDiscountBasisPoints,
  multiplyMoney,
  subtractMoney,
  sumMoney,
} from "@agntia-ventas/domain";
import type {
  DiscountMandate,
  PriceBook,
  PriceEntry,
  Product,
  QuoteLineTotal,
  QuoteRequest,
  QuoteTotals,
  TaxRule,
} from "./models.ts";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

function taxOn(net: Money, basisPoints: number, policy: RoundingPolicy): Money {
  const factor = new Decimal(basisPoints).dividedBy(10_000);
  const amount = new Decimal(net.amount).times(factor).toDecimalPlaces(
    policy.exponent,
    policy.rounding === "HALF_UP"
      ? Decimal.ROUND_HALF_UP
      : policy.rounding === "HALF_EVEN"
        ? Decimal.ROUND_HALF_EVEN
        : policy.rounding === "DOWN"
          ? Decimal.ROUND_DOWN
          : Decimal.ROUND_UP,
  );
  return { amount: amount.toFixed(policy.exponent), currency: net.currency };
}

/** A stale catalog cannot support a delivery claim. */
export function assertCatalogFresh(product: Product, now: string): void {
  if (new Date(product.validUntil) <= new Date(now)) {
    throw new ServiceError("CATALOG_STALE", "catalog entry expired", {
      details: { productRef: product.id, validUntil: product.validUntil },
    });
  }
  if (!product.stockAt) {
    throw new ServiceError("CATALOG_STALE", "stock assertion missing", {
      details: { productRef: product.id },
    });
  }
}

export function assertDeliveryClaim(product: Product, now: string): string {
  assertCatalogFresh(product, now);
  if (!product.deliveryAssertion) {
    throw new ServiceError("CATALOG_STALE", "delivery assertion missing", {
      details: { productRef: product.id },
    });
  }
  return product.deliveryAssertion;
}

export function resolvePrice(
  priceBook: PriceBook,
  productRef: string,
  now: string,
): PriceEntry {
  const at = new Date(now).getTime();
  const entry = priceBook.entries.find(
    (candidate) =>
      candidate.productRef === productRef &&
      new Date(candidate.effectiveFrom).getTime() <= at &&
      (candidate.effectiveTo === undefined ||
        new Date(candidate.effectiveTo).getTime() > at),
  );
  if (!entry) {
    throw new ServiceError("PRICE_STALE", "no effective price for product", {
      details: { productRef, priceBook: priceBook.id, version: priceBook.version },
    });
  }
  if (entry.unitPrice.currency !== priceBook.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "price currency differs from price book");
  }
  return entry;
}

/**
 * Totals are decimal and reproducible. Order of operations:
 * unit x quantity -> line discount -> sum -> order discount -> tax per line.
 * Tax comes only from an approved mapping: it is never inferred.
 */
export function computeQuote(request: QuoteRequest): QuoteTotals {
  if (request.lines.length === 0) {
    throw new ServiceError("VALIDATION_FAILED", "quote needs at least one line");
  }
  const currency = request.priceBook.currency;
  const lines: QuoteLineTotal[] = [];
  const taxMappingRefs = new Set<string>();

  for (const line of request.lines) {
    const product = request.products.find((item) => item.id === line.productRef);
    if (!product) {
      throw new ServiceError("NOT_FOUND", "product not present in catalog", {
        details: { productRef: line.productRef },
      });
    }
    if (product.tenantId !== request.tenantId) {
      throw new ServiceError("TENANT_MISMATCH", "product belongs to another tenant");
    }
    assertCatalogFresh(product, request.now);

    const price = resolvePrice(request.priceBook, line.productRef, request.now);
    const base = multiplyMoney(price.unitPrice, line.quantity, request.policy);

    const discountBasisPoints = line.discountBasisPoints ?? 0;
    if (discountBasisPoints < 0 || discountBasisPoints > 10_000) {
      throw new ServiceError("VALIDATION_FAILED", "line discount out of range", {
        details: { productRef: line.productRef },
      });
    }
    const net = applyDiscountBasisPoints(base, discountBasisPoints, request.policy);

    const rule = request.taxRules.find((item) => item.productRef === line.productRef);
    if (!rule || !rule.sourceRef) {
      throw new ServiceError("TAX_MAPPING_MISSING", "no approved tax rule for product", {
        details: { productRef: line.productRef },
      });
    }
    taxMappingRefs.add(rule.sourceRef);

    lines.push({
      productRef: line.productRef,
      quantity: line.quantity,
      unitPrice: price.unitPrice,
      base,
      discountBasisPoints,
      net,
      tax: taxOn(net, rule.rateBasisPoints, request.policy),
    });
  }

  const subtotal = sumMoney(lines.map((line) => line.base));
  const netBeforeOrder = sumMoney(lines.map((line) => line.net));
  const lineDiscount = subtractMoney(subtotal, netBeforeOrder);

  const orderBasisPoints = request.orderDiscountBasisPoints ?? 0;
  if (orderBasisPoints < 0 || orderBasisPoints > 10_000) {
    throw new ServiceError("VALIDATION_FAILED", "order discount out of range");
  }
  const net = applyDiscountBasisPoints(netBeforeOrder, orderBasisPoints, request.policy);
  const orderDiscount = subtractMoney(netBeforeOrder, net);
  const tax = sumMoney(lines.map((line) => line.tax));
  const total = addMoney(net, tax);

  return {
    currency,
    lines,
    subtotal,
    lineDiscount,
    orderDiscount,
    net,
    tax,
    total,
    policyVersion: request.policy.policyVersion,
    priceBookVersion: request.priceBook.version,
    taxMappingRefs: [...taxMappingRefs].sort(),
  };
}

/**
 * The mandate caps the aggregate discount. Checking line by line is not enough:
 * a split across lines must not bypass the limit.
 */
export function assertDiscountWithinMandate(input: {
  quote: QuoteTotals;
  mandate: DiscountMandate;
  now: string;
}): void {
  const { quote, mandate } = input;
  if (new Date(mandate.expiresAt) <= new Date(input.now)) {
    throw new ServiceError("MANDATE_EXPIRED", "discount mandate expired");
  }

  const totalDiscount = addMoney(quote.lineDiscount, quote.orderDiscount);
  const subtotal = new Decimal(quote.subtotal.amount);
  // The cap is expressed in money and rounded with the quote policy, so an
  // in-mandate percentage never becomes a violation just because cents rounded
  // up. The split case still fails: two 3% cuts exceed a 5% cap in money.
  const allowed = subtotal
    .times(mandate.maxRateBasisPoints)
    .dividedBy(10_000)
    .toDecimalPlaces(quote.net.exponent ?? 2, Decimal.ROUND_HALF_UP);

  if (new Decimal(totalDiscount.amount).greaterThan(allowed)) {
    throw new ServiceError("DISCOUNT_EXCEEDED", "aggregate discount exceeds mandate", {
      details: {
        totalDiscount: totalDiscount.amount,
        allowed: allowed.toFixed(quote.net.exponent ?? 2),
        maxRateBasisPoints: mandate.maxRateBasisPoints,
      },
    });
  }

  if (mandate.maxAmount) {
    if (mandate.maxAmount.currency !== totalDiscount.currency) {
      throw new ServiceError("CURRENCY_MISMATCH", "mandate currency differs from quote");
    }
    if (new Decimal(totalDiscount.amount).greaterThan(mandate.maxAmount.amount)) {
      throw new ServiceError("DISCOUNT_EXCEEDED", "discount exceeds mandate amount", {
        details: { totalDiscount: totalDiscount.amount },
      });
    }
  }

  const overLine = quote.lines.find(
    (line) => line.discountBasisPoints > mandate.maxRateBasisPoints,
  );
  if (overLine) {
    throw new ServiceError("DISCOUNT_EXCEEDED", "line discount above mandate rate", {
      details: { productRef: overLine.productRef },
    });
  }
}

export function quoteHasNoDiscounts(quote: QuoteTotals): boolean {
  return (
    new Decimal(quote.lineDiscount.amount).isZero() &&
    new Decimal(quote.orderDiscount.amount).isZero()
  );
}
