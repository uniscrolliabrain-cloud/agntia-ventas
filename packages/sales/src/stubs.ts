import { ServiceError, type ErrorCode } from "@agntia-ventas/contracts";

// ---------------------------------------------------------------------------
// Declared stubs for the campaigns that cannot be completed in this host
// ---------------------------------------------------------------------------

/**
 * Every capability that is not implemented or not verified is declared here
 * once. Each entry names the campaign, the code that would own it, the code
 * that fails closed and the configuration it needs (names only, never values).
 *
 * A declared stub is not an installed capability: calling `stubCapability`
 * throws, and nothing falls back to an admin/owner/default path.
 */

export interface CapabilityStub {
  readonly id: string;
  readonly campaign: string;
  readonly capability: string;
  readonly status: "stub" | "not_verified";
  readonly failClosedWith: ErrorCode;
  readonly codeRef: string;
  readonly requires: readonly string[];
  readonly reason: string;
}

export const CAPABILITY_STUBS: readonly CapabilityStub[] = [
  {
    id: "c13-source-provider",
    campaign: "C13",
    capability: "vendor search API for account context",
    status: "stub",
    failClosedWith: "PROVIDER_NOT_CONFIGURED",
    codeRef: "packages/sales/src/sources.ts#SOURCE_STATUS",
    requires: ["SOURCE_PROVIDER_BASE_URL", "SOURCE_PROVIDER_KEY_REF", "SOURCE_ALLOWED_HOSTS"],
    reason:
      "fetching is implemented with SSRF/size/MIME guards; no vendor API is contracted or credentialed",
  },
  {
    id: "c14-crm-twenty-write",
    campaign: "C14",
    capability: "Twenty CRM write-back",
    status: "not_verified",
    failClosedWith: "PROVIDER_NOT_CONFIGURED",
    codeRef: "packages/sales/src/crm.ts#createCrmGateway",
    requires: ["CRM_BASE_URL", "CRM_TOKEN_REF"],
    reason: "transport is implemented with injected fetch; no vendor response was observed",
  },
  {
    id: "c15-crm-frappe-espo-suite",
    campaign: "C15",
    capability: "Frappe CRM / EspoCRM / SuiteCRM adapters",
    status: "not_verified",
    failClosedWith: "PROVIDER_NOT_CONFIGURED",
    codeRef: "packages/sales/src/adapters.ts#FRAPPE_ADAPTER",
    requires: ["CRM_BASE_URL", "CRM_TOKEN_REF", "CRM_VENDOR"],
    reason: "one gateway shape is shared; no per-vendor contract or write was verified",
  },
  {
    id: "c22-signature-provider",
    campaign: "C22",
    capability: "electronic signature provider",
    status: "not_verified",
    failClosedWith: "PROVIDER_NOT_CONFIGURED",
    codeRef: "packages/sales/src/signature.ts#verifySignatureWebhook",
    requires: ["SIGNATURE_WEBHOOK_SECRET_REF", "SIGNATURE_PROVIDER"],
    reason:
      "HMAC verification is implemented; no provider sends a real event and a signature is not contract acceptance",
  },
  {
    id: "c24-email-send",
    campaign: "C24",
    capability: "real supervised email delivery",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/commercial.ts#planEmailDraft",
    requires: ["EMAIL_PROVIDER_KEY_REF", "EMAIL_SENDER_DOMAIN"],
    reason: "the pilot is sink-only: drafts are previewed, never sent",
  },
  {
    id: "c25-sequence-scheduler",
    campaign: "C25",
    capability: "outbound sequence scheduler",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/commercial.ts#nextSequenceStep",
    requires: ["SCHEDULER_WORKER", "SUPPRESSION_STORE"],
    reason: "step evaluation is implemented; no worker sends anything in the pilot",
  },
  {
    id: "c26-inbox-ui",
    campaign: "C26",
    capability: "human takeover inbox UI",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/commercial.ts#takeOverConversation",
    requires: ["INBOX_UI"],
    reason: "takeover semantics are implemented; no interactive inbox is built",
  },
  {
    id: "c29-operations-receiver",
    campaign: "C29",
    capability: "operational receiver system",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/operations.ts#proposeOrder",
    requires: ["OPERATIONS_RECEIVER_ENDPOINT", "OPERATIONS_ACK_ENDPOINT"],
    reason: "the order proposal and ACK gate exist; no downstream system receives it",
  },
  {
    id: "c33-dashboard-live-data",
    campaign: "C33",
    capability: "dashboard live data and charts",
    status: "stub",
    failClosedWith: "DEPENDENCY_UNAVAILABLE",
    codeRef: "packages/sales/src/dashboard.ts#DASHBOARD_STATUS",
    requires: ["REPORT_QUERY_STORE"],
    reason: "the server-side renderer is implemented; there is no metrics store or chart layer",
  },
  {
    id: "c34-portal-chat-anam",
    campaign: "C34",
    capability: "portal chat and Anam presence",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/adapters.ts#PORTAL",
    requires: ["ANAM_API_KEY_REF", "PORTAL_CHAT_SERVICE"],
    reason:
      "the portal is signed read-only HTML; presence is never identity or signature",
  },
  {
    id: "c35-sdk-publication",
    campaign: "C35",
    capability: "published TypeScript SDK package",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/client.ts#SalesClient",
    requires: ["NPM_PUBLISH_TOKEN", "PACKAGE_SCOPE_APPROVAL"],
    reason: "the typed client and tool surface exist in-repo; nothing is published",
  },
  {
    id: "c36-parent-transport",
    campaign: "C36",
    capability: "transport and ACK to the parent agent",
    status: "not_verified",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/outbox.ts#PARENT_TRANSPORT_STUB",
    requires: [
      "HOST_BRIDGE_BASE_URL",
      "HOST_BRIDGE_SIGNING_KEY_REF",
      "HOST_BRIDGE_EVENT_SCHEMA_VERSION",
    ],
    reason:
      "envelope and outbox are implemented; the parent endpoint, schema and receipt are not verified",
  },
  {
    id: "c38-provider-metering",
    campaign: "C38",
    capability: "provider-side token metering",
    status: "stub",
    failClosedWith: "PROVIDER_NOT_CONFIGURED",
    codeRef: "packages/sales/src/costs.ts#estimateModelCost",
    requires: ["METERING_PROVIDER_KEY_REF"],
    reason:
      "cost is estimated deterministically and reservations reconcile; no provider usage API is configured",
  },
  {
    id: "c40-real-network",
    campaign: "C40",
    capability: "end-to-end run against real network and providers",
    status: "stub",
    failClosedWith: "NOT_IMPLEMENTED",
    codeRef: "packages/sales/src/e2e.ts#runVerticalE2e",
    requires: ["STAGING_TENANT", "PROVIDER_SANDBOX_KEYS"],
    reason: "the synthetic vertical runs with zero external effects; no real network path exists",
  },
  {
    id: "c41-ci-backup-observability",
    campaign: "C41",
    capability: "CI execution, backups and observability",
    status: "not_verified",
    failClosedWith: "DEPENDENCY_UNAVAILABLE",
    codeRef: "packages/sales/src/operations.ts#OPERATIONS_STATUS",
    requires: ["CI_RUNNER", "BACKUP_TARGET", "OTEL_ENDPOINT"],
    reason: "the workflow exists but never ran here; there is no backup or telemetry sink",
  },
  {
    id: "c42-human-acceptance",
    campaign: "C42",
    capability: "business acceptance and handoff sign-off",
    status: "not_verified",
    failClosedWith: "PROVIDER_NOT_CONFIGURED",
    codeRef: "docs/execution-evidence/C07-C42-REPORT.md",
    requires: ["ACCEPTANCE_OWNER", "SIGNED_HANDOFF"],
    reason: "acceptance is a human act: this report is evidence, not a sign-off",
  },
];

export function stubCapability(id: string): never {
  const stub = CAPABILITY_STUBS.find((entry) => entry.id === id);
  if (!stub) {
    throw new ServiceError("VALIDATION_FAILED", "unknown stub id", { details: { id } });
  }
  throw new ServiceError(
    stub.failClosedWith,
    `${stub.campaign} ${stub.capability} is ${stub.status}`,
    {
      details: {
        stub: stub.id,
        campaign: stub.campaign,
        status: stub.status,
        requires: stub.requires,
      },
    },
  );
}

export function stubById(id: string): CapabilityStub | null {
  return CAPABILITY_STUBS.find((entry) => entry.id === id) ?? null;
}

export function stubCoverage(): {
  readonly total: number;
  readonly campaigns: readonly string[];
  readonly byStatus: Readonly<Record<CapabilityStub["status"], number>>;
} {
  const campaigns = [...new Set(CAPABILITY_STUBS.map((stub) => stub.campaign))].sort();
  return {
    total: CAPABILITY_STUBS.length,
    campaigns,
    byStatus: {
      stub: CAPABILITY_STUBS.filter((stub) => stub.status === "stub").length,
      not_verified: CAPABILITY_STUBS.filter((stub) => stub.status === "not_verified").length,
    },
  };
}
