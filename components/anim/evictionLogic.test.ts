import { describe, expect, it } from "vitest";
import { PRESETS, access, run } from "./evictionLogic";

describe("hot key + scan", () => {
  it("LFU keeps A and hits it at the end, LRU evicted it and misses", () => {
    const keys = PRESETS["hot key + scan"];
    const before = keys.slice(0, -1);
    expect(access(run("LFU", before), "A").outcome.hit).toBe(true);
    expect(access(run("LRU", before), "A").outcome.hit).toBe(false);
  });
});
