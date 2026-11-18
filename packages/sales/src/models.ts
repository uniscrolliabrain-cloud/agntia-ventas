import type { Money, RoundingPolicy } from "@agntia-ventas/contracts";

export interface Account {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
}

export interface ChannelIdentity {
  readonly channel: "email" | "phone" | "whatsapp" | "linkedin";
  readonly value: string;
}

export interface Contact {
  readonly id: string;
  readonly tenantId: string;
  readonly accountId: string;
  readonly fullName: string;
  readonly role: string | null;
  readonly channels: readonly ChannelIdentity[];
}

export type PermissionBasis = "consent" | "legitimate_interest" | "contract";

export interface ContactPermission {
  readonly basis: PermissionBasis;
  readonly purpose: string;
  readonly channel: ChannelIdentity["channel"];
  readonly expiresAt?: string;
}

export interface LeadCandidate {
  readonly id: string;
  readonly tenantId: string;
  readonly contactId: string;
  readonly sourceCredit: string;
  readonly discoveredAt: string;
  readonly permission: ContactPermission | null;
}

export interface AcceptedLead {
  readonly id: string;
  readonly tenantId: string;
  readonly candidateId: string;
  readonly acceptedBy: string;
  readonly acceptedAt: string;
}

export interface SuppressionEntry {
  readonly tenantId: string;
  readonly channel: ChannelIdentity["channel"];
  readonly value: string;
  readonly reason: "opt_out" | "bounce" | "manual";
}

export type Stage =
  | "discovered"
  | "accepted"
  | "qualified"
  | "proposal_draft"
  | "in_review"
  | "approved_to_send"
  | "sent"
  | "negotiating"
  | "won_unverified"
  | "won_verified"
  | "lost"
  | "opted_out"
  | "reconciliation_required";

export interface Opportunity {
  readonly id: string;
  readonly tenantId: string;
  readonly accountId: string;
  readonly stage: Stage;
  readonly version: number;
  readonly evidenceRefs: readonly string[];
}

export interface QualificationFact {
  readonly key: string;
  readonly value: string;
  readonly sourceRef: string;
}

export interface Product {
  readonly id: string;
  readonly tenantId: string;
  readonly catalogVersion: string;
  readonly validUntil: string;
  readonly stockAt: string;
  readonly deliveryAssertion?: string;
}

export interface PriceEntry {
  readonly productRef: string;
  readonly unitPrice: Money;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
}

export interface PriceBook {
  readonly id: string;
  readonly tenantId: string;
  readonly version: string;
  readonly currency: string;
  readonly entries: readonly PriceEntry[];
}

export interface QuoteLineInput {
  readonly productRef: string;
  readonly quantity: string;
  readonly discountBasisPoints?: number;
}

export interface TaxRule {
  readonly productRef: string;
  readonly rateBasisPoints: number;
  readonly sourceRef: string;
}

export interface QuoteRequest {
  readonly tenantId: string;
  readonly priceBook: PriceBook;
  readonly lines: readonly QuoteLineInput[];
  readonly products: readonly Product[];
  readonly taxRules: readonly TaxRule[];
  readonly policy: RoundingPolicy;
  readonly orderDiscountBasisPoints?: number;
  readonly now: string;
}

export interface QuoteLineTotal {
  readonly productRef: string;
  readonly quantity: string;
  readonly unitPrice: Money;
  readonly base: Money;
  readonly discountBasisPoints: number;
  readonly net: Money;
  readonly tax: Money;
}

export interface QuoteTotals {
  readonly currency: string;
  readonly lines: readonly QuoteLineTotal[];
  readonly subtotal: Money;
  readonly lineDiscount: Money;
  readonly orderDiscount: Money;
  readonly orderDiscountBasisPoints: number;
  readonly net: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly policyVersion: string;
  readonly priceBookVersion: string;
  readonly taxMappingRefs: readonly string[];
}

export interface DiscountMandate {
  readonly id: string;
  readonly maxRateBasisPoints: number;
  readonly maxAmount?: Money;
  readonly scope: "order";
  readonly expiresAt: string;
}

export type ClaimKind = "fact" | "proposal" | "inference";

export interface ProposalClaim {
  readonly text: string;
  readonly kind: ClaimKind;
  readonly evidenceRef?: string;
}

export interface ProposalRevision {
  readonly id: string;
  readonly version: number;
  readonly payloadHash: string;
  readonly claims: readonly ProposalClaim[];
  readonly warnings: readonly string[];
}

export interface MeetingProposal {
  readonly id: string;
  readonly operationKey: string;
  readonly startUtc: string;
  readonly timeZone: string;
  readonly attendees: readonly string[];
  readonly status: "proposed" | "booked" | "uncertain";
}

export interface EmailDraft {
  readonly recipient: string;
  readonly channel: "email";
  readonly subject: string;
  readonly body: string;
  readonly purpose: string;
  readonly contentHash: string;
}

export interface SequenceState {
  readonly stepIndex: number;
  readonly maxSteps: number;
  readonly opposed: boolean;
  readonly suppressed: boolean;
  readonly lastSentAt?: string;
}

export interface ActivityRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: "call" | "meeting" | "email" | "note" | "task";
  readonly status: "planned" | "confirmed" | "outcome_unknown";
  readonly receiptRef?: string;
  readonly occurredAt: string;
}

export interface ForecastScenario {
  readonly stage: Stage;
  readonly amount: Money;
  readonly probabilityBasisPoints: number;
}

export interface ForecastSnapshot {
  readonly id: string;
  readonly probabilityVersion: string;
  readonly coverage: { readonly accountsWithAmount: number; readonly accountsTotal: number };
  readonly gross: Money;
  readonly weighted: Money;
  readonly scenarios: readonly ForecastScenario[];
  readonly isRevenue: false;
}

export interface HandoffRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly receiverRef: string;
  readonly status: "proposed" | "offered" | "acknowledged" | "working" | "completed" | "returned";
  readonly ackRef?: string;
}
