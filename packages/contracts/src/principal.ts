import { z } from "zod";
import { CapabilitySchema } from "./capabilities.ts";
import { IsoDateTimeSchema, OpaqueIdSchema } from "./ids.ts";
import { MoneySchema } from "./money.ts";
import { ScopeSchema } from "./scopes.ts";

/**
 * Actor keeps its kind, id, tenant and the native parent references separate.
 * `actor.tenantId` is where the actor comes from; `targetTenantId` (below) is
 * the data scope of a delegation. They are never overwritten into each other.
 */
export const ActorSchema = z
  .object({
    kind: z.enum(["human", "service", "twin"]),
    id: OpaqueIdSchema,
    tenantId: OpaqueIdSchema,
    userId: OpaqueIdSchema.optional(),
    roleId: OpaqueIdSchema.optional(),
    personaId: OpaqueIdSchema.optional(),
    runtimeId: OpaqueIdSchema.optional(),
  })
  .strict();

export type Actor = z.infer<typeof ActorSchema>;

export const MembershipRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "reviewer",
  "viewer",
]);

export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const MembershipStatusSchema = z.enum(["active", "suspended", "revoked"]);

export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

/**
 * Provisioned server-side. The JWT only carries `sub` (and, at most, a tenant
 * claim that must match this record); `user_metadata` never authorizes.
 */
export const MembershipSchema = z
  .object({
    id: OpaqueIdSchema,
    userId: OpaqueIdSchema,
    tenantId: OpaqueIdSchema,
    role: MembershipRoleSchema,
    status: MembershipStatusSchema,
    scopes: z.array(ScopeSchema).max(256),
    resourceScopes: z.array(OpaqueIdSchema).max(256).optional(),
  })
  .strict();

export type Membership = z.infer<typeof MembershipSchema>;

export const PrincipalSchema = z
  .object({
    actor: ActorSchema,
    membershipId: OpaqueIdSchema,
    role: MembershipRoleSchema,
    scopes: z.array(ScopeSchema).max(256),
  })
  .strict();

export type Principal = z.infer<typeof PrincipalSchema>;

/**
 * A twin is a scoped local specialization bound to the canonical agent in the
 * parent repository. It has no authority of its own: capabilities come from
 * the mandate that references it.
 */
export const TwinBindingSchema = z
  .object({
    id: OpaqueIdSchema,
    canonicalAgentRef: OpaqueIdSchema,
    canonicalRevision: z.string().min(1).max(128),
    instanceRef: OpaqueIdSchema,
    targetTenantId: OpaqueIdSchema,
    workOrderRef: OpaqueIdSchema,
    capabilities: z.array(CapabilitySchema).max(128),
    purpose: z.string().min(1).max(512),
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revocationVersion: z.number().int().min(0),
    proofRef: OpaqueIdSchema,
  })
  .strict();

export type TwinBinding = z.infer<typeof TwinBindingSchema>;

export const DelegationMandateSchema = z
  .object({
    id: OpaqueIdSchema,
    originatingActorId: OpaqueIdSchema,
    originatingTenantId: OpaqueIdSchema,
    targetTenantId: OpaqueIdSchema,
    twinBindingRef: OpaqueIdSchema,
    workOrderRef: OpaqueIdSchema.nullable(),
    capabilities: z.array(CapabilitySchema).max(128),
    purpose: z.string().min(1).max(512),
    budget: MoneySchema,
    issuedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    revocationVersion: z.number().int().min(0),
    proofRef: OpaqueIdSchema,
  })
  .strict();

export type DelegationMandate = z.infer<typeof DelegationMandateSchema>;
