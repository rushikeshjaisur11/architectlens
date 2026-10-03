import { describe, expect, it } from "vitest";
import { MAX_KEYS, parseKeys, parsePreferences, parseQuizAnswer } from "./validate";

const valid = new Set(["a/b/c", "a/b/d"]);

describe("parseKeys", () => {
  it("accepts known keys and dedupes", () => {
    expect(parseKeys({ keys: ["a/b/c", "a/b/c", "a/b/d"] }, valid)).toEqual(["a/b/c", "a/b/d"]);
  });
  it("rejects bad shapes, unknown keys, empty and oversized lists", () => {
    expect(parseKeys(null, valid)).toBeNull();
    expect(parseKeys({ keys: "a/b/c" }, valid)).toBeNull();
    expect(parseKeys({ keys: [] }, valid)).toBeNull();
    expect(parseKeys({ keys: ["nope"] }, valid)).toBeNull();
    expect(parseKeys({ keys: [1] }, valid)).toBeNull();
    expect(parseKeys({ keys: Array(MAX_KEYS + 1).fill("a/b/c") }, valid)).toBeNull();
  });
});

describe("parseQuizAnswer", () => {
  const ok = { lessonKey: "a/b/c", kind: "check", questionIndex: 2, correct: true };
  it("accepts a valid answer", () => expect(parseQuizAnswer(ok, valid)).toEqual(ok));
  it("rejects invalid fields", () => {
    expect(parseQuizAnswer({ ...ok, lessonKey: "x" }, valid)).toBeNull();
    expect(parseQuizAnswer({ ...ok, kind: "other" }, valid)).toBeNull();
    expect(parseQuizAnswer({ ...ok, questionIndex: -1 }, valid)).toBeNull();
    expect(parseQuizAnswer({ ...ok, questionIndex: 1.5 }, valid)).toBeNull();
    expect(parseQuizAnswer({ ...ok, correct: "yes" }, valid)).toBeNull();
    expect(parseQuizAnswer([], valid)).toBeNull();
  });
});

describe("parsePreferences", () => {
  it("accepts partial updates", () => {
    expect(parsePreferences({ theme: "sepia" })).toEqual({ theme: "sepia" });
    expect(parsePreferences({ textSize: "lg", theme: "dark" })).toEqual({ theme: "dark", textSize: "lg" });
  });
  it("rejects empty, unknown values and non-objects", () => {
    expect(parsePreferences({})).toBeNull();
    expect(parsePreferences({ theme: "pink" })).toBeNull();
    expect(parsePreferences({ textSize: "xl" })).toBeNull();
    expect(parsePreferences("dark")).toBeNull();
  });
});
