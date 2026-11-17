import { Hono } from "hono";
import { z } from "zod";
import {
  MoneySchema,
  RoundingPolicySchema,
  ServiceError,
  envelopeByteLength,
  type Scope,
} from "@agntia-ventas/contracts";
import {
  assertDiscountWithinMandate,
  computeQuote,
  createApproval,
  createEmailPreview,
  previewImport,
  transitionHandoff,
} from "@agntia-ventas/sales";
import {
  authenticate,
  type AppContext,
  type AppDependencies,
  type AppEnvironment,
} from "../auth.ts";

const MAX_BODY_BYTES = 64 * 1024;

const ProductSchema = z
  .object({
    id: z.string().min(1).max(128),
    catalogVersion: z.string().min(1).max(128),
    validUntil: z.string().datetime({ offset: true }),
    stockAt: z.string().datetime({ offset: true }),
    deliveryAssertion: z.string().min(1).max(512).optional(),
  })
  .strict();

const PriceBookSchema = z
  .object({
    id: z.string().min(1).max(128),
    version: z.string().min(1).max(128),
    currency: z.string().regex(/^[A-Z]{3}$/),
    entries: z
      .array(
        z
          .object({
            productRef: z.string().min(1).max(128),
            unitPrice: MoneySchema,
            effectiveFrom: z.string().datetime({ offset: true }),
            effectiveTo: z.string().datetime({ offset: true }).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();

const QuoteBodySchema = z
  .object({
    priceBook: PriceBookSchema,
    lines: z
      .array(
        z
          .object({
            productRef: z.string().min(1).max(128),
            quantity: z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/),
            discountBasisPoints: z.number().int().min(0).max(10_000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    products: z.array(ProductSchema).min(1).max(200),
    // An empty list is valid input: the domain refuses to infer taxes and
    // answers TAX_MAPPING_MISSING instead of a generic schema error.
    taxRules: z
      .array(
        z
          .object({
            productRef: z.string().min(1).max(128),
            rateBasisPoints: z.number().int().min(0).max(10_000),
            sourceRef: z.string().min(1).max(256),
          })
          .strict(),
      )
      .max(200),
    policy: RoundingPolicySchema,
    orderDiscountBasisPoints: z.number().int().min(0).max(10_000).optional(),
    discountMandate: z
      .object({
        id: z.string().min(1).max(128),
        maxRateBasisPoints: z.number().int().min(0).max(10_000),
        maxAmount: MoneySchema.optional(),
        scope: z.literal("order"),
        expiresAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .optional(),
    now: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const ApprovalBodySchema = z
  .object({
    id: z.string().min(1).max(128),
    resourceRef: z.string().min(1).max(128),
    resourceVersion: z.number().int().min(1),
    payloadHash: z.string().min(8).max(256),
    rightsHash: z.string().min(8).max(256),
    policyHash: z.string().min(8).max(256),
    recipient: z.string().min(1).max(320),
    channel: z.enum(["email", "phone", "whatsapp", "linkedin"]),
    proofRef: z.string().min(1).max(256),
    costCeiling: MoneySchema,
    expiresAt: z.string().datetime({ offset: true }),
    revocationVersion: z.number().int().min(0),
  })
  .strict();

const EmailBodySchema = z
  .object({
    recipient: z.string().min(3).max(320),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20_000),
    purpose: z.string().min(1).max(256),
    suppressed: z.boolean(),
    sinkAllowlist: z.array(z.string().min(3).max(320)).max(100),
  })
  .strict();

const HandoffBodySchema = z
  .object({
    handoff: z
      .object({
        id: z.string().min(1).max(128),
        receiverRef: z.string().min(1).max(128),
        status: z.enum([
          "proposed",
          "offered",
          "acknowledged",
          "working",
          "completed",
          "returned",
        ]),
        ackRef: z.string().min(1).max(128).optional(),
      })
      .strict(),
    to: z.enum(["offered", "acknowledged", "working", "completed", "returned"]),
    ackRef: z.string().min(1).max(128).optional(),
  })
  .strict();

const ImportBodySchema = z
  .object({
    records: z
      .array(
        z
          .object({
            externalId: z.string().min(1).max(128),
            contentHash: z.string().min(8).max(256),
          })
          .strict(),
      )
      .max(500),
    seenExternalIds: z.array(z.string().min(1).max(128)).max(5000),
    reviewedVersions: z.record(z.string(), z.string().max(256)),
    previousCursor: z.string().min(1).max(256).nullable(),
    nextCursor: z.string().min(1).max(256),
  })
  .strict();

async function readBody<T>(
  context: AppContext,
  schema: z.ZodType<T>,
): Promise<T> {
  const declaredLength = Number(context.req.header("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ServiceError("VALIDATION_FAILED", "body exceeds the size limit");
  }

  let raw: unknown;
  try {
    raw = await context.req.json();
  } catch {
    throw new ServiceError("VALIDATION_FAILED", "body must be valid JSON");
  }
  if (envelopeByteLength(raw) > MAX_BODY_BYTES) {
    throw new ServiceError("VALIDATION_FAILED", "body exceeds the size limit");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION_FAILED", "body rejected", {
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

/**
 * Preview-only commercial surface. Every route derives the tenant and actor
 * from the verified principal, checks a named scope and returns no external
 * effect: quotes, approvals, drafts and handoff transitions are computed, not
 * persisted or sent.
 */
export function registerCommercialRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
  const route = (
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
      return context.json({ data, correlationId: context.get("correlationId") });
    });
  };

  route("/v1/ventas/quotes/preview", "sales.quote:propose", async (context, tenantId) => {
    const body = await readBody(context, QuoteBodySchema);
    const now = body.now ?? new Date().toISOString();

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

    return {
      totals,
      discountChecked: body.discountMandate !== undefined,
      externalEffect: false,
    };
  });

  route("/v1/ventas/approvals/preview", "sales.approval:review", async (context, tenantId, actorId) => {
    const body = await readBody(context, ApprovalBodySchema);
    const approval = createApproval({
      ...body,
      tenantId,
      reviewer: { kind: "human", id: actorId },
    });
    return { approval, externalEffect: false };
  });

  route("/v1/ventas/email/preview", "sales.email:propose", async (context) => {
    const body = await readBody(context, EmailBodySchema);
    const plan = createEmailPreview(body);
    return { plan, externalEffect: false };
  });

  route("/v1/ventas/handoffs/transition", "sales.handoff:propose", async (context, tenantId) => {
    const body = await readBody(context, HandoffBodySchema);
    const handoff = {
      ...body.handoff,
      tenantId,
    };
    const next = transitionHandoff(
      handoff,
      body.to,
      body.ackRef === undefined ? {} : { ackRef: body.ackRef },
    );
    return { handoff: next, externalEffect: false };
  });

  route("/v1/ventas/imports/preview", "sales.import:write", async (context) => {
    const body = await readBody(context, ImportBodySchema);
    return { preview: previewImport(body), externalEffect: false };
  });
}

