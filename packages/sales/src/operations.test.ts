import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  OPERATIONS_STATUS,
  assertDiscoveryEndpoint,
  assertNoSecretMaterial,
  planRestore,
  previewImport,
  proposeOrder,
  proposeRenewal,
} from "./operations.ts";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("discovery and secrets", () => {
  it("accepts an allowlisted https endpoint", () => {
    expect(assertDiscoveryEndpoint("https://api.provider.test/v1/search", ["api.provider.test"]).hostname).toBe(
      "api.provider.test",
    );
  });

  it("rejects http, unknown hosts, credentials and private targets", () => {
    expect(
      codeOf(() => assertDiscoveryEndpoint("http://api.provider.test/v1", ["api.provider.test"])),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() => assertDiscoveryEndpoint("https://evil.test/v1", ["api.provider.test"])),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() =>
        assertDiscoveryEndpoint("https://user:pass@api.provider.test/v1", ["api.provider.test"]),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() => assertDiscoveryEndpoint("https://10.0.0.5/v1", ["10.0.0.5"])),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() => assertDiscoveryEndpoint("https://localhost/v1", ["localhost"])),
    ).toBe("VALIDATION_FAILED");
  });

  it("detects secret material", () => {
    expect(codeOf(() => assertNoSecretMaterial("sk-live-abcdefghijkl"))).toBe("VALIDATION_FAILED");
    expect(codeOf(() => assertNoSecretMaterial("postgres://u:p@db/x"))).toBe("VALIDATION_FAILED");
    expect(() => assertNoSecretMaterial("propuesta comercial")).not.toThrow();
  });
});

describe("imports", () => {
  const base = {
    seenExternalIds: ["ext-01"],
    reviewedVersions: { "ext-02": "sha256:old" },
    previousCursor: "cursor-1",
    nextCursor: "cursor-2",
  };

  it("separates fresh, duplicate and conflicting records", () => {
    const preview = previewImport({
      ...base,
      records: [
        { externalId: "ext-01", contentHash: "sha256:a" },
        { externalId: "ext-02", contentHash: "sha256:new" },
        { externalId: "ext-03", contentHash: "sha256:c" },
      ],
    });
    expect(preview.fresh.map((record) => record.externalId)).toEqual(["ext-03"]);
    expect(preview.duplicates).toEqual(["ext-01"]);
    expect(preview.conflicts).toEqual([
      { externalId: "ext-02", reason: "reviewed_content_changed" },
    ]);
    expect(preview.nextCursor).toBe("cursor-2");
  });

  it("rejects a backwards cursor and an unhashed record", () => {
    expect(
      codeOf(() =>
        previewImport({
          ...base,
          nextCursor: "cursor-1",
          records: [{ externalId: "ext-09", contentHash: "sha256:x" }],
        }),
      ),
    ).toBe("CURSOR_REGRESSION");

    expect(
      codeOf(() =>
        previewImport({
          records: [{ externalId: "ext-09", contentHash: "raw" }],
          seenExternalIds: [],
          reviewedVersions: {},
          previousCursor: null,
          nextCursor: "cursor-1",
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("order and renewal", () => {
  it("requires the accepted quote and the receiver ACK", () => {
    expect(
      codeOf(() =>
        proposeOrder({
          id: "order-01",
          acceptedQuoteRef: null,
          total: { amount: "45.96", currency: "EUR" },
          receiverRef: "receiver-01",
          ackRef: "ack-01",
        }),
      ),
    ).toBe("APPROVAL_INVALID");
    expect(
      codeOf(() =>
        proposeOrder({
          id: "order-02",
          acceptedQuoteRef: "quote-01",
          total: { amount: "45.96", currency: "EUR" },
          receiverRef: "receiver-01",
          ackRef: null,
        }),
      ),
    ).toBe("HANDOFF_NOT_ACKED");

    expect(
      proposeOrder({
        id: "order-03",
        acceptedQuoteRef: "quote-01",
        total: { amount: "45.96", currency: "EUR" },
        receiverRef: "receiver-01",
        ackRef: "ack-01",
      }).status,
    ).toBe("proposed_to_operations");
  });

  it("keeps a price change as an approval-gated proposal", () => {
    expect(
      codeOf(() =>
        proposeRenewal({
          id: "renewal-01",
          previousPrice: { amount: "19.99", currency: "EUR" },
          proposedPrice: { amount: "21.99", currency: "EUR" },
          approvalRef: null,
        }),
      ),
    ).toBe("APPROVAL_INVALID");

    expect(
      proposeRenewal({
        id: "renewal-02",
        previousPrice: { amount: "19.99", currency: "EUR" },
        proposedPrice: { amount: "19.99", currency: "EUR" },
        approvalRef: null,
      }).requiresApproval,
    ).toBe(false);

    // Same money with another scale is not a price change.
    expect(
      proposeRenewal({
        id: "renewal-03",
        previousPrice: { amount: "19.9", currency: "EUR" },
        proposedPrice: { amount: "19.90", currency: "EUR" },
        approvalRef: null,
      }).requiresApproval,
    ).toBe(false);
  });
});

describe("restore", () => {
  it("reapplies restrictions and blocks orphan jobs", () => {
    expect(
      planRestore({
        restrictions: ["suppression:ana@example.test", "no_outbound"],
        queuedJobs: [
          { id: "job-01", mandateActive: true },
          { id: "job-02", mandateActive: false },
        ],
      }),
    ).toEqual({
      reappliedRestrictions: ["suppression:ana@example.test", "no_outbound"],
      blockedQueuedJobs: 1,
      resurrectedMandates: 0,
    });
  });

  it("declares CI and backups as not configured", () => {
    expect(OPERATIONS_STATUS.ci).toBe("NOT_CONFIGURED");
    expect(OPERATIONS_STATUS.backups).toBe("NOT_CONFIGURED");
  });
});

describe("secret material", () => {
  it("recognizes provider token formats beyond the legacy sk- prefix", () => {
    for (const value of [
      "sk_live_abcdefghijklmnop",
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "AKIAIOSFODNN7EXAMPLE",
      "xoxb-1234567890-abcdefghij",
    ]) {
      expect(codeOf(() => assertNoSecretMaterial(value))).toBe("VALIDATION_FAILED");
    }
  });
});
