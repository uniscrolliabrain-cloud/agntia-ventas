import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  approvalInvalidation,
  assertApprovalCovers,
  assertPrivacyRequestScope,
  createApproval,
  evaluateTrajectory,
  planSuppression,
  reconcileReservation,
  reserveBudget,
  transitionHandoff,
  type ApprovalBinding,
  type ApprovalRequest,
  type BudgetReservation,
} from "./governance.ts";
import type { HandoffRecord } from "./models.ts";

const NOW = "2026-11-15T10:00:00Z";

function binding(overrides: Partial<ApprovalBinding> = {}): ApprovalBinding {
  return {
    id: "approval-01",
    tenantId: "tenant-alpha-01",
    reviewerId: "user-alpha-01",
    proofRef: "proof-01",
    payloadHash: "sha256:aaa",
    resourceVersion: 3,
    rightsHash: "sha256:rights",
    policyHash: "sha256:policy",
    recipient: "ana@example.test",
    channel: "email",
    costCeiling: { amount: "100.00", currency: "EUR" },
    expiresAt: "2027-01-01T00:00:00Z",
    revocationVersion: 1,
    ...overrides,
  };
}

function request(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    tenantId: "tenant-alpha-01",
    payloadHash: "sha256:aaa",
    resourceVersion: 3,
    rightsHash: "sha256:rights",
    policyHash: "sha256:policy",
    recipient: "ana@example.test",
    channel: "email",
    cost: { amount: "90.00", currency: "EUR" },
    now: NOW,
    currentRevocationVersion: 1,
    ...overrides,
  };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("approvals", () => {
  it("requires a human reviewer and a proof", () => {
    expect(
      codeOf(() =>
        createApproval({
          id: "approval-02",
          tenantId: "tenant-alpha-01",
          reviewer: { kind: "twin", id: "twin-01" },
          proofRef: "proof-02",
          payloadHash: "sha256:aaa",
          resourceVersion: 1,
          rightsHash: "sha256:rights",
          policyHash: "sha256:policy",
          recipient: "ana@example.test",
          channel: "email",
          costCeiling: { amount: "10.00", currency: "EUR" },
          expiresAt: "2027-01-01T00:00:00Z",
          revocationVersion: 1,
        }),
      ),
    ).toBe("APPROVAL_INVALID");

    expect(
      codeOf(() =>
        createApproval({
          id: "approval-03",
          tenantId: "tenant-alpha-01",
          reviewer: { kind: "human", id: "user-alpha-01" },
          proofRef: "",
          payloadHash: "sha256:aaa",
          resourceVersion: 1,
          rightsHash: "sha256:rights",
          policyHash: "sha256:policy",
          recipient: "ana@example.test",
          channel: "email",
          costCeiling: { amount: "10.00", currency: "EUR" },
          expiresAt: "2027-01-01T00:00:00Z",
          revocationVersion: 1,
        }),
      ),
    ).toBe("APPROVAL_INVALID");
  });

  it("covers an identical request", () => {
    expect(() => assertApprovalCovers(binding(), request())).not.toThrow();
  });

  it("rejects another tenant, an expired or revoked approval", () => {
    expect(
      codeOf(() => assertApprovalCovers(binding(), request({ tenantId: "tenant-beta-02" }))),
    ).toBe("APPROVAL_INVALID");
    expect(
      codeOf(() =>
        assertApprovalCovers(binding({ expiresAt: "2026-11-01T00:00:00Z" }), request()),
      ),
    ).toBe("APPROVAL_EXPIRED");
    expect(
      codeOf(() =>
        assertApprovalCovers(binding(), request({ currentRevocationVersion: 2 })),
      ),
    ).toBe("APPROVAL_STALE");
  });

  it("invalidates on any material change", () => {
    expect(
      codeOf(() =>
        assertApprovalCovers(binding(), request({ payloadHash: "sha256:bbb", recipient: "otra@example.test" })),
      ),
    ).toBe("APPROVAL_STALE");

    try {
      assertApprovalCovers(binding(), request({ payloadHash: "sha256:bbb" }));
    } catch (error) {
      expect((error as ServiceError).details).toEqual({ mismatches: ["payloadHash"] });
    }

    expect(
      approvalInvalidation({
        previous: binding(),
        next: { ...request(), resourceVersion: 4, channel: "whatsapp" },
      }),
    ).toEqual(["resourceVersion", "channel"]);
  });

  it("refuses an unreadable expiry instead of treating it as valid", () => {
    expect(
      codeOf(() => assertApprovalCovers(binding({ expiresAt: "soon" }), request())),
    ).toBe("APPROVAL_INVALID");
    expect(
      codeOf(() => assertApprovalCovers(binding(), request({ now: "soon" }))),
    ).toBe("APPROVAL_INVALID");
  });

  it("enforces the cost ceiling in the approval currency", () => {
    expect(
      codeOf(() =>
        assertApprovalCovers(binding(), request({ cost: { amount: "100.01", currency: "EUR" } })),
      ),
    ).toBe("BUDGET_EXCEEDED");
    expect(
      codeOf(() =>
        assertApprovalCovers(binding(), request({ cost: { amount: "10.00", currency: "USD" } })),
      ),
    ).toBe("CURRENCY_MISMATCH");
  });
});

