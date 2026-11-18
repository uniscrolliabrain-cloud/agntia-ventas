import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  applyHumanTakeover,
  assertNoInternalLeak,
  createEmailPreview,
  nextFollowUp,
  proposeMeeting,
  proposeRevision,
  reconcileAfterTimeout,
  stableStringify,
} from "./commercial.ts";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("proposal revisions", () => {
  it("hashes deterministically regardless of key order", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });

  it("refuses a cyclic payload instead of overflowing the stack", () => {
    const cyclic: Record<string, unknown> = { id: "proposal-02" };
    cyclic["self"] = cyclic;
    expect(codeOf(() => stableStringify(cyclic))).toBe("VALIDATION_FAILED");
  });

  it("accepts the same object referenced twice and refuses values JSON cannot hold", () => {
    const shared = { amount: "10.00" };
    expect(stableStringify({ left: shared, right: shared })).toBe(
      '{"left":{"amount":"10.00"},"right":{"amount":"10.00"}}',
    );
    expect(codeOf(() => stableStringify({ total: 10n }))).toBe("VALIDATION_FAILED");
    // Both used to serialize as `null`, so two different payloads produced one
    // sha256 and could share an approval binding.
    expect(codeOf(() => stableStringify({ total: undefined }))).toBe("VALIDATION_FAILED");
    expect(codeOf(() => stableStringify({ total: Number.NaN }))).toBe("VALIDATION_FAILED");
    expect(codeOf(() => stableStringify({ total: Number.POSITIVE_INFINITY }))).toBe(
      "VALIDATION_FAILED",
    );
  });

  it("refuses a fact without evidence", () => {
    expect(
      codeOf(() =>
        proposeRevision({
          id: "proposal-01",
          version: 1,
          claims: [{ text: "El cliente aceptó", kind: "fact" }],
        }),
      ),
    ).toBe("EVIDENCE_REQUIRED");
  });

  it("marks inference and keeps the version hash", () => {
    const revision = proposeRevision({
      id: "proposal-01",
      version: 2,
      claims: [
        { text: "Precio vigente", kind: "fact", evidenceRef: "evidence-01" },
        { text: "Entrega probable en 10 días", kind: "inference" },
      ],
    });
    expect(revision.payloadHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(revision.warnings).toContain("inference_present_marked_as_such");
  });
});

