import {
  MembershipSchema,
  ServiceError,
  type Membership,
  type Principal,
  type Scope,
} from "@agntia-ventas/contracts";
import type { VerifiedClaims } from "./jwt.ts";

export interface MembershipLookup {
  readonly userId: string;
  readonly tenantId: string;
}

export interface MembershipRepository {
  findMembership(lookup: MembershipLookup): Promise<Membership | null>;
}

export interface ResolvePrincipalOptions {
  readonly claims: VerifiedClaims;
  readonly memberships: MembershipRepository;
  readonly requiredScopes?: readonly Scope[];
}

/**
 * A valid signature is not an authorization. The principal exists only when a
 * provisioned, active membership matches the token subject and the tenant
 * claim; role and scopes come from that record, never from the token body.
 */
export async function resolvePrincipal(
  options: ResolvePrincipalOptions,
): Promise<Principal> {
  const { claims } = options;

  if (!claims.tenantClaim) {
    throw new ServiceError(
      "MEMBERSHIP_REQUIRED",
      "token does not select a tenant; a provisioned membership is required",
    );
  }

  const found = await options.memberships.findMembership({
    userId: claims.sub,
    tenantId: claims.tenantClaim,
  });
  if (!found) {
    throw new ServiceError("MEMBERSHIP_REQUIRED", "no membership for this tenant");
  }

  const membership = MembershipSchema.safeParse(found);
  if (!membership.success) {
    throw new ServiceError(
      "DEPENDENCY_UNAVAILABLE",
      "membership record failed contract validation",
    );
  }

  if (membership.data.userId !== claims.sub) {
    throw new ServiceError("TENANT_MISMATCH", "membership belongs to another subject");
  }
  if (membership.data.tenantId !== claims.tenantClaim) {
    throw new ServiceError("TENANT_MISMATCH", "membership tenant does not match token");
  }
  if (membership.data.status === "suspended") {
    throw new ServiceError("MEMBERSHIP_SUSPENDED", "membership suspended");
  }
  if (membership.data.status !== "active") {
    throw new ServiceError("MEMBERSHIP_SUSPENDED", "membership is not active");
  }

  const required = options.requiredScopes ?? [];
  const granted = new Set<Scope>(membership.data.scopes);
  const missing = required.filter((scope) => !granted.has(scope));
  if (missing.length > 0) {
    throw new ServiceError("CAPABILITY_NOT_GRANTED", "missing required scope", {
      details: { missing },
    });
  }

  return {
    actor: {
      kind: "human",
      id: claims.sub,
      userId: claims.sub,
      tenantId: membership.data.tenantId,
    },
    membershipId: membership.data.id,
    role: membership.data.role,
    scopes: membership.data.scopes,
  };
}
