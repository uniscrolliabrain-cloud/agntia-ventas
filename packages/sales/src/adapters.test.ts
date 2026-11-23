import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  CHECKOUT_PORT,
  HOST_BRIDGE,
  SIGNATURE_PORT,
  TWENTY_ADAPTER,
  assertCapabilityAllowed,
  assertPortEnabled,
  createCapabilityReport,
  createCrmAdapter,
  modelToolSurface,
} from "./adapters.ts";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

async function asyncCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ServiceError ? error.code : "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("capability reports", () => {
  it("refuses verified_runtime without evidence", () => {
    expect(
      codeOf(() =>
        createCapabilityReport({
          provider: "twenty",
          kind: "crm",
          status: "verified_runtime",
          checkedAt: "2026-11-15T00:00:00Z",
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("refuses blank evidence and an unreadable check time", () => {
    expect(
      codeOf(() =>
        createCapabilityReport({
          provider: "twenty",
          kind: "crm",
          status: "verified_runtime",
          checkedAt: "2026-11-15T00:00:00Z",
          evidenceRefs: ["   "],
        }),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() =>
        createCapabilityReport({
          provider: "twenty",
          kind: "crm",
          status: "documented",
          checkedAt: "ayer",
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("keeps unknown capabilities disabled", () => {
    const report = createCapabilityReport({
      provider: "espocrm",
      kind: "crm",
      status: "unknown",
      checkedAt: "2026-11-15T00:00:00Z",
    });
    expect(report.status).toBe("unknown");
  });
});

describe("crm adapters", () => {
  it("refuses to act on a documented provider", async () => {
    expect(TWENTY_ADAPTER.report.status).toBe("documented");
    expect(await asyncCodeOf(TWENTY_ADAPTER.previewImport())).toBe(
      "PROVIDER_NOT_CONFIGURED",
    );
  });

  it("never fakes a verified provider it does not bundle", async () => {
    const adapter = createCrmAdapter(
      createCapabilityReport({
        provider: "crm-verified",
        kind: "crm",
        status: "verified_runtime",
        checkedAt: "2026-11-15T00:00:00Z",
        evidenceRefs: ["evidence-crm-01"],
      }),
    );
    expect(await asyncCodeOf(adapter.writeBack())).toBe("NOT_IMPLEMENTED");
  });
});

describe("disabled ports and bridge", () => {
  it("keeps signature and checkout disabled", () => {
    expect(codeOf(() => assertPortEnabled(SIGNATURE_PORT))).toBe("NOT_IMPLEMENTED");
    expect(codeOf(() => assertPortEnabled(CHECKOUT_PORT))).toBe("NOT_IMPLEMENTED");
  });

  it("does not claim a parent bridge mapping", () => {
    expect(HOST_BRIDGE.mapEvent({ type: "ventas.proposal.created" })).toEqual({
      mapped: false,
      reason: "HOST_BRIDGE_NOT_VERIFIED",
      type: "ventas.proposal.created",
    });
  });

  it("keeps approval out of the model tool surface", () => {
    expect(modelToolSurface()).not.toContain("sales_approve_quote");
    expect(codeOf(() => assertCapabilityAllowed("sales_approve_quote"))).toBe(
      "CAPABILITY_NOT_GRANTED",
    );
  });

  it("denies by default any tool outside the named surface", () => {
    expect(() => assertCapabilityAllowed("sales_pipeline_read")).not.toThrow();
    for (const capability of ["sales_send_email", "sales_charge_card", "admin_users"]) {
      expect(codeOf(() => assertCapabilityAllowed(capability))).toBe(
        "CAPABILITY_NOT_GRANTED",
      );
    }
  });
});
