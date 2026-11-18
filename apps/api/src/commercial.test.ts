import { describe, expect, it } from "vitest";
import type { Membership } from "@agntia-ventas/contracts";
import type { VerifiedClaims } from "@agntia-ventas/identity";
import { createApp } from "./app.ts";

const CORRELATION_ID = "corr-commercial-0001";

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

const tokens = new Map<string, VerifiedClaims>([
  ["token-alpha", claims("user-alpha-01", "tenant-alpha-01")],
  ["token-limited", claims("user-limited-04", "tenant-alpha-01")],
]);

const memberships = new Map<string, Membership>([
  [
    "user-alpha-01:tenant-alpha-01",
    {
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
    },
  ],
  [
    "user-limited-04:tenant-alpha-01",
    {
      id: "membership-limited-04",
      userId: "user-limited-04",
      tenantId: "tenant-alpha-01",
      role: "member",
      status: "active",
      scopes: ["sales.pipeline:read"],
    },
  ],
]);

const app = createApp({
  verifyToken: async (token) => {
    const found = tokens.get(token);
    if (!found) throw new Error("invalid token");
    return found;
  },
  memberships: {
    findMembership: async ({ userId, tenantId }) =>
      memberships.get(`${userId}:${tenantId}`) ?? null,
  },
  correlationIdFactory: () => CORRELATION_ID,
});

async function post(
  path: string,
  body: unknown,
  token = "token-alpha",
): Promise<{ status: number; json: any }> {
  const response = await app.request(path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as any };
}

const product = {
  id: "product-alpha-01",
  catalogVersion: "catalog-3",
  validUntil: "2027-01-01T00:00:00Z",
  stockAt: "2026-11-14T00:00:00Z",
  deliveryAssertion: "10 business days",
};

const priceBook = {
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
};

function quoteBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    priceBook,
    lines: [{ productRef: "product-alpha-01", quantity: "2", discountBasisPoints: 500 }],
    products: [product],
    taxRules: [
      { productRef: "product-alpha-01", rateBasisPoints: 2100, sourceRef: "tax-source-01" },
    ],
    policy: { rounding: "HALF_UP", exponent: 2, policyVersion: "q1" },
    ...overrides,
  };
}

describe("quotes/preview", () => {
  it("computes totals from the verified tenant only", async () => {
    const { status, json } = await post("/v1/ventas/quotes/preview", quoteBody());

    expect(status).toBe(200);
    expect(json.data.totals.total.amount).toBe("45.96");
    expect(json.data.totals.net.amount).toBe("37.98");
    expect(json.data.externalEffect).toBe(false);
    expect(json.correlationId).toBe(CORRELATION_ID);
  });

  it("rejects a caller-supplied clock so expiry cannot be spoofed", async () => {
    const { status, json } = await post(
      "/v1/ventas/quotes/preview",
      quoteBody({ now: "2020-01-01T00:00:00Z" }),
    );
    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a body that tries to declare a tenant", async () => {
    const { status, json } = await post(
      "/v1/ventas/quotes/preview",
      quoteBody({ tenantId: "tenant-beta-02" }),
    );
    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a caller without the quote scope", async () => {
    const { status, json } = await post(
      "/v1/ventas/quotes/preview",
      quoteBody(),
      "token-limited",
    );
    expect(status).toBe(403);
    expect(json.error.code).toBe("CAPABILITY_NOT_GRANTED");
    expect(json.error.details.missing).toEqual(["sales.quote:propose"]);
  });

  it("rejects a request without token", async () => {
    const response = await app.request("/v1/ventas/quotes/preview", { method: "POST" });
    expect(response.status).toBe(401);
    expect(((await response.json()) as any).error.code).toBe("AUTH_MISSING");
  });

  it("blocks a discount above the provided mandate", async () => {
    const { status, json } = await post(
      "/v1/ventas/quotes/preview",
      quoteBody({
        discountMandate: {
          id: "mandate-01",
          maxRateBasisPoints: 100,
          scope: "order",
          expiresAt: "2027-01-01T00:00:00Z",
        },
      }),
    );
    expect(status).toBe(403);
    expect(json.error.code).toBe("DISCOUNT_EXCEEDED");
  });

  it("refuses to infer a tax mapping", async () => {
    const { status, json } = await post(
      "/v1/ventas/quotes/preview",
      quoteBody({ taxRules: [] }),
    );
    expect(status).toBe(422);
    expect(json.error.code).toBe("TAX_MAPPING_MISSING");
  });
});

