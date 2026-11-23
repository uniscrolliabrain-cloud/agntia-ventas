import { z } from "zod";
import {
  AmountSchema,
  CurrencySchema,
  ErrorEnvelopeSchema,
  ServiceError,
} from "@agntia-ventas/contracts";
import type { FetchLike } from "./crm.ts";

const QuoteResponseSchema = z
  .object({
    data: z
      .object({
        totals: z
          .object({
            currency: CurrencySchema,
            // A total is money: a plain string let "cuarenta" through as a total.
            total: z
              .object({ amount: AmountSchema, currency: CurrencySchema })
              .loose(),
          })
          .loose(),
        externalEffect: z.literal(false),
      })
      .loose(),
    correlationId: z.string(),
  })
  .loose();

export interface SalesApiClientConfig {
  readonly baseUrl: string;
  readonly getToken: () => Promise<string>;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
}

export interface SalesApiClient {
  quotePreview(body: Readonly<Record<string, unknown>>): Promise<{
    readonly currency: string;
    readonly total: string;
  }>;
}

/**
 * Typed client for the preview API. It never retries a write on its own: a
 * timeout surfaces with `reconciliationRequired` so the caller can look up the
 * operation before sending it again.
 */
export function createSalesApiClient(config: SalesApiClientConfig): SalesApiClient {
  let base: URL;
  try {
    base = new URL(config.baseUrl);
  } catch {
    throw new ServiceError("VALIDATION_FAILED", "client baseUrl is not a valid URL");
  }
  // The bearer token must never travel in clear text or to an odd scheme.
  if (base.protocol !== "https:") {
    throw new ServiceError("VALIDATION_FAILED", "client baseUrl must use https");
  }

  async function call(path: string, body: unknown): Promise<unknown> {
    const token = await config.getToken();
    if (!token) {
      throw new ServiceError("AUTH_MISSING", "client has no token");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000);
    let response;
    // The timeout stays armed until the body is read.
    try {
      try {
        response = await config.fetchImpl(new URL(path, base).toString(), {
          method: "POST",
          redirect: "error",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) {
          throw new ServiceError("PROVIDER_TIMEOUT", "preview request timed out", {
            retryable: true,
            reconciliationRequired: true,
          });
        }
        throw new ServiceError("PROVIDER_UNAVAILABLE", "preview request failed", {
          retryable: true,
        });
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (controller.signal.aborted) {
          throw new ServiceError("PROVIDER_TIMEOUT", "preview response body timed out", {
            retryable: true,
            reconciliationRequired: true,
          });
        }
        throw new ServiceError("PROVIDER_INVALID_RESPONSE", "response is not JSON");
      }

      if (!response.ok) {
      const parsed = ErrorEnvelopeSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ServiceError("PROVIDER_INVALID_RESPONSE", "error envelope is unknown", {
          details: { status: response.status },
        });
      }
        const { code, message, retryable, reconciliationRequired, details } =
          parsed.data.error;
        throw new ServiceError(code, message, {
          retryable,
          reconciliationRequired,
          ...(details ? { details } : {}),
        });
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async quotePreview(body) {
      const parsed = QuoteResponseSchema.safeParse(
        await call("/v1/ventas/quotes/preview", body),
      );
      if (!parsed.success) {
        throw new ServiceError("PROVIDER_INVALID_RESPONSE", "quote response is unknown");
      }
      return {
        currency: parsed.data.data.totals.currency,
        total: parsed.data.data.totals.total.amount,
      };
    },
  };
}
