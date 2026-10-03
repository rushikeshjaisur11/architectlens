export type Mode = "closed" | "open" | "half-open";
export type Outcome = "ok" | "failed" | "fast-failed";
export type Breaker = {
  mode: Mode;
  fails: number; // consecutive failures while closed
  cooldown: number; // requests left to wait while open
  reached: number; // calls that hit the downstream
  failedReached: number; // of those, calls that failed
  fastFailed: number; // calls rejected by the breaker (downstream calls saved)
  last: Outcome | null;
};

export const THRESHOLD = 3;
export const COOLDOWN = 4;

export const initialBreaker = (): Breaker => ({ mode: "closed", fails: 0, cooldown: 0, reached: 0, failedReached: 0, fastFailed: 0, last: null });

// One request = one step. Without a breaker every call reaches the downstream.
export function sendRequest(b: Breaker, healthy: boolean, withBreaker: boolean): Breaker {
  if (withBreaker && b.mode === "open") {
    const cooldown = b.cooldown - 1;
    return { ...b, fastFailed: b.fastFailed + 1, last: "fast-failed", cooldown, mode: cooldown === 0 ? "half-open" : "open" };
  }
  const reached = b.reached + 1;
  const failedReached = b.failedReached + (healthy ? 0 : 1);
  const last: Outcome = healthy ? "ok" : "failed";
  if (!withBreaker) return { ...b, reached, failedReached, last };
  if (b.mode === "half-open") {
    // probe: success closes, failure re-opens with a fresh cooldown
    return healthy
      ? { ...b, mode: "closed", fails: 0, reached, failedReached, last }
      : { ...b, mode: "open", cooldown: COOLDOWN, reached, failedReached, last };
  }
  const fails = healthy ? 0 : b.fails + 1;
  return fails >= THRESHOLD
    ? { ...b, mode: "open", fails, cooldown: COOLDOWN, reached, failedReached, last }
    : { ...b, fails, reached, failedReached, last };
}
