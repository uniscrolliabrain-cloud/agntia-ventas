import { describe, expect, it } from "vitest";
import { ServiceError, type Membership } from "@agntia-ventas/contracts";
import { resolvePrincipal, type MembershipRepository } from "./principal.ts";
import type { VerifiedClaims } from "./jwt.ts";

const NOW = 1_760_000_000;

function claims(overrides: Partial<VerifiedClaims> = {}): VerifiedClaims {
  return {
    sub: "user-alpha-01",
    tenantClaim: "tenant-alpha-01",
    issuer: "https://project-ref.supabase.co/auth/v1",
    audience: ["authenticated"],
    issuedAt: NOW - 30,
    expiresAt: NOW + 300,
    raw: { role: "authenticated" },
    ...overrides,
  };
}

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: "membership-alpha-01",
    userId: "user-alpha-01",
    tenantId: "tenant-alpha-01",
    role: "reviewer",
    status: "active",
    scopes: ["sales.pipeline:read", "sales.quote:propose"],
    ...overrides,
  };
}

function repo(value: Membership | null): MembershipRepository {
  return { findMembership: async () => value };
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

describe("principal resolution", () => {
  it("uses the provisioned membership, not the token body", async () => {
    const principal = await resolvePrincipal({
      claims: claims(),
      memberships: repo(membership()),
    });

    expect(principal.actor.tenantId).toBe("tenant-alpha-01");
    expect(principal.actor.userId).toBe("user-alpha-01");
    expect(principal.role).toBe("reviewer");
    expect(principal.scopes).toEqual(["sales.pipeline:read", "sales.quote:propose"]);
  });

  it("ignores a role claimed in the token", async () => {
    const principal = await resolvePrincipal({
      claims: claims({ raw: { role: "owner" } }),
      memberships: repo(membership({ role: "member" })),
    });
    expect(principal.role).toBe("member");
  });

  it("fails closed when there is no membership", async () => {
    expect(
      await codeOf(resolvePrincipal({ claims: claims(), memberships: repo(null) })),
    ).toBe("MEMBERSHIP_REQUIRED");
  });

  it("fails closed when the token does not select a tenant", async () => {
    expect(
      await codeOf(
        resolvePrincipal({ claims: claims({ tenantClaim: null }), memberships: repo(null) }),
      ),
    ).toBe("MEMBERSHIP_REQUIRED");
  });

  it("rejects suspended and revoked memberships", async () => {
    for (const status of ["suspended", "revoked"] as const) {
      expect(
        await codeOf(
          resolvePrincipal({
            claims: claims(),
            memberships: repo(membership({ status })),
          }),
        ),
      ).toBe("MEMBERSHIP_SUSPENDED");
    }
  });

  it("rejects a membership that belongs to another tenant or subject", async () => {
    expect(
      await codeOf(
        resolvePrincipal({
          claims: claims(),
          memberships: repo(membership({ tenantId: "tenant-beta-02" })),
        }),
      ),
    ).toBe("TENANT_MISMATCH");

    expect(
      await codeOf(
        resolvePrincipal({
          claims: claims(),
          memberships: repo(membership({ userId: "user-beta-02" })),
        }),
      ),
    ).toBe("TENANT_MISMATCH");
  });

  it("enforces required scopes with the missing set", async () => {
    try {
      await resolvePrincipal({
        claims: claims(),
        memberships: repo(membership({ scopes: ["sales.pipeline:read"] })),
        requiredScopes: ["sales.quote:propose"],
      });
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect((error as ServiceError).code).toBe("CAPABILITY_NOT_GRANTED");
      expect((error as ServiceError).details).toEqual({ missing: ["sales.quote:propose"] });
    }
  });

  it("rejects a malformed membership record instead of trusting it", async () => {
    const broken = { ...membership(), scopes: ["not a scope"] } as unknown as Membership;
    expect(
      await codeOf(resolvePrincipal({ claims: claims(), memberships: repo(broken) })),
    ).toBe("DEPENDENCY_UNAVAILABLE");
  });
});
