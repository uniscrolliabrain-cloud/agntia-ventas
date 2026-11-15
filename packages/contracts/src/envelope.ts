import { z } from "zod";
import { CapabilitySchema } from "./capabilities.ts";
import { OpaqueIdSchema } from "./ids.ts";

/**
 * Envelope from docs/contracts/01-contratos.md. `tenantId`/`actorId` are the
 * data scope and verified actor resolved by the server; a value supplied by
 * the caller is only compared, never trusted (see `assertEnvelopeScope`).
 */
export const OperationEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: OpaqueIdSchema,
    tenantId: OpaqueIdSchema,
    actorId: OpaqueIdSchema,
    capability: CapabilitySchema,
    requestId: z.string().min(1).max(128).optional(),
    correlationId: z.string().min(1).max(128),
    causationId: z.string().min(1).max(128).nullable(),
    idempotencyKey: z.string().min(8).max(128),
    expectedVersion: z.number().int().min(1),
    approvalRef: OpaqueIdSchema.nullable(),
    dryRun: z.boolean(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type OperationEnvelope = z.infer<typeof OperationEnvelopeSchema>;

export const MAX_ENVELOPE_BYTES = 64 * 1024;

export function envelopeByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
