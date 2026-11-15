import {
  ServiceError,
  type Capability,
  type DelegationMandate,
  type TwinBinding,
} from "@agntia-ventas/contracts";

export interface MandateValidationContext {
  readonly now: Date;
  readonly twin: TwinBinding;
  /** Revocation version currently published for this mandate/twin. */
  readonly expectedRevocationVersion: number;
  readonly requiredCapability: Capability;
}

function assertNotExpired(mandate: DelegationMandate, now: Date): void {
  if (new Date(mandate.expiresAt).getTime() <= now.getTime()) {
    throw new ServiceError("MANDATE_EXPIRED", "delegation mandate expired");
  }
}

function assertAlreadyValid(mandate: DelegationMandate, now: Date): void {
  if (new Date(mandate.issuedAt).getTime() > now.getTime()) {
    throw new ServiceError("MANDATE_INVALID", "delegation mandate not yet valid");
  }
}

function assertRevocationCurrent(
  mandate: DelegationMandate,
  expectedRevocationVersion: number,
): void {
  if (mandate.revocationVersion !== expectedRevocationVersion) {
    throw new ServiceError("MANDATE_REVOKED", "delegation mandate was revoked or superseded", {
      details: {
        mandateRevocationVersion: mandate.revocationVersion,
        expectedRevocationVersion,
      },
    });
  }
}

function assertBoundToTwin(mandate: DelegationMandate, twin: TwinBinding): void {
  if (mandate.twinBindingRef !== twin.id) {
    throw new ServiceError("MANDATE_INVALID", "mandate is not bound to this twin");
  }
  if (mandate.targetTenantId !== twin.targetTenantId) {
    throw new ServiceError("TENANT_MISMATCH", "mandate target tenant differs from twin");
  }
}

function assertNoCapabilityWidening(
  mandate: DelegationMandate,
  twin: TwinBinding,
): void {
  const twinCapabilities = new Set<Capability>(twin.capabilities);
  const widened = mandate.capabilities.filter(
    (capability) => !twinCapabilities.has(capability),
  );
  if (widened.length > 0) {
    throw new ServiceError(
      "CAPABILITY_WIDENING",
      "mandate requests capabilities the twin does not hold",
      { details: { widened } },
    );
  }
}

function assertRequiredCapability(
  mandate: DelegationMandate,
  requiredCapability: Capability,
): void {
  if (!mandate.capabilities.includes(requiredCapability)) {
    throw new ServiceError("CAPABILITY_NOT_GRANTED", "capability outside the mandate", {
      details: { capability: requiredCapability },
    });
  }
}

function assertExplicitDelegation(mandate: DelegationMandate): void {
  if (
    mandate.originatingTenantId !== mandate.targetTenantId &&
    mandate.workOrderRef === null
  ) {
    throw new ServiceError(
      "MANDATE_INVALID",
      "cross-tenant delegation requires an explicit work order",
    );
  }
}

function assertBudget(mandate: DelegationMandate): void {
  if (Number(mandate.budget.amount) <= 0) {
    throw new ServiceError("MANDATE_INVALID", "mandate budget must be positive");
  }
}

/**
 * Fail-closed check performed before any effect. A worker re-validates the
 * mandate for every job; the originating actor/tenant is preserved and never
 * rewritten into the target tenant.
 */
export function assertMandateAllowsWork(
  mandate: DelegationMandate,
  context: MandateValidationContext,
): void {
  assertNotExpired(mandate, context.now);
  assertAlreadyValid(mandate, context.now);
  assertRevocationCurrent(mandate, context.expectedRevocationVersion);
  assertBoundToTwin(mandate, context.twin);
  assertNoCapabilityWidening(mandate, context.twin);
  assertRequiredCapability(mandate, context.requiredCapability);
  assertExplicitDelegation(mandate);
  assertBudget(mandate);
}

/** The data scope of a mandate is its target, not the actor's own tenant. */
export function mandateDataScope(mandate: DelegationMandate): string {
  return mandate.targetTenantId;
}
