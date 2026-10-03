import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { parsePreferences } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const [row] = await getDb()
    .select({ theme: userPreferences.theme, textSize: userPreferences.textSize })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return Response.json({ theme: row?.theme ?? null, textSize: row?.textSize ?? null });
}

export async function PUT(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const prefs = parsePreferences(await req.json().catch(() => null));
  if (!prefs) return Response.json({ error: "invalid body" }, { status: 400 });
  await getDb()
    .insert(userPreferences)
    .values({ userId, ...prefs })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { ...prefs, updatedAt: new Date() } });
  return Response.json({ ok: true });
}
