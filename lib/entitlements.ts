import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { entitlements } from "@/db/schema";

export function activeEntitlements(userId: string) {
  const now = new Date();
  return getDb()
    .select()
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), lte(entitlements.startsAt, now), or(isNull(entitlements.endsAt), gt(entitlements.endsAt, now))));
}

export async function hasActivePlan(userId: string, plan: string) {
  return (await activeEntitlements(userId)).some((e) => e.plan === plan);
}
