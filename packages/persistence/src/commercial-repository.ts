import type { Pool } from "pg";
import { ServiceError } from "@agntia-ventas/contracts";
import { createPgConnection } from "./pg.ts";
import { createTenantSession } from "./tenant-session.ts";
import type { ScopedSqlClient, SqlClient } from "./types.ts";

type SessionFactory = () => ScopedSqlClient;

export interface QuoteRecordInput {
  readonly id: string;
  readonly opportunityId: string;
  readonly operationKey: string;
  readonly priceBookVersion: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly tax: string;
  readonly total: string;
  readonly currency: string;
  readonly contentHash: string;
}

export interface QuoteRecord extends QuoteRecordInput {
  readonly tenantId: string;
  readonly createdAt: string;
}

export interface QuoteRepository {
  save(
    tenantId: string,
    input: QuoteRecordInput,
  ): Promise<{ readonly record: QuoteRecord; readonly reused: boolean }>;
  find(input: { readonly tenantId: string; readonly id: string }): Promise<QuoteRecord | null>;
}

export interface ApprovalRecordInput {
  readonly id: string;
  readonly operationKey: string;
  readonly resourceRef: string;
  readonly resourceVersion: number;
  readonly payloadHash: string;
  readonly rightsHash: string;
  readonly policyHash: string;
  readonly reviewerId: string;
  readonly proofRef: string;
  readonly recipient: string;
  readonly channel: string;
  readonly costCeiling: string;
  readonly costCeilingCurrency: string;
  readonly expiresAt: string;
  readonly revocationVersion: number;
}

export interface ApprovalRecord extends ApprovalRecordInput {
  readonly tenantId: string;
  readonly status: "active" | "revoked" | "consumed";
  readonly createdAt: string;
}

export interface ApprovalRepository {
  save(
    tenantId: string,
    input: ApprovalRecordInput,
  ): Promise<{ readonly record: ApprovalRecord; readonly reused: boolean }>;
  revoke(input: {
    readonly tenantId: string;
    readonly id: string;
    readonly expectedVersion: number;
  }): Promise<{ readonly record: ApprovalRecord; readonly reused: boolean }>;
  find(input: { readonly tenantId: string; readonly id: string }): Promise<ApprovalRecord | null>;
}

export interface BudgetReservationRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly operationKey: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: "reserved" | "consumed" | "released";
  readonly createdAt: string;
}

export interface BudgetRepository {
  reserve(input: {
    readonly tenantId: string;
    readonly id: string;
    readonly operationKey: string;
    readonly amount: string;
    readonly currency: string;
  }): Promise<{ readonly record: BudgetReservationRecord; readonly reused: boolean }>;
}

interface QuoteRow {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  operation_key: string;
  price_book_version: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  currency: string;
  content_hash: string;
  created_at: Date | string;
}

interface ApprovalRow {
  id: string;
  tenant_id: string;
  operation_key: string;
  resource_ref: string;
  resource_version: number;
  payload_hash: string;
  rights_hash: string;
  policy_hash: string;
  reviewer_id: string;
  proof_ref: string;
  recipient: string;
  channel: string;
  cost_ceiling: string;
  cost_ceiling_currency: string;
  expires_at: Date | string;
  revocation_version: number;
  status: string;
  created_at: Date | string;
}

interface BudgetRow {
  id: string;
  tenant_id: string;
  operation_key: string;
  amount: string;
  currency: string;
  status: string;
  created_at: Date | string;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

/** numeric(20,8) pads zeros; idempotency compares the value, not the scale. */
const sameAmount = (left: string, right: string): boolean =>
  left.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") ===
  right.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

function toQuote(row: QuoteRow): QuoteRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    opportunityId: row.opportunity_id,
    operationKey: row.operation_key,
    priceBookVersion: row.price_book_version,
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    currency: row.currency,
    contentHash: row.content_hash,
    createdAt: iso(row.created_at),
  };
}

const QUOTE_COLUMNS = `id, tenant_id, opportunity_id, operation_key, price_book_version,
  subtotal, discount, tax, total, currency, content_hash, created_at`;

const APPROVAL_COLUMNS = `id, tenant_id, operation_key, resource_ref, resource_version,
  payload_hash, rights_hash, policy_hash, reviewer_id, proof_ref, recipient, channel,
  cost_ceiling, cost_ceiling_currency, expires_at, revocation_version, status, created_at`;

