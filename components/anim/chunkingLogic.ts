export type ChunkStrategy = "fixed-size" | "sentence-aware";
export type Span = { start: number; end: number };

export const DOC =
  "Acme Cloud sells storage plans to small teams. Every plan includes daily backups. " +
  "Customers may request a refund within 30 days of purchase. Refunds go to the original payment method. " +
  "Support is available on weekdays. Enterprise plans add a dedicated manager. " +
  "Invoices are sent on the first of each month. Prices are listed in US dollars.";
export const QUESTION = "How long do customers have to request a refund?";
export const ANSWER = "within 30 days of purchase";
export const ANSWER_SPAN: Span = { start: DOC.indexOf(ANSWER), end: DOC.indexOf(ANSWER) + ANSWER.length };

export function chunkDoc(text: string, strategy: ChunkStrategy, size: number, overlap: number): Span[] {
  if (strategy === "fixed-size") {
    const step = Math.max(1, size - overlap);
    const out: Span[] = [];
    for (let s = 0; s < text.length; s += step) {
      out.push({ start: s, end: Math.min(s + size, text.length) });
      if (s + size >= text.length) break;
    }
    return out;
  }
  const sents = [...text.matchAll(/[^.]+\./g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  const out: Span[] = [];
  let i = 0;
  while (i < sents.length) {
    let j = i;
    while (j + 1 < sents.length && sents[j + 1].end - sents[i].start <= size) j++;
    out.push({ start: sents[i].start, end: sents[j].end });
    if (j + 1 >= sents.length) break;
    let next = j + 1;
    while (next - 1 > i && sents[j].end - sents[next - 1].start <= overlap) next--;
    i = next;
  }
  return out;
}

export const answerIntact = (chunks: Span[]) => chunks.some((c) => c.start <= ANSWER_SPAN.start && c.end >= ANSWER_SPAN.end);
