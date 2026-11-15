import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "./migrate.ts";
import { createPgliteClient } from "./pglite.ts";
import type { SqlClient } from "./types.ts";

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const MIGRATIONS_DIR = join(REPO_ROOT, "db", "migrations");
export const LOCAL_DIR = join(REPO_ROOT, "db", "local");

export interface Harness {
  readonly db: PGlite;
  readonly client: SqlClient;
}

export async function createHarness(): Promise<Harness> {
  const db = new PGlite();
  const client = createPgliteClient(db);
  await runMigrations(client, MIGRATIONS_DIR);
  for (const file of ["00-local-roles.sql", "10-local-grants.sql"]) {
    await client.exec(await readFile(join(LOCAL_DIR, file), "utf8"));
  }
  return { db, client };
}

/**
 * Two synthetic tenants plus an operator tenant, all `.example`. No real
 * person, company or credential is used.
 */
export async function seed(client: SqlClient): Promise<void> {
  await client.exec(`
    insert into app.tenants (id, display_name) values
      ('tenant-alpha-01', 'Alpha Synthetic'),
      ('tenant-beta-02', 'Beta Synthetic'),
      ('tenant-operator-03', 'Operator Synthetic');

    insert into app.memberships (id, tenant_id, user_id, role, status, scopes) values
      ('membership-alpha-01', 'tenant-alpha-01', 'user-alpha-01', 'reviewer', 'active',
       array['sales.pipeline:read', 'sales.quote:propose']),
      ('membership-alpha-02', 'tenant-alpha-01', 'user-alpha-suspended', 'member', 'suspended',
       array['sales.pipeline:read']),
      ('membership-beta-03', 'tenant-beta-02', 'user-beta-02', 'owner', 'active',
       array['sales.pipeline:read']),
      ('membership-op-04', 'tenant-operator-03', 'user-operator-03', 'owner', 'active',
       array['sales.pipeline:read']);

    insert into app.work_orders (id, tenant_id, originating_tenant_id, purpose, accepted_by, status) values
      ('work-order-alpha-01', 'tenant-alpha-01', 'tenant-operator-03', 'pilot quote', 'user-alpha-01', 'active'),
      ('work-order-beta-02', 'tenant-beta-02', 'tenant-operator-03', 'pilot quote', 'user-beta-02', 'active');

    insert into app.twin_bindings
      (id, tenant_id, canonical_agent_ref, canonical_revision, instance_ref, work_order_id,
       capabilities, purpose, issued_at, expires_at, revocation_version, proof_ref)
    values
      ('twin-alpha-01', 'tenant-alpha-01', 'runtime-agent-001', 'rev-54b8d54', 'instance-ventas-01',
       'work-order-alpha-01', array['sales.quote.calculate'], 'pilot quote',
       '2026-11-01T00:00:00Z', '2027-01-01T00:00:00Z', 3, 'proof-alpha-01'),
      ('twin-beta-02', 'tenant-beta-02', 'runtime-agent-001', 'rev-54b8d54', 'instance-ventas-02',
       'work-order-beta-02', array['sales.quote.calculate'], 'pilot quote',
       '2026-11-01T00:00:00Z', '2027-01-01T00:00:00Z', 3, 'proof-beta-02');

    insert into app.delegation_mandates
      (id, tenant_id, originating_tenant_id, originating_actor_id, twin_binding_id,
       work_order_id, capabilities, purpose, budget_amount, budget_currency,
       issued_at, expires_at, revocation_version, proof_ref)
    values
      ('mandate-alpha-01', 'tenant-alpha-01', 'tenant-operator-03', 'user-operator-03',
       'twin-alpha-01', 'work-order-alpha-01', array['sales.quote.calculate'], 'pilot quote',
       30.00, 'EUR', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 3, 'proof-alpha-01');
  `);
}
