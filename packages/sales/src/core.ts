import { ServiceError } from "@agntia-ventas/contracts";
import type {
  Account,
  AcceptedLead,
  Contact,
  LeadCandidate,
  Opportunity,
  QualificationFact,
  Stage,
  SuppressionEntry,
} from "./models.ts";

/**
 * Sensitive attribute roots. Keys are matched per token after splitting
 * separators and camelCase, so `health`, `health_status`, `Health` and
 * `sexualOrientation` are the same sensitive attribute instead of only the
 * snake_case spelling.
 */
const SENSITIVE_ROOTS = [
  "health",
  "disabilit",
  "ethnic",
  "religio",
  "sexual",
  "politic",
  "biometric",
  "emotion",
] as const;

function isSensitiveKey(key: string): boolean {
  const tokens = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0);
  return tokens.some((token) => SENSITIVE_ROOTS.some((root) => token.startsWith(root)));
}

/** Homonyms stay separate: identity is per account, never merged by name. */
export function previewContact(
  contacts: readonly Contact[],
  query: { fullName: string },
): { matches: Contact[]; ambiguous: boolean } {
  const needle = query.fullName.trim().toLowerCase();
  const matches = contacts.filter(
    (contact) => contact.fullName.trim().toLowerCase() === needle,
  );
  return { matches: [...matches], ambiguous: matches.length > 1 };
}

export interface CandidateAcceptance {
  readonly lead: AcceptedLead;
  readonly duplicate: boolean;
}

/** Accepting the same candidate twice returns the same lead, never a new one. */
export function acceptCandidate(input: {
  candidate: LeadCandidate;
  acceptedBy: string;
  acceptedAt: string;
  existing: readonly AcceptedLead[];
}): CandidateAcceptance {
  const previous = input.existing.find(
    (lead) =>
      lead.candidateId === input.candidate.id &&
      lead.tenantId === input.candidate.tenantId,
  );
  if (previous) return { lead: previous, duplicate: true };
  return {
    lead: {
      id: `lead-${input.candidate.id}`,
      tenantId: input.candidate.tenantId,
      candidateId: input.candidate.id,
      acceptedBy: input.acceptedBy,
      acceptedAt: input.acceptedAt,
    },
    duplicate: false,
  };
}

export interface OutreachDecision {
  readonly allowed: boolean;
  readonly reason?:
    | "not_accepted"
    | "no_permission"
    | "purpose_mismatch"
    | "channel_mismatch"
    | "suppressed"
    | "permission_expired";
}

function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Discovery is not contactability: acceptance, purpose, channel and suppression
 * are checked before any draft. A public record never proves permission.
 *
 * - A lead accepted in another tenant does not authorize this candidate.
 * - Permission is bound to a purpose; another purpose is a mismatch.
 * - Suppression is per channel *value* (the actual address), not per channel:
 *   one opt-out must not silence every contact of the tenant.
 * - An unreadable expiry is treated as expired, never as permission.
 */
export function canRequestOutreach(input: {
  candidate: LeadCandidate;
  accepted: readonly AcceptedLead[];
  suppressions: readonly SuppressionEntry[];
  channel: "email" | "phone" | "whatsapp" | "linkedin";
  purpose: string;
  recipient: string;
  now: string;
}): OutreachDecision {
  const purpose = input.purpose.trim();
  const recipient = input.recipient.trim();
  if (purpose.length === 0 || recipient.length === 0) {
    throw new ServiceError(
      "VALIDATION_FAILED",
      "outreach needs an explicit purpose and recipient",
    );
  }

  const isAccepted = input.accepted.some(
    (lead) =>
      lead.candidateId === input.candidate.id &&
      lead.tenantId === input.candidate.tenantId,
  );
  if (!isAccepted) return { allowed: false, reason: "not_accepted" };

  const permission = input.candidate.permission;
  if (!permission) return { allowed: false, reason: "no_permission" };
  if (normaliseText(permission.purpose) !== normaliseText(purpose)) {
    return { allowed: false, reason: "purpose_mismatch" };
  }
  if (permission.channel !== input.channel) {
    return { allowed: false, reason: "channel_mismatch" };
  }
  if (permission.expiresAt) {
    const expiresAt = Date.parse(permission.expiresAt);
    const now = Date.parse(input.now);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(now) || expiresAt <= now) {
      return { allowed: false, reason: "permission_expired" };
    }
  }
  const suppressed = input.suppressions.some(
    (entry) =>
      entry.tenantId === input.candidate.tenantId &&
      entry.channel === input.channel &&
      normaliseText(entry.value) === normaliseText(recipient),
  );
  if (suppressed) return { allowed: false, reason: "suppressed" };
  return { allowed: true };
}

