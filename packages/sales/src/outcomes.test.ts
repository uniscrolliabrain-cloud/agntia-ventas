import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  assertRevenueTerms,
  buildForecast,
  buildReportSnapshot,
  computeConversion,
  recordActivity,
} from "./outcomes.ts";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("activity", () => {
  it("does not confirm an activity without a receipt", () => {
    expect(
      recordActivity({
        id: "activity-01",
        tenantId: "tenant-alpha-01",
        kind: "call",
        occurredAt: "2026-11-15T10:00:00Z",
      }).status,
    ).toBe("outcome_unknown");
  });

  it("confirms with a receipt", () => {
    const activity = recordActivity({
      id: "activity-02",
      tenantId: "tenant-alpha-01",
      kind: "email",
      occurredAt: "2026-11-15T10:00:00Z",
      receiptRef: "receipt-01",
    });
    expect(activity.status).toBe("confirmed");
    expect(activity.receiptRef).toBe("receipt-01");
  });
});

describe("forecast", () => {
  it("separates gross and weighted and never claims revenue", () => {
    const forecast = buildForecast({
      id: "forecast-01",
      probabilityVersion: "p-2026-11",
      scenarios: [
        { stage: "qualified", amount: { amount: "100.00", currency: "EUR" }, probabilityBasisPoints: 5000 },
        { stage: "negotiating", amount: { amount: "200.00", currency: "EUR" }, probabilityBasisPoints: 2500 },
      ],
      accountsWithAmount: 2,
      accountsTotal: 3,
    });

    expect(forecast.gross.amount).toBe("300.00");
    expect(forecast.weighted.amount).toBe("100.00");
    expect(forecast.coverage).toEqual({ accountsWithAmount: 2, accountsTotal: 3 });
    expect(forecast.probabilityVersion).toBe("p-2026-11");
    expect(forecast.isRevenue).toBe(false);
  });

  it("rejects out-of-range probabilities, mixed currencies and impossible coverage", () => {
    expect(
      codeOf(() =>
        buildForecast({
          id: "forecast-02",
          probabilityVersion: "p",
          scenarios: [
            { stage: "qualified", amount: { amount: "10.00", currency: "EUR" }, probabilityBasisPoints: 10_001 },
          ],
          accountsWithAmount: 1,
          accountsTotal: 1,
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    expect(
      codeOf(() =>
        buildForecast({
          id: "forecast-03",
          probabilityVersion: "p",
          scenarios: [
            { stage: "qualified", amount: { amount: "10.00", currency: "EUR" }, probabilityBasisPoints: 5000 },
            { stage: "negotiating", amount: { amount: "10.00", currency: "USD" }, probabilityBasisPoints: 5000 },
          ],
          accountsWithAmount: 1,
          accountsTotal: 1,
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");

    expect(
      codeOf(() =>
        buildForecast({
          id: "forecast-04",
          probabilityVersion: "p",
          scenarios: [
            { stage: "qualified", amount: { amount: "10.00", currency: "EUR" }, probabilityBasisPoints: 5000 },
          ],
          accountsWithAmount: 4,
          accountsTotal: 3,
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    expect(
      codeOf(() =>
        buildForecast({
          id: "forecast-05",
          probabilityVersion: "p",
          scenarios: [
            { stage: "qualified", amount: { amount: "10.00", currency: "EUR" }, probabilityBasisPoints: 5000 },
          ],
          accountsWithAmount: -1,
          accountsTotal: 0,
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("conversion metrics", () => {
  it("removes duplicate wins and reports the denominator", () => {
    const metric = computeConversion({
      cohort: "2026-Q4",
      windowStart: "2026-10-01T00:00:00Z",
      windowEnd: "2026-12-31T23:59:59Z",
      denominator: 40,
      wonIds: ["won-01", "won-01", "won-02"],
    });

    expect(metric.won).toBe(2);
    expect(metric.duplicatesRemoved).toBe(1);
    expect(metric.rateBasisPoints).toBe(500);
  });

  it("returns null for a zero denominator and rejects impossible wins", () => {
    expect(
      computeConversion({
        cohort: "empty",
        windowStart: "2026-01-01T00:00:00Z",
        windowEnd: "2026-12-31T23:59:59Z",
        denominator: 0,
        wonIds: [],
      }).rateBasisPoints,
    ).toBeNull();

    expect(
      codeOf(() =>
        computeConversion({
          cohort: "bad",
          windowStart: "2026-01-01T00:00:00Z",
          windowEnd: "2026-12-31T23:59:59Z",
          denominator: 1,
          wonIds: ["a", "b"],
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("report snapshots", () => {
  it("shows null for missing figures and declares staleness", () => {
    const snapshot = buildReportSnapshot({
      id: "report-01",
      generatedAt: "2026-11-15T10:00:00Z",
      figures: { pipeline_gross: 300, won: 2 },
      required: ["pipeline_gross", "won", "collected"],
      stale: true,
    });

    expect(snapshot.figures["pipeline_gross"]).toBe(300);
    expect(snapshot.figures["collected"]).toBeNull();
    expect(snapshot.missing).toEqual(["collected"]);
    expect(snapshot.stale).toBe(true);
  });

  it("keeps revenue terms distinct and currency-honest", () => {
    expect(() => assertRevenueTerms({})).toThrow();
    expect(
      codeOf(() =>
        assertRevenueTerms({
          booked: { amount: "10.00", currency: "EUR" },
          collected: { amount: "10.00", currency: "USD" },
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");
  });
});
