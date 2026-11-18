import { describe, expect, it } from "vitest";
import { ServiceError, type Membership } from "@agntia-ventas/contracts";
import type { VerifiedClaims } from "@agntia-ventas/identity";
import { createApp } from "./app.ts";

const CORRELATION_ID = "corr-fixed-test-id";

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
  ["token-beta", claims("user-beta-02", "tenant-beta-02")],
  ["token-gamma", claims("user-gamma-03", "tenant-gamma-03")],
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
      scopes: ["sales.pipeline:read", "sales.quote:propose"],
    },
  ],
  [
    "user-gamma-03:tenant-gamma-03",
    {
      id: "membership-gamma-03",
      userId: "user-gamma-03",
      tenantId: "tenant-gamma-03",
      role: "owner",
      status: "suspended",
      scopes: ["sales.pipeline:read"],
    },
  ],
]);

const app = createApp({
  verifyToken: async (token) => {
    const found = tokens.get(token);
    if (!found) throw new ServiceError("AUTH_INVALID", "token verification failed");
    return found;
  },
  memberships: {
    findMembership: async ({ userId, tenantId }) =>
      memberships.get(`${userId}:${tenantId}`) ?? null,
  },
  correlationIdFactory: () => CORRELATION_ID,
});

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    operationId: "operation-0001",
    tenantId: "tenant-alpha-01",
    actorId: "user-alpha-01",
    capability: "sales.quote.calculate",
    correlationId: "corr-envelope-01",
    causationId: null,
    idempotencyKey: "idempotency-0001",
    expectedVersion: 1,
    approvalRef: null,
    dryRun: true,
    payload: { quoteRef: "quote-0001" },
    ...overrides,
  };
}

async function jsonOf(response: Response): Promise<any> {
  return (await response.json()) as any;
}

async function post(
  body: unknown,
  token = "token-alpha",
): Promise<{ status: number; json: any }> {
  const response = await app.request("/v1/ventas/envelopes/validate", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, json: await jsonOf(response) };
}

describe("health", () => {
  it("answers without authentication", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "agntia-ventas",
      schemaVersion: 1,
    });
  });
});

describe("authentication", () => {
  it("rejects a request without bearer token", async () => {
    const response = await app.request("/v1/ventas/me");
    const body = await jsonOf(response);

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_MISSING");
    expect(body.error.correlationId).toBe(CORRELATION_ID);
    expect(body.error.retryable).toBe(false);
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("rejects an invalid token", async () => {
    const response = await app.request("/v1/ventas/me", {
      headers: { authorization: "Bearer forged-token" },
    });
    expect(response.status).toBe(401);
    expect((await jsonOf(response)).error.code).toBe("AUTH_INVALID");
  });

  it("returns the verified principal for a provisioned membership", async () => {
    const response = await app.request("/v1/ventas/me", {
      headers: { authorization: "Bearer token-alpha" },
    });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(body.data.actor.tenantId).toBe("tenant-alpha-01");
    expect(body.data.role).toBe("reviewer");
    expect(body.data.scopes).toEqual(["sales.pipeline:read", "sales.quote:propose"]);
    // Principal data is per-user and must never be cached by an intermediary.
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed when the user has no membership in that tenant", async () => {
    const response = await app.request("/v1/ventas/me", {
      headers: { authorization: "Bearer token-beta" },
    });
    expect(response.status).toBe(403);
    expect((await jsonOf(response)).error.code).toBe("MEMBERSHIP_REQUIRED");
  });

  it("fails closed for a suspended membership", async () => {
    const response = await app.request("/v1/ventas/me", {
      headers: { authorization: "Bearer token-gamma" },
    });
    expect(response.status).toBe(403);
    expect((await jsonOf(response)).error.code).toBe("MEMBERSHIP_SUSPENDED");
  });
});

describe("envelope validation", () => {
  it("accepts a consistent envelope without effects", async () => {
    const { status, json } = await post(envelope());
    expect(status).toBe(200);
    expect(json.data.accepted).toBe(true);
    expect(json.data.capability).toBe("sales.quote.calculate");
    expect(json.data.dryRun).toBe(true);
  });

  it("blocks another tenant in the body", async () => {
    const { status, json } = await post(
      envelope({ tenantId: "tenant-beta-02", actorId: "user-beta-02" }),
    );
    expect(status).toBe(403);
    expect(json.error.code).toBe("TENANT_MISMATCH");
  });

  it("blocks a spoofed actor inside the verified tenant", async () => {
    const { status, json } = await post(envelope({ actorId: "user-beta-02" }));
    expect(status).toBe(403);
    expect(json.error.code).toBe("ACTOR_MISMATCH");
  });

  it("rejects unknown fields instead of silently dropping them", async () => {
    const { status, json } = await post(envelope({ role: "owner" }));
    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(json.error.details)).toContain("role");
  });

  it("rejects a missing required field", async () => {
    const { payload: _ignored, ...withoutPayload } = envelope();
    void _ignored;
    const { status, json } = await post(withoutPayload);
    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects malformed JSON", async () => {
    const { status, json } = await post("{not-json");
    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an oversized envelope", async () => {
    const { status, json } = await post(
      envelope({ payload: { blob: "a".repeat(70 * 1024) } }),
    );
    expect(status).toBe(422);
    expect(json.error.code).toBe("VALIDATION_FAILED");
  });

  it("echoes a valid correlation id and replaces an invalid one", async () => {
    const valid = await app.request("/health", {
      headers: { "x-correlation-id": "trace-00000001" },
    });
    expect(await valid.json()).toEqual({
      status: "ok",
      service: "agntia-ventas",
      schemaVersion: 1,
    });

    const invalid = await app.request("/v1/ventas/me", {
      headers: { authorization: "Bearer token-beta", "x-correlation-id": "bad id" },
    });
    expect((await jsonOf(invalid)).error.correlationId).toBe(CORRELATION_ID);
  });
});

describe("routing", () => {
  it("returns a structured 404 for unknown routes", async () => {
    const response = await app.request("/v1/ventas/execute-anything");
    expect(response.status).toBe(404);
    expect((await jsonOf(response)).error.code).toBe("NOT_FOUND");
  });
});
