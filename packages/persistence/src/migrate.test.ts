import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createPgliteClient } from "./pglite.ts";
import { runMigrations } from "./migrate.ts";
import { MIGRATIONS_DIR } from "./test-support.ts";
import type { SqlClient } from "./types.ts";

/**
 * Simulates a runner whose first look at `schema_migrations` happened before a
 * concurrent runner committed: the initial list is empty, the locked re-check
 * sees the winner.
 */
function staleReader(inner: SqlClient): { client: SqlClient; statements: string[] } {
  const statements: string[] = [];
  let firstRead = true;
  const client: SqlClient = {
    async query<Row = Record<string, unknown>>(
      sql: string,
      params?: readonly unknown[],
    ): Promise<{ rows: Row[] }> {
      statements.push(sql);
      if (firstRead && sql.includes("from app.schema_migrations order by version")) {
        firstRead = false;
        return { rows: [] };
      }
      return inner.query<Row>(sql, params);
    },
    async exec(sql: string): Promise<void> {
      statements.push(sql);
      await inner.exec(sql);
    },
  };
  return { client, statements };
}

describe("migration runner", () => {
  it("applies the pending migration once and records its checksum", async () => {
    const client = createPgliteClient(new PGlite());

    const first = await runMigrations(client, MIGRATIONS_DIR);
    expect(first.applied).toEqual([
      "0001_tenancy_identity",
      "0002_domain",
      "0003_operations",
      "0004_outbox",
      "0005_domain_enums",
    ]);
    expect(first.skipped).toEqual([]);

    const recorded = await client.query<{ version: string; checksum: string }>(
      "select version, checksum from app.schema_migrations order by version",
    );
    expect(recorded.rows).toHaveLength(5);
    for (const row of recorded.rows) {
      expect(row.checksum).toMatch(/^[a-f0-9]{64}$/);
    }

    const second = await runMigrations(client, MIGRATIONS_DIR);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([
      "0001_tenancy_identity",
      "0002_domain",
      "0003_operations",
      "0004_outbox",
      "0005_domain_enums",
    ]);
  });

  it("enables and forces RLS on every tenant table", async () => {
    const client = createPgliteClient(new PGlite());
    await runMigrations(client, MIGRATIONS_DIR);

    const tables = await client.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'app' and c.relkind = 'r'
        order by c.relname`,
    );
    const tenantTables = [
      "accounts",
      "activities",
      "budget_reservations",
      "approvals",
      "candidates",
      "contact_channels",
      "contacts",
      "delegation_mandates",
      "handoffs",
      "memberships",
      "opportunities",
      "parent_outbox",
      "quotes",
      "suppressions",
      "tenants",
      "twin_bindings",
      "work_orders",
    ];
    const guarded = tables.rows.filter((row) => tenantTables.includes(row.relname));

    expect(guarded).toHaveLength(tenantTables.length);
    for (const table of guarded) {
      expect(table.relrowsecurity).toBe(true);
      expect(table.relforcerowsecurity).toBe(true);
    }
  });

  it("refuses a migration whose content changed after being applied", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agntia-migrations-"));
    const path = join(directory, "0001_probe.sql");
    await writeFile(path, "create table if not exists app.probe (id text primary key);");

    const client = createPgliteClient(new PGlite());
    await runMigrations(client, directory);

    await writeFile(
      path,
      "create table if not exists app.probe (id text primary key, extra text);",
    );
    await expect(runMigrations(client, directory)).rejects.toThrow(/checksum mismatch/i);
  });

  it("skips a migration another runner applied while this one waited for the lock", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agntia-race-"));
    await writeFile(
      join(directory, "0001_race.sql"),
      "create table if not exists app.race (id text primary key);",
    );

    const inner = createPgliteClient(new PGlite());
    await runMigrations(inner, directory);

    const { client, statements } = staleReader(inner);
    const report = await runMigrations(client, directory);

    // Without the locked re-check this is a primary-key violation, not a skip.
    expect(report.applied).toEqual([]);
    expect(report.skipped).toEqual(["0001_race"]);
    expect(statements.some((sql) => sql.includes("pg_advisory_xact_lock"))).toBe(true);
  });

  it("rolls back a failing migration instead of leaving a partial schema", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agntia-broken-"));
    await writeFile(
      join(directory, "0001_broken.sql"),
      "create table app.broken (id text primary key); select * from app.does_not_exist;",
    );

    const client = createPgliteClient(new PGlite());
    await expect(runMigrations(client, directory)).rejects.toThrow();

    const tables = await client.query<{ count: string }>(
      "select count(*)::text as count from pg_tables where schemaname = 'app' and tablename = 'broken'",
    );
    expect(tables.rows[0]?.count).toBe("0");
  });
});
