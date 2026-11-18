import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SqlClient } from "./types.ts";

export interface MigrationFile {
  readonly version: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface MigrationReport {
  readonly applied: string[];
  readonly skipped: string[];
}

/**
 * Stable key for the transaction-scoped advisory lock. Two deploy jobs that
 * start at the same time serialize here instead of racing on the DDL and on
 * the `schema_migrations` primary key.
 */
const MIGRATION_LOCK_KEY = 4711_0001;

const MIGRATION_BOOTSTRAP = `
create schema if not exists app;
create table if not exists app.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
`;

export async function loadMigrations(directory: string): Promise<MigrationFile[]> {
  const entries = await readdir(directory);
  const files = entries.filter((name) => name.endsWith(".sql")).sort();
  const migrations: MigrationFile[] = [];
  for (const file of files) {
    const sql = await readFile(join(directory, file), "utf8");
    migrations.push({
      version: file.replace(/\.sql$/, ""),
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  return migrations;
}

/**
 * Applies pending migrations in filename order. A migration whose content
 * changed after being applied is a hard failure, never a silent skip: the
 * schema on disk would no longer match the recorded evidence.
 */
export async function runMigrations(
  client: SqlClient,
  directory: string,
): Promise<MigrationReport> {
  await client.exec(MIGRATION_BOOTSTRAP);

  const applied = new Set<string>();
  const checksums = new Map<string, string>();
  const recorded = await client.query<{ version: string; checksum: string }>(
    "select version, checksum from app.schema_migrations order by version",
  );
  for (const row of recorded.rows) {
    applied.add(row.version);
    checksums.set(row.version, row.checksum);
  }

  const report: MigrationReport = { applied: [], skipped: [] };

  for (const migration of await loadMigrations(directory)) {
    if (applied.has(migration.version)) {
      const known = checksums.get(migration.version);
      if (known !== migration.checksum) {
        throw new Error(
          `migration ${migration.version} changed after being applied (checksum mismatch)`,
        );
      }
      report.skipped.push(migration.version);
      continue;
    }

    await client.exec("begin");
    try {
      await client.query("select pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
      // The initial read happened before the lock: another runner may have
      // applied this version while this one waited. Re-check inside the
      // transaction instead of applying the same migration twice.
      const raced = await client.query<{ checksum: string }>(
        "select checksum from app.schema_migrations where version = $1",
        [migration.version],
      );
      const winner = raced.rows[0];
      if (winner) {
        if (winner.checksum !== migration.checksum) {
          throw new Error(
            `migration ${migration.version} changed after being applied (checksum mismatch)`,
          );
        }
        await client.exec("commit");
        report.skipped.push(migration.version);
        continue;
      }

      await client.exec(migration.sql);
      await client.query(
        "insert into app.schema_migrations (version, checksum) values ($1, $2)",
        [migration.version, migration.checksum],
      );
      await client.exec("commit");
    } catch (error) {
      await client.exec("rollback").catch(() => undefined);
      throw error;
    }
    report.applied.push(migration.version);
  }

  return report;
}
