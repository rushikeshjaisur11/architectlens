import { auth } from "@/auth";
import { activeEntitlements } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const rows = await activeEntitlements(userId);
  return Response.json({ entitlements: rows.map(({ plan, source, startsAt, endsAt }) => ({ plan, source, startsAt, endsAt })) });
}
