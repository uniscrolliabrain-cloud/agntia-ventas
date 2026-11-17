import { z } from "zod";
import { ServiceError } from "@agntia-ventas/contracts";
import { assertDiscoveryEndpoint, type SecretRef } from "./operations.ts";

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
    readonly signal: AbortSignal;
  },
) => Promise<FetchResponse>;

export interface CrmGatewayConfig {
  readonly baseUrl: string;
  /** Server-side resolution: the token never travels in a contract or a log. */
  readonly resolveSecret: (ref: SecretRef) => Promise<string>;
  readonly tokenRef: SecretRef;
  readonly fetchImpl: FetchLike;
  readonly allowedHosts: readonly string[];
  readonly timeoutMs?: number;
}

export interface CrmPerson {
  readonly externalId: string;
  readonly displayName: string;
  readonly email: string | null;
}

const PeopleResponseSchema = z
  .object({
    data: z
      .object({
        people: z
          .array(
            z
              .object({
                id: z.string().min(1).max(128),
                name: z
                  .object({
                    firstName: z.string().max(200),
                    lastName: z.string().max(200),
                  })
                  .strict()
                  .optional(),
                emails: z
                  .object({ primaryEmail: z.string().email().max(320) })
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .max(200),
      })
      .strict(),
  })
  .strict();

const WriteResponseSchema = z
  .object({ data: z.object({ id: z.string().min(1).max(128) }).strict() })
  .strict();

export interface CrmGateway {
  listPeople(input: { readonly limit: number }): Promise<readonly CrmPerson[]>;
  /** A write needs an idempotency key: a retry must not duplicate the note. */
  writeNote(input: {
    readonly recordId: string;
    readonly operationId: string;
    readonly body: string;
  }): Promise<{ readonly receiptId: string }>;
}

/**
 * Twenty/Frappe/Espo/Suite share this gateway shape. The transport is real
 * code with injected fetch; no vendor response has been observed from this
 * environment, so the capability stays documented, not verified.
 */
export function createCrmGateway(config: CrmGatewayConfig): CrmGateway {
  const base = assertDiscoveryEndpoint(config.baseUrl, config.allowedHosts);
  const timeoutMs = config.timeoutMs ?? 10_000;

  async function call(
    path: string,
    init: { method: "GET" | "POST"; body?: string; operationId?: string },
  ): Promise<unknown> {
    const token = await config.resolveSecret(config.tokenRef);
    if (!token) {
      throw new ServiceError("PROVIDER_NOT_CONFIGURED", "crm token is empty");
    }
    const url = new URL(path, base).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: FetchResponse;
    try {
      response = await config.fetchImpl(url, {
        method: init.method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...(init.operationId ? { "idempotency-key": init.operationId } : {}),
        },
        ...(init.body ? { body: init.body } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ServiceError("PROVIDER_TIMEOUT", "crm request timed out", {
          retryable: true,
          reconciliationRequired: true,
        });
      }
      throw new ServiceError("PROVIDER_UNAVAILABLE", "crm request failed", {
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ServiceError("PROVIDER_UNAVAILABLE", "crm answered with an error", {
        retryable: response.status >= 500,
        details: { status: response.status },
      });
    }

    try {
      return await response.json();
    } catch {
      throw new ServiceError("PROVIDER_INVALID_RESPONSE", "crm body is not JSON");
    }
  }

  return {
    async listPeople({ limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new ServiceError("VALIDATION_FAILED", "invalid page size");
      }
      const body = PeopleResponseSchema.safeParse(
        await call(`/api/v1/people?limit=${limit}`, { method: "GET" }),
      );
      if (!body.success) {
        throw new ServiceError("PROVIDER_INVALID_RESPONSE", "crm people shape is unknown");
      }
      return body.data.data.people.map((person) => ({
        externalId: person.id,
        displayName: [person.name?.firstName, person.name?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
        email: person.emails?.primaryEmail ?? null,
      }));
    },

    async writeNote({ recordId, operationId, body }) {
      if (operationId.length < 8) {
        throw new ServiceError("VALIDATION_FAILED", "note needs an idempotency key");
      }
      const parsed = WriteResponseSchema.safeParse(
        await call(`/api/v1/notes`, {
          method: "POST",
          operationId,
          body: JSON.stringify({ data: { recordId, body } }),
        }),
      );
      if (!parsed.success) {
        throw new ServiceError("PROVIDER_INVALID_RESPONSE", "crm write receipt is unknown");
      }
      return { receiptId: parsed.data.data.id };
    },
  };
}
