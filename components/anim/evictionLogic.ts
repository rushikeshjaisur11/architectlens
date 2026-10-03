export type Policy = "LRU" | "LFU" | "FIFO";
export const CAPACITY = 4;
export const KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export type Slot = { key: string; last: number; freq: number; inserted: number };
export type Cache = { policy: Policy; slots: Slot[]; clock: number; hits: number; misses: number };
export type Outcome = { key: string; hit: boolean; evicted?: string; reason?: string };

export const initialCache = (policy: Policy): Cache => ({ policy, slots: [], clock: 0, hits: 0, misses: 0 });

function pickVictim(c: Cache): { slot: Slot; reason: string } {
  const by = (f: (s: Slot) => number[]) =>
    c.slots.reduce((a, b) => {
      const x = f(a), y = f(b);
      return x[0] < y[0] || (x[0] === y[0] && x[1] <= y[1]) ? a : b;
    });
  if (c.policy === "LRU") {
    const slot = by((s) => [s.last, 0]);
    return { slot, reason: `least recently used (last used at t=${slot.last})` };
  }
  if (c.policy === "LFU") {
    const slot = by((s) => [s.freq, s.last]);
    return { slot, reason: `lowest frequency ${slot.freq} (ties go to least recently used)` };
  }
  const slot = by((s) => [s.inserted, 0]);
  return { slot, reason: `first in (inserted at t=${slot.inserted}), hits do not matter` };
}

export function access(c: Cache, key: string): { cache: Cache; outcome: Outcome } {
  const t = c.clock + 1;
  const found = c.slots.find((s) => s.key === key);
  if (found) {
    const slots = c.slots.map((s) => (s === found ? { ...s, last: t, freq: s.freq + 1 } : s));
    return { cache: { ...c, slots, clock: t, hits: c.hits + 1 }, outcome: { key, hit: true } };
  }
  let slots = c.slots;
  let evicted: string | undefined;
  let reason: string | undefined;
  if (slots.length >= CAPACITY) {
    const v = pickVictim(c);
    slots = slots.filter((s) => s !== v.slot);
    evicted = v.slot.key;
    reason = v.reason;
  }
  slots = [...slots, { key, last: t, freq: 1, inserted: t }];
  return { cache: { ...c, slots, clock: t, misses: c.misses + 1 }, outcome: { key, hit: false, evicted, reason } };
}

export const PRESETS: Record<string, string[]> = {
  "hot key + scan": ["A", "A", "A", "A", "B", "C", "D", "E", "F", "G", "A"],
  "loop of 5 keys": ["A", "B", "C", "D", "E", "A", "B", "C", "D", "E", "A", "B", "C", "D", "E"],
};

export function run(policy: Policy, keys: string[]): Cache {
  return keys.reduce((c, k) => access(c, k).cache, initialCache(policy));
}
