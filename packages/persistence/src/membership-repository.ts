import type { Pool } from "pg";
import type { Membership } from "@agntia-ventas/contracts";
import type { MembershipLookup, MembershipRepository } from "@agntia-ventas/identity";
import { createPgConnection } from "./pg.ts";
import { createTenantSession } from "./tenant-session.ts";
import type { ScopedSqlClient } from "./types.ts";

interface MembershipRow {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  status: string;
  scopes: string[] | null;
  resource_scopes: string[] | null;
}

export type TenantSessionFactory = () => ScopedSqlClient;

async function fetchMembership(
  session: ScopedSqlClient,
  lookup: MembershipLookup,
): Promise<Membership | null> {
  return session.withTenant(
    { tenantId: lookup.tenantId, actorId: lookup.userId },
    async (tx) => {
      const { rows } = await tx.query<MembershipRow>(
        `select id, user_id, tenant_id, role, status, scopes, resource_scopes
           from app.memberships
          where tenant_id = $1 and user_id = $2
          limit 1`,
        [lookup.tenantId, lookup.userId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        tenantId: row.tenant_id,
        role: row.role as Membership["role"],
        status: row.status as Membership["status"],
        scopes: (row.scopes ?? []) as Membership["scopes"],
        ...(row.resource_scopes ? { resourceScopes: row.resource_scopes } : {}),
      };
    },
  );
}

/**
 * Every read runs inside a tenant-scoped transaction, so RLS is the second
 * barrier behind the explicit `tenant_id` filter. A missing membership returns
 * `null`; resolvePrincipal decides the fail-closed error.
 */
export function createMembershipRepository(
  createSession: TenantSessionFactory,
): MembershipRepository {
  return {
    findMembership: (lookup) => fetchMembership(createSession(), lookup),
  };
}

/**
 * Production factory: each lookup checks out its own connection from the pool,
 * scopes it and releases it. A PoolClient is never shared between requests.
 */
export function createPooledMembershipRepository(pool: Pool): MembershipRepository {
  const connections = createPgConnection(pool);
  return {
    findMembership: (lookup) =>
      connections.withConnection((client) =>
        fetchMembership(createTenantSession(client), lookup),
      ),
  };
}
