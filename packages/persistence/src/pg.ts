import type { Pool, PoolClient } from "pg";
import type { SqlClient, SqlResult } from "./types.ts";

function adapterFromQueryable(source: Pool | PoolClient): SqlClient {
  return {
    async query<Row = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[],
    ): Promise<SqlResult<Row>> {
      const result = await source.query(sql, params ? [...params] : undefined);
      return { rows: result.rows as Row[] };
    },
    async exec(sql: string): Promise<void> {
      await source.query(sql);
    },
  };
}

/**
 * Production adapter. A session needs its own connection: acquire one per
 * request with `withConnection`, never share a PoolClient between requests.
 */
export function createPgConnection(pool: Pool) {
  return {
    withConnection<T>(fn: (client: SqlClient) => Promise<T>): Promise<T> {
      return pool.connect().then(async (connection) => {
        try {
          return await fn(adapterFromQueryable(connection));
        } finally {
          connection.release();
        }
      });
    },
  };
}

export { adapterFromQueryable };
