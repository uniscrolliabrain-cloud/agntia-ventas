import Decimal from "decimal.js";
import { ServiceError, type Money } from "@agntia-ventas/contracts";
import type { HandoffRecord } from "./models.ts";

export interface ApprovalBinding {
  readonly id: string;
  readonly tenantId: string;
  readonly reviewerId: string;
  readonly proofRef: string;
  readonly payloadHash: string;
  readonly resourceVersion: number;
  readonly rightsHash: string;
  readonly policyHash: string;
  readonly recipient: string;
  readonly channel: string;
  readonly costCeiling: Money;
  readonly expiresAt: string;
  readonly revocationVersion: number;
}

export interface ApprovalRequest {
  readonly tenantId: string;
  readonly payloadHash: string;
  readonly resourceVersion: number;
  readonly rightsHash: string;
  readonly policyHash: string;
  readonly recipient: string;
  readonly channel: string;
  readonly cost: Money;
  readonly now: string;
  readonly currentRevocationVersion: number;
}

/**
 * Only a verified human reviewer can bind an approval. A model or a service
 * cannot fabricate one by writing `approved: true`.
 */
export function createApproval(input: {
  id: string;
  tenantId: string;
  reviewer: { kind: "human" | "service" | "twin"; id: string };
  proofRef: string;
  payloadHash: string;
  resourceVersion: number;
  rightsHash: string;
  policyHash: string;
  recipient: string;
  channel: string;
  costCeiling: Money;
  expiresAt: string;
  revocationVersion: number;
}): ApprovalBinding {
  if (input.reviewer.kind !== "human") {
    throw new ServiceError("APPROVAL_INVALID", "approval requires a human reviewer");
  }
  if (!input.proofRef) {
    throw new ServiceError("APPROVAL_INVALID", "approval requires a proof reference");
  }
  return { ...input, reviewerId: input.reviewer.id };
}

/** Any material change invalidates the approval instead of reusing it. */
export function assertApprovalCovers(
  approval: ApprovalBinding,
  request: ApprovalRequest,
): void {
  if (approval.tenantId !== request.tenantId) {
    throw new ServiceError("APPROVAL_INVALID", "approval belongs to another tenant");
  }
  const expiresAt = Date.parse(approval.expiresAt);
  const now = Date.parse(request.now);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) {
    throw new ServiceError("APPROVAL_INVALID", "approval or request time is unreadable");
  }
  if (expiresAt <= now) {
    throw new ServiceError("APPROVAL_EXPIRED", "approval expired");
  }
  if (approval.revocationVersion !== request.currentRevocationVersion) {
    throw new ServiceError("APPROVAL_STALE", "approval was revoked or superseded");
  }
  const mismatches: string[] = [];
  if (approval.payloadHash !== request.payloadHash) mismatches.push("payloadHash");
  if (approval.resourceVersion !== request.resourceVersion) mismatches.push("resourceVersion");
  if (approval.rightsHash !== request.rightsHash) mismatches.push("rightsHash");
  if (approval.policyHash !== request.policyHash) mismatches.push("policyHash");
  if (approval.recipient !== request.recipient) mismatches.push("recipient");
  if (approval.channel !== request.channel) mismatches.push("channel");
  if (mismatches.length > 0) {
    throw new ServiceError("APPROVAL_STALE", "approval does not cover this payload", {
      details: { mismatches },
    });
  }
  if (approval.costCeiling.currency !== request.cost.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "approval cost ceiling currency differs");
  }
  if (
    new Decimal(request.cost.amount).greaterThan(approval.costCeiling.amount)
  ) {
    throw new ServiceError("BUDGET_EXCEEDED", "cost exceeds the approved ceiling", {
      details: { cost: request.cost.amount, ceiling: approval.costCeiling.amount },
    });
  }
}

export function approvalInvalidation(input: {
  previous: ApprovalBinding;
  next: Pick<
    ApprovalRequest,
    "payloadHash" | "resourceVersion" | "rightsHash" | "policyHash" | "recipient" | "channel"
  >;
}): string[] {
  const reasons: string[] = [];
  if (input.previous.payloadHash !== input.next.payloadHash) reasons.push("payloadHash");
  if (input.previous.resourceVersion !== input.next.resourceVersion) {
    reasons.push("resourceVersion");
  }
  if (input.previous.rightsHash !== input.next.rightsHash) reasons.push("rightsHash");
  if (input.previous.policyHash !== input.next.policyHash) reasons.push("policyHash");
  if (input.previous.recipient !== input.next.recipient) reasons.push("recipient");
  if (input.previous.channel !== input.next.channel) reasons.push("channel");
  return reasons;
}

export interface BudgetReservation {
  readonly operationKey: string;
  readonly amount: Money;
  readonly status: "reserved" | "consumed" | "released";
}

function fractionalDigits(amount: string): number {
  const index = amount.indexOf(".");
  return index === -1 ? 0 : amount.length - index - 1;
}

/**
 * Remaining balance after every reservation that still holds budget. It keeps
 * the widest scale in play instead of rounding to cents, and refuses to add
 * reservations in another currency as if they were the same money.
 */
