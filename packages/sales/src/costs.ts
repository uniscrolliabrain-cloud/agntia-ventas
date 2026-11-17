import Decimal from "decimal.js";
import { ServiceError, type Money, type RoundingPolicy } from "@agntia-ventas/contracts";

export interface ModelPrice {
  readonly modelRef: string;
  readonly inputPerMillion: Money;
  readonly outputPerMillion: Money;
  readonly effectiveFrom: string;
}

const PRICE_TABLE_EXPONENT = 6;

/** Deterministic estimate: tokens x price per million, rounded by policy. */
export function estimateModelCost(input: {
  readonly price: ModelPrice;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly policy: RoundingPolicy;
}): Money {
  const { price } = input;
  if (price.inputPerMillion.currency !== price.outputPerMillion.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "model prices must share a currency");
  }
  for (const value of [input.inputTokens, input.outputTokens]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new ServiceError("VALIDATION_FAILED", "token counts must be non-negative integers");
    }
  }

  const million = new Decimal(1_000_000);
  const cost = new Decimal(price.inputPerMillion.amount)
    .times(input.inputTokens)
    .dividedBy(million)
    .plus(new Decimal(price.outputPerMillion.amount).times(input.outputTokens).dividedBy(million))
    .toDecimalPlaces(
      Math.min(input.policy.exponent, PRICE_TABLE_EXPONENT),
      Decimal.ROUND_HALF_UP,
    );

  return { amount: cost.toFixed(Math.min(input.policy.exponent, PRICE_TABLE_EXPONENT)), currency: price.inputPerMillion.currency };
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
  const ceiling = new Decimal(input.ceiling.amount);
  const spent = new Decimal(input.spent.amount).plus(input.cost.amount);

  return {
    spent: { amount: spent.toFixed(PRICE_TABLE_EXPONENT), currency: input.ceiling.currency },
    remaining: {
      amount: ceiling.minus(spent).toFixed(PRICE_TABLE_EXPONENT),
      currency: input.ceiling.currency,
    },
    exceeded: spent.greaterThan(ceiling),
  };
}
