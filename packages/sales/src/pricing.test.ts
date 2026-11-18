import { describe, expect, it } from "vitest";
import { ServiceError, type RoundingPolicy } from "@agntia-ventas/contracts";
import {
  assertCatalogFresh,
  assertDeliveryClaim,
  assertDiscountWithinMandate,
  computeQuote,
  quoteHasNoDiscounts,
  resolvePrice,
} from "./pricing.ts";
import type { DiscountMandate, PriceBook, Product, TaxRule } from "./models.ts";

const NOW = "2026-11-15T10:00:00Z";
const POLICY: RoundingPolicy = {
  rounding: "HALF_UP",
  exponent: 2,
  policyVersion: "q1",
};

const product: Product = {
  id: "product-alpha-01",
  tenantId: "tenant-alpha-01",
  catalogVersion: "catalog-3",
  validUntil: "2027-01-01T00:00:00Z",
  stockAt: "2026-11-14T00:00:00Z",
  deliveryAssertion: "10 business days",
};

const priceBook: PriceBook = {
  id: "pricebook-alpha-01",
  tenantId: "tenant-alpha-01",
  version: "pb-7",
  currency: "EUR",
  entries: [
    {
      productRef: "product-alpha-01",
      unitPrice: { amount: "19.99", currency: "EUR" },
      effectiveFrom: "2026-01-01T00:00:00Z",
    },
  ],
};

const taxRule: TaxRule = {
  productRef: "product-alpha-01",
  rateBasisPoints: 2100,
  sourceRef: "tax-source-01",
};

const mandate: DiscountMandate = {
  id: "discount-mandate-01",
  maxRateBasisPoints: 500,
  scope: "order",
  expiresAt: "2027-01-01T00:00:00Z",
};

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

function quote(overrides: {
  lineDiscountBasisPoints?: number;
  orderDiscountBasisPoints?: number;
  products?: readonly Product[];
  taxRules?: readonly TaxRule[];
  book?: PriceBook;
} = {}) {
  return computeQuote({
    tenantId: "tenant-alpha-01",
    priceBook: overrides.book ?? priceBook,
    lines: [
      {
        productRef: "product-alpha-01",
        quantity: "2",
        ...(overrides.lineDiscountBasisPoints !== undefined
          ? { discountBasisPoints: overrides.lineDiscountBasisPoints }
          : {}),
      },
    ],
    products: overrides.products ?? [product],
    taxRules: overrides.taxRules ?? [taxRule],
    policy: POLICY,
    ...(overrides.orderDiscountBasisPoints !== undefined
      ? { orderDiscountBasisPoints: overrides.orderDiscountBasisPoints }
      : {}),
    now: NOW,
  });
}

describe("catalog and pricebook", () => {
  it("accepts a fresh catalog with stock and delivery assertions", () => {
    expect(() => assertCatalogFresh(product, NOW)).not.toThrow();
    expect(assertDeliveryClaim(product, NOW)).toBe("10 business days");
  });

  it("blocks a stale catalog and a missing delivery assertion", () => {
    expect(
      codeOf(() => assertCatalogFresh({ ...product, validUntil: "2026-11-01T00:00:00Z" }, NOW)),
    ).toBe("CATALOG_STALE");
    expect(codeOf(() => assertCatalogFresh({ ...product, stockAt: "" }, NOW))).toBe(
      "CATALOG_STALE",
    );
    // An unreadable expiry must not pass a NaN comparison as fresh.
    expect(
      codeOf(() => assertCatalogFresh({ ...product, validUntil: "soon" }, NOW)),
    ).toBe("CATALOG_STALE");
    expect(codeOf(() => assertDeliveryClaim({ ...product, deliveryAssertion: undefined }, NOW))).toBe(
      "CATALOG_STALE",
    );
  });

  it("resolves only an effective price", () => {
    expect(resolvePrice(priceBook, "product-alpha-01", NOW).unitPrice.amount).toBe("19.99");
    expect(
      codeOf(() =>
        resolvePrice(
          { ...priceBook, entries: [{ ...priceBook.entries[0]!, effectiveFrom: "2027-01-01T00:00:00Z" }] },
          "product-alpha-01",
          NOW,
        ),
      ),
    ).toBe("PRICE_STALE");
    expect(codeOf(() => resolvePrice(priceBook, "product-unknown", NOW))).toBe("PRICE_STALE");
    // An unreadable window end must not become an open-ended price.
    expect(
      codeOf(() =>
        resolvePrice(
          {
            ...priceBook,
            entries: [{ ...priceBook.entries[0]!, effectiveTo: "eventually" }],
          },
          "product-alpha-01",
          NOW,
        ),
      ),
    ).toBe("PRICE_STALE");
  });
});

