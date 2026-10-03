export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const providers = [
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET && "github",
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && "google",
  ].filter((p): p is string => !!p);
  return Response.json({ database: !!process.env.DATABASE_URL, providers });
}
