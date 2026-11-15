import { createRemoteJWKSet, jwtVerify } from "jose";
import { OpaqueIdSchema, ServiceError } from "@agntia-ventas/contracts";

type JwtKeyInput = Parameters<typeof jwtVerify>[1];

export interface JwtVerifierConfig {
  /** Exact Supabase project issuer, e.g. https://<ref>.supabase.co/auth/v1 */
  readonly issuer: string;
  readonly audience: string;
  readonly algorithms?: readonly string[];
  readonly clockToleranceSec?: number;
  readonly keySet?: JwtKeyInput;
  /** Server-pinned JWKS endpoint. Never taken from the token (no `jku`). */
  readonly jwksUrl?: string;
}

export interface VerifiedClaims {
  readonly sub: string;
  /** Tenant claim from the token, still unverified against a membership. */
  readonly tenantClaim: string | null;
  readonly issuer: string;
  readonly audience: readonly string[];
  readonly issuedAt: number;
  readonly expiresAt: number;
  /** Sanitized claims: `user_metadata` is dropped and never becomes authority. */
  readonly raw: Readonly<Record<string, unknown>>;
}

export type JwtVerifier = (token: string) => Promise<VerifiedClaims>;

const DEFAULT_ALGORITHMS = ["RS256", "ES256"] as const;

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function tenantClaimOf(payload: Readonly<Record<string, unknown>>): string | null {
  const direct = payload["tenant_id"];
  const appMetadata = payload["app_metadata"];
  const fromAppMetadata =
    typeof appMetadata === "object" && appMetadata !== null
      ? (appMetadata as Record<string, unknown>)["tenant_id"]
      : undefined;
  const candidate = typeof direct === "string" ? direct : fromAppMetadata;

  if (candidate === undefined) return null;
  const parsed = OpaqueIdSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new ServiceError("AUTH_INVALID", "malformed tenant claim");
  }
  return parsed.data;
}

export function createSupabaseJwtVerifier(config: JwtVerifierConfig): JwtVerifier {
  if (!config.keySet && !config.jwksUrl) {
    throw new Error("JWT verifier requires a pinned JWKS endpoint or a key set");
  }

  const keySource: JwtKeyInput =
    config.keySet ?? createRemoteJWKSet(new URL(config.jwksUrl as string));

  return async (token: string): Promise<VerifiedClaims> => {
    if (token.split(".").length !== 3) {
      throw new ServiceError("AUTH_INVALID", "malformed token");
    }

    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(token, keySource, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: [...(config.algorithms ?? DEFAULT_ALGORITHMS)],
        clockTolerance: config.clockToleranceSec ?? 5,
        requiredClaims: ["sub", "exp", "iat", "iss", "aud"],
      });
      payload = verified.payload as Record<string, unknown>;
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === "ERR_JWT_EXPIRED") {
        throw new ServiceError("AUTH_EXPIRED", "token expired");
      }
      throw new ServiceError("AUTH_INVALID", "token verification failed");
    }

    const sub = payload["sub"];
    if (typeof sub !== "string" || sub.length < 1) {
      throw new ServiceError("AUTH_INVALID", "token without subject");
    }

    const { user_metadata: _droppedUserMetadata, ...rest } = payload;
    void _droppedUserMetadata;

    const audience = payload["aud"];
    return {
      sub,
      tenantClaim: tenantClaimOf(rest),
      issuer: String(payload["iss"]),
      audience: Array.isArray(audience)
        ? audience.map(String)
        : [String(audience)],
      issuedAt: Number(payload["iat"]),
      expiresAt: Number(payload["exp"]),
      raw: rest,
    };
  };
}
