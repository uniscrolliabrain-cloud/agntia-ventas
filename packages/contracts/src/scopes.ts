import { z } from "zod";

/**
 * A scope names a resource family and an action: `sales.pipeline:read`,
 * `sales.quote:propose`. Scopes are provisioned server-side per membership and
 * per resource; a claim never names its own scopes.
 */
export const ScopeSchema = z
  .string()
  .min(5)
  .max(96)
  .regex(
    /^[a-z][a-z0-9]*(?:\.[a-z0-9]+)*:[a-z][a-z0-9._-]*$/,
    "scope must be <resource>:<action>",
  );

export type Scope = z.infer<typeof ScopeSchema>;
