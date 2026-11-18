import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import { createParentOutboxRepository } from "./outbox-repository.ts";
import { createTenantSession } from "./tenant-session.ts";
import { createHarness, seed } from "./test-support.ts";

const ALPHA = "tenant-alpha-01";
const BETA = "tenant-beta-02";
const HASH = `sha256:${"a".repeat(64)}`;

const entry = {
  id: "outbox-alpha-01",
  operationKey: "operation-outbox-0001",
  eventType: "ventas.proposal.created",
  payloadHash: HASH,
};

async function setup() {
  const { client } = await createHarness();
  await seed(client);
  const outbox = createParentOutboxRepository(() => createTenantSession(client));
  return { client, outbox };
}

/** Validation can throw before a promise exists, so the call is wrapped. */
async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

async function sentEntry() {
  const context = await setup();
  await context.outbox.enqueue(ALPHA, entry);
  const planned = await context.outbox.planAttempt({
    tenantId: ALPHA,
    operationKey: entry.operationKey,
  });
  if (!planned.allowed) throw new Error("unreachable");
  return context;
}

describe("outbox repository", () => {
  it("stores a pending entry once and rejects another payload under the same key", async () => {
    const { outbox } = await setup();

    const first = await outbox.enqueue(ALPHA, entry);
    expect(first.reused).toBe(false);
    expect(first.record.status).toBe("pending");
    expect(first.record.attempts).toBe(0);
    expect(first.record.ackRef).toBeUndefined();

    const replay = await outbox.enqueue(ALPHA, entry);
    expect(replay.reused).toBe(true);
    expect(replay.record.operationKey).toBe(entry.operationKey);

    expect(
      await codeOf(() =>
        outbox.enqueue(ALPHA, { ...entry, payloadHash: `sha256:${"b".repeat(64)}` }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
    expect(
      await codeOf(() =>
        outbox.enqueue(ALPHA, { ...entry, eventType: "ventas.quote.updated" }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
    expect(
      await codeOf(() => outbox.enqueue(ALPHA, { ...entry, payloadHash: "md5:abc" })),
    ).toBe("VALIDATION_FAILED");
  });

  it("allows one attempt and never sends while an ACK is pending", async () => {
    const { outbox } = await setup();
    await outbox.enqueue(ALPHA, entry);

    const first = await outbox.planAttempt({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
    });
    expect(first.allowed).toBe(true);
    if (!first.allowed) throw new Error("unreachable");
    expect(first.next.status).toBe("sent");
    expect(first.next.attempts).toBe(1);

    expect(
      await outbox.planAttempt({ tenantId: ALPHA, operationKey: entry.operationKey }),
    ).toEqual({
      allowed: false,
      reason: "awaiting_ack",
      reconciliationRequired: true,
    });

    expect(
      await codeOf(() =>
        outbox.planAttempt({ tenantId: ALPHA, operationKey: "missing" }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("records the ACK once and refuses it before a delivery attempt", async () => {
    const { outbox } = await sentEntry();

    const acked = await outbox.acknowledge({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
      ackRef: "parent-ack-01",
    });
    expect(acked.record.status).toBe("acked");
    expect(acked.record.ackRef).toBe("parent-ack-01");

    const replay = await outbox.acknowledge({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
      ackRef: "parent-ack-01",
    });
    expect(replay.reused).toBe(true);

    expect(
      await codeOf(() =>
        outbox.acknowledge({
          tenantId: ALPHA,
          operationKey: entry.operationKey,
          ackRef: "parent-ack-02",
        }),
      ),
    ).toBe("VERSION_CONFLICT");

    await outbox.enqueue(ALPHA, {
      ...entry,
      id: "outbox-alpha-02",
      operationKey: "operation-outbox-0002",
    });
    expect(
      await codeOf(() =>
        outbox.acknowledge({
          tenantId: ALPHA,
          operationKey: "operation-outbox-0002",
          ackRef: "parent-ack-03",
        }),
      ),
    ).toBe("HANDOFF_NOT_ACKED");
    expect(
      await codeOf(() =>
        outbox.acknowledge({
          tenantId: ALPHA,
          operationKey: entry.operationKey,
          ackRef: "",
        }),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      await codeOf(() =>
        outbox.acknowledge({
          tenantId: ALPHA,
          operationKey: "missing",
          ackRef: "parent-ack-04",
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("reconciles a timeout before allowing another attempt", async () => {
    const { outbox } = await sentEntry();

    const timedOut = await outbox.markTimeout({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
    });
    expect(timedOut.status).toBe("unknown");
    expect(timedOut.lastError).toBe("provider_timeout");

    expect(
      await outbox.planAttempt({ tenantId: ALPHA, operationKey: entry.operationKey }),
    ).toEqual({
      allowed: false,
      reason: "reconciliation_required",
      reconciliationRequired: true,
    });

    const missing = await outbox.reconcile({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
      found: false,
    });
    expect(missing.record.status).toBe("failed");
    expect(missing.record.lastError).toBe("reconciled_not_delivered");
    expect(missing.retryAllowed).toBe(true);

    const retried = await outbox.planAttempt({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
    });
    expect(retried.allowed).toBe(true);
    if (!retried.allowed) throw new Error("unreachable");
    expect(retried.next.attempts).toBe(2);

    await outbox.markTimeout({ tenantId: ALPHA, operationKey: entry.operationKey });
    const found = await outbox.reconcile({
      tenantId: ALPHA,
      operationKey: entry.operationKey,
      found: true,
      ackRef: "parent-ack-09",
    });
    expect(found.record.status).toBe("acked");
    expect(found.record.ackRef).toBe("parent-ack-09");
    expect(found.retryAllowed).toBe(false);
  });

  it("stops at the attempt ceiling and only reconciles a delivered entry", async () => {
    const { outbox } = await setup();
    await outbox.enqueue(ALPHA, entry);

    expect(
      await codeOf(() =>
        outbox.reconcile({
          tenantId: ALPHA,
          operationKey: entry.operationKey,
          found: false,
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    for (const attempt of [1, 2]) {
      const planned = await outbox.planAttempt({
        tenantId: ALPHA,
        operationKey: entry.operationKey,
      });
      expect(planned.allowed).toBe(true);
      if (!planned.allowed || planned.next.attempts !== attempt) {
        throw new Error("unexpected plan");
      }
      await outbox.markTimeout({ tenantId: ALPHA, operationKey: entry.operationKey });
      await outbox.reconcile({
        tenantId: ALPHA,
        operationKey: entry.operationKey,
        found: false,
      });
    }

    expect(
      await outbox.planAttempt({
        tenantId: ALPHA,
        operationKey: entry.operationKey,
        maxAttempts: 2,
      }),
    ).toEqual({
      allowed: false,
      reason: "attempts_exhausted",
      reconciliationRequired: false,
    });
  });

  it("keeps every tenant's outbox isolated and enforces the ACK invariant in SQL", async () => {
    const { client, outbox } = await sentEntry();

    expect(
      await outbox.find({ tenantId: BETA, operationKey: entry.operationKey }),
    ).toBeNull();
    expect(
      await codeOf(() =>
        outbox.acknowledge({
          tenantId: BETA,
          operationKey: entry.operationKey,
          ackRef: "parent-ack-01",
        }),
      ),
    ).toBe("NOT_FOUND");

    const session = createTenantSession(client);
    await expect(
      session.withTenant({ tenantId: ALPHA }, (tx) =>
        tx.query(
          `insert into app.parent_outbox
             (id, tenant_id, operation_key, event_type, payload_hash, status)
           values ('outbox-alpha-acked', $1, 'operation-outbox-0003',
                   'ventas.proposal.created', $2, 'acked')`,
          [ALPHA, HASH],
        ),
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});
