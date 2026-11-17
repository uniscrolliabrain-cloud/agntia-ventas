import { z } from "zod";
import { ServiceError } from "@agntia-ventas/contracts";

export const PARENT_EVENT_TYPES = [
  "ventas.proposal.created",
  "ventas.quote.updated",
  "ventas.handoff.requested",
  "ventas.handoff.acknowledged",
] as const;

export type ParentEventType = (typeof PARENT_EVENT_TYPES)[number];

const ParentEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.literal("agntia-ventas"),
    type: z.enum(PARENT_EVENT_TYPES),
    tenantId: z.string().min(1).max(128),
    operationId: z.string().min(1).max(128),
    occurredAt: z.string().datetime({ offset: true }),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type ParentEvent = z.infer<typeof ParentEventSchema>;

const FORBIDDEN_KEYS = [
  "prompt",
  "apiKey",
  "token",
  "secret",
  "internalNotes",
  "rawProviderResponse",
];

function assertNoForbiddenKeys(value: unknown, path = ""): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      throw new ServiceError("VALIDATION_FAILED", "bridge payload carries an internal field", {
        details: { path: path ? `${path}.${key}` : key },
      });
    }
    assertNoForbiddenKeys(nested, path ? `${path}.${key}` : key);
  }
}

/**
 * The parent agent owns canonical identity and coordination. This side only
 * publishes a minimal, validated event. Delivery and parent ACK are not
 * verified from here: mapping is implemented, transport is not.
 */
export function mapToParentEvent(input: {
  readonly type: ParentEventType;
  readonly tenantId: string;
  readonly operationId: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): ParentEvent {
  assertNoForbiddenKeys(input.payload);

  const candidate = {
    schemaVersion: 1 as const,
    source: "agntia-ventas" as const,
    type: input.type,
    tenantId: input.tenantId,
    operationId: input.operationId,
    occurredAt: input.occurredAt,
    payload: input.payload,
  };

  const parsed = ParentEventSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_FAILED", "parent event rejected", {
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      },
    });
  }
  return parsed.data;
}

export const BRIDGE_STATUS = {
  mapping: "implemented",
  transport: "NOT_VERIFIED",
  parentAck: "NOT_VERIFIED",
} as const;
