import { z } from "zod";
import { IsoDateTimeSchema, OpaqueIdSchema } from "./ids.ts";

export const EvidenceKindSchema = z.enum([
  "fact",
  "inference",
  "user_assertion",
  "observation",
]);

export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

/**
 * Provenance that survives projection. A model statement or a spoken "yes"
 * is `user_assertion`/`inference`, never `fact`; confidence is not permission.
 */
export const EvidenceRefSchema = z
  .object({
    id: OpaqueIdSchema,
    tenantId: OpaqueIdSchema,
    originalCustodian: z.string().min(1).max(128),
    sourceObjectRef: z.string().min(1).max(256),
    sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    mapperVersion: z.string().min(1).max(64),
    observedAt: IsoDateTimeSchema,
    effectiveAt: IsoDateTimeSchema.optional(),
    kind: EvidenceKindSchema,
    reviewRef: OpaqueIdSchema.optional(),
  })
  .strict();

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
