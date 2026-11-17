import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import { createSalesApiClient } from "./client.ts";
import type { FetchLike } from "./crm.ts";

const config = {
  baseUrl: "https://api.sales.test",
  getToken: async () => "token-alpha",
};

function respond(body: unknown, status = 200): FetchLike {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

const quoteResponse = {
  data: {
    totals: { currency: "EUR", total: { amount: "45.96", currency: "EUR" } },
    discountChecked: true,
    externalEffect: false,
  },
  correlationId: "corr-01",
};

describe("sales api client", () => {
  it("parses a preview response", async () => {
    const client = createSalesApiClient({ ...config, fetchImpl: respond(quoteResponse) });
    await expect(client.quotePreview({ lines: [] })).resolves.toEqual({
      currency: "EUR",
      total: "45.96",
    });
  });

  it("surfaces the server error code instead of a generic failure", async () => {
    const client = createSalesApiClient({
      ...config,
      fetchImpl: respond(
        {
          error: {
            code: "DISCOUNT_EXCEEDED",
            message: "aggregate discount exceeds mandate",
            correlationId: "corr-01",
            retryable: false,
            reconciliationRequired: false,
          },
        },
        403,
      ),
    });

    await expect(client.quotePreview({})).rejects.toMatchObject({
      code: "DISCOUNT_EXCEEDED",
      httpStatus: 403,
    });
  });

  it("rejects an unknown envelope and a non-JSON body", async () => {
    const unknown = createSalesApiClient({
      ...config,
      fetchImpl: respond({ error: { nope: true } }, 500),
    });
    await expect(unknown.quotePreview({})).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
    });

    const broken = createSalesApiClient({
      ...config,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
      }),
    });
    await expect(broken.quotePreview({})).rejects.toMatchObject({
      code: "PROVIDER_INVALID_RESPONSE",
    });
  });

  it("requires a token and reports a timeout as needing reconciliation", async () => {
    const noToken = createSalesApiClient({
      ...config,
      getToken: async () => "",
      fetchImpl: respond(quoteResponse),
    });
    await expect(noToken.quotePreview({})).rejects.toBeInstanceOf(ServiceError);

    const slow = createSalesApiClient({
      ...config,
      timeoutMs: 5,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });
    await expect(slow.quotePreview({})).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT",
      reconciliationRequired: true,
    });
  });
});
