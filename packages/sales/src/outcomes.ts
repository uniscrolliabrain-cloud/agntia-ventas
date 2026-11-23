import Decimal from "decimal.js";
import { MoneySchema, ServiceError, type Money } from "@agntia-ventas/contracts";
import { addMoney, sumMoney } from "@agntia-ventas/domain";
import type {
  ActivityRecord,
  ForecastScenario,
  ForecastSnapshot,
  Stage,
} from "./models.ts";

const TERMINAL: ReadonlySet<Stage> = new Set(["won_verified", "lost", "opted_out"]);

function fractionalDigits(amount: string): number {
  const dot = amount.indexOf(".");
  return dot === -1 ? 0 : amount.length - dot - 1;
}

/**
 * A planned call is not a call. Only a verified receipt confirms an activity;
 * a provider without confirmation stays unknown.
 */
export function recordActivity(input: {
  id: string;
  tenantId: string;
  kind: ActivityRecord["kind"];
  occurredAt: string;
  receiptRef?: string;
}): ActivityRecord {
  if (!input.id || !input.tenantId) {
    throw new ServiceError("VALIDATION_FAILED", "activity needs an id and a tenant");
  }
  // An unreadable timestamp cannot be ordered against a receipt or a window.
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new ServiceError("VALIDATION_FAILED", "activity time is unreadable", {
      details: { occurredAt: input.occurredAt },
    });
  }
  return {
    id: input.id,
    tenantId: input.tenantId,
    kind: input.kind,
    occurredAt: input.occurredAt,
    status: input.receiptRef ? "confirmed" : "outcome_unknown",
    ...(input.receiptRef ? { receiptRef: input.receiptRef } : {}),
  };
}

/**
 * Forecast is a scenario snapshot, never collected revenue. Pipeline is split
 * into gross and weighted, and the probability version is explicit.
 */
export function buildForecast(input: {
  id: string;
  probabilityVersion: string;
  scenarios: readonly ForecastScenario[];
  accountsWithAmount: number;
  accountsTotal: number;
}): ForecastSnapshot {
  if (input.scenarios.length === 0) {
    throw new ServiceError("VALIDATION_FAILED", "forecast needs at least one scenario");
  }
  for (const [label, value] of [
    ["accountsWithAmount", input.accountsWithAmount],
    ["accountsTotal", input.accountsTotal],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        "coverage counts must be non-negative integers",
        { details: { field: label } },
      );
    }
  }
  if (input.accountsWithAmount > input.accountsTotal) {
    throw new ServiceError("VALIDATION_FAILED", "coverage cannot exceed total accounts");
  }

  const currency = input.scenarios[0]?.amount.currency;
  if (!currency) {
    throw new ServiceError("VALIDATION_FAILED", "forecast scenario without amount");
  }

  let weightedTotal = new Decimal(0);
  // The weighted total keeps the currency's declared display scale: a fixed two
  // decimals turned a zero-decimal currency (JPY) into cents.
  const declaredScales = input.scenarios
    .map((scenario) => scenario.amount.exponent)
    .filter((exponent): exponent is number => exponent !== undefined);
  const scale =
    declaredScales.length > 0
      ? Math.max(...declaredScales)
      : Math.max(...input.scenarios.map((scenario) => fractionalDigits(scenario.amount.amount)));
  for (const scenario of input.scenarios) {
    if (scenario.amount.currency !== currency) {
      throw new ServiceError("CURRENCY_MISMATCH", "forecast mixes currencies");
    }
    // A negative scenario would subtract pipeline from the weighted total, and
    // an unreadable amount throws inside decimal.js instead of the contract.
    const amount = MoneySchema.safeParse(scenario.amount);
    if (!amount.success) {
      throw new ServiceError("VALIDATION_FAILED", "forecast amount is not an exact decimal", {
        details: { stage: scenario.stage },
      });
    }
    if (new Decimal(amount.data.amount).isNegative()) {
      throw new ServiceError("VALIDATION_FAILED", "forecast amount cannot be negative", {
        details: { stage: scenario.stage },
      });
    }
    if (
      !Number.isInteger(scenario.probabilityBasisPoints) ||
      scenario.probabilityBasisPoints < 0 ||
      scenario.probabilityBasisPoints > 10_000
    ) {
      throw new ServiceError("VALIDATION_FAILED", "probability out of range", {
        details: { stage: scenario.stage },
      });
    }
    weightedTotal = weightedTotal.plus(
      new Decimal(amount.data.amount)
        .times(scenario.probabilityBasisPoints)
        .dividedBy(10_000),
    );
  }

  const gross = sumMoney(
    input.scenarios.map((scenario) => scenario.amount as Money),
  );

  return {
    id: input.id,
    probabilityVersion: input.probabilityVersion,
    coverage: {
      accountsWithAmount: input.accountsWithAmount,
      accountsTotal: input.accountsTotal,
    },
    gross,
    weighted: {
      amount: weightedTotal.toFixed(scale),
      currency,
      exponent: scale,
    },
    scenarios: [...input.scenarios],
    isRevenue: false,
  };
}

