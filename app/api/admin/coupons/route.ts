import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { coupons } from "@/db/schema";
import { normaliseCode } from "@/lib/coupons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = ["percent", "fixed", "free_access"] as const;
const bad = (error: string) => Response.json({ error }, { status: 400 });
const forbidden = () => Response.json({ error: "forbidden" }, { status: 403 });

async function adminEmail() {
  const email = (await auth())?.user?.email?.toLowerCase();
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return email && admins.includes(email) ? email : null;
}

// Optional-field parsers: null when absent, undefined when present but invalid.
function optInt(v: unknown, min: number, max: number) {
  if (v === undefined || v === null) return null;
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined;
}

function optDate(v: unknown) {
  if (v === undefined || v === null) return null;
  const d = typeof v === "string" ? new Date(v) : undefined;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

function optText(v: unknown, max: number) {
  if (v === undefined || v === null) return null;
  return typeof v === "string" && v.length <= max ? v : undefined;
}

export async function GET() {
  if (!(await adminEmail())) return forbidden();
  return Response.json({ coupons: await getDb().select().from(coupons).orderBy(coupons.createdAt) });
}

export async function POST(req: Request) {
  const admin = await adminEmail();
  if (!admin) return forbidden();
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return bad("invalid body");

  const code = typeof b.code === "string" ? normaliseCode(b.code) : null;
  if (!code) return bad("code must be 3-40 characters of A-Z, 0-9, - or _");
  if (!KINDS.includes(b.kind)) return bad("kind must be percent, fixed or free_access");
  const value = b.kind === "free_access" ? 0 : optInt(b.value, 1, b.kind === "percent" ? 100 : 100_000_000);
  if (value === undefined || value === null) {
    return bad(b.kind === "percent" ? "value must be an integer 1-100" : "value must be a positive integer in minor units");
  }
  const currency = optText(b.currency, 3);
  if (currency === undefined || (b.kind === "fixed" && currency?.length !== 3)) return bad("fixed coupons need a 3-letter currency");
  const maxRedemptions = optInt(b.maxRedemptions, 1, 1_000_000_000);
  const grantDays = optInt(b.grantDays, 1, 3650);
  const grantsPlan = optText(b.grantsPlan, 40);
  const description = optText(b.description, 200);
  const validFrom = optDate(b.validFrom);
  const validUntil = optDate(b.validUntil);
  if ([maxRedemptions, grantDays, grantsPlan, description, validFrom, validUntil].includes(undefined as never)) return bad("invalid optional field");
  if (validFrom && validUntil && validUntil <= validFrom) return bad("validUntil must be after validFrom");

  const inserted = await getDb()
    .insert(coupons)
    .values({
      code,
      kind: b.kind,
      value,
      currency: currency?.toUpperCase() ?? null,
      maxRedemptions,
      grantDays,
      grantsPlan,
      description,
      validFrom,
      validUntil,
      createdBy: admin,
    })
    .onConflictDoNothing({ target: coupons.code })
    .returning();
  if (inserted.length === 0) return Response.json({ error: "code already exists" }, { status: 409 });
  return Response.json({ coupon: inserted[0] }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await adminEmail())) return forbidden();
  const b = await req.json().catch(() => null);
  const code = typeof b?.code === "string" ? normaliseCode(b.code) : null;
  if (!code) return bad("code required");

  const set: Partial<typeof coupons.$inferInsert> = {};
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") return bad("active must be boolean");
    set.active = b.active;
  }
  for (const [field, parse] of [
    ["maxRedemptions", (v: unknown) => optInt(v, 1, 1_000_000_000)],
    ["validFrom", optDate],
    ["validUntil", optDate],
    ["description", (v: unknown) => optText(v, 200)],
  ] as const) {
    if (b[field] === undefined) continue;
    const v = parse(b[field]);
    if (v === undefined) return bad(`invalid ${field}`);
    Object.assign(set, { [field]: v });
  }
  if (Object.keys(set).length === 0) return bad("nothing to update");

  const updated = await getDb().update(coupons).set(set).where(eq(coupons.code, code)).returning();
  if (updated.length === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ coupon: updated[0] });
}
