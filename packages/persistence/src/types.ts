export interface SqlResult<Row> {
  readonly rows: Row[];
}

export interface SqlClient {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  exec(sql: string): Promise<void>;
}

export interface TenantScope {
  readonly tenantId: string;
  readonly actorId?: string;
}

/**
 * One database session per request. `withTenant` opens a transaction, sets the
 * API role and the verified tenant/actor as transaction-local settings, runs
 * the callback and rolls back on any error. Row level security does the rest.
 */
export interface ScopedSqlClient extends SqlClient {
  withTenant<T>(scope: TenantScope, fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}
