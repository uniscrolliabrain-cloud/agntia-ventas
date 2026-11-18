import Decimal from "decimal.js";
import { ServiceError, type Money } from "@agntia-ventas/contracts";

// ---------------------------------------------------------------------------
// C08 — secret references and provider discovery
// ---------------------------------------------------------------------------

export interface SecretRef {
  readonly id: string;
  readonly provider: string;
  readonly environment: "staging" | "production";
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /sk_(live|test)_[A-Za-z0-9]{10,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /Bearer\s+[A-Za-z0-9._-]{10,}/,
  /postgres(ql)?:\/\/[^\s]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/** Only server-side references travel through contracts, never a secret value. */
export function assertNoSecretMaterial(value: string): void {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new ServiceError("VALIDATION_FAILED", "payload looks like secret material", {
      details: { rule: "no_secret_material" },
    });
  }
}

/** Same private-target rule the source fetcher uses: no loopback, no IP
 * literal (including IPv6), no `.local`/`.internal`/`.localhost` suffix. */
const PRIVATE_HOSTNAME = /^(localhost|\[[^\]]+\]|\d{1,3}(\.\d{1,3}){3}|.*\.(local|internal|localhost))$/i;

/**
 * Discovery cannot take a free URL from the model: https, the default port, an
 * allowlisted host, no embedded credentials and no IP literal or private
 * target.
 */
export function assertDiscoveryEndpoint(url: string, allowlist: readonly string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceError("VALIDATION_FAILED", "endpoint is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new ServiceError("VALIDATION_FAILED", "endpoint must use https");
  }
  if (parsed.username || parsed.password) {
    throw new ServiceError("VALIDATION_FAILED", "endpoint must not embed credentials");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new ServiceError("VALIDATION_FAILED", "endpoint must use the default https port");
  }
  if (!allowlist.includes(parsed.hostname)) {
    throw new ServiceError("VALIDATION_FAILED", "endpoint host is not allowlisted", {
      details: { host: parsed.hostname },
    });
  }
  if (PRIVATE_HOSTNAME.test(parsed.hostname)) {
    throw new ServiceError("VALIDATION_FAILED", "endpoint targets a private host", {
      details: { host: parsed.hostname },
    });
  }
  assertNoSecretMaterial(url);
  return parsed;
}

// ---------------------------------------------------------------------------
// C16 — import preview, cursor and conflicts
// ---------------------------------------------------------------------------

export interface ImportRecord {
  readonly externalId: string;
  readonly contentHash: string;
}

export interface ImportPreview {
  readonly fresh: readonly ImportRecord[];
  readonly duplicates: readonly string[];
  readonly conflicts: readonly { externalId: string; reason: string }[];
  readonly nextCursor: string;
}

/**
 * Cursors are opaque to the caller but self-describing to the core:
 * `v1:<sequence>:<opaque token>`. The sequence is what orders two pages, so a
 * base64/UUID token cannot be compared lexicographically by accident.
 */
const CURSOR_PATTERN = /^v(\d{1,3}):(\d{1,15}):([A-Za-z0-9._~-]{1,200})$/;

function parseImportCursor(cursor: string, field: string): number {
  const match = CURSOR_PATTERN.exec(cursor);
  const version = Number(match?.[1]);
  const sequence = Number(match?.[2]);
  if (!match || version !== 1 || !Number.isSafeInteger(sequence)) {
    throw new ServiceError(
      "VALIDATION_FAILED",
      "cursor is not a supported versioned import cursor",
      { details: { field } },
    );
  }
  return sequence;
}

/**
 * Repeating an import never duplicates. A record whose content changed after a
 * local review is a conflict, not a silent overwrite, and the cursor only moves
 * forward after the local commit.
 */
export function previewImport(input: {
  records: readonly ImportRecord[];
  seenExternalIds: readonly string[];
  reviewedVersions: Readonly<Record<string, string>>;
  previousCursor: string | null;
  nextCursor: string;
}): ImportPreview {
  const nextSequence = parseImportCursor(input.nextCursor, "nextCursor");
  if (input.previousCursor !== null) {
    const previousSequence = parseImportCursor(input.previousCursor, "previousCursor");
    if (nextSequence <= previousSequence) {
      throw new ServiceError("CURSOR_REGRESSION", "cursor cannot move backwards");
    }
  }
  const seen = new Set(input.seenExternalIds);
  const fresh: ImportRecord[] = [];
  const duplicates: string[] = [];
  const conflicts: { externalId: string; reason: string }[] = [];

  for (const record of input.records) {
    const reviewed = input.reviewedVersions[record.externalId];
    if (reviewed && reviewed !== record.contentHash) {
      conflicts.push({ externalId: record.externalId, reason: "reviewed_content_changed" });
      continue;
    }
    if (seen.has(record.externalId)) {
      duplicates.push(record.externalId);
      continue;
    }
    freshnessGuard(record);
    fresh.push(record);
  }

  return { fresh, duplicates, conflicts, nextCursor: input.nextCursor };
}

