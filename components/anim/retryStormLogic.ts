export type Strategy = "none" | "immediate" | "backoff" | "jitter";

export type RoundResult = { round: number; capacity: number; fresh: number; retries: number; offered: number; served: number; failed: number };

export const CLIENTS = 1000;
export const CAPACITY = 1200;
export const OUTAGE = [2, 3];
export const MAX_RETRIES = 3;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rounds to wait before retry number (k+1), where k = retries already made.
function delay(strategy: Strategy, k: number, rand: () => number) {
  if (strategy === "immediate") return 1;
  if (strategy === "backoff") return 2 ** k;
  return 1 + Math.floor(rand() * 2 ** (k + 1)); // jitter: uniform in 1..2^(k+1)
}

// Every round CLIENTS fresh requests arrive. Retries queue by (round, retries made so far).
export function simulate(strategy: Strategy, rounds = 10, seed = 7): RoundResult[] {
  const rand = mulberry32(seed);
  const pending: number[][] = Array.from({ length: rounds + 20 }, () => Array(MAX_RETRIES + 1).fill(0));
  const out: RoundResult[] = [];
  for (let r = 0; r < rounds; r++) {
    pending[r][0] += CLIENTS;
    const capacity = OUTAGE.includes(r) ? 0 : CAPACITY;
    const offered = pending[r].reduce((s, n) => s + n, 0);
    const served = Math.min(offered, capacity);
    let toServe = served; // oldest requests (most retries) served first
    for (let k = MAX_RETRIES; k >= 0; k--) {
      const ok = Math.min(pending[r][k], toServe);
      toServe -= ok;
      const failed = pending[r][k] - ok;
      if (strategy === "none" || k === MAX_RETRIES) continue; // gives up
      for (let i = 0; i < failed; i++) pending[r + delay(strategy, k, rand)][k + 1]++;
    }
    const fresh = pending[r][0];
    out.push({ round: r, capacity, fresh, retries: offered - fresh, offered, served, failed: offered - served });
  }
  return out;
}

export const peakLoad = (rs: RoundResult[]) => Math.max(...rs.map((x) => x.offered));

// First round after the outage where nothing fails; null if not within the simulated rounds.
export function recoveryRound(rs: RoundResult[]) {
  const end = Math.max(...OUTAGE);
  return rs.find((x) => x.round > end && x.failed === 0)?.round ?? null;
}
