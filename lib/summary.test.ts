import { describe, expect, it } from "vitest";
import { readingMinutes, summarize } from "./summary";

describe("summarize", () => {
  it("skips disclaimers and headings, returns first paragraph", () => {
    const md = "*Engineering patterns only.*\n\n## The problem\n\nClinicians **spend** hours on [notes](x).\n\nSecond.";
    expect(summarize(md)).toBe("Clinicians spend hours on notes.");
  });
  it("truncates at a word boundary", () => {
    expect(summarize("word ".repeat(100), 20)).toMatch(/^(word ){1,3}word…$|^word( word)*…$/);
  });
});

describe("readingMinutes", () => {
  it("is at least 1", () => expect(readingMinutes("a b c")).toBe(1));
  it("scales with words", () => expect(readingMinutes("w ".repeat(660))).toBe(3));
});
