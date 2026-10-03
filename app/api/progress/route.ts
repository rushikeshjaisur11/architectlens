import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { lessonProgress } from "@/db/schema";
import { lessonKeys } from "@/lib/lesson-keys";
import { parseKeys } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const rows = await getDb().select({ key: lessonProgress.lessonKey }).from(lessonProgress).where(eq(lessonProgress.userId, userId));
  return Response.json({ read: rows.map((r) => r.key).filter((k) => lessonKeys.has(k)) });
}

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const keys = parseKeys(await req.json().catch(() => null), lessonKeys);
  if (!keys) return Response.json({ error: "invalid body" }, { status: 400 });
  await getDb()
    .insert(lessonProgress)
    .values(keys.map((lessonKey) => ({ userId, lessonKey })))
    .onConflictDoNothing();
  return Response.json({ ok: true, count: keys.length });
}