const ALLOWED_TRANSITIONS: Record<Stage, readonly Stage[]> = {
  discovered: ["accepted", "opted_out"],
  accepted: ["qualified", "lost", "opted_out"],
  qualified: ["proposal_draft", "lost", "opted_out"],
  proposal_draft: ["in_review", "lost", "opted_out"],
  in_review: ["approved_to_send", "proposal_draft", "lost", "opted_out"],
  approved_to_send: ["sent", "lost", "opted_out"],
  sent: ["negotiating", "won_unverified", "lost", "opted_out"],
  negotiating: ["won_unverified", "won_verified", "lost", "opted_out"],
  won_unverified: ["won_verified", "reconciliation_required", "lost"],
  won_verified: [],
  lost: [],
  opted_out: [],
  reconciliation_required: ["won_verified", "lost"],
};

/** Stages have guards: a verified win needs evidence, and versions must match. */
export function transitionOpportunity(
  opportunity: Opportunity,
  to: Stage,
  input: { expectedVersion: number; evidenceRefs?: readonly string[] },
): Opportunity {
  if (opportunity.version !== input.expectedVersion) {
    throw new ServiceError("VERSION_CONFLICT", "opportunity version changed", {
      details: { expected: input.expectedVersion, actual: opportunity.version },
    });
  }
  if (!ALLOWED_TRANSITIONS[opportunity.stage].includes(to)) {
    throw new ServiceError("STAGE_INVALID", "transition not allowed", {
      details: { from: opportunity.stage, to },
    });
  }
  const evidence = [...opportunity.evidenceRefs, ...(input.evidenceRefs ?? [])];
  if (to === "won_verified" && evidence.length === 0) {
    throw new ServiceError("EVIDENCE_REQUIRED", "verified win requires evidence");
  }
  return {
    ...opportunity,
    stage: to,
    version: opportunity.version + 1,
    evidenceRefs: evidence,
  };
}

export interface QualificationProposal {
  readonly facts: readonly QualificationFact[];
  readonly missing: readonly string[];
  readonly rejectedSensitive: readonly string[];
}

/**
 * Unknown data stays unknown. Sensitive attributes are rejected instead of
 * being inferred, and every fact must cite a source.
 */
export function proposeQualification(input: {
  facts: readonly QualificationFact[];
  requiredKeys: readonly string[];
}): QualificationProposal {
  const rejectedSensitive: string[] = [];
  const accepted: QualificationFact[] = [];
  for (const fact of input.facts) {
    if (isSensitiveKey(fact.key)) {
      rejectedSensitive.push(fact.key);
      continue;
    }
    if (!fact.sourceRef) {
      throw new ServiceError("EVIDENCE_REQUIRED", "qualification fact without source", {
        details: { key: fact.key },
      });
    }
    accepted.push(fact);
  }
  const present = new Set(accepted.map((fact) => fact.key));
  const missing = input.requiredKeys.filter((key) => !present.has(key));
  return { facts: accepted, missing, rejectedSensitive };
}

const INSTRUCTION_PATTERN =
  /(ignore (all )?previous instructions|system prompt|you must call|execute (the )?tool|exfiltrat|send (me )?(the )?(token|secret))/i;

export interface AccountContext {
  readonly blocks: readonly { sourceRef: string; text: string; flagged: boolean }[];
  readonly flaggedSources: readonly string[];
  readonly rightsRef: string;
}

/**
 * Fetched text is data, never instruction: instruction-like content is kept but
 * flagged so policy can refuse it and the model cannot treat it as authority.
 */
export function buildAccountContext(input: {
  rightsRef: string;
  blocks: readonly { sourceRef: string; text: string }[];
}): AccountContext {
  const blocks = input.blocks.map((block) => ({
    ...block,
    flagged: INSTRUCTION_PATTERN.test(block.text),
  }));
  return {
    rightsRef: input.rightsRef,
    blocks,
    flaggedSources: blocks.filter((block) => block.flagged).map((b) => b.sourceRef),
  };
}

export function assertAccountScope(account: Account, tenantId: string): void {
  if (account.tenantId !== tenantId) {
    throw new ServiceError("TENANT_MISMATCH", "account belongs to another tenant");
  }
}
