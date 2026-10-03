import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { couponRedemptions, coupons, entitlements } from "@/db/schema";
import { evaluateCoupon, normaliseCode } from "@/lib/coupons";
import { clientIp, throttled } from "@/lib/throttle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY_MS = 86_400_000;

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? normaliseCode(body.code) : null;
  if (!code) return Response.json({ ok: false, reason: "not_found" }, { status: 400 });
  if (await throttled([`coupon:${clientIp(req)}`, `coupon-user:${userId}`])) return Response.json({ error: "rate limited" }, { status: 429 });

  const db = getDb();
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  const [existing] = coupon
    ? await db.select().from(couponRedemptions).where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, userId))).limit(1)
    : [];
  const result = evaluateCoupon(coupon, new Date(), !!existing);
  if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: 400 });
  if (coupon.kind !== "free_access" && !coupon.grantsPlan) return Response.json({ ok: false, reason: "not_redeemable" }, { status: 400 });

  // neon-http has no interactive transactions: claim a slot atomically in one UPDATE, compensate if the insert loses a race.
  const claimed = await db
    .update(coupons)
    .set({ redeemedCount: sql`${coupons.redeemedCount} + 1` })
    .where(
      and(
        eq(coupons.id, coupon.id),
        eq(coupons.active, true),
        or(isNull(coupons.maxRedemptions), sql`${coupons.redeemedCount} < ${coupons.maxRedemptions}`),
        or(isNull(coupons.validFrom), lte(coupons.validFrom, sql`now()`)),
        or(isNull(coupons.validUntil), sql`${coupons.validUntil} >= now()`),
      ),
    )
    .returning({ id: coupons.id });
  if (claimed.length === 0) return Response.json({ ok: false, reason: "exhausted" }, { status: 400 });

  const inserted = await db.insert(couponRedemptions).values({ couponId: coupon.id, userId }).onConflictDoNothing().returning({ id: couponRedemptions.id });
  if (inserted.length === 0) {
    await db.update(coupons).set({ redeemedCount: sql`${coupons.redeemedCount} - 1` }).where(eq(coupons.id, coupon.id));
    return Response.json({ ok: false, reason: "already_redeemed" }, { status: 400 });
  }

  const plan = coupon.grantsPlan ?? "pro";
  const endsAt = coupon.grantDays ? new Date(Date.now() + coupon.grantDays * DAY_MS) : null;
  await db.insert(entitlements).values({ userId, plan, source: "coupon", couponId: coupon.id, endsAt });
  return Response.json({ ok: true, plan, endsAt });
}
