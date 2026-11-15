import { describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { ServiceError } from "@agntia-ventas/contracts";
import { createSupabaseJwtVerifier } from "./jwt.ts";

const ISSUER = "https://project-ref.supabase.co/auth/v1";
const AUDIENCE = "authenticated";

const keys = await generateKeyPair("ES256");
const otherKeys = await generateKeyPair("ES256");

const verifier = createSupabaseJwtVerifier({
  issuer: ISSUER,
  audience: AUDIENCE,
  keySet: keys.publicKey,
});

async function sign(
  payload: Record<string, unknown>,
  options: { alg?: "ES256"; issuer?: string; audience?: string; expiresInSeconds?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: options.alg ?? "ES256" })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(String(payload["sub"] ?? "user-a"))
    .setIssuedAt(now - 30)
    .setExpirationTime(now + (options.expiresInSeconds ?? 300))
    .sign(keys.privateKey);
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ServiceError) return error.code;
    return "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("supabase jwt verification", () => {
  it("accepts a well-formed token and keeps the tenant claim", async () => {
    const token = await sign({ sub: "user-a", tenant_id: "tenant-alpha-01" });
    const claims = await verifier(token);

    expect(claims.sub).toBe("user-a");
    expect(claims.tenantClaim).toBe("tenant-alpha-01");
    expect(claims.issuer).toBe(ISSUER);
    expect(claims.audience).toEqual([AUDIENCE]);
  });

  it("falls back to app_metadata.tenant_id", async () => {
    const token = await sign({
      sub: "user-a",
      app_metadata: { tenant_id: "tenant-beta-02" },
    });
    expect((await verifier(token)).tenantClaim).toBe("tenant-beta-02");
  });

  it("drops user_metadata so it can never become authority", async () => {
    const token = await sign({
      sub: "user-a",
      tenant_id: "tenant-alpha-01",
      role: "authenticated",
      user_metadata: { tenant_id: "tenant-beta-02", role: "owner" },
    });
    const claims = await verifier(token);

    expect(claims.tenantClaim).toBe("tenant-alpha-01");
    expect(claims.raw["user_metadata"]).toBeUndefined();
  });

  it("rejects a token signed by another key", async () => {
    const now = Math.floor(Date.now() / 1000);
    const foreign = await new SignJWT({ tenant_id: "tenant-alpha-01" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject("user-a")
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(otherKeys.privateKey);

    expect(await codeOf(verifier(foreign))).toBe("AUTH_INVALID");
  });

  it("rejects alg=none", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    );
    const body = Buffer.from(
      JSON.stringify({
        sub: "user-a",
        iss: ISSUER,
        aud: AUDIENCE,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        tenant_id: "tenant-alpha-01",
      }),
    ).toString("base64url");

    expect(await codeOf(verifier(`${header}.${body}.`))).toBe("AUTH_INVALID");
  });

  it("rejects a foreign issuer", async () => {
    const token = await sign(
      { sub: "user-a", tenant_id: "tenant-alpha-01" },
      { issuer: "https://attacker.example/auth/v1" },
    );
    expect(await codeOf(verifier(token))).toBe("AUTH_INVALID");
  });

  it("rejects a foreign audience", async () => {
    const token = await sign(
      { sub: "user-a", tenant_id: "tenant-alpha-01" },
      { audience: "service_role" },
    );
    expect(await codeOf(verifier(token))).toBe("AUTH_INVALID");
  });

  it("rejects an expired token", async () => {
    const token = await sign(
      { sub: "user-a", tenant_id: "tenant-alpha-01" },
      { expiresInSeconds: -60 },
    );
    expect(await codeOf(verifier(token))).toBe("AUTH_EXPIRED");
  });

  it("rejects malformed input and malformed tenant claims", async () => {
    expect(await codeOf(verifier("not-a-jwt"))).toBe("AUTH_INVALID");
    expect(await codeOf(verifier("a.b.c"))).toBe("AUTH_INVALID");

    const badTenant = await sign({ sub: "user-a", tenant_id: "x" });
    expect(await codeOf(verifier(badTenant))).toBe("AUTH_INVALID");
  });

  it("requires a pinned key source", () => {
    expect(() =>
      createSupabaseJwtVerifier({ issuer: ISSUER, audience: AUDIENCE }),
    ).toThrow(/key set|JWKS/i);
  });
});
