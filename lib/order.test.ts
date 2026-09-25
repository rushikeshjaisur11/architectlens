import { describe, expect, it } from "vitest";
import { order } from "./order";

describe("order", () => {
  it("parses the numeric prefix from a filename", () => {
    expect(order("07-rate-limiting.md")).toBe(7);
  });

  it("returns a finite sentinel for a filename with no numeric prefix", () => {
    const result = order("system-design-roadmap.md");
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(Number.MAX_SAFE_INTEGER);
  });
});
