import type { Context } from "hono";
import { ServiceError, type Principal, type Scope } from "@agntia-ventas/contracts";
import {
  resolvePrincipal,
  type JwtVerifier,
  type MembershipRepository,
} from "@agntia-ventas/identity";

export interface AppDependencies {
  readonly verifyToken: JwtVerifier;
  readonly memberships: MembershipRepository;
  readonly correlationIdFactory?: () => string;
}

export interface AppEnvironment {
  Variables: {
    correlationId: string;
  };
}

export type AppContext = Context<AppEnvironment>;

/**
 * A valid token is not an authorization: the principal comes from the
 * provisioned membership, and scopes are checked server-side.
 */
export async function authenticate(
  context: AppContext,
  dependencies: AppDependencies,
  requiredScopes: readonly Scope[] = [],
): Promise<Principal> {
  const header = context.req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const token = match?.[1];
  if (!token) {
    throw new ServiceError("AUTH_MISSING", "missing bearer token");
  }

  const claims = await dependencies.verifyToken(token);
  return resolvePrincipal({
    claims,
    memberships: dependencies.memberships,
    requiredScopes,
  });
}
