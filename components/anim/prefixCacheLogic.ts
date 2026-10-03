export type Order = "stable-first" | "volatile-first";
export type Block = { id: string; label: string; tokens: number; key: string };

// Illustrative sizes (assumptions, not from the lesson).
export const TOKENS = { timestamp: 20, system: 1200, tools: 800, docs: 3000, question: 50 };
export const DEFAULT_DISCOUNT = 0.1; // lesson: cache reads at 0.1x base input price

// Request n: question and timestamp change every request; everything else is identical.
export function buildPrompt(order: Order, timestamp: boolean, n: number): Block[] {
  const system: Block = { id: "system", label: "System prompt", tokens: TOKENS.system, key: "system" };
  const tools: Block = { id: "tools", label: "Tool definitions", tokens: TOKENS.tools, key: "tools" };
  const docs: Block = { id: "docs", label: "Retrieved docs", tokens: TOKENS.docs, key: "docs" };
  const question: Block = { id: "question", label: "User question", tokens: TOKENS.question, key: `q${n}` };
  const stamp: Block = { id: "timestamp", label: "Timestamp", tokens: TOKENS.timestamp, key: `t${n}` };
  const body = order === "stable-first" ? [system, tools, docs, question] : [question, system, tools, docs];
  return timestamp ? [stamp, ...body] : body;
}

// Prefix caching: reuse stops at the first block that differs from the previous request.
export function commonPrefix(prev: Block[] | null, cur: Block[]): { blocks: number; tokens: number } {
  let blocks = 0;
  let tokens = 0;
  while (prev && blocks < cur.length && blocks < prev.length && prev[blocks].key === cur[blocks].key) {
    tokens += cur[blocks].tokens;
    blocks++;
  }
  return { blocks, tokens };
}

export const totalTokens = (b: Block[]) => b.reduce((s, x) => s + x.tokens, 0);

// Relative input cost (and prefill time, assuming it scales with tokens computed): uncached = 1.
export function relativeCost(cached: number, total: number, discount: number): number {
  return (total - cached + cached * discount) / total;
}
