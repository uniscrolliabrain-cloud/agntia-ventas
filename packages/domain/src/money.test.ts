import { describe, expect, it } from "vitest";
import { ServiceError } from "@agntia-ventas/contracts";
import {
  addMoney,
  applyDiscountBasisPoints,
  multiplyMoney,
  roundMoney,
  subtractMoney,
  sumMoney,
} from "./money.ts";

const HALF_UP_2 = { rounding: "HALF_UP", exponent: 2, policyVersion: "q1" } as const;
const HALF_EVEN_2 = { rounding: "HALF_EVEN", exponent: 2, policyVersion: "q1" } as const;

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof ServiceError) return error.code;
    return "UNEXPECTED";
  }
  return "NO_ERROR";
}

describe("money arithmetic", () => {
  it("adds decimals without binary float artefacts", () => {
    const total = addMoney(
      { amount: "0.1", currency: "EUR" },
      { amount: "0.2", currency: "EUR" },
    );
    // Scale is the widest input scale (1 decimal here), never a float artefact.
    expect(total.amount).toBe("0.3");
    expect(total.exponent).toBe(1);
    expect(total.currency).toBe("EUR");
  });

  it("keeps the widest scale when adding", () => {
    expect(
      addMoney({ amount: "1.5", currency: "EUR" }, { amount: "2", currency: "EUR" }).amount,
    ).toBe("3.5");
  });

  it("subtracts and sums line totals", () => {
    const total = sumMoney([
      { amount: "19.99", currency: "EUR" },
      { amount: "0.01", currency: "EUR" },
      { amount: "5.00", currency: "EUR" },
    ]);
    expect(total.amount).toBe("25.00");
    expect(
      subtractMoney({ amount: "25.00", currency: "EUR" }, { amount: "19.99", currency: "EUR" })
        .amount,
    ).toBe("5.01");
  });

  it("rejects mixing currencies instead of guessing a conversion", () => {
    expect(
      codeOf(() =>
        addMoney({ amount: "10.00", currency: "EUR" }, { amount: "10.00", currency: "USD" }),
      ),
    ).toBe("CURRENCY_MISMATCH");
  });

  it("rejects an empty sum", () => {
    expect(codeOf(() => sumMoney([]))).toBe("VALIDATION_FAILED");
  });
});

describe("quantity x unit price", () => {
  it("rounds once with the declared policy", () => {
    expect(
      multiplyMoney({ amount: "19.99", currency: "EUR" }, "3", HALF_UP_2).amount,
    ).toBe("59.97");
    expect(
      multiplyMoney({ amount: "10.00", currency: "EUR" }, "2.5", HALF_UP_2).amount,
    ).toBe("25.00");
  });

  it("distinguishes HALF_UP from HALF_EVEN", () => {
    const unit = { amount: "1.005", currency: "EUR" };
    expect(multiplyMoney(unit, "1", HALF_UP_2).amount).toBe("1.01");
    expect(multiplyMoney(unit, "1", HALF_EVEN_2).amount).toBe("1.00");
  });

  it("supports 8-decimal unit prices exactly", () => {
    expect(
      multiplyMoney({ amount: "0.00000001", currency: "EUR" }, "3", {
        rounding: "HALF_UP",
        exponent: 8,
        policyVersion: "q1",
      }).amount,
    ).toBe("0.00000003");
  });

  it("refuses zero, negative and malformed quantities", () => {
    const unit = { amount: "10.00", currency: "EUR" };
    expect(codeOf(() => multiplyMoney(unit, "0", HALF_UP_2))).toBe("QUANTITY_INVALID");
    expect(codeOf(() => multiplyMoney(unit, "-1", HALF_UP_2))).toBe("QUANTITY_INVALID");
    expect(codeOf(() => multiplyMoney(unit, "2,5", HALF_UP_2))).toBe("QUANTITY_INVALID");
    expect(codeOf(() => multiplyMoney(unit, "1e3", HALF_UP_2))).toBe("QUANTITY_INVALID");
  });

  it("refuses an unsupported rounding policy", () => {
    expect(
      codeOf(() =>
        multiplyMoney({ amount: "10.00", currency: "EUR" }, "2", {
          rounding: "BANKERS",
          exponent: 2,
          policyVersion: "q1",
        } as never),
      ),
    ).toBe("ROUNDING_UNSUPPORTED");
  });
});

describe("discounts", () => {
  it("applies basis points deterministically", () => {
    expect(
      applyDiscountBasisPoints({ amount: "100.00", currency: "EUR" }, 1500, HALF_UP_2).amount,
    ).toBe("85.00");
  });

  it("rejects a discount outside 0..100%", () => {
    expect(
      codeOf(() =>
        applyDiscountBasisPoints({ amount: "100.00", currency: "EUR" }, 10_001, HALF_UP_2),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() =>
        applyDiscountBasisPoints({ amount: "100.00", currency: "EUR" }, -1, HALF_UP_2),
      ),
    ).toBe("VALIDATION_FAILED");
  });

  it("refuses an unsupported rounding policy instead of crashing", () => {
    expect(
      codeOf(() =>
        applyDiscountBasisPoints({ amount: "100.00", currency: "EUR" }, 500, {
          rounding: "BANKERS",
          exponent: 2,
          policyVersion: "q1",
        } as never),
      ),
    ).toBe("ROUNDING_UNSUPPORTED");
  });

  it("rounds only at the end of the calculus", () => {
    const discounted = applyDiscountBasisPoints(
      { amount: "0.03", currency: "EUR" },
      3333,
      HALF_UP_2,
    );
    expect(discounted.amount).toBe("0.02");
    expect(roundMoney({ amount: "0.005", currency: "EUR" }, HALF_UP_2).amount).toBe("0.01");
  });
});
