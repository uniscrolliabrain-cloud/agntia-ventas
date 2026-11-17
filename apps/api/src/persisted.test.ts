import { describe, expect, it } from "vitest";
import { ServiceError, type Membership } from "@agntia-ventas/contracts";
import type {
  ApprovalRecord,
  BudgetReservationRecord,
  CommercialRepository,
  QuoteRecord,
} from "@agntia-ventas/persistence";
import type { VerifiedClaims } from "@agntia-ventas/identity";
import { createApp } from "./app.ts";

const CORRELATION_ID = "corr-persisted-01";

function claims(userId: string, tenantId: string): VerifiedClaims {
  return {
    sub: userId,
    tenantClaim: tenantId,
    issuer: "https://project-ref.supabase.co/auth/v1",
    audience: ["authenticated"],
    issuedAt: 1_759_999_970,
    expiresAt: 1_760_000_300,
    raw: { role: "authenticated", tenant_id: tenantId },
  };
}

const membership: Membership = {
  id: "membership-alpha-01",
  userId: "user-alpha-01",
  tenantId: "tenant-alpha-01",
  role: "reviewer",
  status: "active",
  scopes: [
    "sales.pipeline:read",
    "sales.quote:propose",
    "sales.approval:review",
    "sales.email:propose",
    "sales.handoff:propose",
    "sales.import:write",
  ],
};

const verifyToken = async (token: string): Promise<VerifiedClaims> => {
  if (token !== "token-alpha") {
    throw new ServiceError("AUTH_INVALID", "unknown token");
  }
  return claims("user-alpha-01", "tenant-alpha-01");
};

const memberships = {
  findMembership: async ({ userId, tenantId }: { userId: string; tenantId: string }) =>
    userId === membership.userId && tenantId === membership.tenantId ? membership : null,
};

/** In-memory double: the PGlite repository test proves the real SQL. */
function createFakeCommercial(): CommercialRepository {
  const quotes = new Map<string, QuoteRecord>();
  const approvals = new Map<string, ApprovalRecord>();
  const budgets = new Map<string, BudgetReservationRecord>();

  return {
    quotes: {
      async save(tenantId, input) {
        const existing = [...quotes.values()].find(
          (row) => row.tenantId === tenantId && row.operationKey === input.operationKey,
        );
        if (existing) {
          if (existing.contentHash !== input.contentHash) {
            throw new ServiceError("IDEMPOTENCY_CONFLICT", "different quote");
          }
          return { record: existing, reused: true };
        }
        const record: QuoteRecord = {
          ...input,
          tenantId,
          createdAt: "2026-11-15T10:00:00.000Z",
        };
        quotes.set(`${tenantId}:${input.id}`, record);
        return { record, reused: false };
      },
      async find({ tenantId, id }) {
        return quotes.get(`${tenantId}:${id}`) ?? null;
      },
    },
    approvals: {
      async save(tenantId, input) {
        const existing = [...approvals.values()].find(
          (row) => row.tenantId === tenantId && row.operationKey === input.operationKey,
        );
        if (existing) {
          if (existing.payloadHash !== input.payloadHash) {
            throw new ServiceError("IDEMPOTENCY_CONFLICT", "different approval");
          }
          return { record: existing, reused: true };
        }
        const record: ApprovalRecord = {
          ...input,
          tenantId,
          status: "active",
          createdAt: "2026-11-15T10:00:00.000Z",
        };
        approvals.set(`${tenantId}:${input.id}`, record);
        return { record, reused: false };
      },
      async revoke({ tenantId, id, expectedVersion }) {
        const key = `${tenantId}:${id}`;
        const record = approvals.get(key);
        if (!record) throw new ServiceError("NOT_FOUND", "approval not found");
        if (record.status === "revoked") return { record, reused: true };
        if (record.revocationVersion !== expectedVersion) {
          throw new ServiceError("VERSION_CONFLICT", "approval version changed");
        }
        const revoked: ApprovalRecord = {
          ...record,
          status: "revoked",
          revocationVersion: record.revocationVersion + 1,
        };
        approvals.set(key, revoked);
        return { record: revoked, reused: false };
      },
      async find({ tenantId, id }) {
        return approvals.get(`${tenantId}:${id}`) ?? null;
      },
    },
    budgets: {
      async reserve(input) {
        const key = `${input.tenantId}:${input.operationKey}`;
        const existing = budgets.get(key);
        if (existing) {
          if (existing.amount !== input.amount) {
            throw new ServiceError("IDEMPOTENCY_CONFLICT", "different reservation");
          }
          return { record: existing, reused: true };
        }
        const record: BudgetReservationRecord = {
          id: input.id,
          tenantId: input.tenantId,
          operationKey: input.operationKey,
          amount: input.amount,
          currency: input.currency,
          status: "reserved",
          createdAt: "2026-11-15T10:00:00.000Z",
        };
        budgets.set(key, record);
        return { record, reused: false };
      },
    },
  };
}