function remainingAfter(
  available: Money,
  reservations: readonly BudgetReservation[],
): Money {
  let spent = new Decimal(0);
  let scale = fractionalDigits(available.amount);
  for (const item of reservations) {
    if (item.status === "released") continue;
    if (item.amount.currency !== available.currency) {
      throw new ServiceError("CURRENCY_MISMATCH", "reservation currency differs from budget");
    }
    spent = spent.plus(item.amount.amount);
    scale = Math.max(scale, fractionalDigits(item.amount.amount));
  }
  return {
    amount: new Decimal(available.amount).minus(spent).toFixed(scale),
    currency: available.currency,
    exponent: scale,
  };
}

/**
 * Reservation is transactional per operationKey: a retry reuses it, and two
 * concurrent operations can never spend the last unit twice. A replay returns
 * the balance that actually remains, not the original ceiling.
 */
export function reserveBudget(input: {
  available: Money;
  reservations: readonly BudgetReservation[];
  operationKey: string;
  amount: Money;
}): { reservation: BudgetReservation; remaining: Money; reused: boolean } {
  const { available, amount } = input;
  if (available.currency !== amount.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "budget currency differs");
  }
  if (!new Decimal(amount.amount).isPositive()) {
    throw new ServiceError("VALIDATION_FAILED", "budget reservation must be positive");
  }
  const existing = input.reservations.find(
    (item) => item.operationKey === input.operationKey,
  );
  if (existing) {
    if (
      existing.amount.currency !== amount.currency ||
      !new Decimal(existing.amount.amount).equals(amount.amount)
    ) {
      throw new ServiceError("IDEMPOTENCY_CONFLICT", "same key with a different amount");
    }
    return {
      reservation: existing,
      remaining: remainingAfter(available, input.reservations),
      reused: true,
    };
  }

  const reservation: BudgetReservation = {
    operationKey: input.operationKey,
    amount,
    status: "reserved",
  };
  const remaining = remainingAfter(available, [...input.reservations, reservation]);
  if (new Decimal(remaining.amount).isNegative()) {
    throw new ServiceError("BUDGET_EXCEEDED", "budget reservation exceeds the remaining balance", {
      details: { available: available.amount, requested: amount.amount },
    });
  }

  return { reservation, remaining, reused: false };
}

export function reconcileReservation(input: {
  reservation: BudgetReservation;
  observedCost: Money;
}): { status: "consumed"; actual: Money } {
  if (input.observedCost.currency !== input.reservation.amount.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "observed cost currency differs");
  }
  return { status: "consumed", actual: input.observedCost };
}

export function assertPrivacyRequestScope(input: {
  identityVerified: boolean;
  representationProof: string | null;
  scope: readonly string[];
}): void {
  if (!input.identityVerified) {
    throw new ServiceError("APPROVAL_INVALID", "privacy request needs verified identity");
  }
  if (!input.representationProof) {
    throw new ServiceError("APPROVAL_INVALID", "privacy request needs representation proof");
  }
  if (input.scope.length === 0) {
    throw new ServiceError("VALIDATION_FAILED", "privacy request needs a scope");
  }
}

/**
 * Erasure is a reviewable process: it plans propagation with ACK per system and
 * is never executed from a chat message alone.
 */
export function planSuppression(input: {
  requestId: string;
  downstream: readonly string[];
}): { requestId: string; propagateTo: readonly string[]; requiresHumanReview: true; executed: false } {
  return {
    requestId: input.requestId,
    propagateTo: [...input.downstream],
    requiresHumanReview: true,
    executed: false,
  };
}

const HANDOFF_FLOW: Record<HandoffRecord["status"], readonly HandoffRecord["status"][]> = {
  proposed: ["offered"],
  offered: ["acknowledged", "returned"],
  acknowledged: ["working", "returned"],
  working: ["completed", "returned"],
  completed: [],
  returned: [],
};

/** An emitted event is not an ACK: completion needs the receiver's reference. */
export function transitionHandoff(
  handoff: HandoffRecord,
  to: HandoffRecord["status"],
  input: { ackRef?: string },
): HandoffRecord {
  if (!HANDOFF_FLOW[handoff.status].includes(to)) {
    throw new ServiceError("STAGE_INVALID", "handoff transition not allowed", {
      details: { from: handoff.status, to },
    });
  }
  // Acknowledging may rely on an ACK already recorded on the handoff, but
  // completion needs its own explicit ACK: an earlier ACK is not the result.
  if (to === "acknowledged" && !input.ackRef && !handoff.ackRef) {
    throw new ServiceError("HANDOFF_NOT_ACKED", "handoff needs an ACK reference");
  }
  if (to === "completed" && !input.ackRef) {
    throw new ServiceError("HANDOFF_NOT_ACKED", "completion needs its own ACK reference");
  }
  const ackRef = input.ackRef ?? handoff.ackRef;
  return {
    ...handoff,
    status: to,
    ...(ackRef ? { ackRef } : {}),
  };
}

export interface TrajectoryStep {
  readonly capability: string;
  readonly forbidden: boolean;
}

/**
 * A correct final message does not compensate a forbidden intermediate action:
 * the trajectory is part of the contract.
 */
export function evaluateTrajectory(input: {
  steps: readonly TrajectoryStep[];
  finalAnswerAccepted: boolean;
}): { passed: boolean; violations: readonly string[] } {
  const violations = input.steps
    .filter((step) => step.forbidden)
    .map((step) => step.capability);
  return {
    passed: input.finalAnswerAccepted && violations.length === 0,
    violations,
  };
}
