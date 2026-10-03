import { describe, expect, it } from "vitest";
import { applyDiscount, evaluateCoupon, normaliseCode, type Coupon } from "./coupons";

const now = new Date("2026-06-01T00:00:00Z");
const base: Coupon = {
  kind: "percent", value: 20, currency: null, description: "d", maxRedemptions: null,
  redeemedCount: 0, validFrom: null, validUntil: null, active: true,
};

describe("normaliseCode", () => {
  it("trims, uppercases and strips inner spaces", () => expect(normaliseCode("  early bird-1 ")).toBe("EARLYBIRD-1"));
  it("rejects bad characters and lengths", () => {
    for (const bad of ["ab", "x".repeat(41), "a$b", ""]) expect(normaliseCode(bad)).toBeNull();
  });
});

describe("evaluateCoupon", () => {
  it("accepts a valid coupon", () => expect(evaluateCoupon(base, now)).toMatchObject({ ok: true, kind: "percent", value: 20 }));
  it("reports each failure reason", () => {
    expect(evaluateCoupon(null, now)).toEqual({ ok: false, reason: "not_found" });
    expect(evaluateCoupon({ ...base, active: false }, now)).toEqual({ ok: false, reason: "inactive" });
    expect(evaluateCoupon({ ...base, validFrom: new Date("2026-07-01") }, now)).toEqual({ ok: false, reason: "not_started" });
    expect(evaluateCoupon({ ...base, validUntil: new Date("2026-05-01") }, now)).toEqual({ ok: false, reason: "expired" });
    expect(evaluateCoupon({ ...base, maxRedemptions: 5, redeemedCount: 5 }, now)).toEqual({ ok: false, reason: "exhausted" });
    expect(evaluateCoupon(base, now, true)).toEqual({ ok: false, reason: "already_redeemed" });
  });
});

describe("applyDiscount", () => {
  it("applies percent, fixed and free_access, clamped at 0", () => {
    expect(applyDiscount(1000, { kind: "percent", value: 25 })).toBe(750);
    expect(applyDiscount(1000, { kind: "fixed", value: 300 })).toBe(700);
    expect(applyDiscount(1000, { kind: "fixed", value: 5000 })).toBe(0);
    expect(applyDiscount(1000, { kind: "free_access", value: 0 })).toBe(0);
  });
});
