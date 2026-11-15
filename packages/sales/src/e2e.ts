import { ServiceError, type RoundingPolicy } from "@agntia-ventas/contracts";
import {
  acceptCandidate,
  canRequestOutreach,
  proposeQualification,
  transitionOpportunity,
} from "./core.ts";
import { proposeRevision, proposeMeeting, createEmailPreview, contentHash } from "./commercial.ts";
import {
  assertDiscountWithinMandate,
  computeQuote,
} from "./pricing.ts";
import {
  assertApprovalCovers,
  createApproval,
  transitionHandoff,
  type ApprovalBinding,
} from "./governance.ts";
import { recordActivity } from "./outcomes.ts";
import type {
  AcceptedLead,
  Account,
  Contact,
  DiscountMandate,
  EmailDraft,
  ForecastSnapshot,
  HandoffRecord,
  LeadCandidate,
  MeetingProposal,
  Opportunity,
  PriceBook,
  Product,
  QualificationFact,
  QuoteTotals,
  SuppressionEntry,
  TaxRule,
} from "./models.ts";

export interface PilotFixture {
  readonly tenantId: string;
  readonly operatorTenantId: string;
  readonly account: Account;
  readonly contact: Contact;
  readonly candidate: LeadCandidate;
  readonly accepted: readonly AcceptedLead[];
  readonly suppressions: readonly SuppressionEntry[];
  readonly opportunity: Opportunity;
  readonly qualificationFacts: readonly QualificationFact[];
  readonly requiredQualificationKeys: readonly string[];
  readonly products: readonly Product[];
  readonly priceBook: PriceBook;
  readonly taxRules: readonly TaxRule[];
  readonly policy: RoundingPolicy;
  readonly discountMandate: DiscountMandate;
  readonly orderDiscountBasisPoints?: number;
  readonly reviewer: { readonly kind: "human"; readonly id: string };
  readonly sinkAllowlist: readonly string[];
  readonly now: string;
  readonly handoff: HandoffRecord;
  readonly forecast?: ForecastSnapshot;
}

export interface PilotStep {
  readonly step: string;
  readonly status: "ok" | "blocked";
  readonly code?: string;
}

export interface PilotResult {
  readonly status: "completed" | "blocked";
  readonly steps: readonly PilotStep[];
  readonly quote?: QuoteTotals;
  readonly approval?: ApprovalBinding;
  readonly draft?: EmailDraft;
  readonly meeting?: MeetingProposal;
  readonly handoff?: HandoffRecord;
  readonly effects: {
    readonly emailsSent: 0;
    readonly signatures: 0;
    readonly payments: 0;
    readonly providerCalls: 0;
  };
}

const NO_EFFECTS = {
  emailsSent: 0,
  signatures: 0,
  payments: 0,
  providerCalls: 0,
} as const;

/**
 * Synthetic vertical: candidate -> acceptance -> opportunity -> quote -> review
 * -> sink -> receipt -> meeting -> handoff with ACK. Every step is local; the
 * effects counters stay at zero by construction and any block stops the run.
 */
