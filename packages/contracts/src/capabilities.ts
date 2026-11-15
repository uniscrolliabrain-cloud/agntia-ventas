import { z } from "zod";

/**
 * Capabilities are nominated, never free-form. Baseline/administration tasks
 * are internal: they are not endpoints or tools offered to the model
 * (docs/contracts/01-contratos.md, "API nominada prevista").
 */
export const INTERNAL_CAPABILITIES = [
  "baseline.capture",
  "authority.define",
  "auth.verify",
  "twin.bind",
  "contracts.validate",
  "storage.migrate",
  "approval.preview",
  "provider.discover",
  "sdk.contract",
  "host.bridge",
  "release.prepare",
  "pilot.accept",
  "security.verify",
  "e2e.verify",
  "usage.measure",
] as const;

export const PRODUCT_CAPABILITIES = [
  "sales.contacts.preview",
  "sales.candidates.accept",
  "sales.pipeline.transition",
  "sales.qualification.propose",
  "sales.account.context",
  "sales.twenty.preview",
  "sales.crm.import",
  "sales.import.preview",
  "sales.catalog.read",
  "sales.price.preview",
  "sales.quote.calculate",
  "sales.discount.propose",
  "sales.quote.propose",
  "sales.signature.propose",
  "sales.meeting.preview",
  "sales.email.preview",
  "sales.followup.propose",
  "sales.handoff.preview",
  "sales.activity.log",
  "sales.forecast.run",
  "sales.order.propose",
  "sales.renewal.propose",
  "sales.quality.evaluate",
  "sales.metrics.snapshot",
  "report.snapshot",
  "advisor.session",
  "handoff.propose",
] as const;

export const CAPABILITIES = [
  ...INTERNAL_CAPABILITIES,
  ...PRODUCT_CAPABILITIES,
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CapabilitySchema = z.enum(CAPABILITIES);

export type InternalCapability = (typeof INTERNAL_CAPABILITIES)[number];
export type ProductCapability = (typeof PRODUCT_CAPABILITIES)[number];

const INTERNAL_SET: ReadonlySet<string> = new Set(INTERNAL_CAPABILITIES);

export function isInternalCapability(capability: string): boolean {
  return INTERNAL_SET.has(capability);
}

/**
 * Sensitive effects stay outside the initial model catalogue: approval,
 * sending, signing, charging, exporting everything or administering is a
 * human/UI act bound to an ApprovalBinding, not a tool call.
 */
const FORBIDDEN_MODEL_PREFIXES = [
  "admin.",
  "sales.approve",
  "sales.send",
  "sales.sign",
  "sales.charge",
  "export_all",
  "approval.grant",
] as const;

export function isModelExposedCapability(capability: string): boolean {
  if (isInternalCapability(capability)) return false;
  return !FORBIDDEN_MODEL_PREFIXES.some((prefix) =>
    capability.startsWith(prefix),
  );
}

/** Initially available tool surface for the model (C35). Read/propose only. */
export const INITIAL_MODEL_TOOLS = [
  "sales_pipeline_read",
  "sales_account_read",
  "sales_candidate_preview",
  "sales_quote_propose",
  "sales_followup_propose",
  "sales_forecast_explain",
  "sales_handoff_propose",
] as const;

export type InitialModelTool = (typeof INITIAL_MODEL_TOOLS)[number];
