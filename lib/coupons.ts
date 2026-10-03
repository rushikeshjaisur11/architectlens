export type CouponKind = "percent" | "fixed" | "free_access";

export type Coupon = {
  kind: CouponKind;
  value: number;
  currency: string | null;
  description: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
};

export type CouponReason = "not_found" | "inactive" | "not_started" | "expired" | "exhausted" | "already_redeemed";

export type CouponResult =
  | { ok: true; kind: CouponKind; value: number; currency: string | null; description: string | null }
  | { ok: false; reason: CouponReason };

export function normaliseCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9_-]{3,40}$/.test(code) ? code : null;
}

export function evaluateCoupon(coupon: Coupon | null | undefined, now: Date, alreadyRedeemed = false): CouponResult {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.active) return { ok: false, reason: "inactive" };
  if (coupon.validFrom && now < coupon.validFrom) return { ok: false, reason: "not_started" };
  if (coupon.validUntil && now > coupon.validUntil) return { ok: false, reason: "expired" };
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) return { ok: false, reason: "exhausted" };
  if (alreadyRedeemed) return { ok: false, reason: "already_redeemed" };
  const { kind, value, currency, description } = coupon;
  return { ok: true, kind, value, currency, description };
}

export function applyDiscount(priceMinor: number, coupon: Pick<Coupon, "kind" | "value">): number {
  const off =
    coupon.kind === "percent" ? Math.round((priceMinor * coupon.value) / 100) : coupon.kind === "fixed" ? coupon.value : priceMinor;
  return Math.max(0, priceMinor - off);
}