export function runPilotVertical(fixture: PilotFixture): PilotResult {
  const steps: PilotStep[] = [];
  const state: {
    quote?: QuoteTotals;
    approval?: ApprovalBinding;
    draft?: EmailDraft;
    meeting?: MeetingProposal;
    handoff?: HandoffRecord;
  } = {};

  const run = (step: string, action: () => void): boolean => {
    try {
      action();
      steps.push({ step, status: "ok" });
      return true;
    } catch (error) {
      if (error instanceof ServiceError) {
        steps.push({ step, status: "blocked", code: error.code });
        return false;
      }
      throw error;
    }
  };

  let opportunity = fixture.opportunity;
  let acceptedLead: AcceptedLead | undefined;

  const accepted = run("candidates.accept", () => {
    const result = acceptCandidate({
      candidate: fixture.candidate,
      acceptedBy: fixture.reviewer.id,
      acceptedAt: fixture.now,
      existing: fixture.accepted,
    });
    acceptedLead = result.lead;
    if (result.duplicate) {
      steps.push({ step: "candidates.accept.duplicate", status: "ok" });
    }
  });
  if (!accepted) return { status: "blocked", steps, effects: NO_EFFECTS };

  const outreach = canRequestOutreach({
    candidate: fixture.candidate,
    accepted: acceptedLead
      ? [...fixture.accepted, acceptedLead]
      : fixture.accepted,
    suppressions: fixture.suppressions,
    channel: "email",
    now: fixture.now,
  });
  steps.push({
    step: "candidates.outreach_permission",
    status: outreach.allowed ? "ok" : "blocked",
    ...(outreach.reason ? { code: outreach.reason } : {}),
  });
  if (!outreach.allowed) return { status: "blocked", steps, effects: NO_EFFECTS };

  const pipeline = run("pipeline.transition", () => {
    const first = transitionOpportunity(opportunity, "accepted", {
      expectedVersion: opportunity.version,
    });
    opportunity = transitionOpportunity(first, "qualified", {
      expectedVersion: first.version,
    });
  });
  if (!pipeline) return { status: "blocked", steps, effects: NO_EFFECTS };

  const qualification = run("qualification.propose", () => {
    proposeQualification({
      facts: fixture.qualificationFacts,
      requiredKeys: fixture.requiredQualificationKeys,
    });
  });
  if (!qualification) return { status: "blocked", steps, effects: NO_EFFECTS };

  const quote = run("quote.calculate", () => {
    state.quote = computeQuote({
      tenantId: fixture.tenantId,
      priceBook: fixture.priceBook,
      lines: [
        {
          productRef: fixture.products[0]?.id ?? "product-missing",
          quantity: "2",
          discountBasisPoints: 500,
        },
      ],
      products: fixture.products,
      taxRules: fixture.taxRules,
      policy: fixture.policy,
      ...(fixture.orderDiscountBasisPoints !== undefined
        ? { orderDiscountBasisPoints: fixture.orderDiscountBasisPoints }
        : {}),
      now: fixture.now,
    });
    assertDiscountWithinMandate({
      quote: state.quote,
      mandate: fixture.discountMandate,
      now: fixture.now,
    });
  });
  if (!quote || !state.quote) return { status: "blocked", steps, effects: NO_EFFECTS };
  const quoteTotals: QuoteTotals = state.quote;

  const proposal = run("proposal.revision", () => {
    proposeRevision({
      id: `proposal-${fixture.tenantId}`,
      version: 1,
      claims: [
        { text: "Precio de catálogo vigente", kind: "fact", evidenceRef: "evidence-price-01" },
        { text: "Entrega estimada en 10 días laborables", kind: "proposal" },
      ],
    });
  });
  if (!proposal) return { status: "blocked", steps, effects: NO_EFFECTS };

  const approval = run("approval.binding", () => {
    const payloadHash = contentHash(quoteTotals);
    const binding = createApproval({
      id: `approval-${fixture.tenantId}`,
      tenantId: fixture.tenantId,
      reviewer: fixture.reviewer,
      proofRef: "proof-approval-01",
      payloadHash,
      resourceVersion: 1,
      rightsHash: "sha256:rights",
      policyHash: "sha256:policy",
      recipient: fixture.contact.channels[0]?.value ?? "contact@example.test",
      channel: "email",
      costCeiling: { amount: "300.00", currency: quoteTotals.currency },
      expiresAt: "2027-01-01T00:00:00Z",
      revocationVersion: 1,
    });
    assertApprovalCovers(binding, {
      tenantId: fixture.tenantId,
      payloadHash,
      resourceVersion: 1,
      rightsHash: "sha256:rights",
      policyHash: "sha256:policy",
      recipient: fixture.contact.channels[0]?.value ?? "contact@example.test",
      channel: "email",
      cost: quoteTotals.total,
      now: fixture.now,
      currentRevocationVersion: 1,
    });
    state.approval = binding;
  });
  if (!approval) return { status: "blocked", steps, effects: NO_EFFECTS };

  const preview = run("email.preview", () => {
    const plan = createEmailPreview({
      recipient: fixture.contact.channels[0]?.value ?? "contact@example.test",
      subject: "Propuesta sintética",
      body: "Adjuntamos la propuesta calculada. Sin efecto externo en el piloto.",
      purpose: "pilot proposal",
      suppressed: false,
      sinkAllowlist: fixture.sinkAllowlist,
    });
    state.draft = plan.draft;
  });
  if (!preview) return { status: "blocked", steps, effects: NO_EFFECTS };

  const activity = run("activity.receipt", () => {
    const record = recordActivity({
      id: `activity-${fixture.tenantId}`,
      tenantId: fixture.tenantId,
      kind: "email",
      occurredAt: fixture.now,
      receiptRef: "receipt-sink-01",
    });
    if (record.status !== "confirmed") {
      throw new ServiceError("EVIDENCE_REQUIRED", "activity without receipt");
    }
  });
  if (!activity) return { status: "blocked", steps, effects: NO_EFFECTS };

  const meeting = run("meeting.propose", () => {
    state.meeting = proposeMeeting({
      id: `meeting-${fixture.tenantId}`,
      operationKey: "op-meeting-01",
      startUtc: "2026-11-20T10:00:00Z",
      timeZone: "Europe/Madrid",
      attendees: [fixture.reviewer.id],
    });
  });
  if (!meeting) return { status: "blocked", steps, effects: NO_EFFECTS };

  const handoff = run("handoff.ack", () => {
    const offered = transitionHandoff(fixture.handoff, "offered", {});
    const acknowledged = transitionHandoff(offered, "acknowledged", {
      ackRef: "ack-receiver-01",
    });
    state.handoff = transitionHandoff(acknowledged, "working", {});
  });
  if (!handoff) return { status: "blocked", steps, effects: NO_EFFECTS };

  return {
    status: "completed",
    steps,
    ...state,
    effects: NO_EFFECTS,
  };
}
