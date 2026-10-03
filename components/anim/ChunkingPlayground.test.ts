import { describe, expect, it } from "vitest";
import { DOC, answerIntact, chunkDoc } from "./chunkingLogic";

describe("chunkDoc", () => {
  it("fixed-size cuts the answer at a small size, sentence-aware keeps it", () => {
    expect(answerIntact(chunkDoc(DOC, "fixed-size", 40, 0))).toBe(false);
    expect(answerIntact(chunkDoc(DOC, "sentence-aware", 40, 0))).toBe(true);
    expect(answerIntact(chunkDoc(DOC, "fixed-size", 120, 40))).toBe(true);
  });
});
