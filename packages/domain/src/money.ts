import Decimal from "decimal.js";
import {
  MoneySchema,
  QuantitySchema,
  RoundingPolicySchema,
  ServiceError,
  type Money,
  type RoundingPolicy,
} from "@agntia-ventas/contracts";

/**
 * Deterministic money core. All arithmetic is decimal, never binary float:
 * a JS `number` cannot represent 0.1 exactly and money commitments must be
 * reproducible (docs/09-evaluacion.md, docs/architecture/04-runtime.md).
 */
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

const MAX_FRACTIONAL_DIGITS = 8;

function toDecimal(amount: string): Decimal {
  const parsed = MoneySchema.shape.amount.safeParse(amount);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_FAILED", "amount is not an exact decimal", {
      details: { field: "amount" },
    });
  }
  return new Decimal(amount);
}

function fractionalDigits(amount: string): number {
  const index = amount.indexOf(".");
  return index === -1 ? 0 : amount.length - index - 1;
}

function assertCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "cannot combine different currencies", {
      details: { left: left.currency, right: right.currency },
    });
  }
}

function materialize(value: Decimal, currency: string, digits: number): Money {
  if (!value.isFinite()) {
    throw new ServiceError("VALIDATION_FAILED", "non-finite money value");
  }
  const scale = Math.min(Math.max(digits, 0), MAX_FRACTIONAL_DIGITS);
  if (value.decimalPlaces() > MAX_FRACTIONAL_DIGITS) {
    throw new ServiceError("ROUNDING_UNSUPPORTED", "result exceeds 8 fractional digits", {
      details: { decimalPlaces: value.decimalPlaces() },
    });
  }
  return { amount: value.toFixed(scale), currency, exponent: scale };
}

const ROUNDING_MODES: Record<RoundingPolicy["rounding"], Decimal.Rounding> = {
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  DOWN: Decimal.ROUND_DOWN,
  UP: Decimal.ROUND_UP,
};

export function addMoney(left: Money, right: Money): Money {
  assertCurrency(left, right);
  const digits = Math.max(fractionalDigits(left.amount), fractionalDigits(right.amount));
  return materialize(toDecimal(left.amount).plus(toDecimal(right.amount)), left.currency, digits);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertCurrency(left, right);
  const digits = Math.max(fractionalDigits(left.amount), fractionalDigits(right.amount));
  return materialize(
    toDecimal(left.amount).minus(toDecimal(right.amount)),
    left.currency,
    digits,
  );
}

export function sumMoney(items: readonly Money[]): Money {
  const first = items[0];
  if (!first) {
    throw new ServiceError("VALIDATION_FAILED", "cannot sum an empty money list");
  }
  return items.slice(1).reduce((total, next) => addMoney(total, next), first);
}

export function isZeroMoney(value: Money): boolean {
  return toDecimal(value.amount).isZero();
}

/**
 * quantity x unit price, rounded only once with the versioned policy. The
 * policy is part of the calculation input so the same quote always produces
 * the same totals.
 */
export function multiplyMoney(
  unitPrice: Money,
  quantity: string,
  policy: RoundingPolicy,
): Money {
  const parsedPolicy = RoundingPolicySchema.safeParse(policy);
  if (!parsedPolicy.success) {
    throw new ServiceError("ROUNDING_UNSUPPORTED", "invalid rounding policy", {
      details: { issues: parsedPolicy.error.issues.map((issue) => issue.message) },
    });
  }
  const parsedQuantity = QuantitySchema.safeParse(quantity);
  if (!parsedQuantity.success) {
    throw new ServiceError("QUANTITY_INVALID", "quantity must be a non-negative exact decimal", {
      details: { quantity },
    });
  }
  const quantityDecimal = new Decimal(quantity);
  if (quantityDecimal.isZero()) {
    throw new ServiceError("QUANTITY_INVALID", "quantity must be greater than zero", {
      details: { quantity },
    });
  }
  const exact = toDecimal(unitPrice.amount).times(quantityDecimal);
  const rounded = exact.toDecimalPlaces(
    parsedPolicy.data.exponent,
    ROUNDING_MODES[parsedPolicy.data.rounding],
  );
  return {
    amount: rounded.toFixed(parsedPolicy.data.exponent),
    currency: unitPrice.currency,
    exponent: parsedPolicy.data.exponent,
  };
}

export function roundMoney(value: Money, policy: RoundingPolicy): Money {
  const parsedPolicy = RoundingPolicySchema.safeParse(policy);
  if (!parsedPolicy.success) {
    throw new ServiceError("ROUNDING_UNSUPPORTED", "invalid rounding policy");
  }
  const rounded = toDecimal(value.amount).toDecimalPlaces(
    parsedPolicy.data.exponent,
    ROUNDING_MODES[parsedPolicy.data.rounding],
  );
  return {
    amount: rounded.toFixed(parsedPolicy.data.exponent),
    currency: value.currency,
    exponent: parsedPolicy.data.exponent,
  };
}

/** Percentage discount expressed in basis points, applied with the policy. */
export function applyDiscountBasisPoints(
  base: Money,
  basisPoints: number,
  policy: RoundingPolicy,
): Money {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new ServiceError("VALIDATION_FAILED", "basisPoints must be an integer in [0,10000]");
  }
  const factor = new Decimal(basisPoints).dividedBy(10_000);
  const discounted = toDecimal(base.amount).times(new Decimal(1).minus(factor));
  const rounded = discounted.toDecimalPlaces(
    policy.exponent,
    ROUNDING_MODES[policy.rounding],
  );
  return {
    amount: rounded.toFixed(policy.exponent),
    currency: base.currency,
    exponent: policy.exponent,
  };
}
