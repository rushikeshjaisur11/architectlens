import { describe, expect, it } from "vitest";
import { buildPrompt, commonPrefix, totalTokens, type Order } from "./prefixCacheLogic";

describe("prefix caching", () => {
  it("stable-first hits high, a leading timestamp hits ~0", () => {
    const ratio = (ts: boolean, order: Order = "stable-first") => {
      const a = buildPrompt(order, ts, 1);
      const b = buildPrompt(order, ts, 2);
      return commonPrefix(a, b).tokens / totalTokens(b);
    };
    expect(ratio(false)).toBeGreaterThan(0.9);
    expect(ratio(true)).toBe(0);
    expect(ratio(false, "volatile-first")).toBe(0);
  });
});
