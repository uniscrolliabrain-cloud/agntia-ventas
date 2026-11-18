import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  OUTBOX_STATUS,
  applyParentAck,
  createParentTransport,
  enqueueParentEvent,
  markDeliveryTimeout,
  planDeliveryAttempt,
  reconcileOutboxAfterTimeout,
  type OutboxEntry,
} from "./outbox.ts";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

async function asyncCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

const hash = `sha256:${"a".repeat(64)}`;
const now = "2026-11-18T09:00:00Z";

function enqueued(): OutboxEntry {
  return enqueueParentEvent({
    entries: [],
    operationKey: "operation-0001",
    eventType: "ventas.proposal.created",
    payloadHash: hash,
    now,
  }).entry;
}

describe("outbox enqueue", () => {
  it("reuses the same operation key and rejects a different payload", () => {
    const first = enqueueParentEvent({
      entries: [],
      operationKey: "operation-0001",
      eventType: "ventas.proposal.created",
      payloadHash: hash,
      now,
    });
    expect(first.reused).toBe(false);
    expect(first.entry.status).toBe("pending");

    const replay = enqueueParentEvent({
      entries: first.entries,
      operationKey: "operation-0001",
      eventType: "ventas.proposal.created",
      payloadHash: hash,
      now,
    });
    expect(replay.reused).toBe(true);
    expect(replay.entries).toHaveLength(1);

    expect(
      codeOf(() =>
        enqueueParentEvent({
          entries: first.entries,
          operationKey: "operation-0001",
          eventType: "ventas.quote.updated",
          payloadHash: `sha256:${"b".repeat(64)}`,
          now,
        }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("requires an operation key and a sha256 payload hash", () => {
    expect(
      codeOf(() =>
        enqueueParentEvent({
          entries: [],
          operationKey: "",
          eventType: "ventas.proposal.created",
          payloadHash: hash,
          now,
        }),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() =>
        enqueueParentEvent({
          entries: [],
          operationKey: "operation-0001",
          eventType: "ventas.proposal.created",
          payloadHash: "md5:abc",
          now,
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("delivery and acknowledgement", () => {
  it("allows one attempt and never re-sends while an ACK is pending", () => {
    const first = planDeliveryAttempt({ entry: enqueued(), now });
    expect(first.allowed).toBe(true);
    if (!first.allowed) throw new Error("unreachable");
    expect(first.next.status).toBe("sent");
    expect(first.next.attempts).toBe(1);

    const second = planDeliveryAttempt({ entry: first.next, now });
    expect(second).toEqual({
      allowed: false,
      reason: "awaiting_ack",
      reconciliationRequired: true,
    });
  });

  it("stops at the attempt ceiling", () => {
    const entry: OutboxEntry = { ...enqueued(), status: "failed", attempts: 3 };
    expect(planDeliveryAttempt({ entry, now, maxAttempts: 3 })).toEqual({
      allowed: false,
      reason: "attempts_exhausted",
      reconciliationRequired: false,
    });
  });

  it("records an ACK once and rejects an ACK for something never sent", () => {
    const sent = planDeliveryAttempt({ entry: enqueued(), now });
    if (!sent.allowed) throw new Error("unreachable");

    const acked = applyParentAck({
      entries: [sent.next],
      operationKey: "operation-0001",
      ackRef: "parent-ack-01",
      now,
    });
    expect(acked.entries[0]?.status).toBe("acked");
    expect(acked.entries[0]?.ackRef).toBe("parent-ack-01");

    const replay = applyParentAck({
      entries: acked.entries,
      operationKey: "operation-0001",
      ackRef: "parent-ack-01",
      now,
    });
    expect(replay.reused).toBe(true);

    expect(
      codeOf(() =>
        applyParentAck({
          entries: acked.entries,
          operationKey: "operation-0001",
          ackRef: "parent-ack-02",
          now,
        }),
      ),
    ).toBe("VERSION_CONFLICT");

    expect(
      codeOf(() =>
        applyParentAck({
          entries: [enqueued()],
          operationKey: "operation-0001",
          ackRef: "parent-ack-01",
          now,
        }),
      ),
    ).toBe("HANDOFF_NOT_ACKED");

    expect(
      codeOf(() =>
        applyParentAck({ entries: [], operationKey: "missing", ackRef: "a", now }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("never plans a retry after a timeout until reconciliation says it is missing", () => {
    const sent = planDeliveryAttempt({ entry: enqueued(), now });
    if (!sent.allowed) throw new Error("unreachable");

    const timedOut = markDeliveryTimeout({ entry: sent.next, now });
    expect(timedOut.status).toBe("unknown");
    expect(planDeliveryAttempt({ entry: timedOut, now }).allowed).toBe(false);

    const delivered = reconcileOutboxAfterTimeout({
      entry: timedOut,
      lookup: { found: true, ackRef: "parent-ack-09" },
      now,
    });
    expect(delivered.entry.status).toBe("acked");
    expect(delivered.retryAllowed).toBe(false);

    const missing = reconcileOutboxAfterTimeout({
      entry: timedOut,
      lookup: { found: false },
      now,
    });
    expect(missing.entry.status).toBe("failed");
    expect(missing.retryAllowed).toBe(true);
    expect(planDeliveryAttempt({ entry: missing.entry, now }).allowed).toBe(true);
  });

  it("only reconciles an entry that left the pending state", () => {
    expect(
      codeOf(() =>
        reconcileOutboxAfterTimeout({ entry: enqueued(), lookup: { found: false }, now }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("parent transport stub", () => {
  it("fails closed with NOT_IMPLEMENTED and declares what it needs", async () => {
    expect(await asyncCodeOf(createParentTransport().send(enqueued()))).toBe("NOT_IMPLEMENTED");
    expect(OUTBOX_STATUS.transport).toBe("STUB");
    expect(OUTBOX_STATUS.store).toBe("IN_MEMORY_ONLY");
  });
});
