import type { ScopedSqlClient, SqlClient, TenantScope } from "./types.ts";

export interface TenantSessionOptions {
  /** Non-superuser deployment role. Defaults to the least-privilege API role. */
  readonly role?: string;
}

const ROLE_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * A single connection cannot interleave transactions, so calls are queued.
 * A pool must hand one connection per request to this session.
 */
export function createTenantSession(
  client: SqlClient,
  options: TenantSessionOptions = {},
): ScopedSqlClient {
  const role = options.role ?? "app_user";
  if (!ROLE_PATTERN.test(role)) {
    throw new Error("invalid deployment role name");
  }

  let queue: Promise<unknown> = Promise.resolve();

  async function runScoped<T>(
    scope: TenantScope,
    fn: (tx: SqlClient) => Promise<T>,
  ): Promise<T> {
    await client.exec("begin");
    try {
      // SET LOCAL ROLE scopes the role to this transaction only.
      await client.exec(`set local role ${role}`);
      await client.query("select set_config('app.tenant_id', $1, true)", [
        scope.tenantId,
      ]);
      if (scope.actorId) {
        await client.query("select set_config('app.actor_id', $1, true)", [
          scope.actorId,
        ]);
      }
      const result = await fn(client);
      await client.exec("commit");
      return result;
    } catch (error) {
      await client.exec("rollback").catch(() => undefined);
      throw error;
    }
  }

  return {
    query: (sql, params) => client.query(sql, params),
    exec: (sql) => client.exec(sql),
    withTenant<T>(scope: TenantScope, fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const next = queue.then(
        () => runScoped(scope, fn),
        () => runScoped(scope, fn),
      );
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
