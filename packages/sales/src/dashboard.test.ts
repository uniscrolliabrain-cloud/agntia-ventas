import { describe, expect, it } from "vitest";
import {
  DASHBOARD_HEADERS,
  DASHBOARD_STATUS,
  escapeHtml,
  renderDashboardHtml,
} from "./dashboard.ts";
import { buildForecast, buildReportSnapshot, computeConversion } from "./outcomes.ts";

const report = buildReportSnapshot({
  id: "report-01",
  generatedAt: "2026-11-18T09:00:00Z",
  figures: { pipeline: 12, won: 3, collected: undefined },
  required: ["pipeline", "won", "collected"],
  stale: true,
});

const forecast = buildForecast({
  id: "forecast-01",
  probabilityVersion: "p-2026-11",
  accountsWithAmount: 2,
  accountsTotal: 3,
  scenarios: [
    { stage: "proposal_draft", amount: { amount: "1000.00", currency: "EUR" }, probabilityBasisPoints: 2500 },
    { stage: "negotiating", amount: { amount: "500.00", currency: "EUR" }, probabilityBasisPoints: 6000 },
  ],
});

const conversion = computeConversion({
  cohort: "2026-Q4",
  windowStart: "2026-10-01",
  windowEnd: "2026-12-31",
  denominator: 4,
  wonIds: ["opp-1", "opp-1", "opp-2"],
});

describe("dashboard renderer", () => {
  it("renders figures, missing data and the stale banner", () => {
    const html = renderDashboardHtml({
      tenantLabel: "Tenant Alpha",
      generatedAt: "2026-11-18T09:05:00Z",
      report,
      forecast,
      conversions: [conversion],
    });

    expect(html).toContain("Tenant Alpha");
    expect(html).toContain("sin dato");
    expect(html).toContain("obsoletos");
    expect(html).toContain("no es ingreso");
    expect(html).toContain("550.00");
    expect(html).toContain("2/4");
  });

  it("escapes every dynamic value and ships no script", () => {
    const html = renderDashboardHtml({
      tenantLabel: '<script>alert("x")</script>',
      generatedAt: "2026-11-18T09:05:00Z",
      report,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Sin previsión calculada");
    expect(DASHBOARD_HEADERS["content-security-policy"]).toContain("default-src 'none'");
    expect(DASHBOARD_HEADERS["content-security-policy"]).not.toContain("script-src");
    expect(DASHBOARD_HEADERS["cache-control"]).toBe("no-store");
  });

  it("shows an explicit gap when there is no conversion denominator", () => {
    const empty = computeConversion({
      cohort: "2026-Q4",
      windowStart: "2026-10-01",
      windowEnd: "2026-12-31",
      denominator: 0,
      wonIds: [],
    });
    const html = renderDashboardHtml({
      tenantLabel: "Tenant Alpha",
      generatedAt: "2026-11-18T09:05:00Z",
      report,
      conversions: [empty],
    });
    expect(html).toContain("sin denominador");
    expect(escapeHtml("a&b")).toBe("a&amp;b");
    expect(DASHBOARD_STATUS.charts).toBe("STUB");
  });
});
