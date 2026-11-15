import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  createSupabaseJwtVerifier,
  type MembershipRepository,
} from "@agntia-ventas/identity";
import { createPooledMembershipRepository } from "@agntia-ventas/persistence";
import { createApp } from "./app.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

/**
 * Without a database the API still starts, but every authenticated route fails
 * closed with 424. There is no admin/default principal fallback.
 */
function createMembershipRepository(): MembershipRepository {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
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
  return createPooledMembershipRepository(
    new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 }),
  );
}

const app = createApp({
  verifyToken: createSupabaseJwtVerifier({
    issuer: requireEnv("SUPABASE_JWT_ISSUER"),
    audience: process.env["SUPABASE_JWT_AUDIENCE"] ?? "authenticated",
    jwksUrl: requireEnv("SUPABASE_JWKS_URL"),
  }),
  memberships: createMembershipRepository(),
});

const port = Number(process.env["PORT"] ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(
    `${JSON.stringify({ event: "listening", port: info.port, service: "agntia-ventas" })}\n`,
  );
});
