import { createHash } from "node:crypto";
import { ServiceError } from "@agntia-ventas/contracts";
import type {
  EmailDraft,
  MeetingProposal,
  ProposalClaim,
  ProposalRevision,
  SequenceState,
} from "./models.ts";

/** Deterministic JSON: nested keys are sorted, so a hash never depends on order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

export function contentHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

const canonicalHash = contentHash;

/**
 * A commercial text keeps the difference between a confirmed fact (with
 * evidence) and a proposal. A fact without evidence is refused, not softened.
 */
export function proposeRevision(input: {
  id: string;
  version: number;
  claims: readonly ProposalClaim[];
}): ProposalRevision {
  const warnings: string[] = [];
  for (const claim of input.claims) {
    if (claim.kind === "fact" && !claim.evidenceRef) {
      throw new ServiceError("EVIDENCE_REQUIRED", "fact claim without evidence", {
        details: { text: claim.text.slice(0, 80) },
      });
    }
    if (claim.kind === "inference") {
      warnings.push("inference_present_marked_as_such");
    }
  }
  return {
    id: input.id,
    version: input.version,
    payloadHash: canonicalHash({
      version: input.version,
      claims: input.claims.map((claim) => ({
        text: claim.text,
        kind: claim.kind,
        evidenceRef: claim.evidenceRef ?? null,
      })),
    }),
    claims: [...input.claims],
    warnings,
  };
}

function offsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const read = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return Math.round((asIfUtc - date.getTime()) / 60_000);
}

/**
 * Double click is idempotent (same operationKey). A DST transition makes the
 * local slot ambiguous; the result is `uncertain`, never a silent guess.
 */
export function proposeMeeting(input: {
  id: string;
  operationKey: string;
  startUtc: string;
  timeZone: string;
  attendees: readonly string[];
  alreadyBooked?: readonly MeetingProposal[];
}): MeetingProposal {
  const existing = input.alreadyBooked?.find(
    (meeting) => meeting.operationKey === input.operationKey,
  );
  if (existing) return existing;

  if (input.attendees.length === 0) {
    throw new ServiceError("VALIDATION_FAILED", "meeting needs at least one attendee");
  }

  const start = new Date(input.startUtc);
  const before = offsetMinutes(new Date(start.getTime() - 30 * 60_000), input.timeZone);
  const after = offsetMinutes(new Date(start.getTime() + 30 * 60_000), input.timeZone);
  const ambiguous = before !== after;

  return {
    id: input.id,
    operationKey: input.operationKey,
    startUtc: input.startUtc,
    timeZone: input.timeZone,
    attendees: [...input.attendees],
    status: ambiguous ? "uncertain" : "proposed",
  };
}

export interface EmailPlan {
  readonly mode: "sink_only";
  readonly externalEffect: false;
  readonly draft: EmailDraft;
}

/**
 * Pilot email is a preview into a controlled sink. A test endpoint can still
 * have an effect, so sending stays out of the tool surface.
 */
export function createEmailPreview(input: {
  recipient: string;
  subject: string;
  body: string;
  purpose: string;
  suppressed: boolean;
  sinkAllowlist: readonly string[];
}): EmailPlan {
  if (input.suppressed) {
    throw new ServiceError("SUPPRESSION_BLOCKED", "recipient is suppressed");
  }
  if (!input.sinkAllowlist.includes(input.recipient)) {
    throw new ServiceError("VALIDATION_FAILED", "recipient outside the pilot sink allowlist", {
      details: { recipient: input.recipient },
    });
  }
  const draft: EmailDraft = {
    recipient: input.recipient,
    channel: "email",
    subject: input.subject,
    body: input.body,
    purpose: input.purpose,
    contentHash: canonicalHash({
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
    }),
  };
  return { mode: "sink_only", externalEffect: false, draft };
}

/** A timeout after a possible remote accept is unknown, never a safe retry. */
export function reconcileAfterTimeout(): {
  status: "outcome_unknown";
  retryable: false;
  reconciliationRequired: true;
} {
  return {
    status: "outcome_unknown",
    retryable: false,
    reconciliationRequired: true,
  };
}

export interface FollowUpDecision {
  readonly allowed: boolean;
  readonly reason?: "opposed" | "suppressed" | "cap_reached" | "no_channel_permission";
}

/** Suppression, opposition and caps are re-checked before every step. */
export function nextFollowUp(input: {
  state: SequenceState;
  hasChannelPermission: boolean;
}): FollowUpDecision {
  if (input.state.opposed) return { allowed: false, reason: "opposed" };
  if (input.state.suppressed) return { allowed: false, reason: "suppressed" };
  if (!input.hasChannelPermission) {
    return { allowed: false, reason: "no_channel_permission" };
  }
  if (input.state.stepIndex >= input.state.maxSteps) {
    return { allowed: false, reason: "cap_reached" };
  }
  return { allowed: true };
}

/**
 * A human takeover mutes the twin immediately; a queued job must re-validate
 * before speaking, so a late automatic reply never lands after the human.
 */
export function applyHumanTakeover(input: {
  takeoverBy: string;
  queuedJobs: readonly { id: string; twinGenerated: boolean }[];
}): { muted: boolean; cancelled: string[]; owner: string } {
  if (!input.takeoverBy) {
    throw new ServiceError("VALIDATION_FAILED", "takeover requires an owner");
  }
  return {
    muted: true,
    cancelled: input.queuedJobs
      .filter((job) => job.twinGenerated)
      .map((job) => job.id),
    owner: input.takeoverBy,
  };
}

export function assertNoInternalLeak(input: {
  externalBody: string;
  internalNotes: readonly string[];
}): void {
  const leaked = input.internalNotes.some(
    (note) => note.trim().length > 0 && input.externalBody.includes(note.trim()),
  );
  if (leaked) {
    throw new ServiceError("VALIDATION_FAILED", "internal note present in external payload");
  }
}
