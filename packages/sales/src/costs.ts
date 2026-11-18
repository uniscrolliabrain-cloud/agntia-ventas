import Decimal from "decimal.js";
import {
  MoneySchema,
  RoundingPolicySchema,
  ServiceError,
  type Money,
  type RoundingPolicy,
} from "@agntia-ventas/contracts";
import { decimalRounding } from "@agntia-ventas/domain";

export interface ModelPrice {
  readonly modelRef: string;
  readonly inputPerMillion: Money;
  readonly outputPerMillion: Money;
  readonly effectiveFrom: string;
}

const PRICE_TABLE_EXPONENT = 6;

/**
 * A cost table is money too: an unreadable amount must not reach decimal.js
 * (it throws a driver error, not a contract error) and a negative price would
 * turn a spend into a credit.
 */
function requireNonNegativeMoney(value: Money, field: string): Decimal {
  const parsed = MoneySchema.safeParse(value);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_FAILED", "money value is not an exact decimal", {
      details: { field },
    });
  }
  const decimal = new Decimal(parsed.data.amount);
  if (decimal.isNegative()) {
    throw new ServiceError("VALIDATION_FAILED", "money value cannot be negative", {
      details: { field },
    });
  }
  return decimal;
}

/** Deterministic estimate: tokens x price per million, rounded by policy. */
export function estimateModelCost(input: {
  readonly price: ModelPrice;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly policy: RoundingPolicy;
}): Money {
  const { price } = input;
  const policy = RoundingPolicySchema.safeParse(input.policy);
  if (!policy.success) {
    throw new ServiceError("ROUNDING_UNSUPPORTED", "invalid rounding policy", {
      details: { issues: policy.error.issues.map((issue) => issue.message) },
    });
  }
  if (price.inputPerMillion.currency !== price.outputPerMillion.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "model prices must share a currency");
  }
  for (const value of [input.inputTokens, input.outputTokens]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new ServiceError("VALIDATION_FAILED", "token counts must be non-negative integers");
    }
  }

  const inputPrice = requireNonNegativeMoney(price.inputPerMillion, "inputPerMillion");
  const outputPrice = requireNonNegativeMoney(price.outputPerMillion, "outputPerMillion");

  // The declared policy is the whole policy: rounding half-up regardless of it
  // made a DOWN/HALF_EVEN cost table silently over-charge.
  const exponent = Math.min(policy.data.exponent, PRICE_TABLE_EXPONENT);
  const million = new Decimal(1_000_000);
  const cost = inputPrice
    .times(input.inputTokens)
    .dividedBy(million)
    .plus(outputPrice.times(input.outputTokens).dividedBy(million))
    .toDecimalPlaces(exponent, decimalRounding(policy.data.rounding));

  return {
    amount: cost.toFixed(exponent),
    currency: price.inputPerMillion.currency,
  };
}

export interface BudgetUsage {
  readonly spent: Money;
  readonly remaining: Money;
  readonly exceeded: boolean;
}

/** A single ceiling per run: spending is checked before the call, not after. */
export function consumeModelBudget(input: {
  readonly ceiling: Money;
  readonly spent: Money;
  readonly cost: Money;
}): BudgetUsage {
  if (
    input.ceiling.currency !== input.spent.currency ||
    input.ceiling.currency !== input.cost.currency
  ) {
    throw new ServiceError("CURRENCY_MISMATCH", "budget must share one currency");
  }
  // A negative cost would increase the remaining balance and let a run spend
  // past its ceiling; an unreadable amount crashes inside decimal.js.
  const ceiling = requireNonNegativeMoney(input.ceiling, "ceiling");
  const spentBefore = requireNonNegativeMoney(input.spent, "spent");
  const cost = requireNonNegativeMoney(input.cost, "cost");
  const spent = spentBefore.plus(cost);

  return {
    spent: { amount: spent.toFixed(PRICE_TABLE_EXPONENT), currency: input.ceiling.currency },
    remaining: {
      amount: ceiling.minus(spent).toFixed(PRICE_TABLE_EXPONENT),
      currency: input.ceiling.currency,
    },
    exceeded: spent.greaterThan(ceiling),
  };
}
