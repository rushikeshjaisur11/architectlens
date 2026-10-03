import { describe, expect, it } from "vitest";
import { latencyMultiplier, mmc } from "./littlesLawLogic";

describe("littles law logic", () => {
  it("M/M/1 time in system is 1/(mu-lambda) and Little's Law holds", () => {
    const s = mmc(70, 100, 1);
    if (!s.stable) throw new Error("expected stable");
    expect(s.w).toBeCloseTo(1 / 30, 9);
    expect(s.l).toBeCloseTo(70 / 30, 9);
  });

  it("flags unstable at or above capacity", () => {
    expect(mmc(100, 100, 1).stable).toBe(false);
    expect(mmc(250, 100, 2).stable).toBe(false);
  });

  it("70% -> 95% multiplies latency 6x on one server", () => {
    expect(latencyMultiplier(0.95, 100, 1) / latencyMultiplier(0.7, 100, 1)).toBeCloseTo(6, 6);
  });
});
