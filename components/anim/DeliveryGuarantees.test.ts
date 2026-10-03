import { describe, expect, it } from "vitest";
import { deliver, START, TOTAL, type Fault, type Mode } from "./deliveryLogic";

function run(mode: Mode, fault: Fault) {
  let s = START;
  for (let i = 0; i < TOTAL; i++) s = deliver(s, mode, i === 2 ? fault : "none");
  return s;
}

describe("delivery guarantees", () => {
  it("at-most-once loses the crashed message, no duplicates", () => {
    const s = run("at-most-once", "crash");
    expect([s.lost, s.redelivered, s.charged]).toEqual([1, 0, 9]);
  });
  it("at-least-once double-charges on crash or dropped ack", () => {
    for (const f of ["crash", "dropAck"] as const) {
      const s = run("at-least-once", f);
      expect([s.lost, s.redelivered, s.charged]).toEqual([0, 1, 11]);
    }
  });
  it("exactly-once effect: redelivered but charged once", () => {
    const s = run("exactly-once", "crash");
    expect([s.lost, s.redelivered, s.charged]).toEqual([0, 1, 10]);
  });
});