function toApproval(row: ApprovalRow): ApprovalRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    operationKey: row.operation_key,
    resourceRef: row.resource_ref,
    resourceVersion: row.resource_version,
    payloadHash: row.payload_hash,
    rightsHash: row.rights_hash,
    policyHash: row.policy_hash,
    reviewerId: row.reviewer_id,
    proofRef: row.proof_ref,
    recipient: row.recipient,
    channel: row.channel,
    costCeiling: row.cost_ceiling,
    costCeilingCurrency: row.cost_ceiling_currency,
    expiresAt: iso(row.expires_at),
    revocationVersion: row.revocation_version,
    status: row.status as ApprovalRecord["status"],
    createdAt: iso(row.created_at),
  };
}

function toBudget(row: BudgetRow): BudgetReservationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    operationKey: row.operation_key,
    amount: row.amount,
    currency: row.currency,
    status: row.status as BudgetReservationRecord["status"],
    createdAt: iso(row.created_at),
  };
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23505" || /duplicate key|unique constraint/i.test(String(error));
}

/**
 * A repeated operation key returns the stored row when the payload is
 * identical. A different payload is a conflict, not a silent overwrite, and a
 * concurrent duplicate fails closed instead of creating a second effect.
 */
export function createQuoteRepository(createSession: SessionFactory): QuoteRepository {
  return {
    save(tenantId, input) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const existing = await tx.query<QuoteRow>(
          `select ${QUOTE_COLUMNS} from app.quotes
            where tenant_id = $1 and operation_key = $2 limit 1`,
          [tenantId, input.operationKey],
        );
        const found = existing.rows[0];
        if (found) {
          const record = toQuote(found);
          if (
            record.contentHash !== input.contentHash ||
            record.opportunityId !== input.opportunityId ||
            record.priceBookVersion !== input.priceBookVersion
          ) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "operation key reused with a different quote",
            );
          }
          return { record, reused: true };
        }

        try {
          const inserted = await tx.query<QuoteRow>(
            `insert into app.quotes
               (id, tenant_id, opportunity_id, operation_key, price_book_version,
                subtotal, discount, tax, total, currency, content_hash)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             returning ${QUOTE_COLUMNS}`,
            [
              input.id,
              tenantId,
              input.opportunityId,
              input.operationKey,
              input.priceBookVersion,
              input.subtotal,
              input.discount,
              input.tax,
              input.total,
              input.currency,
              input.contentHash,
            ],
          );
          return { record: toQuote(inserted.rows[0]!), reused: false };
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "a concurrent operation already stored this quote",
            );
          }
          throw error;
        }
      });
    },

    find({ tenantId, id }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const { rows } = await tx.query<QuoteRow>(
          `select ${QUOTE_COLUMNS} from app.quotes where tenant_id = $1 and id = $2 limit 1`,
          [tenantId, id],
        );
        return rows[0] ? toQuote(rows[0]) : null;
      });
    },
  };
}

export function createApprovalRepository(
  createSession: SessionFactory,
): ApprovalRepository {
  return {
    save(tenantId, input) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const existing = await tx.query<ApprovalRow>(
          `select ${APPROVAL_COLUMNS} from app.approvals
            where tenant_id = $1 and operation_key = $2 limit 1`,
          [tenantId, input.operationKey],
        );
        const found = existing.rows[0];
        if (found) {
          const record = toApproval(found);
          // Every field of the binding is part of the identity: reusing a key
          // with another recipient or ceiling is a conflict, never a replay
          // that silently returns the old approval.
          if (
            record.payloadHash !== input.payloadHash ||
            record.rightsHash !== input.rightsHash ||
            record.policyHash !== input.policyHash ||
            record.reviewerId !== input.reviewerId ||
            record.resourceRef !== input.resourceRef ||
            record.resourceVersion !== input.resourceVersion ||
            record.proofRef !== input.proofRef ||
            record.recipient !== input.recipient ||
            record.channel !== input.channel ||
            !sameAmount(record.costCeiling, input.costCeiling) ||
            record.costCeilingCurrency !== input.costCeilingCurrency ||
            Date.parse(record.expiresAt) !== Date.parse(input.expiresAt)
          ) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "operation key reused with a different approval",
            );
          }
          return { record, reused: true };
        }

        try {
          const inserted = await tx.query<ApprovalRow>(
            `insert into app.approvals
               (id, tenant_id, operation_key, resource_ref, resource_version, payload_hash,
                rights_hash, policy_hash, reviewer_id, proof_ref, recipient, channel,
                cost_ceiling, cost_ceiling_currency, expires_at, revocation_version, status)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active')
             returning ${APPROVAL_COLUMNS}`,
            [
              input.id,
              tenantId,
              input.operationKey,
              input.resourceRef,
              input.resourceVersion,
              input.payloadHash,
              input.rightsHash,
              input.policyHash,
              input.reviewerId,
              input.proofRef,
              input.recipient,
              input.channel,
              input.costCeiling,
              input.costCeilingCurrency,
              input.expiresAt,
              input.revocationVersion,
            ],
          );
          return { record: toApproval(inserted.rows[0]!), reused: false };
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "a concurrent operation already stored this approval",
            );
          }
          throw error;
        }
      });
    },

    revoke({ tenantId, id, expectedVersion }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const updated = await tx.query<ApprovalRow>(
          `update app.approvals
              set status = 'revoked', revocation_version = revocation_version + 1
            where tenant_id = $1 and id = $2 and revocation_version = $3 and status = 'active'
            returning ${APPROVAL_COLUMNS}`,
          [tenantId, id, expectedVersion],
        );
        const row = updated.rows[0];
        if (row) {
          return { record: toApproval(row), reused: false };
        }

        const existing = await tx.query<ApprovalRow>(
          `select ${APPROVAL_COLUMNS} from app.approvals where tenant_id = $1 and id = $2`,
          [tenantId, id],
        );
        if (!existing.rows[0]) {
          throw new ServiceError("NOT_FOUND", "approval not found");
        }
        const current = toApproval(existing.rows[0]);
        if (current.status === "revoked") {
          return { record: current, reused: true };
        }
        throw new ServiceError("VERSION_CONFLICT", "approval version changed", {
          details: { currentVersion: current.revocationVersion },
        });
      });
    },

    find({ tenantId, id }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const { rows } = await tx.query<ApprovalRow>(
          `select ${APPROVAL_COLUMNS} from app.approvals where tenant_id = $1 and id = $2 limit 1`,
          [tenantId, id],
        );
        return rows[0] ? toApproval(rows[0]) : null;
      });
    },
  };
}

