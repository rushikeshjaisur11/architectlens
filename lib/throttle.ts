import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { authAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 10;

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** Records an attempt for each key; true when any key already hit the limit. */
export async function throttled(keys: string[]) {
  const db = getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  let blocked = false;
  for (const key of keys) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(authAttempts)
      .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, since)));
    if (n >= LIMIT) blocked = true;
    else await db.insert(authAttempts).values({ key });
  }
  return blocked;
}
