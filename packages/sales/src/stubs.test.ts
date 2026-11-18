import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ServiceError, ERROR_CODES } from "@agntia-ventas/contracts";
import {
  CAPABILITY_STUBS,
  stubById,
  stubCapability,
  stubCoverage,
} from "./stubs.ts";

function thrown(fn: () => unknown): ServiceError | null {
  try {
    fn();
  } catch (error) {
    return error instanceof ServiceError ? error : null;
  }
  return null;
}

describe("declared stubs", () => {
  it("has unique ids and a known error code for every stub", () => {
    const ids = CAPABILITY_STUBS.map((stub) => stub.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const stub of CAPABILITY_STUBS) {
      expect(ERROR_CODES).toContain(stub.failClosedWith);
      expect(stub.requires.length).toBeGreaterThan(0);
      expect(stub.reason.length).toBeGreaterThan(0);
    }
  });

  it("covers every campaign whose external part is still open", () => {
    const coverage = stubCoverage();
    expect(coverage.total).toBe(CAPABILITY_STUBS.length);
    for (const campaign of ["C13", "C14", "C15", "C22", "C33", "C34", "C35", "C36", "C38", "C41", "C42"]) {
      expect(coverage.campaigns).toContain(campaign);
    }
    expect(coverage.byStatus.stub + coverage.byStatus.not_verified).toBe(coverage.total);
  });

  it("points every codeRef at a file and symbol that exist", () => {
    // A stub whose evidence link names a removed function claims a fail-closed
    // path nobody can read; five refs had drifted from the real exports.
    const root = new URL("../../../", import.meta.url);
    for (const stub of CAPABILITY_STUBS) {
      const [path, symbol] = stub.codeRef.split("#") as [string, string | undefined];
      const source = readFileSync(fileURLToPath(new URL(path, root)), "utf8");
      if (symbol) {
        expect(source, `${stub.id} -> ${stub.codeRef}`).toMatch(
          new RegExp(`(?:function|const|interface)\\s+${symbol}\\b`),
        );
      }
    }
  });

  it("fails closed with the declared code and never returns", () => {
    for (const stub of CAPABILITY_STUBS) {
      const error = thrown(() => stubCapability(stub.id));
      expect(error?.code).toBe(stub.failClosedWith);
      expect(error?.details?.campaign).toBe(stub.campaign);
    }
  });

  it("rejects an unknown stub id with a validation error", () => {
    expect(thrown(() => stubCapability("c99-nope"))?.code).toBe("VALIDATION_FAILED");
    expect(stubById("c36-parent-transport")?.status).toBe("not_verified");
    expect(stubById("c99-nope")).toBeNull();
  });
});
