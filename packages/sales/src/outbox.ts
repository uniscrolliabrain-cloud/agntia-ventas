import { ServiceError } from "@agntia-ventas/contracts";
import type { ParentEventType } from "./bridge.ts";

// ---------------------------------------------------------------------------
// C36 — parent bridge outbox and ACK
// ---------------------------------------------------------------------------

/**
 * An emitted event is not a delivery and a delivery is not an ACK. The outbox
 * is deterministic: a repeated operation key reuses the entry, a different
 * payload is a conflict, and a timed-out delivery is reconciled by lookup
 * instead of being retried blindly.
 */

export type OutboxStatus = "pending" | "sent" | "acked" | "failed" | "unknown";

export interface OutboxEntry {
  readonly operationKey: string;
  readonly eventType: ParentEventType;
  readonly payloadHash: string;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly updatedAt: string;
  readonly ackRef?: string;
  readonly lastError?: string;
}

const PAYLOAD_HASH = /^sha256:[a-f0-9]{64}$/;

export function enqueueParentEvent(input: {
  readonly entries: readonly OutboxEntry[];
  readonly operationKey: string;
  readonly eventType: ParentEventType;
  readonly payloadHash: string;
  readonly now: string;
}): { readonly entry: OutboxEntry; readonly entries: readonly OutboxEntry[]; readonly reused: boolean } {
  if (!input.operationKey) {
    throw new ServiceError("VALIDATION_FAILED", "outbox entry needs an operation key");
  }
  if (!PAYLOAD_HASH.test(input.payloadHash)) {
    throw new ServiceError("VALIDATION_FAILED", "outbox entry needs a payload hash");
  }

  const existing = input.entries.find((entry) => entry.operationKey === input.operationKey);
  if (existing) {
    if (existing.payloadHash !== input.payloadHash || existing.eventType !== input.eventType) {
      throw new ServiceError(
        "IDEMPOTENCY_CONFLICT",
        "same operation key with a different payload",
        { details: { operationKey: input.operationKey } },
      );
    }
    return { entry: existing, entries: input.entries, reused: true };
  }

  const entry: OutboxEntry = {
    operationKey: input.operationKey,
    eventType: input.eventType,
    payloadHash: input.payloadHash,
    status: "pending",
    attempts: 0,
    updatedAt: input.now,
  };
  return { entry, entries: [...input.entries, entry], reused: false };
}

export type DeliveryPlan =
  | { readonly allowed: true; readonly next: OutboxEntry }
  | {
      readonly allowed: false;
      readonly reason:
        | "already_acked"
        | "awaiting_ack"
        | "reconciliation_required"
        | "attempts_exhausted";
      readonly reconciliationRequired: boolean;
    };

/**
 * A `sent` or `unknown` entry cannot be re-sent: the previous attempt may have
 * reached the parent. Only reconciliation unlocks another attempt.
 */
export function planDeliveryAttempt(input: {
  readonly entry: OutboxEntry;
  readonly now: string;
  readonly maxAttempts?: number;
}): DeliveryPlan {
  const maxAttempts = input.maxAttempts ?? 5;
  const { entry } = input;

  if (entry.status === "acked") {
    return { allowed: false, reason: "already_acked", reconciliationRequired: false };
  }
  if (entry.status === "sent") {
    return { allowed: false, reason: "awaiting_ack", reconciliationRequired: true };
  }
  if (entry.status === "unknown") {
    return {
      allowed: false,
      reason: "reconciliation_required",
      reconciliationRequired: true,
    };
  }
  if (entry.attempts >= maxAttempts) {
    return {
      allowed: false,
      reason: "attempts_exhausted",
      reconciliationRequired: false,
    };
  }

  return {
    allowed: true,
    next: {
      ...entry,
      status: "sent",
      attempts: entry.attempts + 1,
      updatedAt: input.now,
    },
  };
}

export function markDeliveryTimeout(input: {
  readonly entry: OutboxEntry;
  readonly now: string;
}): OutboxEntry {
  if (input.entry.status !== "sent") {
    throw new ServiceError("VALIDATION_FAILED", "only a sent entry can time out");
  }
  return {
    ...input.entry,
    status: "unknown",
    updatedAt: input.now,
    lastError: "provider_timeout",
  };
}

/**
 * A parent ACK closes the entry. An ACK for an entry that was never sent is
 * rejected: an event nobody delivered cannot be acknowledged.
 */
