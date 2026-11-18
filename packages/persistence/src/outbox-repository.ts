import type { Pool } from "pg";
import { ServiceError } from "@agntia-ventas/contracts";
import { createPgConnection } from "./pg.ts";
import { createTenantSession } from "./tenant-session.ts";
import type { ScopedSqlClient, SqlClient } from "./types.ts";

type SessionFactory = () => ScopedSqlClient;

// ---------------------------------------------------------------------------
// C36/C38 — durable parent bridge outbox
// ---------------------------------------------------------------------------

/**
 * Same state machine as `packages/sales/src/outbox.ts`, persisted per tenant:
 * an emitted event is not a delivery and a delivery is not an ACK. The
 * operation key is unique per tenant, so a replay reuses the row and a
 * different payload under the same key is a conflict.
 */

export type OutboxStatus = "pending" | "sent" | "acked" | "failed" | "unknown";

export interface OutboxRecordInput {
  readonly id: string;
  readonly operationKey: string;
  readonly eventType: string;
  readonly payloadHash: string;
}

export interface OutboxRecord extends OutboxRecordInput {
  readonly tenantId: string;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly ackRef?: string;
  readonly lastError?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type OutboxBlockedReason =
  | "already_acked"
  | "awaiting_ack"
  | "reconciliation_required"
  | "attempts_exhausted";

export type OutboxDeliveryPlan =
  | { readonly allowed: true; readonly next: OutboxRecord }
  | {
      readonly allowed: false;
      readonly reason: OutboxBlockedReason;
      readonly reconciliationRequired: boolean;
    };

export interface OutboxReconciliation {
  readonly record: OutboxRecord;
  readonly retryAllowed: boolean;
}

export interface ParentOutboxRepository {
  enqueue(
    tenantId: string,
    input: OutboxRecordInput,
  ): Promise<{ readonly record: OutboxRecord; readonly reused: boolean }>;
  find(input: {
    readonly tenantId: string;
    readonly operationKey: string;
  }): Promise<OutboxRecord | null>;
  planAttempt(input: {
    readonly tenantId: string;
    readonly operationKey: string;
    readonly maxAttempts?: number;
  }): Promise<OutboxDeliveryPlan>;
  markTimeout(input: {
    readonly tenantId: string;
    readonly operationKey: string;
  }): Promise<OutboxRecord>;
  acknowledge(input: {
    readonly tenantId: string;
    readonly operationKey: string;
    readonly ackRef: string;
  }): Promise<{ readonly record: OutboxRecord; readonly reused: boolean }>;
  reconcile(input: {
    readonly tenantId: string;
    readonly operationKey: string;
    readonly found: boolean;
    readonly ackRef?: string;
  }): Promise<OutboxReconciliation>;
}

interface OutboxRow {
  id: string;
  tenant_id: string;
  operation_key: string;
  event_type: string;
  payload_hash: string;
  status: string;
  attempts: number;
  ack_ref: string | null;
  last_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const PAYLOAD_HASH = /^sha256:[a-f0-9]{64}$/;

const COLUMNS = `id, tenant_id, operation_key, event_type, payload_hash, status,
  attempts, ack_ref, last_error, created_at, updated_at`;

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

function toRecord(row: OutboxRow): OutboxRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    operationKey: row.operation_key,
    eventType: row.event_type,
    payloadHash: row.payload_hash,
    status: row.status as OutboxStatus,
    attempts: Number(row.attempts),
    ...(row.ack_ref ? { ackRef: row.ack_ref } : {}),
    ...(row.last_error ? { lastError: row.last_error } : {}),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function readRow(
  tx: SqlClient,
  tenantId: string,
  operationKey: string,
): Promise<OutboxRow | null> {
  const { rows } = await tx.query<OutboxRow>(
    `select ${COLUMNS} from app.parent_outbox
      where tenant_id = $1 and operation_key = $2 limit 1`,
    [tenantId, operationKey],
  );
  return rows[0] ?? null;
}

async function requireRow(
  tx: SqlClient,
  tenantId: string,
  operationKey: string,
): Promise<OutboxRow> {
  const row = await readRow(tx, tenantId, operationKey);
  if (!row) {
    throw new ServiceError("NOT_FOUND", "outbox entry not found");
  }
  return row;
}

function blockedReason(
  row: OutboxRow,
  maxAttempts: number,
): Extract<OutboxDeliveryPlan, { allowed: false }> | null {
  if (row.status === "acked") {
    return { allowed: false, reason: "already_acked", reconciliationRequired: false };
  }
  if (row.status === "sent") {
    return { allowed: false, reason: "awaiting_ack", reconciliationRequired: true };
  }
  if (row.status === "unknown") {
    return {
      allowed: false,
      reason: "reconciliation_required",
      reconciliationRequired: true,
    };
  }
  if (Number(row.attempts) >= maxAttempts) {
    return {
      allowed: false,
      reason: "attempts_exhausted",
      reconciliationRequired: false,
    };
  }
  return null;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23505" || /duplicate key|unique constraint/i.test(String(error));
}

export function createParentOutboxRepository(
  createSession: SessionFactory,
): ParentOutboxRepository {
  return {
    enqueue(tenantId, input) {
      if (!input.id) {
        throw new ServiceError("VALIDATION_FAILED", "outbox entry needs an id");
      }
      if (!input.operationKey) {
        throw new ServiceError("VALIDATION_FAILED", "outbox entry needs an operation key");
      }
      if (!input.eventType) {
        throw new ServiceError("VALIDATION_FAILED", "outbox entry needs an event type");
      }
      if (!PAYLOAD_HASH.test(input.payloadHash)) {
        throw new ServiceError("VALIDATION_FAILED", "outbox entry needs a payload hash");
      }

      return createSession().withTenant({ tenantId }, async (tx) => {
        const found = await readRow(tx, tenantId, input.operationKey);
        if (found) {
          const record = toRecord(found);
          if (
            record.payloadHash !== input.payloadHash ||
            record.eventType !== input.eventType
          ) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "same operation key with a different payload",
              { details: { operationKey: input.operationKey } },
            );
          }
          return { record, reused: true };
        }

        try {
          const inserted = await tx.query<OutboxRow>(
            `insert into app.parent_outbox
               (id, tenant_id, operation_key, event_type, payload_hash)
             values ($1, $2, $3, $4, $5)
             returning ${COLUMNS}`,
            [input.id, tenantId, input.operationKey, input.eventType, input.payloadHash],
          );
          return { record: toRecord(inserted.rows[0]!), reused: false };
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "a concurrent operation already stored this outbox entry",
            );
          }
          throw error;
        }
      });
    },

    find({ tenantId, operationKey }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const row = await readRow(tx, tenantId, operationKey);
        return row ? toRecord(row) : null;
      });
    },

    planAttempt({ tenantId, operationKey, maxAttempts = 5 }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const current = await requireRow(tx, tenantId, operationKey);
        const blocked = blockedReason(current, maxAttempts);
        if (blocked) {
          return blocked;
        }

        // Conditional on the attempts we just read: two workers cannot both
        // turn the same attempt into a delivery.
        const updated = await tx.query<OutboxRow>(
          `update app.parent_outbox
              set status = 'sent', attempts = attempts + 1, updated_at = now()
            where tenant_id = $1 and operation_key = $2
              and status in ('pending', 'failed') and attempts = $3
            returning ${COLUMNS}`,
          [tenantId, operationKey, current.attempts],
        );
        const row = updated.rows[0];
        if (row) {
          return { allowed: true, next: toRecord(row) };
        }

        const reread = await requireRow(tx, tenantId, operationKey);
        const raced = blockedReason(reread, maxAttempts);
        if (raced) {
          return raced;
        }
        throw new ServiceError(
          "VERSION_CONFLICT",
          "outbox entry changed while planning a delivery attempt",
        );
      });
    },

    markTimeout({ tenantId, operationKey }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const updated = await tx.query<OutboxRow>(
          `update app.parent_outbox
              set status = 'unknown', last_error = 'provider_timeout', updated_at = now()
            where tenant_id = $1 and operation_key = $2 and status = 'sent'
            returning ${COLUMNS}`,
          [tenantId, operationKey],
        );
        const row = updated.rows[0];
        if (row) {
          return toRecord(row);
        }
        const current = await requireRow(tx, tenantId, operationKey);
        throw new ServiceError("VALIDATION_FAILED", "only a sent entry can time out", {
          details: { status: current.status },
        });
      });
    },

    acknowledge({ tenantId, operationKey, ackRef }) {
      if (!ackRef) {
        throw new ServiceError("VALIDATION_FAILED", "ACK needs a reference");
      }
      return createSession().withTenant({ tenantId }, async (tx) => {
        const current = await requireRow(tx, tenantId, operationKey);
        if (current.status === "acked") {
          if (current.ack_ref === ackRef) {
            return { record: toRecord(current), reused: true };
          }
          throw new ServiceError(
            "VERSION_CONFLICT",
            "entry was acknowledged with another reference",
          );
        }
        if (current.status === "pending" || current.status === "failed") {
          throw new ServiceError(
            "HANDOFF_NOT_ACKED",
            "ACK received for an event without a delivery attempt",
            { details: { status: current.status } },
          );
        }

        const updated = await tx.query<OutboxRow>(
          `update app.parent_outbox
              set status = 'acked', ack_ref = $3, updated_at = now()
            where tenant_id = $1 and operation_key = $2
              and status in ('sent', 'unknown')
            returning ${COLUMNS}`,
          [tenantId, operationKey, ackRef],
        );
        const row = updated.rows[0];
        if (row) {
          return { record: toRecord(row), reused: false };
        }

        const reread = await requireRow(tx, tenantId, operationKey);
        if (reread.status === "acked" && reread.ack_ref === ackRef) {
          return { record: toRecord(reread), reused: true };
        }
        throw new ServiceError(
          "VERSION_CONFLICT",
          "outbox entry changed while recording the ACK",
        );
      });
    },

    reconcile({ tenantId, operationKey, found, ackRef }) {
      if (found && !ackRef) {
        throw new ServiceError(
          "VALIDATION_FAILED",
          "reconciliation that finds the event needs an ACK reference",
        );
      }
      return createSession().withTenant({ tenantId }, async (tx) => {
        const current = await requireRow(tx, tenantId, operationKey);
        if (current.status !== "sent" && current.status !== "unknown") {
          throw new ServiceError(
            "VALIDATION_FAILED",
            "only a sent or unknown entry needs reconciliation",
            { details: { status: current.status } },
          );
        }

        const updated = found
          ? await tx.query<OutboxRow>(
              `update app.parent_outbox
                  set status = 'acked', ack_ref = $3, last_error = null, updated_at = now()
                where tenant_id = $1 and operation_key = $2
                  and status in ('sent', 'unknown')
                returning ${COLUMNS}`,
              [tenantId, operationKey, ackRef],
            )
          : await tx.query<OutboxRow>(
              `update app.parent_outbox
                  set status = 'failed', last_error = 'reconciled_not_delivered',
                      updated_at = now()
                where tenant_id = $1 and operation_key = $2
                  and status in ('sent', 'unknown')
                returning ${COLUMNS}`,
              [tenantId, operationKey],
            );

        const row = updated.rows[0];
        if (!row) {
          throw new ServiceError(
            "VERSION_CONFLICT",
            "outbox entry changed while reconciling",
          );
        }
        return { record: toRecord(row), retryAllowed: !found };
      });
    },
  };
}

/** Production factory: one pooled connection per call, so RLS applies per transaction. */
export function createPooledOutboxRepository(pool: Pool): ParentOutboxRepository {
  const connections = createPgConnection(pool);
  const withSession = <T>(fn: (client: SqlClient) => Promise<T>): Promise<T> =>
    connections.withConnection(fn);

  return {
    enqueue: (tenantId, input) =>
      withSession((client) =>
        createParentOutboxRepository(() => createTenantSession(client)).enqueue(
          tenantId,
          input,
        ),
      ),
    find: (lookup) =>
      withSession((client) =>
        createParentOutboxRepository(() => createTenantSession(client)).find(lookup),
      ),
    planAttempt: (input) =>
      withSession((client) =>
        createParentOutboxRepository(() => createTenantSession(client)).planAttempt(input),
      ),
    markTimeout: (input) =>
      withSession((client) =>
        createParentOutboxRepository(() => createTenantSession(client)).markTimeout(input),
      ),
    acknowledge: (input) =>
      withSession((client) =>
        createParentOutboxRepository(() => createTenantSession(client)).acknowledge(input),
      ),
    reconcile: (input) =>
      withSession((client) =>
        createParentOutboxRepository(() => createTenantSession(client)).reconcile(input),
      ),
  };
}
