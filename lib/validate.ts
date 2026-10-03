export const THEMES = ["light", "dark", "black", "sepia"] as const;
export const TEXT_SIZES = ["sm", "md", "lg"] as const;
export const QUIZ_KINDS = ["predict", "check"] as const;
export const MAX_KEYS = 400;
const MAX_QUESTION_INDEX = 99;

export type Theme = (typeof THEMES)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type QuizAnswer = { lessonKey: string; kind: (typeof QUIZ_KINDS)[number]; questionIndex: number; correct: boolean };

function obj(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export function parseKeys(body: unknown, valid: Set<string>): string[] | null {
  const keys = obj(body)?.keys;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_KEYS) return null;
  if (!keys.every((k) => typeof k === "string" && valid.has(k))) return null;
  return [...new Set(keys as string[])];
}

export function parseQuizAnswer(body: unknown, valid: Set<string>): QuizAnswer | null {
  const b = obj(body);
  if (!b) return null;
  const { lessonKey, kind, questionIndex, correct } = b;
  if (typeof lessonKey !== "string" || !valid.has(lessonKey)) return null;
  if (!QUIZ_KINDS.includes(kind as QuizAnswer["kind"])) return null;
  if (!Number.isInteger(questionIndex) || (questionIndex as number) < 0 || (questionIndex as number) > MAX_QUESTION_INDEX) return null;
  if (typeof correct !== "boolean") return null;
  return { lessonKey, kind: kind as QuizAnswer["kind"], questionIndex: questionIndex as number, correct };
}

export function parsePreferences(body: unknown): { theme?: Theme; textSize?: TextSize } | null {
  const b = obj(body);
  if (!b) return null;
  const { theme, textSize } = b;
  if (theme !== undefined && !THEMES.includes(theme as Theme)) return null;
  if (textSize !== undefined && !TEXT_SIZES.includes(textSize as TextSize)) return null;
  if (theme === undefined && textSize === undefined) return null;
  return { ...(theme !== undefined && { theme: theme as Theme }), ...(textSize !== undefined && { textSize: textSize as TextSize }) };
}
