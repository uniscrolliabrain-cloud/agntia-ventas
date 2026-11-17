import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  createSupabaseJwtVerifier,
  type MembershipRepository,
} from "@agntia-ventas/identity";
import {
  createPooledCommercialRepository,
  createPooledMembershipRepository,
} from "@agntia-ventas/persistence";
import { createApp } from "./app.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

const connectionString = process.env["DATABASE_URL"];
const pool = connectionString
  ? new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 })
  : null;

/**
 * Without a database the API still starts, but every authenticated route fails
 * closed with 424. There is no admin/default principal fallback.
 */
function createMembershipRepository(): MembershipRepository {
  if (!pool) {
    return {
      async findMembership() {
        throw new ServiceError(
          "DEPENDENCY_UNAVAILABLE",
          "DATABASE_URL is not configured; membership storage is unavailable",
          { details: { pendingCampaign: "VTA-C06" } },
        );
      },
    };
  }
  return createPooledMembershipRepository(pool);
}

const app = createApp({
  verifyToken: createSupabaseJwtVerifier({
    issuer: requireEnv("SUPABASE_JWT_ISSUER"),
    audience: process.env["SUPABASE_JWT_AUDIENCE"] ?? "authenticated",
    jwksUrl: requireEnv("SUPABASE_JWKS_URL"),
  }),
  memberships: createMembershipRepository(),
  ...(pool ? { commercial: createPooledCommercialRepository(pool) } : {}),
});

const port = Number(process.env["PORT"] ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(
    `${JSON.stringify({ event: "listening", port: info.port, service: "agntia-ventas" })}\n`,
  );
});