describe("meetings", () => {
  it("is idempotent per operation key and rejects another slot under it", () => {
    const first = proposeMeeting({
      id: "meeting-01",
      operationKey: "op-01",
      startUtc: "2026-11-20T10:00:00Z",
      timeZone: "Europe/Madrid",
      attendees: ["user-alpha-01"],
    });
    const repeated = proposeMeeting({
      id: "meeting-02",
      operationKey: "op-01",
      startUtc: "2026-11-20T10:00:00Z",
      timeZone: "Europe/Madrid",
      attendees: ["user-alpha-01"],
      alreadyBooked: [first],
    });
    expect(repeated.id).toBe("meeting-01");
    expect(repeated.startUtc).toBe("2026-11-20T10:00:00Z");

    // The key used to return the 10:00 meeting for an 11:00 request, so the
    // caller believed a slot was booked that never existed.
    expect(
      codeOf(() =>
        proposeMeeting({
          id: "meeting-03",
          operationKey: "op-01",
          startUtc: "2026-11-20T11:00:00Z",
          timeZone: "Europe/Madrid",
          attendees: ["user-alpha-01"],
          alreadyBooked: [first],
        }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("marks a DST-ambiguous slot as uncertain", () => {
    const meeting = proposeMeeting({
      id: "meeting-03",
      operationKey: "op-02",
      startUtc: "2026-10-25T00:45:00Z",
      timeZone: "Europe/Madrid",
      attendees: ["user-alpha-01"],
    });
    expect(meeting.status).toBe("uncertain");
  });

  it("proposes a normal slot and rejects an empty attendee list", () => {
    expect(
      proposeMeeting({
        id: "meeting-04",
        operationKey: "op-03",
        startUtc: "2026-07-01T10:00:00Z",
        timeZone: "Europe/Madrid",
        attendees: ["user-alpha-01"],
      }).status,
    ).toBe("proposed");

    expect(
      codeOf(() =>
        proposeMeeting({
          id: "meeting-05",
          operationKey: "op-04",
          startUtc: "2026-07-01T10:00:00Z",
          timeZone: "Europe/Madrid",
          attendees: [],
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("keeps a midnight slot proposed", () => {
    // Midnight used to render as hour "24" with hour12:false, which shifted
    // the offset a full day and turned a normal slot into "uncertain".
    const meeting = proposeMeeting({
      id: "meeting-08",
      operationKey: "op-07",
      startUtc: "2026-07-01T00:00:00Z",
      timeZone: "UTC",
      attendees: ["user-alpha-01"],
    });
    expect(meeting.status).toBe("proposed");
  });

  it("refuses an unreadable start or an unknown timezone", () => {
    expect(
      codeOf(() =>
        proposeMeeting({
          id: "meeting-06",
          operationKey: "op-05",
          startUtc: "tomorrow",
          timeZone: "Europe/Madrid",
          attendees: ["user-alpha-01"],
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    expect(
      codeOf(() =>
        proposeMeeting({
          id: "meeting-07",
          operationKey: "op-06",
          startUtc: "2026-07-01T10:00:00Z",
          timeZone: "Mars/Olympus",
          attendees: ["user-alpha-01"],
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("supervised email", () => {
  it("creates a sink-only preview with no external effect", () => {
    const plan = createEmailPreview({
      recipient: "ana@example.test",
      subject: "Propuesta",
      body: "Cuerpo",
      purpose: "pilot",
      suppressed: false,
      sinkAllowlist: ["ana@example.test"],
    });
    expect(plan.mode).toBe("sink_only");
    expect(plan.externalEffect).toBe(false);
    expect(plan.draft.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("blocks a suppressed recipient or one outside the allowlist", () => {
    expect(
      codeOf(() =>
        createEmailPreview({
          recipient: "ana@example.test",
          subject: "s",
          body: "b",
          purpose: "p",
          suppressed: true,
          sinkAllowlist: ["ana@example.test"],
        }),
      ),
    ).toBe("SUPPRESSION_BLOCKED");

    expect(
      codeOf(() =>
        createEmailPreview({
          recipient: "otra@example.test",
          subject: "s",
          body: "b",
          purpose: "p",
          suppressed: false,
          sinkAllowlist: ["ana@example.test"],
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("treats a timeout after a possible accept as uncertain", () => {
    expect(reconcileAfterTimeout()).toEqual({
      status: "outcome_unknown",
      retryable: false,
      reconciliationRequired: true,
    });
  });
});

describe("sequences and takeover", () => {
  it("re-checks opposition, suppression and caps", () => {
    const base = { stepIndex: 1, maxSteps: 3, opposed: false, suppressed: false };
    expect(nextFollowUp({ state: base, hasChannelPermission: true })).toEqual({
      allowed: true,
    });
    expect(
      nextFollowUp({ state: { ...base, opposed: true }, hasChannelPermission: true }).reason,
    ).toBe("opposed");
    expect(
      nextFollowUp({ state: { ...base, suppressed: true }, hasChannelPermission: true }).reason,
    ).toBe("suppressed");
    expect(
      nextFollowUp({ state: { ...base, stepIndex: 3 }, hasChannelPermission: true }).reason,
    ).toBe("cap_reached");
    expect(
      nextFollowUp({ state: base, hasChannelPermission: false }).reason,
    ).toBe("no_channel_permission");
  });

  it("cancels twin jobs on human takeover", () => {
    const result = applyHumanTakeover({
      takeoverBy: "user-alpha-01",
      queuedJobs: [
        { id: "job-01", twinGenerated: true },
        { id: "job-02", twinGenerated: false },
      ],
    });
    expect(result.muted).toBe(true);
    expect(result.cancelled).toEqual(["job-01"]);
  });

  it("refuses to leak an internal note into an external message", () => {
    expect(() =>
      assertNoInternalLeak({
        externalBody: "Hola, te envío la propuesta.",
        internalNotes: ["no ofrecer descuento"],
      }),
    ).not.toThrow();
    expect(
      codeOf(() =>
        assertNoInternalLeak({
          externalBody: "Hola, no ofrecer descuento.",
          internalNotes: ["no ofrecer descuento"],
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});