describe("quote totals", () => {
  it("computes deterministic totals with one rounding per step", () => {
    const totals = quote({ lineDiscountBasisPoints: 500 });

    expect(totals.subtotal.amount).toBe("39.98");
    expect(totals.lines[0]?.net.amount).toBe("37.98");
    expect(totals.lines[0]?.tax.amount).toBe("7.98");
    expect(totals.lineDiscount.amount).toBe("2.00");
    expect(totals.orderDiscount.amount).toBe("0.00");
    expect(totals.net.amount).toBe("37.98");
    expect(totals.tax.amount).toBe("7.98");
    expect(totals.total.amount).toBe("45.96");
    expect(totals.priceBookVersion).toBe("pb-7");
    expect(totals.taxMappingRefs).toEqual(["tax-source-01"]);
  });

  it("applies an order discount after line discounts", () => {
    const totals = quote({ lineDiscountBasisPoints: 500, orderDiscountBasisPoints: 1000 });
    expect(totals.net.amount).toBe("34.18");
    expect(totals.orderDiscount.amount).toBe("3.80");
    expect(totals.total.amount).toBe("42.16");
    expect(quoteHasNoDiscounts(totals)).toBe(false);
  });

  it("is reproducible for the same input", () => {
    expect(JSON.stringify(quote({ lineDiscountBasisPoints: 250 }))).toBe(
      JSON.stringify(quote({ lineDiscountBasisPoints: 250 })),
    );
  });

  it("refuses to infer taxes", () => {
    expect(codeOf(() => quote({ taxRules: [] }))).toBe("TAX_MAPPING_MISSING");
    expect(
      codeOf(() => quote({ taxRules: [{ ...taxRule, sourceRef: "" }] })),
    ).toBe("TAX_MAPPING_MISSING");
    // A negative or excessive rate is invalid data, not a discount on tax.
    expect(
      codeOf(() => quote({ taxRules: [{ ...taxRule, rateBasisPoints: -100 }] })),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() => quote({ taxRules: [{ ...taxRule, rateBasisPoints: 10_001 }] })),
    ).toBe("VALIDATION_FAILED");
  });

  it("refuses mixed currencies and foreign tenants", () => {
    expect(
      codeOf(() =>
        quote({
          book: {
            ...priceBook,
            entries: [
              {
                ...priceBook.entries[0]!,
                unitPrice: { amount: "19.99", currency: "USD" },
              },
            ],
          },
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");

    expect(
      codeOf(() => quote({ products: [{ ...product, tenantId: "tenant-beta-02" }] })),
    ).toBe("TENANT_MISMATCH");

    expect(
      codeOf(() => quote({ book: { ...priceBook, tenantId: "tenant-beta-02" } })),
    ).toBe("TENANT_MISMATCH");
  });
});

describe("discount mandates", () => {
  it("accepts a discount inside the mandate", () => {
    const totals = quote({ lineDiscountBasisPoints: 500 });
    expect(() =>
      assertDiscountWithinMandate({ quote: totals, mandate, now: NOW }),
    ).not.toThrow();
  });

  it("blocks a split discount that bypasses the aggregate cap", () => {
    const totals = quote({ lineDiscountBasisPoints: 300, orderDiscountBasisPoints: 300 });
    expect(codeOf(() => assertDiscountWithinMandate({ quote: totals, mandate, now: NOW }))).toBe(
      "DISCOUNT_EXCEEDED",
    );
  });

  it("blocks an expired mandate and an exceeded amount cap", () => {
    const totals = quote({ lineDiscountBasisPoints: 500 });
    expect(
      codeOf(() =>
        assertDiscountWithinMandate({
          quote: totals,
          mandate: { ...mandate, expiresAt: "2026-11-01T00:00:00Z" },
          now: NOW,
        }),
      ),
    ).toBe("MANDATE_EXPIRED");

    expect(
      codeOf(() =>
        assertDiscountWithinMandate({
          quote: totals,
          mandate: {
            ...mandate,
            maxAmount: { amount: "1.00", currency: "EUR" },
          },
          now: NOW,
        }),
      ),
    ).toBe("DISCOUNT_EXCEEDED");
  });

  it("refuses an unreadable mandate expiry and an out-of-range rate", () => {
    const totals = quote({ lineDiscountBasisPoints: 500 });
    expect(
      codeOf(() =>
        assertDiscountWithinMandate({
          quote: totals,
          mandate: { ...mandate, expiresAt: "eventually" },
          now: NOW,
        }),
      ),
    ).toBe("MANDATE_EXPIRED");
    expect(
      codeOf(() =>
        assertDiscountWithinMandate({
          quote: totals,
          mandate: { ...mandate, maxRateBasisPoints: 10_001 },
          now: NOW,
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("treats a quote with no discount as clean", () => {
    expect(quoteHasNoDiscounts(quote())).toBe(true);
  });
});