function buildApp(commercial?: CommercialRepository) {
  return createApp({
    verifyToken,
    memberships,
    correlationIdFactory: () => CORRELATION_ID,
    ...(commercial ? { commercial } : {}),
  });
}

const app = buildApp(createFakeCommercial());

const product = {
  id: "product-alpha-01",
  catalogVersion: "catalog-3",
  validUntil: "2027-01-01T00:00:00Z",
  stockAt: "2026-11-14T00:00:00Z",
  deliveryAssertion: "10 business days",
};

function quoteBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "quote-alpha-01",
    opportunityId: "opportunity-alpha-01",
    operationKey: "operation-0001",
    priceBook: {
      id: "pricebook-alpha-01",
      version: "pb-7",
      currency: "EUR",
      entries: [
        {
          productRef: "product-alpha-01",
          unitPrice: { amount: "19.99", currency: "EUR" },
          effectiveFrom: "2026-01-01T00:00:00Z",
        },
      ],
    },
    lines: [{ productRef: "product-alpha-01", quantity: "2", discountBasisPoints: 500 }],
    products: [product],
    taxRules: [
      { productRef: "product-alpha-01", rateBasisPoints: 2100, sourceRef: "tax-source-01" },
    ],
    policy: { rounding: "HALF_UP", exponent: 2, policyVersion: "q1" },
    now: "2026-11-15T10:00:00Z",
    ...overrides,
  };
}

async function post(
  target: string,
  body: unknown,
  token = "token-alpha",
): Promise<{ status: number; json: any }> {
  const response = await app.request(target, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as any };
}

const approvalBody = {
  id: "approval-alpha-01",
  operationKey: "operation-approval-0001",
  resourceRef: "quote-alpha-01",
  resourceVersion: 1,
  payloadHash: "sha256:payload",
  rightsHash: "sha256:rights",
  policyHash: "sha256:policy",
  recipient: "ana@example.test",
  channel: "email",
  proofRef: "proof-01",
  costCeiling: { amount: "100.00", currency: "EUR" },
  expiresAt: "2027-01-01T00:00:00Z",
  revocationVersion: 0,
};

describe("persisted quotes", () => {
  it("creates once, replays with 200 and reads back", async () => {
    const first = await post("/v1/ventas/quotes", quoteBody());
    expect(first.status).toBe(201);
    expect(first.json.data.reused).toBe(false);
    expect(first.json.data.record.total).toMatch(/^45\.96/);
    expect(first.json.data.record.tenantId).toBe("tenant-alpha-01");

    const replay = await post("/v1/ventas/quotes", quoteBody());
    expect(replay.status).toBe(200);
    expect(replay.json.data.reused).toBe(true);

    const read = await app.request("/v1/ventas/quotes/quote-alpha-01", {
      headers: { authorization: "Bearer token-alpha" },
    });
    expect(read.status).toBe(200);
    expect(((await read.json()) as any).data.quote.id).toBe("quote-alpha-01");
  });

  it("rejects the same key with different content", async () => {
    const { status, json } = await post(
      "/v1/ventas/quotes",
      quoteBody({ lines: [{ productRef: "product-alpha-01", quantity: "3" }] }),
    );
    expect(status).toBe(409);
    expect(json.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("answers 404 for an unknown quote", async () => {
    const response = await app.request("/v1/ventas/quotes/quote-unknown", {
      headers: { authorization: "Bearer token-alpha" },
    });
    expect(response.status).toBe(404);
  });
});

describe("persisted approvals", () => {
  it("stores with the verified reviewer and revokes idempotently", async () => {
    const created = await post("/v1/ventas/approvals", approvalBody);
    expect(created.status).toBe(201);
    expect(created.json.data.record.reviewerId).toBe("user-alpha-01");

    const replay = await post("/v1/ventas/approvals", approvalBody);
    expect(replay.status).toBe(200);
    expect(replay.json.data.reused).toBe(true);

    const revoked = await post("/v1/ventas/approvals/approval-alpha-01/revoke", {
      expectedVersion: 0,
    });
    expect(revoked.status).toBe(201);
    expect(revoked.json.data.record.status).toBe("revoked");
    expect(revoked.json.data.record.revocationVersion).toBe(1);

    const again = await post("/v1/ventas/approvals/approval-alpha-01/revoke", {
      expectedVersion: 0,
    });
    expect(again.status).toBe(200);
    expect(again.json.data.reused).toBe(true);
  });
});

describe("storage unavailable", () => {
  it("fails closed with 424 when no commercial storage is configured", async () => {
    const readOnly = buildApp();
    const response = await readOnly.request("/v1/ventas/quotes", {
      method: "POST",
      headers: { authorization: "Bearer token-alpha", "content-type": "application/json" },
      body: JSON.stringify(quoteBody()),
    });

    expect(response.status).toBe(424);
    expect(((await response.json()) as any).error.code).toBe("DEPENDENCY_UNAVAILABLE");
  });
});
