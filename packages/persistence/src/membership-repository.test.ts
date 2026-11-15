import { describe, expect, it } from "vitest";
import { createMembershipRepository } from "./membership-repository.ts";
import { createTenantSession } from "./tenant-session.ts";
import { createHarness, seed } from "./test-support.ts";

describe("membership repository", () => {
  it("returns the provisioned membership of the verified tenant", async () => {
    const { client } = await createHarness();
    await seed(client);
    const repository = createMembershipRepository(() => createTenantSession(client));

    const membership = await repository.findMembership({
      userId: "user-alpha-01",
      tenantId: "tenant-alpha-01",
    });

    expect(membership).not.toBeNull();
    expect(membership?.id).toBe("membership-alpha-01");
    expect(membership?.role).toBe("reviewer");
    expect(membership?.scopes).toEqual(["sales.pipeline:read", "sales.quote:propose"]);
  });

  it("returns a suspended membership so the caller can fail closed", async () => {
    const { client } = await createHarness();
    await seed(client);
    const repository = createMembershipRepository(() => createTenantSession(client));

    const membership = await repository.findMembership({
      userId: "user-alpha-suspended",
      tenantId: "tenant-alpha-01",
    });
    expect(membership?.status).toBe("suspended");
  });

  it("does not cross tenants even with a valid user id", async () => {
    const { client } = await createHarness();
    await seed(client);
    const repository = createMembershipRepository(() => createTenantSession(client));

    const wrongTenant = await repository.findMembership({
      userId: "user-beta-02",
      tenantId: "tenant-alpha-01",
    });
    expect(wrongTenant).toBeNull();

    const unknownUser = await repository.findMembership({
      userId: "user-nobody-01",
      tenantId: "tenant-beta-02",
    });
    expect(unknownUser).toBeNull();
  });

  it("is usable as the identity port without change", async () => {
    const { client } = await createHarness();
    await seed(client);
    const repository = createMembershipRepository(() => createTenantSession(client));

    // Structural check: the object satisfies the port used by resolvePrincipal.
    const port: import("@agntia-ventas/identity").MembershipRepository = repository;
    expect(typeof port.findMembership).toBe("function");
  });
});
