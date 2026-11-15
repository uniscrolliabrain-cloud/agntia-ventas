import { z } from "zod";

/**
 * Closed error catalogue from docs/contracts/01-contratos.md. Unknown failures
 * never fall back to an admin/owner path: they surface as INTERNAL or
 * DEPENDENCY_UNAVAILABLE and leave the capability disabled.
 */
export const ERROR_CODES = [
  "AUTH_MISSING",
  "AUTH_INVALID",
  "AUTH_EXPIRED",
  "MEMBERSHIP_REQUIRED",
  "MEMBERSHIP_SUSPENDED",
  "TENANT_MISMATCH",
  "ACTOR_MISMATCH",
  "CAPABILITY_NOT_GRANTED",
  "CAPABILITY_WIDENING",
  "MANDATE_EXPIRED",
  "MANDATE_REVOKED",
  "MANDATE_INVALID",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "DEPENDENCY_UNAVAILABLE",
  "RATE_LIMITED",
  "PROVIDER_INVALID_RESPONSE",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "CURRENCY_MISMATCH",
  "QUANTITY_INVALID",
  "ROUNDING_UNSUPPORTED",
  "STAGE_INVALID",
  "EVIDENCE_REQUIRED",
  "APPROVAL_INVALID",
  "APPROVAL_EXPIRED",
  "APPROVAL_STALE",
  "SUPPRESSION_BLOCKED",
  "CATALOG_STALE",
  "PRICE_STALE",
  "TAX_MAPPING_MISSING",
  "DISCOUNT_EXCEEDED",
  "BUDGET_EXCEEDED",
  "HANDOFF_NOT_ACKED",
  "CURSOR_REGRESSION",
  "PROVIDER_NOT_CONFIGURED",
  "NOT_IMPLEMENTED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  AUTH_MISSING: 401,
  AUTH_INVALID: 401,
  AUTH_EXPIRED: 401,
  MEMBERSHIP_REQUIRED: 403,
  MEMBERSHIP_SUSPENDED: 403,
  TENANT_MISMATCH: 403,
  ACTOR_MISMATCH: 403,
  CAPABILITY_NOT_GRANTED: 403,
  CAPABILITY_WIDENING: 403,
  MANDATE_EXPIRED: 403,
  MANDATE_REVOKED: 403,
  MANDATE_INVALID: 403,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  DEPENDENCY_UNAVAILABLE: 424,
  RATE_LIMITED: 429,
  PROVIDER_INVALID_RESPONSE: 502,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_TIMEOUT: 504,
  CURRENCY_MISMATCH: 422,
  QUANTITY_INVALID: 422,
  ROUNDING_UNSUPPORTED: 422,
  STAGE_INVALID: 422,
  EVIDENCE_REQUIRED: 422,
  APPROVAL_INVALID: 403,
  APPROVAL_EXPIRED: 403,
  APPROVAL_STALE: 409,
  SUPPRESSION_BLOCKED: 403,
  CATALOG_STALE: 409,
  PRICE_STALE: 409,
  TAX_MAPPING_MISSING: 422,
  DISCOUNT_EXCEEDED: 403,
  BUDGET_EXCEEDED: 403,
  HANDOFF_NOT_ACKED: 409,
  CURSOR_REGRESSION: 409,
  PROVIDER_NOT_CONFIGURED: 503,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

export interface ServiceErrorOptions {
  readonly retryable?: boolean;
  readonly reconciliationRequired?: boolean;
  /** Sanitized, non-PII diagnostics. Never a stack trace or payload dump. */
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ServiceError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly reconciliationRequired: boolean;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: ErrorCode, message: string, options: ServiceErrorOptions = {}) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.reconciliationRequired = options.reconciliationRequired ?? false;
    this.details = options.details;
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_CODE[this.code];
  }
}

export const ErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string().min(1).max(512),
        correlationId: z.string().min(1).max(128),
        retryable: z.boolean(),
        reconciliationRequired: z.boolean(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export function toErrorEnvelope(
  error: ServiceError,
  correlationId: string,
): ErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: error.message,
      correlationId,
      retryable: error.retryable,
      reconciliationRequired: error.reconciliationRequired,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}
