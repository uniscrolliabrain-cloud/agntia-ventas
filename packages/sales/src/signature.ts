import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ServiceError } from "@agntia-ventas/contracts";

const PayloadSchema = z
  .object({
    eventId: z.string().min(1).max(128),
    documentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    signerRef: z.string().min(1).max(256),
    status: z.literal("signed"),
  })
  .strict();

export interface VerifiedSignatureEvent {
  readonly providerEventId: string;
  readonly documentHash: string;
  readonly signerRef: string;
  readonly verifiedAt: string;
  /** A signature event proves the signature, not the contract or the payment. */
  readonly isContractAccepted: false;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/**
 * Provider-agnostic webhook check: HMAC over `timestamp.rawBody`, a bounded
 * clock skew and the signed document hash compared with the expected one.
 * Without a configured secret the capability stays disabled.
 */
export function verifySignatureWebhook(input: {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly rawBody: string;
  readonly secret: string | null;
  readonly now: string;
  readonly expectedDocumentHash: string;
  readonly toleranceSeconds?: number;
}): VerifiedSignatureEvent {
  if (!input.secret) {
    throw new ServiceError("PROVIDER_NOT_CONFIGURED", "signature secret is not configured");
  }

  const timestamp = input.headers["x-signature-timestamp"];
  const provided = input.headers["x-signature"];
  if (!timestamp || !provided) {
    throw new ServiceError("AUTH_INVALID", "signature headers are missing");
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    throw new ServiceError("AUTH_INVALID", "signature timestamp is malformed");
  }

  const nowSeconds = Math.floor(new Date(input.now).getTime() / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isFinite(nowSeconds) || Math.abs(nowSeconds - Number(timestamp)) > tolerance) {
    throw new ServiceError("AUTH_EXPIRED", "signature timestamp is outside the window");
  }

  const expected = hmacHex(input.secret, `${timestamp}.${input.rawBody}`);
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new ServiceError("AUTH_INVALID", "signature does not match");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody);
  } catch {
    throw new ServiceError("PROVIDER_INVALID_RESPONSE", "signature body is not JSON");
  }
  const payload = PayloadSchema.safeParse(parsedJson);
  if (!payload.success) {
    throw new ServiceError("PROVIDER_INVALID_RESPONSE", "signature event shape is unknown");
  }
  if (payload.data.documentHash !== input.expectedDocumentHash) {
    throw new ServiceError("APPROVAL_STALE", "signed document differs from the approved one");
  }

  return {
    providerEventId: payload.data.eventId,
    documentHash: payload.data.documentHash,
    signerRef: payload.data.signerRef,
    verifiedAt: new Date(nowSeconds * 1000).toISOString(),
    isContractAccepted: false,
  };
}

/** Test/ops helper: the same HMAC the provider is expected to send. */
export function signWebhookPayload(secret: string, timestamp: number, rawBody: string): string {
  return hmacHex(secret, `${timestamp}.${rawBody}`);
}
