import { describe, expect, it } from "vitest";
import {
  CapabilitySchema,
  MoneySchema,
  OperationEnvelopeSchema,
  ScopeSchema,
} from "./index.ts";
import { isModelExposedCapability } from "./capabilities.ts";
import { OperationResultSchema } from "./results.ts";

describe("money contract", () => {
  it("accepts exact decimal strings", () => {
    expect(MoneySchema.parse({ amount: "19.99", currency: "EUR" }).amount).toBe("19.99");
    expect(MoneySchema.parse({ amount: "0.00000001", currency: "USD" }).amount).toBe(
      "0.00000001",
    );
  });

  it("rejects floats, exponent notation and more than 8 decimals", () => {
    expect(MoneySchema.safeParse({ amount: 0.1, currency: "EUR" }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: "1e3", currency: "EUR" }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: "01.00", currency: "EUR" }).success).toBe(false);
    expect(
      MoneySchema.safeParse({ amount: "1.000000001", currency: "EUR" }).success,
    ).toBe(false);
  });

  it("rejects unknown fields and non ISO-4217 currencies", () => {
    expect(
      MoneySchema.safeParse({ amount: "1.00", currency: "EUR", extra: true }).success,
    ).toBe(false);
    expect(MoneySchema.safeParse({ amount: "1.00", currency: "eur" }).success).toBe(false);
    expect(MoneySchema.safeParse({ amount: "1.00", currency: "EURO" }).success).toBe(false);
  });
});

describe("envelope contract", () => {
  const valid = {
    schemaVersion: 1,
    operationId: "operation-0001",
    tenantId: "tenant-alpha-01",
    actorId: "user-alpha-01",
    capability: "sales.quote.calculate",
    correlationId: "corr-0001",
    causationId: null,
    idempotencyKey: "idempotency-0001",
    expectedVersion: 1,
    approvalRef: null,
    dryRun: true,
    payload: { quoteRef: "quote-0001" },
  };

  it("accepts a complete envelope", () => {
    expect(OperationEnvelopeSchema.parse(valid).capability).toBe("sales.quote.calculate");
  });

  it("rejects identity fields smuggled as unknown keys", () => {
    const result = OperationEnvelopeSchema.safeParse({ ...valid, approved: true });
    expect(result.success).toBe(false);
  });

  it("rejects another schema version and unknown capabilities", () => {
    expect(OperationEnvelopeSchema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(
      false,
    );
    expect(
      OperationEnvelopeSchema.safeParse({ ...valid, capability: "sales.send" }).success,
    ).toBe(false);
  });

  it("requires a real idempotency key and version", () => {
    expect(
      OperationEnvelopeSchema.safeParse({ ...valid, idempotencyKey: "short" }).success,
    ).toBe(false);
    expect(OperationEnvelopeSchema.safeParse({ ...valid, expectedVersion: 0 }).success).toBe(
      false,
    );
    expect(
      OperationEnvelopeSchema.safeParse({ ...valid, payload: "not-an-object" }).success,
    ).toBe(false);
  });
});

describe("capability catalogue", () => {
  it("is closed", () => {
    expect(CapabilitySchema.safeParse("sales.quote.calculate").success).toBe(true);
    expect(CapabilitySchema.safeParse("sales.execute-anything").success).toBe(false);
  });

  it("keeps baseline and sensitive effects out of the model surface", () => {
    expect(isModelExposedCapability("sales.quote.calculate")).toBe(true);
    expect(isModelExposedCapability("baseline.capture")).toBe(false);
    expect(isModelExposedCapability("storage.migrate")).toBe(false);
    expect(isModelExposedCapability("sales.approve.quote")).toBe(false);
    expect(isModelExposedCapability("sales.send.email")).toBe(false);
  });
});

describe("scopes and results", () => {
  it("requires resource:action scopes", () => {
    expect(ScopeSchema.safeParse("sales.quote:propose").success).toBe(true);
    expect(ScopeSchema.safeParse("sales").success).toBe(false);
    expect(ScopeSchema.safeParse("Sales:read").success).toBe(false);
    expect(ScopeSchema.safeParse("sales.quote").success).toBe(false);
  });

  const base = {
    operationId: "operation-0001",
    payloadHash: `sha256:${"a".repeat(64)}`,
    localRefs: [],
    evidenceRefs: [],
    warnings: [],
    actualScope: [],
    occurredAt: "2026-11-15T00:00:00Z",
  };

  it("models an uncertain outcome as reconciliation, not a safe retry", () => {
    const unknown = OperationResultSchema.parse({
      ...base,
      status: "outcome_unknown",
      remoteRefs: ["remote-0001"],
      reconciliationRequired: true,
      retryable: false,
    });
    expect(unknown.status).toBe("outcome_unknown");

    const unsafeRetry = OperationResultSchema.safeParse({
      ...base,
      status: "outcome_unknown",
      remoteRefs: [],
      reconciliationRequired: false,
      retryable: false,
    });
    expect(unsafeRetry.success).toBe(false);
  });

  it("requires a reason for blocked and failed results", () => {
    expect(
      OperationResultSchema.safeParse({
        ...base,
        status: "blocked",
        reasonCode: "STALE_PRICEBOOK",
        reconciliationRequired: false,
      }).success,
    ).toBe(true);
    expect(
      OperationResultSchema.safeParse({
        ...base,
        status: "blocked",
        reconciliationRequired: false,
      }).success,
    ).toBe(false);
  });
});
