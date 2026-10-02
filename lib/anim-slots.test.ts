import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ANIMATION_NAMES } from "../components/anim/names";

function markdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

const used: { file: string; name: string }[] = [];
for (const file of markdownFiles(path.resolve(__dirname, "../content"))) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/data-anim="([^"]+)"/g)) {
    used.push({ file: path.relative(process.cwd(), file), name: match[1] });
  }
}

describe("lesson animation placeholders", () => {
  it("only reference registered animations", () => {
    const unknown = used.filter((u) => !(ANIMATION_NAMES as readonly string[]).includes(u.name));
    expect(unknown).toEqual([]);
  });

  it("use every registered animation at least once", () => {
    const usedNames = new Set(used.map((u) => u.name));
    const unused = ANIMATION_NAMES.filter((name) => !usedNames.has(name));
    expect(unused).toEqual([]);
  });
});