export function applyParentAck(input: {
  readonly entries: readonly OutboxEntry[];
  readonly operationKey: string;
  readonly ackRef: string;
  readonly now: string;
}): { readonly entries: readonly OutboxEntry[]; readonly reused: boolean } {
  if (!input.ackRef) {
    throw new ServiceError("VALIDATION_FAILED", "ACK needs a reference");
  }
  const index = input.entries.findIndex((entry) => entry.operationKey === input.operationKey);
  const entry = index >= 0 ? input.entries[index] : undefined;
  if (!entry) {
    throw new ServiceError("NOT_FOUND", "outbox entry not found");
  }
  if (entry.status === "acked") {
    if (entry.ackRef === input.ackRef) {
      return { entries: input.entries, reused: true };
    }
    throw new ServiceError("VERSION_CONFLICT", "entry was acknowledged with another reference");
  }
  if (entry.status === "pending" || entry.status === "failed") {
    throw new ServiceError(
      "HANDOFF_NOT_ACKED",
      "ACK received for an event without a delivery attempt",
      { details: { status: entry.status } },
    );
  }

  const next: OutboxEntry = {
    ...entry,
    status: "acked",
    ackRef: input.ackRef,
    updatedAt: input.now,
  };
  const entries = [...input.entries];
  entries[index] = next;
  return { entries, reused: false };
}

export type OutboxLookup =
  | { readonly found: false }
  | { readonly found: true; readonly ackRef: string };

/**
 * After a timeout the core asks the parent what happened. If the event is
 * there, it is acknowledged. If it is not, the entry may be attempted again
 * with the same operation key (the parent deduplicates on it).
 */
export function reconcileOutboxAfterTimeout(input: {
  readonly entry: OutboxEntry;
  readonly lookup: OutboxLookup;
  readonly now: string;
}): { readonly entry: OutboxEntry; readonly retryAllowed: boolean } {
  if (input.entry.status !== "unknown" && input.entry.status !== "sent") {
    throw new ServiceError(
      "VALIDATION_FAILED",
      "only a sent or unknown entry needs reconciliation",
    );
  }

  if (input.lookup.found) {
    return {
      entry: {
        ...input.entry,
        status: "acked",
        ackRef: input.lookup.ackRef,
        updatedAt: input.now,
      },
      retryAllowed: false,
    };
  }

  return {
    entry: {
      ...input.entry,
      status: "failed",
      updatedAt: input.now,
      lastError: "reconciled_not_delivered",
    },
    retryAllowed: true,
  };
}

// ---------------------------------------------------------------------------
// STUB (C36) — parent transport
// ---------------------------------------------------------------------------

/**
 * STUB C36: the transport to the parent agent is not implemented and it is not
 * verified. `agntia-ventas` must not guess the parent's endpoint, signing
 * scheme or event schema, and must never write to the sibling `agente` repo.
 * Required before this can be enabled, all server-side:
 *   - HOST_BRIDGE_BASE_URL (https, allowlisted)
 *   - HOST_BRIDGE_SIGNING_KEY_REF (reference, never a value in code)
 *   - HOST_BRIDGE_EVENT_SCHEMA_VERSION published by the parent
 *   - a parent-side ACK endpoint with receipts
 * Until then every send fails closed with NOT_IMPLEMENTED.
 */
export interface ParentTransport {
  send(entry: OutboxEntry): Promise<{ readonly receiptId: string }>;
}

export const PARENT_TRANSPORT_STUB: {
  readonly status: "HOST_BRIDGE_NOT_VERIFIED";
  readonly campaign: "C36";
  readonly requires: readonly string[];
} = {
  status: "HOST_BRIDGE_NOT_VERIFIED",
  campaign: "C36",
  requires: [
    "HOST_BRIDGE_BASE_URL",
    "HOST_BRIDGE_SIGNING_KEY_REF",
    "HOST_BRIDGE_EVENT_SCHEMA_VERSION",
  ],
};

export function createParentTransport(): ParentTransport {
  return {
    async send() {
      throw new ServiceError(
        "NOT_IMPLEMENTED",
        "parent bridge transport is HOST_BRIDGE_NOT_VERIFIED",
        { details: { campaign: "C36", status: PARENT_TRANSPORT_STUB.status } },
      );
    },
  };
}

export const OUTBOX_STATUS = {
  store: "IN_MEMORY_ONLY",
  transport: "STUB",
  reconciliation: "implemented",
} as const;
