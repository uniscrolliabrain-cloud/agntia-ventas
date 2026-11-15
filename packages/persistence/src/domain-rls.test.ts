import { describe, expect, it } from "vitest";
import { createTenantSession } from "./tenant-session.ts";
import { createHarness, seed } from "./test-support.ts";
import type { SqlClient } from "./types.ts";

const ALPHA = { tenantId: "tenant-alpha-01", actorId: "user-alpha-01" };
const BETA = { tenantId: "tenant-beta-02", actorId: "user-beta-02" };

describe("domain tables under RLS", () => {
  it("shows each tenant only its own commercial rows", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    const alpha = await session.withTenant(ALPHA, (tx) =>
      tx.query<{ id: string }>("select id from app.accounts order by id"),
    );
    const beta = await session.withTenant(BETA, (tx) =>
      tx.query<{ id: string }>("select id from app.accounts order by id"),
    );

    expect(alpha.rows.map((row) => row.id)).toEqual(["account-alpha-01"]);
    expect(beta.rows.map((row) => row.id)).toEqual(["account-beta-02"]);
  });

  it("returns nothing without a verified tenant", async () => {
    const { client } = await createHarness();
    await seed(client);

    // The harness superuser bypasses RLS, so the check runs as the API role.
    await client.exec("begin");
    await client.exec("set local role app_user");
    const unscoped = await client.query<{ count: string }>(
      "select count(*)::text as count from app.opportunities",
    );
    await client.exec("commit");

    expect(unscoped.rows[0]?.count).toBe("0");
  });

  it("rejects a write into another tenant", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    await expect(
      session.withTenant(ALPHA, (tx) =>
        tx.query(
          `insert into app.accounts (id, tenant_id, display_name, source_ref, source_hash)
           values ('account-evil-01', 'tenant-beta-02', 'Evil', 'seed', 'sha256:cccc')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("cannot attach a row to another tenant's account", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    await expect(
      session.withTenant(ALPHA, (tx) =>
        tx.query(
          `insert into app.contacts (id, tenant_id, account_id, full_name)
           values ('contact-evil-01', 'tenant-alpha-01', 'account-beta-02', 'Evil')`,
        ),
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("enforces the schema invariants in the database too", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    // A confirmed activity needs a receipt.
    await expect(
      session.withTenant(ALPHA, (tx) =>
        tx.query(
          `insert into app.activities
             (id, tenant_id, opportunity_id, kind, occurred_at, status)
           values ('activity-evil-01', 'tenant-alpha-01', 'opportunity-alpha-01',
                   'call', now(), 'confirmed')`,
        ),
      ),
    ).rejects.toThrow(/check constraint/i);

    // A handoff in progress needs the receiver ACK.
    await expect(
      session.withTenant(ALPHA, (tx) =>
        tx.query(
          `insert into app.handoffs (id, tenant_id, opportunity_id, receiver_ref, status)
           values ('handoff-evil-01', 'tenant-alpha-01', 'opportunity-alpha-01',
                   'receiver-01', 'working')`,
        ),
      ),
    ).rejects.toThrow(/check constraint/i);

    // A candidate permission is all-or-nothing.
    await expect(
      session.withTenant(ALPHA, (tx) =>
        tx.query(
          `insert into app.candidates
             (id, tenant_id, contact_id, source_credit, discovered_at, permission_basis)
           values ('candidate-evil-01', 'tenant-alpha-01', 'contact-alpha-01',
                   'seed', now(), 'consent')`,
        ),
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it("records a confirmed activity with its receipt", async () => {
    const { client } = await createHarness();
    await seed(client);
    const session = createTenantSession(client);

    const inserted = await session.withTenant(ALPHA, async (tx: SqlClient) => {
      await tx.query(
        `insert into app.activities
           (id, tenant_id, opportunity_id, kind, occurred_at, receipt_ref, status)
         values ('activity-alpha-01', 'tenant-alpha-01', 'opportunity-alpha-01',
                 'email', '2026-11-15T10:00:00Z', 'receipt-01', 'confirmed')`,
      );
      return tx.query<{ id: string; status: string }>(
        "select id, status from app.activities where tenant_id = $1",
        ["tenant-alpha-01"],
      );
    });

    expect(inserted.rows).toEqual([{ id: "activity-alpha-01", status: "confirmed" }]);
  });
});