describe("budget reservations", () => {
  const available = { amount: "100.00", currency: "EUR" };

  it("reserves, reuses and refuses to overspend", () => {
    const first = reserveBudget({
      available,
      reservations: [],
      operationKey: "op-01",
      amount: { amount: "60.00", currency: "EUR" },
    });
    expect(first.remaining.amount).toBe("40.00");
    expect(first.reused).toBe(false);

    const reservations: BudgetReservation[] = [first.reservation];
    expect(
      reserveBudget({
        available,
        reservations,
        operationKey: "op-02",
        amount: { amount: "10.00", currency: "EUR" },
      }).remaining.amount,
    ).toBe("30.00");

    expect(
      codeOf(() =>
        reserveBudget({
          available,
          reservations,
          operationKey: "op-03",
          amount: { amount: "50.00", currency: "EUR" },
        }),
      ),
    ).toBe("BUDGET_EXCEEDED");
  });

  it("is idempotent per key and rejects a different amount", () => {
    const first = reserveBudget({
      available,
      reservations: [],
      operationKey: "op-01",
      amount: { amount: "10.00", currency: "EUR" },
    });
    const again = reserveBudget({
      available,
      reservations: [first.reservation],
      operationKey: "op-01",
      amount: { amount: "10.00", currency: "EUR" },
    });
    expect(again.reused).toBe(true);
    // A replay reports the balance that remains, not the original ceiling.
    expect(again.remaining.amount).toBe("90.00");

    // Same money, another scale, is the same reservation.
    expect(
      reserveBudget({
        available,
        reservations: [first.reservation],
        operationKey: "op-01",
        amount: { amount: "10.0", currency: "EUR" },
      }).reused,
    ).toBe(true);

    expect(
      codeOf(() =>
        reserveBudget({
          available,
          reservations: [first.reservation],
          operationKey: "op-01",
          amount: { amount: "10.00", currency: "USD" },
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");

    expect(
      codeOf(() =>
        reserveBudget({
          available,
          reservations: [first.reservation],
          operationKey: "op-01",
          amount: { amount: "11.00", currency: "EUR" },
        }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("reconciles the observed cost", () => {
    const reservation = reserveBudget({
      available,
      reservations: [],
      operationKey: "op-09",
      amount: { amount: "10.00", currency: "EUR" },
    }).reservation;
    expect(
      reconcileReservation({
        reservation,
        observedCost: { amount: "9.50", currency: "EUR" },
      }).status,
    ).toBe("consumed");
    expect(
      codeOf(() =>
        reconcileReservation({
          reservation,
          observedCost: { amount: "9.50", currency: "USD" },
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");
  });

  it("never increases the balance with a negative or foreign-currency reservation", () => {
    expect(
      codeOf(() =>
        reserveBudget({
          available,
          reservations: [],
          operationKey: "op-neg",
          amount: { amount: "-5.00", currency: "EUR" },
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    expect(
      codeOf(() =>
        reserveBudget({
          available,
          reservations: [
            {
              operationKey: "op-usd",
              amount: { amount: "5.00", currency: "USD" },
              status: "reserved",
            },
          ],
          operationKey: "op-eur",
          amount: { amount: "5.00", currency: "EUR" },
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");

    // Sub-cent budgets keep their scale instead of rounding to cents.
    const precise = reserveBudget({
      available: { amount: "1.00000000", currency: "EUR" },
      reservations: [],
      operationKey: "op-precise",
      amount: { amount: "0.00000001", currency: "EUR" },
    });
    expect(precise.remaining.amount).toBe("0.99999999");
  });
});

describe("privacy", () => {
  it("requires identity, representation and scope", () => {
    expect(() =>
      assertPrivacyRequestScope({
        identityVerified: true,
        representationProof: "proof-01",
        scope: ["marketing"],
      }),
    ).not.toThrow();
    expect(
      codeOf(() =>
        assertPrivacyRequestScope({
          identityVerified: false,
          representationProof: "proof-01",
          scope: ["marketing"],
        }),
      ),
    ).toBe("APPROVAL_INVALID");
    expect(
      codeOf(() =>
        assertPrivacyRequestScope({
          identityVerified: true,
          representationProof: null,
          scope: ["marketing"],
        }),
      ),
    ).toBe("APPROVAL_INVALID");
  });

  it("plans propagation without executing it", () => {
    const plan = planSuppression({ requestId: "privacy-01", downstream: ["crm", "email"] });
    expect(plan.executed).toBe(false);
    expect(plan.requiresHumanReview).toBe(true);
    expect(plan.propagateTo).toEqual(["crm", "email"]);
  });
});

describe("handoff", () => {
  const handoff: HandoffRecord = {
    id: "handoff-01",
    tenantId: "tenant-alpha-01",
    receiverRef: "receiver-01",
    status: "proposed",
  };

  it("requires an ACK before acknowledging or completing", () => {
    const offered = transitionHandoff(handoff, "offered", {});
    expect(codeOf(() => transitionHandoff(offered, "acknowledged", {}))).toBe(
      "HANDOFF_NOT_ACKED",
    );

    const acknowledged = transitionHandoff(offered, "acknowledged", { ackRef: "ack-01" });
    expect(acknowledged.status).toBe("acknowledged");
    const working = transitionHandoff(acknowledged, "working", {});
    expect(codeOf(() => transitionHandoff(working, "completed", {}))).toBe(
      "HANDOFF_NOT_ACKED",
    );
    expect(transitionHandoff(working, "completed", { ackRef: "ack-02" }).status).toBe(
      "completed",
    );
  });

  it("rejects an out-of-order transition", () => {
    expect(codeOf(() => transitionHandoff(handoff, "completed", { ackRef: "ack-01" }))).toBe(
      "STAGE_INVALID",
    );
  });
});

describe("commercial QA", () => {
  it("fails a correct final answer with a forbidden intermediate action", () => {
    expect(
      evaluateTrajectory({
        steps: [
          { capability: "sales_quote_propose", forbidden: false },
          { capability: "sales_send_email", forbidden: true },
        ],
        finalAnswerAccepted: true,
      }),
    ).toEqual({ passed: false, violations: ["sales_send_email"] });

    expect(
      evaluateTrajectory({
        steps: [{ capability: "sales_quote_propose", forbidden: false }],
        finalAnswerAccepted: true,
      }).passed,
    ).toBe(true);
  });
});
