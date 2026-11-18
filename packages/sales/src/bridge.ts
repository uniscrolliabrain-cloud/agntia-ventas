import { z } from "zod";
import {
  MAX_ENVELOPE_BYTES,
  ServiceError,
  envelopeByteLength,
} from "@agntia-ventas/contracts";

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

/**
 * Keys are compared after removing separators and case, so a payload cannot
 * smuggle `internal_notes` or `API-KEY` past a camelCase-only list.
 */
const FORBIDDEN_KEYS = new Set([
  "prompt",
  "systemprompt",
  "apikey",
  "token",
  "secret",
  "password",
  "privatekey",
  "authorization",
  "internalnotes",
  "rawproviderresponse",
]);

function normaliseKey(key: string): string {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

function assertNoForbiddenKeys(
  value: unknown,
  path = "",
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;
  // A repeated reference is skipped, so a cyclic payload cannot blow the stack.
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenKeys(item, `${path}[${index}]`, seen),
    );
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(normaliseKey(key))) {
      throw new ServiceError("VALIDATION_FAILED", "bridge payload carries an internal field", {
        details: { path: path ? `${path}.${key}` : key },
      });
    }
    assertNoForbiddenKeys(nested, path ? `${path}.${key}` : key, seen);
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

  // The event crosses a process boundary: bound it and refuse values JSON
  // cannot represent instead of failing later in the outbox.
  let payloadBytes: number;
  try {
    payloadBytes = envelopeByteLength(input.payload);
  } catch {
    throw new ServiceError("VALIDATION_FAILED", "bridge payload is not serializable");
  }
  if (payloadBytes > MAX_ENVELOPE_BYTES) {
    throw new ServiceError("VALIDATION_FAILED", "bridge payload exceeds the size limit", {
      details: { payloadBytes, maxBytes: MAX_ENVELOPE_BYTES },
    });
  }

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
