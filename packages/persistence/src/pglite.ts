import type { PGlite } from "@electric-sql/pglite";
import type { SqlClient, SqlResult } from "./types.ts";

/** Real PostgreSQL compiled to WASM: same SQL, same RLS, no Docker needed. */
export function createPgliteClient(database: PGlite): SqlClient {
  return {
    async query<Row = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[],
    ): Promise<SqlResult<Row>> {
      const result = await database.query<Row>(
        sql,
        params ? [...params] : undefined,
      );
      return { rows: result.rows };
    },
    async exec(sql: string): Promise<void> {
      await database.exec(sql);
    },
  };
}
