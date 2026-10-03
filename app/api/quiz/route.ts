import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { quizResults } from "@/db/schema";
import { lessonKeys } from "@/lib/lesson-keys";
import { parseQuizAnswer } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const results = await getDb()
    .select({
      lessonKey: quizResults.lessonKey,
      kind: quizResults.kind,
      questionIndex: quizResults.questionIndex,
      correct: quizResults.correct,
      answeredAt: quizResults.answeredAt,
    })
    .from(quizResults)
    .where(eq(quizResults.userId, userId));
  return Response.json({ results });
}

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) return unauthorized();
  const answer = parseQuizAnswer(await req.json().catch(() => null), lessonKeys);
  if (!answer) return Response.json({ error: "invalid body" }, { status: 400 });
  await getDb()
    .insert(quizResults)
    .values({ userId, ...answer })
    .onConflictDoUpdate({
      target: [quizResults.userId, quizResults.lessonKey, quizResults.kind, quizResults.questionIndex],
      set: { correct: answer.correct, answeredAt: new Date() },
    });
  return Response.json({ ok: true });
}
