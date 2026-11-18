import { describe, expect, it, vi } from "vitest";
import { ServiceError, type RoundingPolicy } from "@agntia-ventas/contracts";
import {
  BRIDGE_STATUS,
  mapToParentEvent,
} from "./bridge.ts";
import {
  consumeModelBudget,
  estimateModelCost,
  type ModelPrice,
} from "./costs.ts";
import { createCrmGateway, type FetchLike } from "./crm.ts";
import {
  signWebhookPayload,
  verifySignatureWebhook,
} from "./signature.ts";

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

const tokenRef = { id: "secret-crm-01", provider: "twenty", environment: "staging" as const };
const resolveSecret = async (): Promise<string> => "token-value";

function jsonFetch(body: unknown, status = 200): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const peopleBody = {
  data: {
    people: [
      {
        id: "person-01",
        name: { firstName: "Ana", lastName: "Ejemplo" },
        emails: { primaryEmail: "ana@example.test" },
      },
      { id: "person-02" },
    ],
  },
};

describe("crm gateway", () => {
  it("normalizes people and keeps null when an email is absent", async () => {
    const gateway = createCrmGateway({
      baseUrl: "https://api.provider.test",
      allowedHosts: ["api.provider.test"],
      resolveSecret,
      tokenRef,
      fetchImpl: jsonFetch(peopleBody),
    });

    const people = await gateway.listPeople({ limit: 10 });
    expect(people).toEqual([
      { externalId: "person-01", displayName: "Ana Ejemplo", email: "ana@example.test" },
      { externalId: "person-02", displayName: "", email: null },
    ]);
  });

  it("refuses a host outside the allowlist", () => {
    expect(
      codeOf(() =>
        createCrmGateway({
          baseUrl: "https://evil.test",
          allowedHosts: ["api.provider.test"],
          resolveSecret,
          tokenRef,
          fetchImpl: jsonFetch(peopleBody),
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("reports an unknown response shape instead of guessing", async () => {
    const gateway = createCrmGateway({
      baseUrl: "https://api.provider.test",
      allowedHosts: ["api.provider.test"],
      resolveSecret,
      tokenRef,
      fetchImpl: jsonFetch({ data: { people: [{ id: 1 }] } }),
    });
    expect(await asyncCodeOf(gateway.listPeople({ limit: 5 }))).toBe(
      "PROVIDER_INVALID_RESPONSE",
    );
  });

  it("maps a provider error and never silently retries", async () => {
    const gateway = createCrmGateway({
      baseUrl: "https://api.provider.test",
      allowedHosts: ["api.provider.test"],
      resolveSecret,
      tokenRef,
      fetchImpl: jsonFetch({ error: "boom" }, 503),
    });
    expect(await asyncCodeOf(gateway.listPeople({ limit: 5 }))).toBe("PROVIDER_UNAVAILABLE");
  });

  it("turns an aborted request into a timeout that needs reconciliation", async () => {
    const gateway = createCrmGateway({
      baseUrl: "https://api.provider.test",
      allowedHosts: ["api.provider.test"],
      resolveSecret,
      tokenRef,
      timeoutMs: 5,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });

    await expect(gateway.listPeople({ limit: 5 })).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      retryable: true,
      reconciliationRequired: true,
    });
  });

  it("sends an idempotency key on writes and requires one", async () => {
    const fetchImpl = vi.fn<FetchLike>(jsonFetch({ data: { id: "note-01" } }));
    const gateway = createCrmGateway({
      baseUrl: "https://api.provider.test",
      allowedHosts: ["api.provider.test"],
      resolveSecret,
      tokenRef,
      fetchImpl,
    });

    expect(await asyncCodeOf(gateway.writeNote({ recordId: "r", operationId: "short", body: "x" })))
      .toBe("VALIDATION_FAILED");

    const receipt = await gateway.writeNote({
      recordId: "person-01",
      operationId: "operation-0001",
      body: "Nota",
    });
    expect(receipt.receiptId).toBe("note-01");
    expect(fetchImpl.mock.calls[0]?.[1].headers["idempotency-key"]).toBe("operation-0001");
    // A 30x would leave the allowlisted host, so redirects are an error.
    expect(fetchImpl.mock.calls[0]?.[1].redirect).toBe("error");
  });
});

describe("signature webhook", () => {
  const secret = "test-secret-value";
  const documentHash = `sha256:${"a".repeat(64)}`;
  const rawBody = JSON.stringify({
    eventId: "event-01",
    documentHash,
    signerRef: "signer-01",
    status: "signed",
  });
  const now = "2026-11-15T10:00:00Z";
  const timestamp = Math.floor(new Date(now).getTime() / 1000);

  it("accepts a fresh, correctly signed event for the approved document", () => {
    const event = verifySignatureWebhook({
      headers: {
        "x-signature-timestamp": String(timestamp),
        "x-signature": signWebhookPayload(secret, timestamp, rawBody),
      },
      rawBody,
      secret,
      now,
      expectedDocumentHash: documentHash,
    });

    expect(event.providerEventId).toBe("event-01");
    expect(event.isContractAccepted).toBe(false);
  });

  it("rejects a tampered body, a stale timestamp and another document", () => {
    const signature = signWebhookPayload(secret, timestamp, rawBody);
    expect(
      codeOf(() =>
        verifySignatureWebhook({
          headers: { "x-signature-timestamp": String(timestamp), "x-signature": signature },
          rawBody: rawBody.replace("signed", "signed "),
          secret,
          now,
          expectedDocumentHash: documentHash,
        }),
      ),
    ).toBe("AUTH_INVALID");

    expect(
      codeOf(() =>
        verifySignatureWebhook({
          headers: {
            "x-signature-timestamp": String(timestamp - 3600),
            "x-signature": signWebhookPayload(secret, timestamp - 3600, rawBody),
          },
          rawBody,
          secret,
          now,
          expectedDocumentHash: documentHash,
        }),
      ),
    ).toBe("AUTH_EXPIRED");

    expect(
      codeOf(() =>
        verifySignatureWebhook({
          headers: { "x-signature-timestamp": String(timestamp), "x-signature": signature },
          rawBody,
          secret,
          now,
          expectedDocumentHash: `sha256:${"b".repeat(64)}`,
        }),
      ),
    ).toBe("APPROVAL_STALE");
  });

  it("stays disabled without a configured secret", () => {
    expect(
      codeOf(() =>
        verifySignatureWebhook({
          headers: {},
          rawBody,
          secret: null,
          now,
          expectedDocumentHash: documentHash,
        }),
      ),
    ).toBe("PROVIDER_NOT_CONFIGURED");
  });
});

describe("parent bridge", () => {
  it("maps a minimal event", () => {
    const event = mapToParentEvent({
      type: "ventas.handoff.requested",
      tenantId: "tenant-alpha-01",
      operationId: "operation-0001",
      occurredAt: "2026-11-15T10:00:00Z",
      payload: { handoffId: "handoff-01", ackRef: null },
    });
    expect(event.source).toBe("agntia-ventas");
    expect(event.schemaVersion).toBe(1);
    expect(BRIDGE_STATUS.transport).toBe("NOT_VERIFIED");
  });

  it("bounds the payload and refuses values JSON cannot represent", () => {
    expect(
      codeOf(() =>
        mapToParentEvent({
          type: "ventas.quote.updated",
          tenantId: "tenant-alpha-01",
          operationId: "operation-0001",
          occurredAt: "2026-11-15T10:00:00Z",
          payload: { blob: "a".repeat(70 * 1024) },
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(
      codeOf(() =>
        mapToParentEvent({
          type: "ventas.quote.updated",
          tenantId: "tenant-alpha-01",
          operationId: "operation-0001",
          occurredAt: "2026-11-15T10:00:00Z",
          payload: circular,
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("refuses internal fields and unknown event types", () => {
    expect(
      codeOf(() =>
        mapToParentEvent({
          type: "ventas.quote.updated",
          tenantId: "tenant-alpha-01",
          operationId: "operation-0001",
          occurredAt: "2026-11-15T10:00:00Z",
          payload: { nested: { prompt: "system prompt" } },
        }),
      ),
    ).toBe("VALIDATION_FAILED");

    // Separators and case do not smuggle an internal field past the filter.
    for (const key of ["api_key", "internal_notes", "raw_provider_response", "API-KEY"]) {
      expect(
        codeOf(() =>
          mapToParentEvent({
            type: "ventas.quote.updated",
            tenantId: "tenant-alpha-01",
            operationId: "operation-0001",
            occurredAt: "2026-11-15T10:00:00Z",
            payload: { [key]: "leak" },
          }),
        ),
      ).toBe("VALIDATION_FAILED");
    }

    expect(
      codeOf(() =>
        mapToParentEvent({
          type: "ventas.unknown" as never,
          tenantId: "tenant-alpha-01",
          operationId: "operation-0001",
          occurredAt: "2026-11-15T10:00:00Z",
          payload: {},
        }),
      ),
    ).toBe("VALIDATION_FAILED");
  });
});

describe("model costs", () => {
  const policy: RoundingPolicy = { rounding: "HALF_UP", exponent: 6, policyVersion: "q1" };
  const price: ModelPrice = {
    modelRef: "model-01",
    inputPerMillion: { amount: "3.00", currency: "EUR" },
    outputPerMillion: { amount: "15.00", currency: "EUR" },
    effectiveFrom: "2026-01-01T00:00:00Z",
  };

  it("prices tokens deterministically", () => {
    const cost = estimateModelCost({
      price,
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      policy,
    });
    expect(cost.amount).toBe("10.500000");
  });

  it("flags an exceeded ceiling before spending more", () => {
    const usage = consumeModelBudget({
      ceiling: { amount: "5.00", currency: "EUR" },
      spent: { amount: "4.00", currency: "EUR" },
      cost: { amount: "1.50", currency: "EUR" },
    });
    expect(usage.exceeded).toBe(true);
    expect(usage.remaining.amount).toBe("-0.500000");
  });

  it("refuses an invalid rounding policy instead of crashing", () => {
    expect(
      codeOf(() =>
        estimateModelCost({
          price,
          inputTokens: 1,
          outputTokens: 1,
          policy: { rounding: "BANKERS", exponent: 2, policyVersion: "q1" } as never,
        }),
      ),
    ).toBe("ROUNDING_UNSUPPORTED");
  });

  it("rejects mixed currencies and negative tokens", () => {
    expect(
      codeOf(() =>
        estimateModelCost({
          price: { ...price, outputPerMillion: { amount: "15.00", currency: "USD" } },
          inputTokens: 1,
          outputTokens: 1,
          policy,
        }),
      ),
    ).toBe("CURRENCY_MISMATCH");

    expect(
      codeOf(() => estimateModelCost({ price, inputTokens: -1, outputTokens: 1, policy })),
    ).toBe("VALIDATION_FAILED");
  });
});
