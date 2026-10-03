import { describe, expect, it } from "vitest";
import { heal, initialCap, read, togglePartition, write } from "./capLogic";

describe("cap", () => {
  it("CP errors during a partition", () => {
    const s = togglePartition(initialCap("CP")).state;
    expect(write(s, 0, 2).ok).toBe(false);
    expect(read(s, 1).ok).toBe(false);
  });
  it("AP diverges, then LWW loses a write on heal", () => {
    let s = togglePartition(initialCap("AP")).state;
    s = write(s, 0, 2).state;
    s = write(s, 1, 3).state;
    expect(read(s, 0).msg).toContain("x=2");
    expect(read(s, 1).msg).toContain("x=3");
    const h = heal(s);
    expect(h.state.nodes[0].v).toBe(3);
    expect(h.msg).toContain("lost");
  });
});
