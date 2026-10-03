import { describe, expect, it } from "vitest";
import { composite, nines } from "./availabilityLogic";

describe("availability math", () => {
  it("series multiplies, parallel redundancy improves", () => {
    expect(composite("series", [0.999, 0.999, 0.999])).toBeCloseTo(0.997, 3);
    expect(composite("parallel", [0.99, 0.99])).toBeCloseTo(0.9999, 6);
    expect(nines(0.9999)).toBeCloseTo(4, 6);
  });
});
