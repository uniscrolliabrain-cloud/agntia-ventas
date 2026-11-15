import { serve } from "@hono/node-server";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  createSupabaseJwtVerifier,
  type MembershipRepository,
} from "@agntia-ventas/identity";
import { createApp } from "./app.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

/**
 * Membership storage belongs to campaign C06 (persistence, RLS, migrations).
 * Until then every authenticated route fails closed with 424 instead of
 * falling back to an admin/default principal.
 */
const memberships: MembershipRepository = {
  async findMembership() {
    throw new ServiceError(
      "DEPENDENCY_UNAVAILABLE",
      "membership store is not implemented yet (campaign VTA-C06)",
      { details: { pendingCampaign: "VTA-C06" } },
    );
  },
};

const app = createApp({
  verifyToken: createSupabaseJwtVerifier({
    issuer: requireEnv("SUPABASE_JWT_ISSUER"),
    audience: process.env["SUPABASE_JWT_AUDIENCE"] ?? "authenticated",
    jwksUrl: requireEnv("SUPABASE_JWKS_URL"),
  }),
  memberships,
});

const port = Number(process.env["PORT"] ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(
    `${JSON.stringify({ event: "listening", port: info.port, service: "agntia-ventas" })}\n`,
  );
});
