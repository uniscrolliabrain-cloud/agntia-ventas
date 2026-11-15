import { describe, expect, it } from "vitest";
import { runPilotVertical, type PilotFixture } from "./e2e.ts";
import type { DiscountMandate, PriceBook, Product, TaxRule } from "./models.ts";

const NOW = "2026-11-15T10:00:00Z";

const product: Product = {
  id: "product-alpha-01",
  tenantId: "tenant-alpha-01",
  catalogVersion: "catalog-3",
  validUntil: "2027-01-01T00:00:00Z",
  stockAt: "2026-11-14T00:00:00Z",
  deliveryAssertion: "10 business days",
};

const priceBook: PriceBook = {
  id: "pricebook-alpha-01",
  tenantId: "tenant-alpha-01",
  version: "pb-7",
  currency: "EUR",
  entries: [
    {
      productRef: "product-alpha-01",
      unitPrice: { amount: "19.99", currency: "EUR" },
      effectiveFrom: "2026-01-01T00:00:00Z",
    },
  ],
};

const taxRule: TaxRule = {
  productRef: "product-alpha-01",
  rateBasisPoints: 2100,
  sourceRef: "tax-source-01",
};

const mandate: DiscountMandate = {
  id: "discount-mandate-01",
  maxRateBasisPoints: 500,
  scope: "order",
  expiresAt: "2027-01-01T00:00:00Z",
};

function fixture(overrides: Partial<PilotFixture> = {}): PilotFixture {
  return {
    tenantId: "tenant-alpha-01",
    operatorTenantId: "tenant-operator-03",
    account: {
      id: "account-alpha-01",
      tenantId: "tenant-alpha-01",
      displayName: "Alpha Synthetic",
      sourceRef: "source-01",
      sourceHash: "sha256:source",
    },
    contact: {
      id: "contact-alpha-01",
      tenantId: "tenant-alpha-01",
      accountId: "account-alpha-01",
      fullName: "Ana Ejemplo",
      role: "operations",
      channels: [{ channel: "email", value: "ana@example.test" }],
    },
    candidate: {
      id: "candidate-alpha-01",
      tenantId: "tenant-alpha-01",
      contactId: "contact-alpha-01",
      sourceCredit: "public-registry",
      discoveredAt: "2026-11-10T00:00:00Z",
      permission: {
        basis: "legitimate_interest",
        purpose: "pilot outreach",
        channel: "email",
        expiresAt: "2027-01-01T00:00:00Z",
      },
    },
    accepted: [],
    suppressions: [],
    opportunity: {
      id: "opportunity-alpha-01",
      tenantId: "tenant-alpha-01",
      accountId: "account-alpha-01",
      stage: "discovered",
      version: 1,
      evidenceRefs: [],
    },
    qualificationFacts: [
      { key: "budget_confirmed", value: "true", sourceRef: "evidence-01" },
    ],
    requiredQualificationKeys: ["budget_confirmed"],
    products: [product],
    priceBook,
    taxRules: [taxRule],
    policy: { rounding: "HALF_UP", exponent: 2, policyVersion: "q1" },
    discountMandate: mandate,
    reviewer: { kind: "human", id: "user-alpha-01" },
    sinkAllowlist: ["ana@example.test"],
    now: NOW,
    handoff: {
      id: "handoff-alpha-01",
      tenantId: "tenant-alpha-01",
      receiverRef: "receiver-01",
      status: "proposed",
    },
    ...overrides,
  };
}

describe("synthetic pilot vertical", () => {
  it("completes with zero external effects", () => {
    const result = runPilotVertical(fixture());

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.step)).toEqual([
      "candidates.accept",
      "candidates.outreach_permission",
      "pipeline.transition",
      "qualification.propose",
      "quote.calculate",
      "proposal.revision",
      "approval.binding",
      "email.preview",
      "activity.receipt",
      "meeting.propose",
      "handoff.ack",
    ]);
    expect(result.effects).toEqual({
      emailsSent: 0,
      signatures: 0,
      payments: 0,
      providerCalls: 0,
    });
    expect(result.quote?.total.amount).toBe("45.96");
    expect(result.approval?.reviewerId).toBe("user-alpha-01");
    expect(result.handoff?.status).toBe("working");
  });

  it("blocks before any quote when the channel is suppressed", () => {
    const result = runPilotVertical(
      fixture({
        suppressions: [
          {
            tenantId: "tenant-alpha-01",
            channel: "email",
            value: "ana@example.test",
            reason: "opt_out",
          },
        ],
      }),
    );

    expect(result.status).toBe("blocked");
    expect(result.steps.at(-1)).toEqual({
      step: "candidates.outreach_permission",
      status: "blocked",
      code: "suppressed",
    });
    expect(result.quote).toBeUndefined();
    expect(result.effects.emailsSent).toBe(0);
  });

  it("blocks a quote that exceeds the discount mandate", () => {
    const result = runPilotVertical(
      fixture({
        discountMandate: { ...mandate, maxRateBasisPoints: 100 },
      }),
    );

    expect(result.status).toBe("blocked");
    expect(result.steps.at(-1)).toEqual({
      step: "quote.calculate",
      status: "blocked",
      code: "DISCOUNT_EXCEEDED",
    });
    expect(result.draft).toBeUndefined();
  });

  it("blocks the preview when the recipient is outside the sink allowlist", () => {
    const result = runPilotVertical(fixture({ sinkAllowlist: ["other@example.test"] }));
    expect(result.status).toBe("blocked");
    expect(result.steps.at(-1)).toEqual({
      step: "email.preview",
      status: "blocked",
      code: "VALIDATION_FAILED",
    });
  });

  it("fails closed when the source candidate has no permission", () => {
    const result = runPilotVertical(
      fixture({ candidate: { ...fixture().candidate, permission: null } }),
    );
    expect(result.status).toBe("blocked");
    expect(result.steps.at(-1)?.code).toBe("no_permission");
  });
});
