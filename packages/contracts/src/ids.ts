import { z } from "zod";

/**
 * Opaque identifiers. Service-side ids are never derived from provider ids by
 * position or name, and never forced into a UUID shape (see
 * docs/contracts/01-contratos.md).
 */
export const OpaqueIdSchema = z
  .string()
  .min(8, "id too short")
  .max(128, "id too long")
  .regex(/^[A-Za-z0-9._:-]+$/, "id must be opaque [A-Za-z0-9._:-]");

export type OpaqueId = z.infer<typeof OpaqueIdSchema>;

/** ISO-8601 timestamp with an explicit offset. Timezone lives in its own field. */
export const IsoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/,
    "timestamp must be ISO-8601 with offset",
  );

export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO-8601 calendar date");

export type IsoDate = z.infer<typeof IsoDateSchema>;

export const TimeZoneSchema = z
  .string()
  .regex(/^[A-Za-z]+\/[A-Za-z_+-]+$/, "timezone must be an IANA zone");

export type TimeZone = z.infer<typeof TimeZoneSchema>;
