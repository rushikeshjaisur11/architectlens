import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { couponRedemptions, coupons } from "@/db/schema";
import { evaluateCoupon, normaliseCode } from "@/lib/coupons";
import { clientIp, throttled } from "@/lib/throttle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) return Response.json({ error: "unavailable" }, { status: 503 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? normaliseCode(body.code) : null;
  if (!code) return Response.json({ valid: false, reason: "not_found" });
  if (await throttled([`coupon:${clientIp(req)}`])) return Response.json({ error: "rate limited" }, { status: 429 });

  const db = getDb();
  const userId = (await auth())?.user?.id;
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  const redeemed =
    !!userId &&
    !!coupon &&
    (await db.select().from(couponRedemptions).where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.userId, userId))).limit(1)).length > 0;
  const result = evaluateCoupon(coupon, new Date(), redeemed);
  if (result.ok && result.kind === "free_access" && !userId) return Response.json({ valid: false, reason: "not_found" });
  return Response.json(
    result.ok
      ? { valid: true, kind: result.kind, value: result.value, currency: result.currency, description: result.description }
      : { valid: false, reason: result.reason },
  );
}
