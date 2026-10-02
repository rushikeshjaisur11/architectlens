import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCENES } from "../components/anim/scenes";

const root = path.resolve(__dirname, "../content");
const strip = (s: string) => s.replace(/^\d+-/, "");

const lessons: { key: string; placeholder: boolean }[] = [];
for (const track of fs.readdirSync(root)) {
  for (const cat of fs.readdirSync(path.join(root, track))) {
    const dir = path.join(root, track, cat);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      lessons.push({ key: `${track}/${strip(cat)}/${strip(file.replace(/\.md$/, ""))}`, placeholder: /data-anim="/.test(text) });
    }
  }
}

describe("lesson animation coverage", () => {
  it("every lesson has a scene or an explicit animation placeholder", () => {
    const missing = lessons.filter((l) => !l.placeholder && !SCENES[l.key]).map((l) => l.key);
    expect(missing).toEqual([]);
  });

  it("every scene belongs to an existing lesson", () => {
    const keys = new Set(lessons.map((l) => l.key));
    const orphans = Object.keys(SCENES).filter((k) => !keys.has(k));
    expect(orphans).toEqual([]);
  });
});
