import { describe, expect, it } from "vitest";
import {
  ServiceError,
  type DelegationMandate,
  type TwinBinding,
} from "@agntia-ventas/contracts";
import { assertMandateAllowsWork, mandateDataScope } from "./mandate.ts";

const NOW = new Date("2026-11-15T00:00:00Z");

const twin: TwinBinding = {
  id: "twin-binding-001",
  canonicalAgentRef: "runtime-agent-001",
  canonicalRevision: "rev-54b8d54",
  instanceRef: "instance-ventas-01",
  targetTenantId: "tenant-target-01",
  workOrderRef: "work-order-001",
  capabilities: ["sales.quote.calculate", "sales.quote.propose"],
  purpose: "pilot quote preparation",
  issuedAt: "2026-11-01T00:00:00Z",
  expiresAt: "2027-01-01T00:00:00Z",
  revocationVersion: 3,
  proofRef: "proof-001",
};

function mandate(overrides: Partial<DelegationMandate> = {}): DelegationMandate {
  return {
    id: "mandate-001",
    originatingActorId: "user-operator-01",
    originatingTenantId: "tenant-operator-01",
    targetTenantId: "tenant-target-01",
    twinBindingRef: "twin-binding-001",
    workOrderRef: "work-order-001",
    capabilities: ["sales.quote.calculate"],
    purpose: "calculate a quote for the pilot",
    budget: { amount: "30.00", currency: "EUR" },
    issuedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-12-01T00:00:00Z",
    revocationVersion: 3,
    proofRef: "proof-001",
    ...overrides,
  };
}

function check(overrides: Partial<DelegationMandate> = {}, expected?: string): void {
  try {
    assertMandateAllowsWork(mandate(overrides), {
      now: NOW,
      twin,
      expectedRevocationVersion: 3,
      requiredCapability: "sales.quote.calculate",
    });
    expect(expected).toBeUndefined();
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).code).toBe(expected);
  }
}

describe("delegation mandates", () => {
  it("accepts a live mandate bound to the twin", () => {
    check();
  });

  it("rejects an expired mandate", () => {
    check({ expiresAt: "2026-11-14T00:00:00Z" }, "MANDATE_EXPIRED");
  });

  it("rejects a mandate that is not valid yet", () => {
    check({ issuedAt: "2026-12-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" }, "MANDATE_INVALID");
  });

  it("rejects a superseded or revoked mandate", () => {
    check({ revocationVersion: 2 }, "MANDATE_REVOKED");
  });

  it("rejects a mandate bound to another twin or tenant", () => {
    check({ twinBindingRef: "twin-binding-999" }, "MANDATE_INVALID");
    check({ targetTenantId: "tenant-beta-02" }, "TENANT_MISMATCH");
  });

  it("never widens the twin capabilities", () => {
    check(
      { capabilities: ["sales.quote.calculate", "sales.email.preview"] },
      "CAPABILITY_WIDENING",
    );
  });

  it("requires the requested capability inside the mandate", () => {
    try {
      assertMandateAllowsWork(mandate({ capabilities: ["sales.quote.propose"] }), {
        now: NOW,
        twin,
        expectedRevocationVersion: 3,
        requiredCapability: "sales.quote.calculate",
      });
      throw new Error("expected failure");
    } catch (error) {
      expect((error as ServiceError).code).toBe("CAPABILITY_NOT_GRANTED");
    }
  });

  it("requires an explicit work order for cross-tenant delegation", () => {
    check({ workOrderRef: null }, "MANDATE_INVALID");
    check(
      { originatingTenantId: "tenant-target-01", workOrderRef: null },
      undefined,
    );
  });

  it("requires a positive budget", () => {
    check({ budget: { amount: "0.00", currency: "EUR" } }, "MANDATE_INVALID");
    check({ budget: { amount: "-5.00", currency: "EUR" } }, "MANDATE_INVALID");
  });

  it("refuses an unreadable budget instead of accepting it as positive", () => {
    check({ budget: { amount: "abc", currency: "EUR" } }, "MANDATE_INVALID");
    check(
      { budget: { amount: "10,00", currency: "EUR" } as DelegationMandate["budget"] },
      "MANDATE_INVALID",
    );
  });

  it("treats an unreadable date as expired or invalid, never as live", () => {
    check({ expiresAt: "mañana" }, "MANDATE_EXPIRED");
    check({ issuedAt: "ayer" }, "MANDATE_INVALID");

    try {
      assertMandateAllowsWork(mandate(), {
        now: new Date("not-a-date"),
        twin,
        expectedRevocationVersion: 3,
        requiredCapability: "sales.quote.calculate",
      });
      throw new Error("expected failure");
    } catch (error) {
      expect((error as ServiceError).code).toBe("MANDATE_EXPIRED");
    }
  });

  it("keeps the target tenant as data scope without rewriting the origin", () => {
    const value = mandate();
    expect(mandateDataScope(value)).toBe("tenant-target-01");
    expect(value.originatingTenantId).toBe("tenant-operator-01");
  });
});