export interface ConversionMetric {
  readonly cohort: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly denominator: number;
  readonly won: number;
  readonly rateBasisPoints: number | null;
  readonly duplicatesRemoved: number;
}

/**
 * Conversion has a denominator, a window and a cohort. Duplicate wins are
 * removed instead of inflating the rate, and a zero denominator yields `null`.
 */
export function computeConversion(input: {
  cohort: string;
  windowStart: string;
  windowEnd: string;
  denominator: number;
  wonIds: readonly string[];
}): ConversionMetric {
  if (input.denominator < 0 || !Number.isInteger(input.denominator)) {
    throw new ServiceError("VALIDATION_FAILED", "denominator must be a non-negative integer");
  }
  // A metric with an unreadable or inverted window is not measurable data.
  const windowStart = Date.parse(input.windowStart);
  const windowEnd = Date.parse(input.windowEnd);
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
    throw new ServiceError("VALIDATION_FAILED", "conversion window is unreadable");
  }
  if (windowEnd <= windowStart) {
    throw new ServiceError("VALIDATION_FAILED", "conversion window must end after it starts");
  }
  const unique = new Set(input.wonIds);
  const won = unique.size;
  const duplicatesRemoved = input.wonIds.length - won;
  if (won > input.denominator) {
    throw new ServiceError("VALIDATION_FAILED", "won exceeds denominator");
  }
  return {
    cohort: input.cohort,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    denominator: input.denominator,
    won,
    rateBasisPoints:
      input.denominator === 0
        ? null
        : Math.round((won / input.denominator) * 10_000),
    duplicatesRemoved,
  };
}

export interface ReportSnapshot {
  readonly id: string;
  readonly figures: Readonly<Record<string, number | null>>;
  readonly missing: readonly string[];
  readonly stale: boolean;
  readonly generatedAt: string;
}

/**
 * A report shows `null` for data it does not have. It never fills a figure to
 * look complete, and it declares staleness instead of hiding it.
 */
export function buildReportSnapshot(input: {
  id: string;
  generatedAt: string;
  figures: Readonly<Record<string, number | undefined>>;
  required: readonly string[];
  stale: boolean;
}): ReportSnapshot {
  const figures: Record<string, number | null> = {};
  const missing: string[] = [];
  for (const key of input.required) {
    const value = input.figures[key];
    if (value === undefined) {
      figures[key] = null;
      missing.push(key);
    } else {
      // A NaN or an infinity rendered as a real figure in the dashboard.
      if (!Number.isFinite(value)) {
        throw new ServiceError("VALIDATION_FAILED", "report figure is not a finite number", {
          details: { key },
        });
      }
      figures[key] = value;
    }
  }
  return {
    id: input.id,
    figures,
    missing,
    stale: input.stale,
    generatedAt: input.generatedAt,
  };
}

/** Booked, won, recognized and collected are different facts, never aliases. */
export function assertRevenueTerms(input: {
  booked?: Money;
  won?: Money;
  recognized?: Money;
  collected?: Money;
}): void {
  const provided = Object.values(input).filter((value): value is Money => Boolean(value));
  if (provided.length === 0) {
    throw new ServiceError("VALIDATION_FAILED", "no revenue figure provided");
  }
  const currency = provided[0]?.currency;
  if (provided.some((value) => value.currency !== currency)) {
    throw new ServiceError("CURRENCY_MISMATCH", "revenue figures mix currencies");
  }
  void addMoney;
}

export function isTerminalStage(stage: Stage): boolean {
  return TERMINAL.has(stage);
}
