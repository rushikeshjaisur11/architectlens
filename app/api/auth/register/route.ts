import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, isValidEmail, normaliseEmail, passwordProblem } from "@/lib/password";
import { clientIp, throttled } from "@/lib/throttle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) return fail("Accounts are not available yet", 503);
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? normaliseEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!isValidEmail(email)) return fail("Enter a valid email address", 400);
  const problem = passwordProblem(password);
  if (problem) return fail(problem, 400);
  if (await throttled([`register-ip:${clientIp(req)}`, `register-email:${email}`])) {
    return fail("Too many attempts. Try again in a few minutes", 429);
  }
  const inserted = await getDb()
    .insert(users)
    .values({ email, name: name || null, passwordHash: await hashPassword(password) })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (inserted.length === 0) return fail("Could not create an account with those details", 409);
  return Response.json({ ok: true }, { status: 201 });
}
