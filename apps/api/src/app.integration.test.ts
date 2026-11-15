import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import {
  createMembershipRepository,
  createTenantSession,
} from "@agntia-ventas/persistence";
import { createHarness, seed } from "@agntia-ventas/persistence/testing";
import { createSupabaseJwtVerifier } from "@agntia-ventas/identity";
import { createApp } from "./app.ts";

const ISSUER = "https://project-ref.supabase.co/auth/v1";
const AUDIENCE = "authenticated";

const keys = await generateKeyPair("ES256");
const otherKeys = await generateKeyPair("ES256");

const harness = await createHarness();
await seed(harness.client);

const app = createApp({
  verifyToken: createSupabaseJwtVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    keySet: keys.publicKey,
  }),
  memberships: createMembershipRepository(() => createTenantSession(harness.client)),
  correlationIdFactory: () => "corr-integration-01",
});

type Signer = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

async function token(
  sub: string,
  tenantId: string,
  options: { signer?: Signer; expiresIn?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ tenant_id: tenantId, role: "authenticated" })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt(now - 10)
    .setExpirationTime(now + (options.expiresIn ?? 300))
    .sign(options.signer ?? keys.privateKey);
}

async function me(bearer: string): Promise<{ status: number; json: any }> {
  const response = await app.request("/v1/ventas/me", {
    headers: { authorization: `Bearer ${bearer}` },
  });
  return { status: response.status, json: (await response.json()) as any };
}

describe("identity end to end with real postgres", () => {
  it("resolves role and scopes from the database, not from the token", async () => {
    const { status, json } = await me(await token("user-alpha-01", "tenant-alpha-01"));

    expect(status).toBe(200);
    expect(json.data.actor.tenantId).toBe("tenant-alpha-01");
    expect(json.data.actor.userId).toBe("user-alpha-01");
    expect(json.data.membershipId).toBe("membership-alpha-01");
    expect(json.data.role).toBe("reviewer");
    expect(json.data.scopes).toEqual([
      "sales.pipeline:read",
      "sales.quote:propose",
    ]);
  });

  it("isolates the second synthetic tenant", async () => {
    const beta = await me(await token("user-beta-02", "tenant-beta-02"));
    expect(beta.status).toBe(200);
    expect(beta.json.data.role).toBe("owner");
    expect(beta.json.data.membershipId).toBe("membership-beta-03");

    const claimingBeta = await me(await token("user-alpha-01", "tenant-beta-02"));
    expect(claimingBeta.status).toBe(403);
    expect(claimingBeta.json.error.code).toBe("MEMBERSHIP_REQUIRED");
  });

  it("blocks a suspended membership", async () => {
    const { status, json } = await me(
      await token("user-alpha-suspended", "tenant-alpha-01"),
    );
    expect(status).toBe(403);
    expect(json.error.code).toBe("MEMBERSHIP_SUSPENDED");
  });

  it("rejects an expired or foreign-signed token", async () => {
    const expired = await me(
      await token("user-alpha-01", "tenant-alpha-01", { expiresIn: -60 }),
    );
    expect(expired.status).toBe(401);
    expect(expired.json.error.code).toBe("AUTH_EXPIRED");

    const foreign = await me(
      await token("user-alpha-01", "tenant-alpha-01", {
        signer: otherKeys.privateKey,
      }),
    );
    expect(foreign.status).toBe(401);
    expect(foreign.json.error.code).toBe("AUTH_INVALID");
  });

  it("validates an envelope for the verified principal only", async () => {
    const bearer = await token("user-alpha-01", "tenant-alpha-01");
    const accepted = await app.request("/v1/ventas/envelopes/validate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
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
      }),
    });
    expect(accepted.status).toBe(200);
    expect(((await accepted.json()) as any).data.accepted).toBe(true);
  });
});
