import { describe, expect, it } from "vitest";
import { ServiceError, type Membership } from "@agntia-ventas/contracts";
import type {
  ApprovalRecord,
  CommercialRepository,
  QuoteRecord,
} from "@agntia-ventas/persistence";
import type { VerifiedClaims } from "@agntia-ventas/identity";
import { createApp } from "./app.ts";
import { createPortalToken, verifyPortalToken } from "./portal.ts";

const SECRET = "portal-test-secret";
const NOW = "2026-11-15T10:00:00Z";

const membership: Membership = {
  id: "membership-alpha-01",
  userId: "user-alpha-01",
  tenantId: "tenant-alpha-01",
  role: "reviewer",
  status: "active",
  scopes: ["sales.pipeline:read"],
};

const claims: VerifiedClaims = {
  sub: "user-alpha-01",
  tenantClaim: "tenant-alpha-01",
  issuer: "https://project-ref.supabase.co/auth/v1",
  audience: ["authenticated"],
  issuedAt: 1_759_999_970,
  expiresAt: 1_760_000_300,
  raw: { role: "authenticated" },
};

const quote: QuoteRecord = {
  id: "quote-alpha-01",
  tenantId: "tenant-alpha-01",
  opportunityId: "opportunity-alpha-01",
  operationKey: "operation-0001",
  priceBookVersion: "pb-7",
  subtotal: "39.98000000",
  discount: "2.00000000",
  tax: "7.98000000",
  total: "45.96000000",
  currency: "EUR",
  contentHash: "sha256:aaaa",
  createdAt: "2026-11-15T09:00:00.000Z",
};

function fakeCommercial(): CommercialRepository {
  const quotes = new Map<string, QuoteRecord>([[`${quote.tenantId}:${quote.id}`, quote]]);
  const unused = async () => {
    throw new ServiceError("NOT_IMPLEMENTED", "not used by the portal");
  };
  return {
    quotes: {
      async save() {
        return unused();
      },
      async find({ tenantId, id }) {
        return quotes.get(`${tenantId}:${id}`) ?? null;
      },
    },
    approvals: {
      save: unused,
      revoke: unused,
      find: async () => null as ApprovalRecord | null,
    },
    budgets: { reserve: unused },
  };
}

function buildApp(options: { secret?: string; commercial?: CommercialRepository } = {}) {
  return createApp({
    verifyToken: async () => claims,
    memberships: { findMembership: async () => membership },
    correlationIdFactory: () => "corr-portal-01",
    ...(options.commercial ? { commercial: options.commercial } : {}),
    ...(options.secret ? { portalSecret: options.secret } : {}),
  });
}

function link(overrides: { quoteId?: string; expiresAt?: string } = {}): string {
  return createPortalToken({
    secret: SECRET,
    tenantId: "tenant-alpha-01",
    quoteId: overrides.quoteId ?? quote.id,
    expiresAt: overrides.expiresAt ?? "2026-12-15T10:00:00Z",
  });
}

describe("portal token", () => {
  it("round-trips and rejects tampering or expiry", () => {
    const token = link();
    expect(verifyPortalToken({ token, secret: SECRET, now: NOW })).toMatchObject({
      tenantId: "tenant-alpha-01",
      quoteId: quote.id,
    });
    expect(() =>
      verifyPortalToken({ token: `${token.slice(0, -1)}0`, secret: SECRET, now: NOW }),
    ).toThrow(/signature/i);
    expect(() =>
      verifyPortalToken({ token: link({ expiresAt: "2026-11-01T00:00:00Z" }), secret: SECRET, now: NOW }),
    ).toThrow(/expired/i);
  });
});

describe("portal page", () => {
  const app = buildApp({ secret: SECRET, commercial: fakeCommercial() });

  it("renders a read-only quote with security headers", async () => {
    const response = await app.request(`/portal/quotes/${quote.id}?token=${link()}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(html).toContain("45.96000000");
    expect(html).toContain("no firma, no cobra");
    expect(html).not.toContain("token=");
  });

  it("rejects a missing, expired or foreign token", async () => {
    const missing = await app.request(`/portal/quotes/${quote.id}`);
    expect(missing.status).toBe(401);

    const expired = await app.request(
      `/portal/quotes/${quote.id}?token=${link({ expiresAt: "2026-11-01T00:00:00Z" })}`,
    );
    expect(expired.status).toBe(401);
    expect(((await expired.json()) as any).error.code).toBe("AUTH_EXPIRED");

    const foreign = await app.request(
      `/portal/quotes/quote-other?token=${link({ quoteId: "quote-other" })}`,
    );
    expect(foreign.status).toBe(404);
  });

  it("fails closed without a signing secret", async () => {
    const unsigned = buildApp({ commercial: fakeCommercial() });
    const response = await unsigned.request(`/portal/quotes/${quote.id}?token=${link()}`);
    expect(response.status).toBe(503);
    expect(((await response.json()) as any).error.code).toBe("PROVIDER_NOT_CONFIGURED");
  });
});
