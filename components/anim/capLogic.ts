export type Mode = "CP" | "AP";
export type Node = { v: number; ts: number };
export type Cap = { mode: Mode; partitioned: boolean; nodes: [Node, Node]; clock: number };
export type Op = { state: Cap; ok: boolean; msg: string };

const NAMES = ["A", "B"];

export function initialCap(mode: Mode = "CP"): Cap {
  return { mode, partitioned: false, nodes: [{ v: 1, ts: 0 }, { v: 1, ts: 0 }], clock: 0 };
}

// Two replicas: quorum = 2, so a partitioned node alone never has quorum.
export function write(s: Cap, i: 0 | 1, v: number): Op {
  if (!s.partitioned) {
    const ts = s.clock + 1;
    return { state: { ...s, clock: ts, nodes: [{ v, ts }, { v, ts }] }, ok: true, msg: `OK: x=${v} replicated to A and B.` };
  }
  if (s.mode === "CP") return { state: s, ok: false, msg: `ERROR: write to ${NAMES[i]} rejected, no quorum (unavailable).` };
  const ts = s.clock + 1;
  const nodes: [Node, Node] = [s.nodes[0], s.nodes[1]];
  nodes[i] = { v, ts };
  return { state: { ...s, clock: ts, nodes }, ok: true, msg: `OK: ${NAMES[i]} accepted x=${v}. B/A cannot see it.` };
}

export function read(s: Cap, i: 0 | 1): Op {
  if (s.partitioned && s.mode === "CP") return { state: s, ok: false, msg: `ERROR: read from ${NAMES[i]} refused, no quorum (unavailable).` };
  return { state: s, ok: true, msg: `OK: ${NAMES[i]} returned x=${s.nodes[i].v}.` };
}

// Heal the partition; AP reconciles with last-write-wins (higher ts).
export function heal(s: Cap): Op {
  const [a, b] = s.nodes;
  if (!s.partitioned) return { state: s, ok: true, msg: "Network already healthy." };
  const win = b.ts > a.ts ? b : a;
  const diverged = a.v !== b.v;
  const lost = diverged && a.ts > 0 && b.ts > 0 ? (win === a ? b : a) : null;
  const msg = lost
    ? `Healed. Last-write-wins kept x=${win.v}; the write x=${lost.v} is lost.`
    : "Healed. Replicas agree.";
  return { state: { ...s, partitioned: false, nodes: [{ ...win }, { ...win }] }, ok: true, msg };
}

export function togglePartition(s: Cap): Op {
  return s.partitioned ? heal(s) : { state: { ...s, partitioned: true }, ok: true, msg: "Partition: A and B cannot talk." };
}
