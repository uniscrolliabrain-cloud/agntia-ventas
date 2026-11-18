import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  createApprovalRepository,
  createBudgetRepository,
  createQuoteRepository,
} from "./commercial-repository.ts";
import { createTenantSession } from "./tenant-session.ts";
import { createHarness, seed } from "./test-support.ts";

const ALPHA = "tenant-alpha-01";
const BETA = "tenant-beta-02";

async function setup() {
  const { client } = await createHarness();
  await seed(client);
  const session = () => createTenantSession(client);
  return {
    client,
    quotes: createQuoteRepository(session),
    approvals: createApprovalRepository(session),
    budgets: createBudgetRepository(session),
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

const quote = {
  id: "quote-alpha-01",
  opportunityId: "opportunity-alpha-01",
  operationKey: "operation-0001",
  priceBookVersion: "pb-7",
  subtotal: "39.98",
  discount: "2.00",
  tax: "7.98",
  total: "45.96",
  currency: "EUR",
  contentHash: "sha256:aaaa",
};

const approval = {
  id: "approval-alpha-01",
  operationKey: "operation-approval-0001",
  resourceRef: "quote-alpha-01",
  resourceVersion: 1,
  payloadHash: "sha256:payload",
  rightsHash: "sha256:rights",
  policyHash: "sha256:policy",
  reviewerId: "user-alpha-01",
  proofRef: "proof-01",
  recipient: "ana@example.test",
  channel: "email",
  costCeiling: "100.00",
  costCeilingCurrency: "EUR",
  expiresAt: "2027-01-01T00:00:00Z",
  revocationVersion: 0,
};

describe("quote repository", () => {
  it("stores once and replays an identical operation", async () => {
    const { quotes } = await setup();

    const first = await quotes.save(ALPHA, quote);
    expect(first.reused).toBe(false);
    expect(first.record.tenantId).toBe(ALPHA);
    expect(first.record.total).toMatch(/^45\.96/);
    expect(first.record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const again = await quotes.save(ALPHA, quote);
    expect(again.reused).toBe(true);
    expect(again.record.id).toBe(first.record.id);
  });

  it("treats a different payload under the same key as a conflict", async () => {
    const { quotes } = await setup();
    await quotes.save(ALPHA, quote);

    expect(
      await codeOf(quotes.save(ALPHA, { ...quote, contentHash: "sha256:bbbb" })),
    ).toBe("IDEMPOTENCY_CONFLICT");
    // Same totals, another opportunity is still another quote.
    expect(
      await codeOf(
        quotes.save(ALPHA, { ...quote, opportunityId: "opportunity-beta-02" }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("does not expose another tenant's quote", async () => {
    const { quotes } = await setup();
    await quotes.save(ALPHA, quote);

    expect(await quotes.find({ tenantId: ALPHA, id: quote.id })).not.toBeNull();
    expect(await quotes.find({ tenantId: BETA, id: quote.id })).toBeNull();
  });

  it("refuses a quote attached to another tenant's opportunity", async () => {
    const { quotes } = await setup();
    await expect(
      quotes.save(ALPHA, { ...quote, opportunityId: "opportunity-beta-02" }),
    ).rejects.toThrow(/foreign key/i);
  });
});

describe("approval repository", () => {
  it("stores, revokes by expected version and replays the revocation", async () => {
    const { approvals } = await setup();

    const saved = await approvals.save(ALPHA, approval);
    expect(saved.reused).toBe(false);
    expect(saved.record.status).toBe("active");

    const revoked = await approvals.revoke({
      tenantId: ALPHA,
      id: approval.id,
      expectedVersion: 0,
    });
    expect(revoked.record.status).toBe("revoked");
    expect(revoked.record.revocationVersion).toBe(1);

    const replay = await approvals.revoke({
      tenantId: ALPHA,
      id: approval.id,
      expectedVersion: 0,
    });
    expect(replay.reused).toBe(true);
    expect(replay.record.revocationVersion).toBe(1);
  });

  it("reports a missing approval and a reused key with other data", async () => {
    const { approvals } = await setup();

    expect(
      await codeOf(approvals.revoke({ tenantId: ALPHA, id: "nope", expectedVersion: 0 })),
    ).toBe("NOT_FOUND");

    await approvals.save(ALPHA, approval);
    expect(
      await codeOf(approvals.save(ALPHA, { ...approval, payloadHash: "sha256:other" })),
    ).toBe("IDEMPOTENCY_CONFLICT");
    // The whole binding is the payload: a new recipient or ceiling cannot be
    // silently answered with the old approval.
    expect(
      await codeOf(
        approvals.save(ALPHA, { ...approval, recipient: "otra@example.test" }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
    expect(
      await codeOf(approvals.save(ALPHA, { ...approval, costCeiling: "999.00" })),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });
});

describe("budget repository", () => {
  const reservation = {
    tenantId: ALPHA,
    id: "reservation-alpha-01",
    operationKey: "operation-budget-0001",
    amount: "10.00",
    currency: "EUR",
  };

  it("reserves once and replays the same key", async () => {
    const { budgets } = await setup();

    const first = await budgets.reserve(reservation);
    expect(first.reused).toBe(false);
    expect(first.record.status).toBe("reserved");

    const again = await budgets.reserve(reservation);
    expect(again.reused).toBe(true);
  });

  it("rejects a different amount under the same key", async () => {
    const { budgets } = await setup();
    await budgets.reserve(reservation);

    expect(await codeOf(budgets.reserve({ ...reservation, amount: "11.00" }))).toBe(
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("maps a duplicate id race to an idempotency conflict", async () => {
    const { budgets } = await setup();
    await budgets.reserve(reservation);

    // The operation-key pre-check misses; the primary key still rejects it.
    expect(
      await codeOf(
        budgets.reserve({ ...reservation, operationKey: "operation-budget-0002" }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });
});