describe("approvals/preview", () => {
  const approvalBody = {
    id: "approval-01",
    resourceRef: "quote-01",
    resourceVersion: 3,
    payloadHash: "sha256:aaa",
    rightsHash: "sha256:rights",
    policyHash: "sha256:policy",
    recipient: "ana@example.test",
    channel: "email",
    proofRef: "proof-01",
    costCeiling: { amount: "100.00", currency: "EUR" },
    expiresAt: "2027-01-01T00:00:00Z",
    revocationVersion: 1,
  };

  it("binds the approval to the verified reviewer", async () => {
    const { status, json } = await post("/v1/ventas/approvals/preview", approvalBody);
    expect(status).toBe(200);
    expect(json.data.approval.reviewerId).toBe("user-alpha-01");
    expect(json.data.approval.tenantId).toBe("tenant-alpha-01");
    expect(json.data.externalEffect).toBe(false);
  });

  it("rejects a caller-declared reviewer", async () => {
    const { status } = await post("/v1/ventas/approvals/preview", {
      ...approvalBody,
      reviewer: { kind: "human", id: "user-beta-02" },
    });
    expect(status).toBe(422);
  });
});

describe("email/preview", () => {
  const emailBody = {
    recipient: "ana@example.test",
    subject: "Propuesta",
    body: "Cuerpo de la propuesta",
    purpose: "pilot",
    suppressed: false,
    sinkAllowlist: ["ana@example.test"],
  };

  it("returns a sink-only draft", async () => {
    const { status, json } = await post("/v1/ventas/email/preview", emailBody);
    expect(status).toBe(200);
    expect(json.data.plan.mode).toBe("sink_only");
    expect(json.data.plan.externalEffect).toBe(false);
  });

  it("blocks a suppressed recipient", async () => {
    const { status, json } = await post("/v1/ventas/email/preview", {
      ...emailBody,
      suppressed: true,
    });
    expect(status).toBe(403);
    expect(json.error.code).toBe("SUPPRESSION_BLOCKED");
  });
});

describe("handoffs/transition", () => {
  it("forces proposed -> offered before acknowledgement", async () => {
    const { status, json } = await post("/v1/ventas/handoffs/transition", {
      handoff: { id: "handoff-01", receiverRef: "receiver-01", status: "proposed" },
      to: "acknowledged",
    });
    expect(status).toBe(422);
    expect(json.error.code).toBe("STAGE_INVALID");

    const offered = await post("/v1/ventas/handoffs/transition", {
      handoff: { id: "handoff-01", receiverRef: "receiver-01", status: "proposed" },
      to: "offered",
    });
    expect(offered.status).toBe(200);
    expect(offered.json.data.handoff.status).toBe("offered");
  });
});

describe("imports/preview", () => {
  it("rejects a backwards cursor", async () => {
    const { status, json } = await post("/v1/ventas/imports/preview", {
      records: [{ externalId: "ext-01", contentHash: "sha256:a" }],
      seenExternalIds: [],
      reviewedVersions: {},
      previousCursor: "v1:2:op-b",
      nextCursor: "v1:1:op-a",
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe("CURSOR_REGRESSION");
  });

  it("separates duplicates from fresh records", async () => {
    const { status, json } = await post("/v1/ventas/imports/preview", {
      records: [
        { externalId: "ext-01", contentHash: "sha256:a" },
        { externalId: "ext-02", contentHash: "sha256:b" },
      ],
      seenExternalIds: ["ext-01"],
      reviewedVersions: {},
      previousCursor: null,
      nextCursor: "v1:1:op-a",
    });
    expect(status).toBe(200);
    expect(json.data.preview.fresh.map((record: { externalId: string }) => record.externalId)).toEqual([
      "ext-02",
    ]);
    expect(json.data.preview.duplicates).toEqual(["ext-01"]);
  });
});
