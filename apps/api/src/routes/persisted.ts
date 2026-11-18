import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { ServiceError, type Scope } from "@agntia-ventas/contracts";
import type { CommercialRepository } from "@agntia-ventas/persistence";
import {
  assertDiscountWithinMandate,
  computeQuote,
  createApproval,
  quoteDiscountTotal,
  stableStringify,
} from "@agntia-ventas/sales";
import {
  authenticate,
  type AppContext,
  type AppDependencies,
  type AppEnvironment,
} from "../auth.ts";
import { ApprovalBodySchema, QuoteBodySchema, readBody } from "./commercial.ts";

const PersistedQuoteSchema = QuoteBodySchema.extend({
  id: z.string().min(1).max(128),
  opportunityId: z.string().min(1).max(128),
  operationKey: z.string().min(8).max(128),
});

const PersistedApprovalSchema = ApprovalBodySchema.extend({
  operationKey: z.string().min(8).max(128),
});

const RevokeSchema = z.object({ expectedVersion: z.number().int().min(0) }).strict();

function requireCommercial(dependencies: AppDependencies): CommercialRepository {
  if (!dependencies.commercial) {
    throw new ServiceError(
      "DEPENDENCY_UNAVAILABLE",
      "commercial storage is not configured in this deployment",
    );
  }
  return dependencies.commercial;
}

/**
 * Effect routes. They persist a computed quote or a human approval inside a
 * tenant-scoped transaction, keyed by an operation key, and never call a
 * provider. A repeated key returns the stored row; a different payload with the
 * same key is a conflict.
 */
export function registerPersistedRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
  const write = (
    path: string,
    scope: Scope,
    handler: (context: AppContext, tenantId: string, actorId: string) => Promise<unknown>,
  ) => {
    app.post(path, async (context) => {
      const principal = await authenticate(context, dependencies, [scope]);
      const data = await handler(
        context,
        principal.actor.tenantId,
        principal.actor.userId ?? principal.actor.id,
      );
      const reused = (data as { reused?: boolean }).reused === true;
      return context.json(
        { data, correlationId: context.get("correlationId") },
        reused ? 200 : 201,
      );
    });
  };

  app.get("/v1/ventas/quotes/:id", async (context) => {
    const principal = await authenticate(context, dependencies, ["sales.pipeline:read"]);
    const stores = requireCommercial(dependencies);
    const quoteId = context.req.param("id");
    if (!quoteId) {
      throw new ServiceError("VALIDATION_FAILED", "quote id is missing");
    }
    const quote = await stores.quotes.find({
      tenantId: principal.actor.tenantId,
      id: quoteId,
    });
    if (!quote) {
      throw new ServiceError("NOT_FOUND", "quote not found");
    }
    return context.json({
      data: { quote },
      correlationId: context.get("correlationId"),
    });
  });

  write("/v1/ventas/quotes", "sales.quote:propose", async (context, tenantId) => {
    const body = await readBody(context, PersistedQuoteSchema);
    const stores = requireCommercial(dependencies);
    const now = new Date().toISOString();

    const totals = computeQuote({
      tenantId,
      priceBook: { ...body.priceBook, tenantId },
      lines: body.lines,
      products: body.products.map((product) => ({ ...product, tenantId })),
      taxRules: body.taxRules,
      policy: body.policy,
      ...(body.orderDiscountBasisPoints !== undefined
        ? { orderDiscountBasisPoints: body.orderDiscountBasisPoints }
        : {}),
      now,
    });
    if (body.discountMandate) {
      assertDiscountWithinMandate({ quote: totals, mandate: body.discountMandate, now });
    }

    const contentHash = `sha256:${createHash("sha256")
      .update(stableStringify(totals), "utf8")
      .digest("hex")}`;

    const saved = await stores.quotes.save(tenantId, {
      id: body.id,
      opportunityId: body.opportunityId,
      operationKey: body.operationKey,
      priceBookVersion: totals.priceBookVersion,
      subtotal: totals.subtotal.amount,
      discount: quoteDiscountTotal(totals).amount,
      tax: totals.tax.amount,
      total: totals.total.amount,
      currency: totals.currency,
      contentHash,
    });

    return { ...saved, totals, externalEffect: false };
  });

  write("/v1/ventas/approvals", "sales.approval:review", async (context, tenantId, actorId) => {
    const body = await readBody(context, PersistedApprovalSchema);
    const stores = requireCommercial(dependencies);

    const approval = createApproval({
      ...body,
      tenantId,
      reviewer: { kind: "human", id: actorId },
    });

    const saved = await stores.approvals.save(tenantId, {
      id: approval.id,
      operationKey: body.operationKey,
      resourceRef: body.resourceRef,
      resourceVersion: body.resourceVersion,
      payloadHash: body.payloadHash,
      rightsHash: body.rightsHash,
      policyHash: body.policyHash,
      reviewerId: approval.reviewerId,
      proofRef: body.proofRef,
      recipient: body.recipient,
      channel: body.channel,
      costCeiling: body.costCeiling.amount,
      costCeilingCurrency: body.costCeiling.currency,
      expiresAt: body.expiresAt,
      revocationVersion: body.revocationVersion,
    });

    return { ...saved, externalEffect: false };
  });

  write("/v1/ventas/approvals/:id/revoke", "sales.approval:review", async (context, tenantId) => {
    const body = await readBody(context, RevokeSchema);
    const stores = requireCommercial(dependencies);
    const approvalId = context.req.param("id");
    if (!approvalId) {
      throw new ServiceError("VALIDATION_FAILED", "approval id is missing");
    }
    const revoked = await stores.approvals.revoke({
      tenantId,
      id: approvalId,
      expectedVersion: body.expectedVersion,
    });
    return { ...revoked, externalEffect: false };
  });
}
