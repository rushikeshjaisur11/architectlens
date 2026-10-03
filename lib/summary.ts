function plain(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// First prose paragraph (skipping italic disclaimers, lists, code), trimmed to ~limit chars at a word boundary.
export function summarize(raw: string, limit = 170): string {
  const body = raw.replace(/^---[\s\S]*?\n---\s*/, "");
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|[-*+] |\d+\. |```|\||<|\*[^*]+\*$|_[^_]+_$)/.test(p));
  const text = plain(para ?? "");
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

export function readingMinutes(raw: string): number {
  const words = raw.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
