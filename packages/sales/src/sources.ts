import { createHash } from "node:crypto";
import { ServiceError } from "@agntia-ventas/contracts";
import type { QualificationFact } from "./models.ts";
import { assertNoSecretMaterial } from "./operations.ts";

// ---------------------------------------------------------------------------
// C13 — account context sources
// ---------------------------------------------------------------------------

/**
 * A source document is untrusted data, never an instruction. This module reads
 * it, hashes it, tags injection attempts and refuses to build a fact that does
 * not literally appear in the fetched text.
 */

export interface SourceHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export interface SourceFetchInit {
  readonly method: "GET";
  /** Redirects are never followed: a 30x is an error, not a detour. */
  readonly redirect: "error";
  readonly headers: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
}

export type SourceFetchLike = (
  url: string,
  init: SourceFetchInit,
) => Promise<SourceHttpResponse>;

const ALLOWED_MEDIA_TYPES = ["text/html", "text/plain", "application/json"] as const;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;

const PRIVATE_HOSTNAME = /^(localhost|\[[^\]]+\]|\d{1,3}(\.\d{1,3}){3}|.*\.(local|internal|localhost))$/i;

const INJECTION_SIGNALS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  {
    label: "ignore_instructions",
    pattern: /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions/i,
  },
  { label: "system_prompt", pattern: /system\s*prompt|prompt\s+del\s+sistema/i },
  {
    label: "role_override",
    pattern: /you\s+are\s+now|act\s+as\s+(an?\s+)?(admin|system|developer)|ahora\s+eres/i,
  },
  {
    label: "secret_exfiltration",
    pattern: /(reveal|print|show|send)\s+(your\s+|the\s+)?(api\s*key|token|secret|password)/i,
  },
  {
    label: "tool_call_injection",
    pattern: /<\s*(tool|function)[_\s-]?call|"tool_call"|"\s*tool\s*"\s*:/i,
  },
];

export interface SourceExcerpt {
  readonly sourceRef: string;
  readonly url: string;
  readonly fetchedAt: string;
  readonly contentHash: string;
  readonly mediaType: string;
  readonly text: string;
  /** Always untrusted: the caller must not treat it as a command. */
  readonly trust: "untrusted";
  readonly injectionSignals: readonly string[];
}

/**
 * Only a public https URL on an allowlisted host may be fetched. Entries in
 * `allowedHosts` match exactly, or match a suffix when they start with a dot
 * (`.example.test` covers `www.example.test` but not `notexample.test`).
 */
export function assertPublicSourceUrl(url: string, allowedHosts: readonly string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceError("VALIDATION_FAILED", "source is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new ServiceError("VALIDATION_FAILED", "source must use https");
  }
  if (parsed.username || parsed.password) {
    throw new ServiceError("VALIDATION_FAILED", "source must not embed credentials");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new ServiceError("VALIDATION_FAILED", "source must use the default https port");
  }
  if (PRIVATE_HOSTNAME.test(parsed.hostname)) {
    throw new ServiceError("VALIDATION_FAILED", "source targets a private host", {
      details: { host: parsed.hostname },
    });
  }
  const allowed = allowedHosts.some((entry) => {
    const rule = entry.toLowerCase();
    if (!rule.startsWith(".")) return parsed.hostname === rule;
    const suffix = rule.slice(1);
    return parsed.hostname === suffix || parsed.hostname.endsWith(rule);
  });
  if (!allowed) {
    throw new ServiceError("VALIDATION_FAILED", "source host is not allowlisted", {
      details: { host: parsed.hostname },
    });
  }
  assertNoSecretMaterial(url);
  return parsed;
}

function mediaTypeOf(header: string | null): string | null {
  if (!header) return null;
  const [value] = header.split(";");
  const normalised = value?.trim().toLowerCase();
  return normalised ? normalised : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

/** Scripts, styles and comments are dropped, not summarised: no hidden text. */
export function htmlToText(raw: string): string {
  const withoutBlocks = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]{0,2048}>/g, " ");

  return decodeEntities(withoutBlocks)
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function detectInjectionSignals(text: string): readonly string[] {
  return INJECTION_SIGNALS.filter((signal) => signal.pattern.test(text)).map(
    (signal) => signal.label,
  );
}

/**
 * Fetch is bounded in time, in bytes and in media type. Oversize, empty,
 * non-allowlisted and redirected responses all fail closed; nothing is
 * truncated and presented as if it were complete.
 */
