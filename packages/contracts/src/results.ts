import { z } from "zod";
import { IsoDateTimeSchema, OpaqueIdSchema } from "./ids.ts";

const base = {
  operationId: OpaqueIdSchema,
  payloadHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  localRefs: z.array(OpaqueIdSchema).max(64),
  evidenceRefs: z.array(OpaqueIdSchema).max(64),
  warnings: z.array(z.string().max(512)).max(32),
  actualScope: z.array(z.string().max(128)).max(64),
  occurredAt: IsoDateTimeSchema,
};

/**
 * An emitted event is not an ACK, a remote accept is not a delivered result.
 * `outcome_unknown` is a first-class state that requires reconciliation: it is
 * never treated as a safe failure to retry blindly.
 */
export const OperationResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...base,
      status: z.literal("confirmed"),
      remoteRefs: z.array(z.string().max(256)).max(64),
      reconciliationRequired: z.literal(false),
    })
    .strict(),
  z
    .object({
      ...base,
      status: z.literal("outcome_unknown"),
      remoteRefs: z.array(z.string().max(256)).max(64),
      reconciliationRequired: z.literal(true),
      retryable: z.literal(false),
    })
    .strict(),
  z
    .object({
      ...base,
      status: z.literal("blocked"),
      reasonCode: z.string().min(1).max(64),
      reconciliationRequired: z.literal(false),
    })
    .strict(),
  z
    .object({
      ...base,
      status: z.literal("failed"),
      reasonCode: z.string().min(1).max(64),
      retryable: z.boolean(),
      reconciliationRequired: z.boolean(),
    })
    .strict(),
]);

export type OperationResult = z.infer<typeof OperationResultSchema>;

export const SuccessEnvelopeSchema = z
  .object({
    data: z.unknown(),
    correlationId: z.string().min(1).max(128),
  })
  .strict();

export type SuccessEnvelope = z.infer<typeof SuccessEnvelopeSchema>;
