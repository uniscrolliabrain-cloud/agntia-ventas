import { ServiceError, INITIAL_MODEL_TOOLS } from "@agntia-ventas/contracts";

export type CapabilityStatus =
  | "documented"
  | "verified_runtime"
  | "unknown"
  | "unsupported"
  | "forbidden"
  | "not_configured";

export interface CapabilityReport {
  readonly provider: string;
  readonly kind: "crm" | "signature" | "checkout" | "calendar" | "messaging" | "presence";
  readonly status: CapabilityStatus;
  readonly checkedAt: string;
  readonly evidenceRefs: readonly string[];
}

/**
 * `verified_runtime` requires evidence. Without it the capability stays
 * documented/unknown and the adapter refuses to act.
 */
export function createCapabilityReport(input: {
  provider: string;
  kind: CapabilityReport["kind"];
  status: CapabilityStatus;
  checkedAt: string;
  evidenceRefs?: readonly string[];
}): CapabilityReport {
  const evidenceRefs = input.evidenceRefs ?? [];
  // A blank reference is not evidence: `[""]` used to satisfy the gate.
  const usableRefs = evidenceRefs.filter((ref) => ref.trim().length > 0);
  if (input.status === "verified_runtime" && usableRefs.length === 0) {
    throw new ServiceError(
      "VALIDATION_FAILED",
      "verified_runtime capability report needs evidence",
      { details: { provider: input.provider } },
    );
  }
  // "When was this verified" must be readable or the report proves nothing.
  if (!Number.isFinite(Date.parse(input.checkedAt))) {
    throw new ServiceError("VALIDATION_FAILED", "capability check time is unreadable", {
      details: { provider: input.provider, checkedAt: input.checkedAt },
    });
  }
  return {
    provider: input.provider,
    kind: input.kind,
    status: input.status,
    checkedAt: input.checkedAt,
    evidenceRefs,
  };
}

export interface CrmAdapter {
  readonly provider: string;
  readonly report: CapabilityReport;
  previewImport(): Promise<never>;
  writeBack(): Promise<never>;
}

/**
 * CRM adapters are named, allowlisted ports. The repository ships no vendor
 * client, so even a verified report ends in NOT_IMPLEMENTED instead of a fake
 * success. Unknown/unsupported/forbidden never fall back to admin.
 */
export function createCrmAdapter(report: CapabilityReport): CrmAdapter {
  const refuse = (): never => {
    if (report.status !== "verified_runtime") {
      throw new ServiceError(
        "PROVIDER_NOT_CONFIGURED",
        `${report.provider} is ${report.status}; capability disabled`,
        { details: { provider: report.provider, status: report.status } },
      );
    }
    throw new ServiceError(
      "NOT_IMPLEMENTED",
      `${report.provider} client is not bundled in this repository`,
      { details: { provider: report.provider } },
    );
  };
  return {
    provider: report.provider,
    report,
    previewImport: async () => refuse(),
    writeBack: async () => refuse(),
  };
}

export const TWENTY_ADAPTER = createCrmAdapter(
  createCapabilityReport({
    provider: "twenty",
    kind: "crm",
    status: "documented",
    checkedAt: "2026-11-15T00:00:00Z",
  }),
);

export const FRAPPE_ADAPTER = createCrmAdapter(
  createCapabilityReport({
    provider: "frappe-crm",
    kind: "crm",
    status: "documented",
    checkedAt: "2026-11-15T00:00:00Z",
  }),
);

export interface DisabledPort {
  readonly capability: "disabled";
  readonly reason: string;
}

export const SIGNATURE_PORT: DisabledPort = {
  capability: "disabled",
  reason:
    "signature is a separate port; it needs a verified provider, representation proof and a human approval",
};

export const CHECKOUT_PORT: DisabledPort = {
  capability: "disabled",
  reason: "payments are out of the pilot; creating a link is not settlement",
};

export const PORTAL: { readonly status: "not_implemented"; readonly reason: string } = {
  status: "not_implemented",
  reason: "portal UI is not built in this repository (campaign C34)",
};

export function assertPortEnabled(port: DisabledPort): never {
  throw new ServiceError("NOT_IMPLEMENTED", port.reason, {
    details: { capability: port.capability },
  });
}

/**
 * The parent bridge is not verified: no claim mapping, no event enum invention
 * and no write to `agente`. Confirmed facts would be projected by a future
 * patch under its own authorization.
 */
export const HOST_BRIDGE = {
  status: "HOST_BRIDGE_NOT_VERIFIED" as const,
  mapEvent(event: { type: string }): { mapped: false; reason: "HOST_BRIDGE_NOT_VERIFIED"; type: string } {
    return {
      mapped: false,
      reason: "HOST_BRIDGE_NOT_VERIFIED",
      type: event.type,
    };
  },
};

/** Tool surface offered to the model: read and propose only. */
export function modelToolSurface(): readonly string[] {
  return [...INITIAL_MODEL_TOOLS];
}

/**
 * Deny by default: only the named, read/propose tool surface is callable by
 * the model. A prefix blacklist let `sales_send_email` or any other effect
 * through simply because it was not called `approve`.
 */
export function assertCapabilityAllowed(capability: string): void {
  if (!modelToolSurface().includes(capability)) {
    throw new ServiceError(
      "CAPABILITY_NOT_GRANTED",
      "capability is not part of the model tool surface",
      { details: { capability } },
    );
  }
}