export async function fetchSourceExcerpt(input: {
  readonly url: string;
  readonly allowedHosts: readonly string[];
  readonly fetchImpl: SourceFetchLike;
  readonly now: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}): Promise<SourceExcerpt> {
  const target = assertPublicSourceUrl(input.url, input.allowedHosts);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // The timeout covers the body read: a server that sends headers and then
  // stalls cannot keep the fetch alive past the deadline.
  try {
    let response: SourceHttpResponse;
    try {
      response = await input.fetchImpl(target.toString(), {
        method: "GET",
        redirect: "error",
        headers: {
          accept: ALLOWED_MEDIA_TYPES.join(", "),
          "user-agent": "agntia-ventas-source/1",
        },
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ServiceError("PROVIDER_TIMEOUT", "source request timed out", {
          retryable: true,
        });
      }
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "source request failed; redirects are not followed",
        { retryable: true },
      );
    }

    if (!response.ok) {
      throw new ServiceError("PROVIDER_UNAVAILABLE", "source answered with an error", {
        retryable: response.status >= 500,
        details: { status: response.status },
      });
    }

    const mediaType = mediaTypeOf(response.headers.get("content-type"));
    if (
      !mediaType ||
      !ALLOWED_MEDIA_TYPES.includes(mediaType as (typeof ALLOWED_MEDIA_TYPES)[number])
    ) {
      throw new ServiceError("PROVIDER_INVALID_RESPONSE", "unsupported source media type", {
        details: { mediaType },
      });
    }

    // A declared length is checked before buffering: reading the whole body and
    // rejecting it afterwards still allocates whatever the provider sent.
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null) {
      const declared = Number(declaredLength);
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw new ServiceError(
          "PROVIDER_INVALID_RESPONSE",
          "source declares more than the size limit",
          { details: { declared, maxBytes } },
        );
      }
    }

    let raw: string;
    try {
      raw = await response.text();
    } catch {
      if (controller.signal.aborted) {
        throw new ServiceError("PROVIDER_TIMEOUT", "source body timed out", {
          retryable: true,
        });
      }
      throw new ServiceError("PROVIDER_UNAVAILABLE", "source body could not be read", {
        retryable: true,
      });
    }
    if (Buffer.byteLength(raw, "utf8") > maxBytes) {
      throw new ServiceError("PROVIDER_INVALID_RESPONSE", "source exceeds the size limit", {
        details: { maxBytes },
      });
    }

    const text = mediaType === "text/html" ? htmlToText(raw) : raw.trim();
    if (text.length === 0) {
      throw new ServiceError("PROVIDER_INVALID_RESPONSE", "source has no readable text");
    }

    const contentHash = `sha256:${createHash("sha256").update(raw, "utf8").digest("hex")}`;
    return {
      sourceRef: `source:${target.hostname}:${contentHash.slice(7, 19)}`,
      url: target.toString(),
      fetchedAt: input.now,
      contentHash,
      mediaType,
      text,
      trust: "untrusted",
      injectionSignals: detectInjectionSignals(text),
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalise(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * A qualification fact needs a literal quote from the fetched text. The model
 * may propose a key/value pair; the core only records it when the source
 * actually says it.
 */
export function qualificationFactFromSource(input: {
  readonly excerpt: SourceExcerpt;
  readonly key: string;
  readonly value: string;
}): QualificationFact {
  const key = input.key.trim();
  const value = input.value.trim();
  if (key.length === 0 || key.length > 64) {
    throw new ServiceError("VALIDATION_FAILED", "fact key is empty or too long");
  }
  if (value.length === 0 || value.length > 500) {
    throw new ServiceError("VALIDATION_FAILED", "fact value is empty or too long");
  }
  assertNoSecretMaterial(value);

  if (!normalise(input.excerpt.text).includes(normalise(value))) {
    throw new ServiceError("EVIDENCE_REQUIRED", "fact is not supported by the source text", {
      details: { key, sourceRef: input.excerpt.sourceRef },
    });
  }

  return { key, value, sourceRef: input.excerpt.sourceRef };
}

/** Retrieval is implemented; the vendor search API and the allowlist are not. */
export const SOURCE_STATUS = {
  retrieval: "implemented",
  vendorSearchApi: "STUB",
  tenantAllowlist: "NOT_CONFIGURED",
} as const;
