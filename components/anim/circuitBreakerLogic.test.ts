import { describe, expect, it } from "vitest";
import { COOLDOWN, THRESHOLD, initialBreaker, sendRequest, type Breaker } from "./circuitBreakerLogic";

const run = (b: Breaker, n: number, healthy: boolean, on = true) => {
  for (let i = 0; i < n; i++) b = sendRequest(b, healthy, on);
  return b;
};

describe("circuit breaker", () => {
  it("opens after N failures, fast-fails, probes half-open, then closes or re-opens", () => {
    let b = run(initialBreaker(), THRESHOLD, false);
    expect(b.mode).toBe("open");
    b = run(b, COOLDOWN, false);
    expect(b.mode).toBe("half-open");
    expect(b.fastFailed).toBe(COOLDOWN);
    expect(b.reached).toBe(THRESHOLD);
    expect(sendRequest(b, false, true).mode).toBe("open"); // failed probe
    const closed = sendRequest(b, true, true); // good probe
    expect(closed.mode).toBe("closed");
    expect(closed.fails).toBe(0);
  });
  it("without a breaker every call reaches the downstream", () => {
    const b = run(initialBreaker(), 10, false, false);
    expect(b.reached).toBe(10);
    expect(b.fastFailed).toBe(0);
  });
});
