import { describe, expect, it } from "vitest";
import { runAll } from "./agentLoopLogic";

describe("agent loop stop reasons", () => {
  it("stops correctly with and without guards", () => {
    expect(runAll({ toolFails: false, maxSteps: null, detectLoops: false }).stop).toBe("done");
    expect(runAll({ toolFails: true, maxSteps: null, detectLoops: false }).stop).toBe("budget");
    const capped = runAll({ toolFails: true, maxSteps: 5, detectLoops: false });
    expect([capped.stop, capped.entries.length]).toEqual(["max_steps", 5]);
    const looped = runAll({ toolFails: true, maxSteps: 12, detectLoops: true });
    expect([looped.stop, looped.entries.length]).toEqual(["loop_detected", 2]);
    expect(runAll({ toolFails: false, maxSteps: 3, detectLoops: true }).stop).toBe("done");
  });
});
