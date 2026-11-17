import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { ServiceError } from "@agntia-ventas/contracts";
import type { CommercialRepository, QuoteRecord } from "@agntia-ventas/persistence";
import type { AppDependencies, AppEnvironment } from "./auth.ts";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,2048}\.[a-f0-9]{64}$/;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Read-only portal link: tenant + quote + expiry, signed server-side. */
export function createPortalToken(input: {
  readonly secret: string;
  readonly tenantId: string;
  readonly quoteId: string;
  readonly expiresAt: string;
}): string {
  const payload = Buffer.from(
    JSON.stringify({ t: input.tenantId, q: input.quoteId, e: input.expiresAt }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(input.secret, payload)}`;
}

export function verifyPortalToken(input: {
  readonly token: string;
  readonly secret: string | null;
  readonly now: string;
}): { readonly tenantId: string; readonly quoteId: string; readonly expiresAt: string } {
  if (!input.secret) {
    throw new ServiceError("PROVIDER_NOT_CONFIGURED", "portal link signing is not configured");
  }
  if (!TOKEN_PATTERN.test(input.token)) {
    throw new ServiceError("AUTH_INVALID", "portal token is malformed");
  }
  const [payload, signature] = input.token.split(".") as [string, string];
  const expected = sign(input.secret, payload);
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new ServiceError("AUTH_INVALID", "portal token signature does not match");
  }

  let claims: { t: string; q: string; e: string };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ServiceError("AUTH_INVALID", "portal token payload is unreadable");
  }
  if (new Date(claims.e).getTime() <= new Date(input.now).getTime()) {
    throw new ServiceError("AUTH_EXPIRED", "portal link expired");
  }
  return { tenantId: claims.t, quoteId: claims.q, expiresAt: claims.e };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PAGE_STYLE = `body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f6f7f9;color:#111}
main{max-width:40rem;margin:0 auto;padding:2rem 1rem 3rem}
.card{background:#fff;border:1px solid #e2e5ea;border-radius:12px;padding:1.5rem}
h1{font-size:1.35rem;margin:0 0 .25rem}
p.muted{color:#5b6472;margin:.25rem 0 1.25rem}
table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{text-align:left;padding:.5rem 0;border-bottom:1px solid #eceff3}
td.amount{text-align:right;font-variant-numeric:tabular-nums}
.total td{font-weight:600;border-bottom:none}
.notice{margin-top:1.25rem;font-size:.875rem;color:#5b6472}
@media(max-width:480px){main{padding:1rem .75rem 2rem}.card{padding:1rem}}`;

function renderQuotePage(input: {
  readonly quote: QuoteRecord;
  readonly expiresAt: string;
}): string {
  const amount = (value: string): string =>
    `${escapeHtml(input.quote.currency)} ${escapeHtml(value)}`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cotización ${escapeHtml(input.quote.id)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
<section class="card">
<h1>Cotización ${escapeHtml(input.quote.id)}</h1>
<p class="muted">Pricebook ${escapeHtml(input.quote.priceBookVersion)} · válida hasta ${escapeHtml(input.expiresAt)}</p>
<table>
<tbody>
<tr><th>Subtotal</th><td class="amount">${amount(input.quote.subtotal)}</td></tr>
<tr><th>Descuento</th><td class="amount">−${escapeHtml(input.quote.discount)}</td></tr>
<tr><th>Impuestos</th><td class="amount">${amount(input.quote.tax)}</td></tr>
<tr class="total"><th>Total</th><td class="amount">${amount(input.quote.total)}</td></tr>
</tbody>
</table>
<p class="notice">Vista de solo lectura. En el piloto este enlace no firma, no cobra y no envía nada: cualquier aceptación pasa por una persona.</p>
</section>
</main>
</body>
</html>`;
}

/**
 * Portal shell (C34): a signed, expiring, read-only quote page. Chat and
 * avatar/presence are not enabled here, and the page never carries a token,
 * signature or payment action.
 */
export function registerPortalRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
  app.get("/portal/quotes/:id", (context) => {
    const stores: CommercialRepository | undefined = dependencies.commercial;
    if (!stores) {
      throw new ServiceError("DEPENDENCY_UNAVAILABLE", "portal storage is not configured");
    }
    const token = context.req.query("token") ?? "";
    const now = new Date().toISOString();
    const claims = verifyPortalToken({
      token,
      secret: dependencies.portalSecret ?? null,
      now,
    });
    const quoteId = context.req.param("id");
    if (!quoteId || claims.quoteId !== quoteId) {
      throw new ServiceError("NOT_FOUND", "quote not found");
    }

    return stores.quotes
      .find({ tenantId: claims.tenantId, id: quoteId })
      .then((quote) => {
        if (!quote) {
          throw new ServiceError("NOT_FOUND", "quote not found");
        }
        return context.html(
          renderQuotePage({ quote, expiresAt: claims.expiresAt }),
          200,
          {
            "content-security-policy":
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          },
        );
      });
  });
}