function freshnessGuard(record: ImportRecord): void {
  if (!record.contentHash.startsWith("sha256:")) {
    throw new ServiceError("VALIDATION_FAILED", "import record without content hash", {
      details: { externalId: record.externalId },
    });
  }
}

// ---------------------------------------------------------------------------
// C29 — order proposal and operational handoff
// ---------------------------------------------------------------------------

export interface OrderProposal {
  readonly id: string;
  readonly acceptedQuoteRef: string;
  readonly receiverRef: string;
  readonly ackRef: string;
  readonly total: Money;
  readonly status: "proposed_to_operations";
}

/** A won deal is not an order: an accepted quote and a receiver ACK are needed. */
export function proposeOrder(input: {
  id: string;
  acceptedQuoteRef: string | null;
  total: Money;
  receiverRef: string | null;
  ackRef: string | null;
}): OrderProposal {
  if (!input.acceptedQuoteRef) {
    throw new ServiceError("APPROVAL_INVALID", "order needs an accepted quote");
  }
  if (!input.receiverRef) {
    throw new ServiceError("VALIDATION_FAILED", "order needs a receiver");
  }
  if (!input.ackRef) {
    throw new ServiceError("HANDOFF_NOT_ACKED", "order needs the receiver ACK");
  }
  return {
    id: input.id,
    acceptedQuoteRef: input.acceptedQuoteRef,
    receiverRef: input.receiverRef,
    ackRef: input.ackRef,
    total: input.total,
    status: "proposed_to_operations",
  };
}

// ---------------------------------------------------------------------------
// C30 — renewal and expansion
// ---------------------------------------------------------------------------

export interface RenewalProposal {
  readonly id: string;
  readonly previousPrice: Money;
  readonly proposedPrice: Money;
  readonly requiresApproval: boolean;
  readonly approvalRef: string | null;
  readonly status: "proposed";
}

/** A price change stays a proposal until a human approval covers it. */
export function proposeRenewal(input: {
  id: string;
  previousPrice: Money;
  proposedPrice: Money;
  approvalRef: string | null;
}): RenewalProposal {
  if (input.previousPrice.currency !== input.proposedPrice.currency) {
    throw new ServiceError("CURRENCY_MISMATCH", "renewal prices must share a currency");
  }
  // Same money, other scale ("10.0" vs "10.00") is not a price change.
  const changed = !new Decimal(input.previousPrice.amount).equals(
    input.proposedPrice.amount,
  );
  if (changed && !input.approvalRef) {
    throw new ServiceError(
      "APPROVAL_INVALID",
      "a price change in renewal needs an approval",
      { details: { previous: input.previousPrice.amount } },
    );
  }
  return {
    id: input.id,
    previousPrice: input.previousPrice,
    proposedPrice: input.proposedPrice,
    requiresApproval: changed,
    approvalRef: input.approvalRef,
    status: "proposed",
  };
}

// ---------------------------------------------------------------------------
// C41 — restore and release operations
// ---------------------------------------------------------------------------

export interface RestoreCheck {
  readonly reappliedRestrictions: readonly string[];
  readonly blockedQueuedJobs: number;
  readonly resurrectedMandates: 0;
}

/**
 * Restore reapplies restrictions and suppressions and never reactivates expired
 * mandates or previously confirmed effects.
 */
export function planRestore(input: {
  restrictions: readonly string[];
  queuedJobs: readonly { id: string; mandateActive: boolean }[];
}): RestoreCheck {
  return {
    reappliedRestrictions: [...input.restrictions],
    blockedQueuedJobs: input.queuedJobs.filter((job) => !job.mandateActive).length,
    resurrectedMandates: 0,
  };
}

/** CI and backups are not configured in this repository: no false claim. */
export const OPERATIONS_STATUS = {
  ci: "NOT_CONFIGURED",
  backups: "NOT_CONFIGURED",
  observability: "NOT_CONFIGURED",
  runbook: "DOCUMENTED_ONLY",
} as const;
