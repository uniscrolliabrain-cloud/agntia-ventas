import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  MAX_ENVELOPE_BYTES,
  OperationEnvelopeSchema,
  ServiceError,
  envelopeByteLength,
  toErrorEnvelope,
} from "@agntia-ventas/contracts";
import {
  authenticate,
  type AppDependencies,
  type AppEnvironment,
} from "./auth.ts";
import { registerCommercialRoutes } from "./routes/commercial.ts";
import { registerPersistedRoutes } from "./routes/persisted.ts";
import { registerPortalRoutes } from "./portal.ts";

export type { AppDependencies } from "./auth.ts";

const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Named, closed API surface (docs/contracts/01-contratos.md). There is no
 * generic `/provider/{method}`, free SQL, shell or arbitrary HTTP route.
 */
export function createApp(dependencies: AppDependencies): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();
  const newCorrelationId =
    dependencies.correlationIdFactory ?? (() => `corr-${crypto.randomUUID()}`);

  app.use("*", async (context, next) => {
    const incoming = context.req.header("x-correlation-id");
    const correlationId =
      incoming && CORRELATION_PATTERN.test(incoming) ? incoming : newCorrelationId();
    context.set("correlationId", correlationId);
    // Authenticated data and signed portal pages are never cacheable.
    context.header("cache-control", "no-store");
    await next();
  });

  app.get("/health", (context) =>
    context.json({ status: "ok", service: "agntia-ventas", schemaVersion: 1 }),
  );

  app.get("/v1/ventas/me", async (context) => {
    const principal = await authenticate(context, dependencies);
    return context.json({
      data: principal,
      correlationId: context.get("correlationId"),
    });
  });

  /**
   * Contract check endpoint: validates the envelope, proves the caller cannot
   * smuggle another tenant/actor and returns no effect (there is no remote
   * write behind it).
   */
  registerCommercialRoutes(app, dependencies);
  registerPersistedRoutes(app, dependencies);
  registerPortalRoutes(app, dependencies);

  app.post("/v1/ventas/envelopes/validate", async (context) => {
    const principal = await authenticate(context, dependencies);

    const declaredLength = Number(context.req.header("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ENVELOPE_BYTES) {
      throw new ServiceError("VALIDATION_FAILED", "envelope exceeds the size limit");
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      throw new ServiceError("VALIDATION_FAILED", "body must be valid JSON");
    }
    if (envelopeByteLength(body) > MAX_ENVELOPE_BYTES) {
      throw new ServiceError("VALIDATION_FAILED", "envelope exceeds the size limit");
    }

    const parsed = OperationEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ServiceError("VALIDATION_FAILED", "envelope rejected", {
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
            ...(issue.code === "unrecognized_keys" ? { keys: issue.keys } : {}),
          })),
        },
      });
    }

    const envelope = parsed.data;
    if (envelope.tenantId !== principal.actor.tenantId) {
      throw new ServiceError("TENANT_MISMATCH", "envelope tenant is not the verified tenant");
    }
    if (envelope.actorId !== principal.actor.id) {
      throw new ServiceError("ACTOR_MISMATCH", "envelope actor is not the verified actor");
    }

    return context.json({
      data: {
        accepted: true,
        capability: envelope.capability,
        dryRun: envelope.dryRun,
        payloadBytes: envelopeByteLength(envelope.payload),
      },
      correlationId: context.get("correlationId"),
    });
  });

  app.notFound((context) =>
    context.json(
      toErrorEnvelope(
        new ServiceError("NOT_FOUND", "route not found"),
        context.get("correlationId") ?? "corr-unknown",
      ),
      404,
    ),
  );

  app.onError((error, context) => {
    const correlationId = context.get("correlationId") ?? "corr-unknown";
    if (error instanceof ServiceError) {
      return context.json(
        toErrorEnvelope(error, correlationId),
        error.httpStatus as ContentfulStatusCode,
      );
    }
    return context.json(
      toErrorEnvelope(new ServiceError("INTERNAL", "internal error"), correlationId),
      500,
    );
  });

  return app;
}
