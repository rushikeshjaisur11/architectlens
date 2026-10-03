import { describe, expect, it } from "vitest";
import { evaluate, weightGB } from "./quantizationLogic";

describe("quantization memory", () => {
  it("70B weights scale with precision", () => {
    expect(weightGB(70, "FP16")).toBe(140);
    expect(weightGB(70, "INT4")).toBe(35);
  });
  it("fit results", () => {
    expect(evaluate(70, "INT4", 80).fits).toBe(true);
    expect(evaluate(70, "INT4", 24).fits).toBe(false);
    expect(evaluate(70, "FP16", 80).gpus).toBe(2);
  });
});
