import { describe, expect, it } from "vitest";
import { createHarness, seed } from "./test-support.ts";
import { createTenantSession } from "./tenant-session.ts";

async function idsOf(
  session: ReturnType<typeof createTenantSession>,
  tenantId: string,
  table: "memberships" | "twin_bindings" | "delegation_mandates" | "tenants",
): Promise<string[]> {
  const column = table === "tenants" ? "id" : "id";
  const result = await session.withTenant({ tenantId }, (tx) =>
    tx.query<{ id: string }>(`select ${column} as id from app.${table} order by id`),
  );
  return result.rows.map((row) => row.id);
}

describe("row level security", () => {
  it("shows each tenant only its own rows", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    expect(await idsOf(session, "tenant-alpha-01", "memberships")).toEqual([
      "membership-alpha-01",
      "membership-alpha-02",
    ]);
    expect(await idsOf(session, "tenant-beta-02", "memberships")).toEqual([
      "membership-beta-03",
    ]);
    expect(await idsOf(session, "tenant-alpha-01", "twin_bindings")).toEqual([
      "twin-alpha-01",
    ]);
    expect(await idsOf(session, "tenant-beta-02", "delegation_mandates")).toEqual([]);
    expect(await idsOf(session, "tenant-alpha-01", "tenants")).toEqual([
      "tenant-alpha-01",
    ]);
  });

  it("returns nothing when no verified tenant is set", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    const unscoped = await session.withTenant({ tenantId: "" }, (tx) =>
      tx.query<{ id: string }>("select id from app.memberships"),
    );
    expect(unscoped.rows).toEqual([]);
  });

  it("rejects a write into another tenant", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    await expect(
      session.withTenant({ tenantId: "tenant-alpha-01" }, (tx) =>
        tx.query(
          `insert into app.memberships (id, tenant_id, user_id, role, status, scopes)
           values ('membership-evil-01', 'tenant-beta-02', 'user-evil-01', 'owner', 'active', '{}')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("runs as a non-superuser without BYPASSRLS", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    const inside = await session.withTenant({ tenantId: "tenant-alpha-01" }, async (tx) => {
      const who = await tx.query<{ current_user: string }>("select current_user");
      return who.rows[0]?.current_user;
    });
    expect(inside).toBe("app_user");

    const roles = await client.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
      "select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('app_user', 'app_worker')",
    );
    expect(roles.rows).toHaveLength(2);
    for (const role of roles.rows) {
      expect(role.rolsuper).toBe(false);
      expect(role.rolbypassrls).toBe(false);
    }
  });

  it("does not leak the tenant setting outside the transaction", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    await idsOf(session, "tenant-alpha-01", "memberships");

    const after = await client.query<{ tenant: string | null; current_user: string }>(
      "select current_setting('app.tenant_id', true) as tenant, current_user",
    );
    expect(after.rows[0]?.tenant === "" || after.rows[0]?.tenant === null).toBe(true);
    expect(after.rows[0]?.current_user).not.toBe("app_user");
  });

  it("lets the worker read but not write", async () => {
    const { client } = await createHarness();
    await seed(client);
    const worker = createTenantSession(client, { role: "app_worker" });

    const readable = await worker.withTenant({ tenantId: "tenant-alpha-01" }, (tx) =>
      tx.query<{ id: string }>("select id from app.memberships order by id"),
    );
    expect(readable.rows.map((row) => row.id)).toEqual([
      "membership-alpha-01",
      "membership-alpha-02",
    ]);

    await expect(
      worker.withTenant({ tenantId: "tenant-alpha-01" }, (tx) =>
        tx.query(
          `insert into app.memberships (id, tenant_id, user_id, role, status, scopes)
           values ('membership-worker-01', 'tenant-alpha-01', 'user-worker-01', 'member', 'active', '{}')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("blocks a mandate that borrows a twin from another tenant", async () => {
    const { client } = await createHarness();
    await seed(client);

    await expect(
      client.query(
        `insert into app.delegation_mandates
           (id, tenant_id, originating_tenant_id, originating_actor_id, twin_binding_id,
            work_order_id, capabilities, purpose, budget_amount, budget_currency,
            issued_at, expires_at, revocation_version, proof_ref)
         values ('mandate-evil-01', 'tenant-alpha-01', 'tenant-operator-03', 'user-operator-03',
                 'twin-beta-02', 'work-order-alpha-01', array['sales.quote.calculate'], 'cross tenant',
                 10.00, 'EUR', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 1, 'proof-x')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("requires a work order for cross-tenant delegation and positive budget", async () => {
    const { client } = await createHarness();
    await seed(client);

    await expect(
      client.query(
        `insert into app.delegation_mandates
           (id, tenant_id, originating_tenant_id, originating_actor_id, twin_binding_id,
            work_order_id, capabilities, purpose, budget_amount, budget_currency,
            issued_at, expires_at, revocation_version, proof_ref)
         values ('mandate-evil-02', 'tenant-alpha-01', 'tenant-operator-03', 'user-operator-03',
                 'twin-alpha-01', null, array['sales.quote.calculate'], 'no work order',
                 10.00, 'EUR', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 1, 'proof-x')`,
      ),
    ).rejects.toThrow(/check constraint/i);

    await expect(
      client.query(
        `insert into app.delegation_mandates
           (id, tenant_id, originating_tenant_id, originating_actor_id, twin_binding_id,
            work_order_id, capabilities, purpose, budget_amount, budget_currency,
            issued_at, expires_at, revocation_version, proof_ref)
         values ('mandate-evil-03', 'tenant-alpha-01', 'tenant-operator-03', 'user-operator-03',
                 'twin-alpha-01', 'work-order-alpha-01', array['sales.quote.calculate'], 'zero budget',
                 0, 'EUR', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 1, 'proof-x')`,
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});
