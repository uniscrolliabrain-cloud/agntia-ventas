import type { Money } from "@agntia-ventas/contracts";
import type { ForecastSnapshot } from "./models.ts";
import type { ConversionMetric, ReportSnapshot } from "./outcomes.ts";

// ---------------------------------------------------------------------------
// C33 — reports and dashboard
// ---------------------------------------------------------------------------

/**
 * Server-rendered, read-only dashboard. No JavaScript, no external assets and
 * no inline event handlers: every dynamic value is HTML-escaped and a missing
 * figure is shown as "sin dato", never as a zero.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export const DASHBOARD_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
} as const;

export interface DashboardInput {
  readonly tenantLabel: string;
  readonly generatedAt: string;
  readonly report: ReportSnapshot;
  readonly forecast?: ForecastSnapshot | null;
  readonly conversions?: readonly ConversionMetric[] | null;
}

function formatMoney(money: Money | null | undefined): string {
  if (!money) return '<span class="missing">sin dato</span>';
  return escapeHtml(`${money.amount} ${money.currency}`);
}

function formatFigure(value: number | null): string {
  return value === null ? '<span class="missing">sin dato</span>' : escapeHtml(String(value));
}

function formatRate(value: number | null): string {
  if (value === null) return '<span class="missing">sin denominador</span>';
  return escapeHtml(`${(value / 100).toFixed(2)} % (${value} bps)`);
}

function renderForecast(forecast: ForecastSnapshot | null | undefined): string {
  if (!forecast) {
    return '<p class="missing">Sin previsión calculada para este periodo.</p>';
  }
  const scenarios = forecast.scenarios
    .map(
      (scenario) =>
        `<tr><td>${escapeHtml(scenario.stage)}</td><td>${formatMoney(scenario.amount)}</td><td>${escapeHtml(
          `${(scenario.probabilityBasisPoints / 100).toFixed(2)} %`,
        )}</td></tr>`,
    )
    .join("");

  return `
    <section>
      <h2>Previsión (no es ingreso)</h2>
      <p class="note">Versión de probabilidad: ${escapeHtml(forecast.probabilityVersion)}. Cobertura: ${escapeHtml(
        `${forecast.coverage.accountsWithAmount}/${forecast.coverage.accountsTotal} cuentas con importe`,
      )}.</p>
      <dl>
        <dt>Bruto</dt><dd>${formatMoney(forecast.gross)}</dd>
        <dt>Ponderado</dt><dd>${formatMoney(forecast.weighted)}</dd>
      </dl>
      <table>
        <caption>Escenarios por etapa</caption>
        <thead><tr><th>Etapa</th><th>Importe</th><th>Probabilidad</th></tr></thead>
        <tbody>${scenarios}</tbody>
      </table>
    </section>`;
}

function renderConversions(
  conversions: readonly ConversionMetric[] | null | undefined,
): string {
  if (!conversions || conversions.length === 0) {
    return '<p class="missing">Sin métricas de conversión para este periodo.</p>';
  }
  const rows = conversions
    .map(
      (metric) =>
        `<tr><td>${escapeHtml(metric.cohort)}</td><td>${escapeHtml(
          `${metric.windowStart} — ${metric.windowEnd}`,
        )}</td><td>${escapeHtml(String(metric.won))}/${escapeHtml(
          String(metric.denominator),
        )}</td><td>${formatRate(metric.rateBasisPoints)}</td><td>${escapeHtml(
          String(metric.duplicatesRemoved),
        )}</td></tr>`,
    )
    .join("");
  return `
    <table>
      <caption>Conversión por cohorte</caption>
      <thead><tr><th>Cohorte</th><th>Ventana</th><th>Ganados</th><th>Tasa</th><th>Duplicados descartados</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderFigures(report: ReportSnapshot): string {
  const rows = Object.entries(report.figures)
    .map(
      ([key, value]) =>
        `<tr><td>${escapeHtml(key)}</td><td>${formatFigure(value)}</td></tr>`,
    )
    .join("");
  const missing =
    report.missing.length === 0
      ? ""
      : `<p class="note">Datos ausentes: ${escapeHtml(report.missing.join(", "))}.</p>`;
  return `
    <section>
      <h2>Cifras del periodo</h2>
      <table>
        <caption>Indicadores</caption>
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${missing}
    </section>`;
}

export function renderDashboardHtml(input: DashboardInput): string {
  const stale = input.report.stale
    ? '<p class="stale" role="status">Datos marcados como obsoletos: no usar para decidir.</p>'
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Panel de ventas — ${escapeHtml(input.tenantLabel)}</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; line-height: 1.45; }
main { max-width: 60rem; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
h2 { font-size: 1.1rem; margin: 1.75rem 0 .5rem; }
header p, .note { color: #555; margin: .25rem 0; }
.stale { background: #fff3cd; border: 1px solid #b8860b; color: #4a3200; padding: .6rem .8rem; border-radius: .35rem; }
.missing { color: #8a1c1c; font-style: italic; }
table { border-collapse: collapse; width: 100%; margin-top: .5rem; }
caption { text-align: left; font-weight: 600; padding-bottom: .35rem; }
th, td { border-bottom: 1px solid #ccc; padding: .4rem .5rem; text-align: left; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: .25rem 1rem; margin: .5rem 0; }
dt { font-weight: 600; }
@media (max-width: 40rem) { body { padding: 1rem; } th, td { font-size: .9rem; } }
</style>
</head>
<body>
<main>
<header>
<h1>Panel de ventas</h1>
<p>${escapeHtml(input.tenantLabel)} · generado ${escapeHtml(input.generatedAt)}</p>
</header>
${stale}
${renderFigures(input.report)}
${renderForecast(input.forecast)}
<section>
<h2>Conversión</h2>
${renderConversions(input.conversions)}
</section>
<footer>
<p class="note">Solo lectura. Previsión no es ingreso reconocido ni cobrado.</p>
</footer>
</main>
</body>
</html>
`;
}

/** The renderer exists; live data binding and charts do not. */
export const DASHBOARD_STATUS = {
  renderer: "implemented",
  liveData: "NOT_CONFIGURED",
  charts: "STUB",
} as const;
