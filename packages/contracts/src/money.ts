import { z } from "zod";

/**
 * Money is always an exact decimal string plus an ISO-4217 currency. Binary
 * floats are rejected by construction: the string has no exponent and no
 * leading zeros, and arithmetic happens in `@agntia-ventas/domain` with
 * decimal.js (docs/09-evaluacion.md, "QuoteTotals").
 */
export const CurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "currency must be ISO-4217 alpha-3");

export type Currency = z.infer<typeof CurrencySchema>;

export const AmountSchema = z
  .string()
  .regex(
    /^-?(0|[1-9]\d{0,17})(\.\d{1,8})?$/,
    "amount must be an exact decimal string (no exponent, max 8 fractional digits)",
  );

export type Amount = z.infer<typeof AmountSchema>;

export const MoneySchema = z
  .object({
    amount: AmountSchema,
    currency: CurrencySchema,
    /** Optional declared display scale; never used to hide precision. */
    exponent: z.number().int().min(0).max(8).optional(),
  })
  .strict();

export type Money = z.infer<typeof MoneySchema>;

export const RoundingSchema = z.enum(["HALF_UP", "HALF_EVEN", "DOWN", "UP"]);

export type Rounding = z.infer<typeof RoundingSchema>;

/** Deterministic, versioned rounding policy for a quote calculation. */
export const RoundingPolicySchema = z
  .object({
    rounding: RoundingSchema,
    exponent: z.number().int().min(0).max(8),
    policyVersion: z.string().min(1).max(32),
  })
  .strict();

export type RoundingPolicy = z.infer<typeof RoundingPolicySchema>;

export const QuantitySchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/, "quantity must be a positive exact decimal string");

export type Quantity = z.infer<typeof QuantitySchema>;
