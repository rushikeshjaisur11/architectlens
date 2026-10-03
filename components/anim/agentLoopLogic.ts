export type StopReason = "done" | "max_steps" | "loop_detected" | "budget";
export type Config = { toolFails: boolean; maxSteps: number | null; detectLoops: boolean };
export type Entry = { n: number; thought: string; call: string | null; observation: string; inTokens: number };
export type Run = { entries: Entry[]; stop: StopReason | null };

export const BASE_TOKENS = 600; // system prompt + tools + task
export const STEP_TOKENS = 250; // thought + call + observation appended per step
export const BUDGET_TOKENS = 40000; // billing backstop, always on
export const USD_PER_1K = 0.01; // illustrative
export const REPEAT_LIMIT = 3; // identical call this many times in a row = loop

export const start = (): Run => ({ entries: [], stop: null });

// Each step re-sends the whole context, so input tokens grow linearly and total cost quadratically.
export const totalTokens = (r: Run) => r.entries.reduce((s, e) => s + e.inTokens, 0);
export const totalCost = (r: Run) => (totalTokens(r) / 1000) * USD_PER_1K;

// Scripted agent: working tool = get_order -> issue_refund -> answer. Failing tool = retries get_order forever.
function plan(r: Run, toolFails: boolean): Omit<Entry, "n" | "inTokens"> {
  const k = r.entries.length;
  if (toolFails) return { thought: "Lookup failed, retry it.", call: "get_order(4182)", observation: "ERROR: 503 timeout" };
  if (k === 0) return { thought: "Need the order first.", call: "get_order(4182)", observation: "order 4182, $40, delivered" };
  if (k === 1) return { thought: "Eligible, issue refund.", call: "issue_refund(4182, 40)", observation: "refund ok" };
  return { thought: "Refund done, tell the user.", call: null, observation: "final answer sent" };
}

export function step(r: Run, c: Config): Run {
  if (r.stop) return r;
  const n = r.entries.length;
  const next = plan(r, c.toolFails);
  const tail = r.entries.slice(-(REPEAT_LIMIT - 1));
  const repeated = tail.length === REPEAT_LIMIT - 1 && tail.every((e) => e.call === next.call);
  if (c.maxSteps !== null && n >= c.maxSteps) return { ...r, stop: "max_steps" };
  if (c.detectLoops && repeated) return { ...r, stop: "loop_detected" };
  const inTokens = BASE_TOKENS + STEP_TOKENS * n;
  const out: Run = { entries: [...r.entries, { n: n + 1, ...next, inTokens }], stop: null };
  if (next.call === null) out.stop = "done";
  else if (totalTokens(out) >= BUDGET_TOKENS) out.stop = "budget";
  return out;
}

export function runAll(c: Config): Run {
  let r = start();
  while (!r.stop) r = step(r, c);
  return r;
}