export function createBudgetRepository(createSession: SessionFactory): BudgetRepository {
  return {
    reserve({ tenantId, id, operationKey, amount, currency }) {
      return createSession().withTenant({ tenantId }, async (tx) => {
        const existing = await tx.query<BudgetRow>(
          `select id, tenant_id, operation_key, amount, currency, status, created_at
             from app.budget_reservations
            where tenant_id = $1 and operation_key = $2 limit 1`,
          [tenantId, operationKey],
        );
        const found = existing.rows[0];
        if (found) {
          const record = toBudget(found);
          if (!sameAmount(record.amount, amount) || record.currency !== currency) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "operation key reused with a different reservation",
            );
          }
          return { record, reused: true };
        }

        try {
          const inserted = await tx.query<BudgetRow>(
            `insert into app.budget_reservations (id, tenant_id, operation_key, amount, currency)
             values ($1, $2, $3, $4, $5)
             returning id, tenant_id, operation_key, amount, currency, status, created_at`,
            [id, tenantId, operationKey, amount, currency],
          );
          return { record: toBudget(inserted.rows[0]!), reused: false };
        } catch (error) {
          // A concurrent writer that won the race (same key or same id) is a
          // conflict, not an INTERNAL error leaking the driver message.
          if (isUniqueViolation(error)) {
            throw new ServiceError(
              "IDEMPOTENCY_CONFLICT",
              "a concurrent operation already reserved this budget",
            );
          }
          throw error;
        }
      });
    },
  };
}

export interface CommercialRepository {
  readonly quotes: QuoteRepository;
  readonly approvals: ApprovalRepository;
  readonly budgets: BudgetRepository;
}

/**
 * Production factory: each call checks out its own connection, so a PoolClient
 * is never shared between requests and RLS applies per transaction.
 */
export function createPooledCommercialRepository(pool: Pool): CommercialRepository {
  const connections = createPgConnection(pool);
  const withSession = <T>(fn: (client: SqlClient) => Promise<T>): Promise<T> =>
    connections.withConnection(fn);

  return {
    quotes: {
      save: (tenantId, input) =>
        withSession((client) =>
          createQuoteRepository(() => createTenantSession(client)).save(tenantId, input),
        ),
      find: (lookup) =>
        withSession((client) =>
          createQuoteRepository(() => createTenantSession(client)).find(lookup),
        ),
    },
    approvals: {
      save: (tenantId, input) =>
        withSession((client) =>
          createApprovalRepository(() => createTenantSession(client)).save(tenantId, input),
        ),
      revoke: (input) =>
        withSession((client) =>
          createApprovalRepository(() => createTenantSession(client)).revoke(input),
        ),
      find: (lookup) =>
        withSession((client) =>
          createApprovalRepository(() => createTenantSession(client)).find(lookup),
        ),
    },
    budgets: {
      reserve: (input) =>
        withSession((client) =>
          createBudgetRepository(() => createTenantSession(client)).reserve(input),
        ),
    },
  };
}
