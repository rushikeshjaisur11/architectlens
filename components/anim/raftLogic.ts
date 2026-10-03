
export type Role = "follower" | "candidate" | "leader";
export type RaftNode = { up: boolean; term: number; votedFor: number | null; role: Role; votes: number };
export type Cluster = { nodes: RaftNode[]; partitioned: boolean; note: string };

export const N = 5;
const MAJORITY = Math.floor(N / 2) + 1;
export const MINORITY_IDS = [0, 1];

const node = (role: Role = "follower"): RaftNode => ({ up: true, term: 1, votedFor: 0, role, votes: role === "leader" ? N : 0 });

export function initialCluster(): Cluster {
  return {
    nodes: [node("leader"), node(), node(), node(), node()],
    partitioned: false,
    note: "Node 0 leads term 1 with 5 of 5 votes.",
  };
}

// Nodes that can talk to each other. A partition splits {0,1} from {2,3,4}.
function groups(c: Cluster): number[][] {
  const all = [0, 1, 2, 3, 4];
  return c.partitioned ? [MINORITY_IDS, all.filter((i) => !MINORITY_IDS.includes(i))] : [all];
}

// Within each connected group, adopt the highest term seen; stale leaders step down.
function settle(c: Cluster): Cluster {
  const nodes = c.nodes.map((n) => ({ ...n }));
  for (const g of groups(c)) {
    const live = g.filter((i) => nodes[i].up);
    const top = Math.max(0, ...live.map((i) => nodes[i].term));
    for (const i of live) {
      if (nodes[i].term < top) nodes[i] = { ...nodes[i], term: top, votedFor: null, role: "follower", votes: 0 };
    }
  }
  return { ...c, nodes };
}

function liveLeader(nodes: RaftNode[], group: number[]): boolean {
  return group.some((i) => nodes[i].up && nodes[i].role === "leader");
}

// One deterministic round: in every group with no live leader, its lowest-id live node times out and runs for election.
export function advanceTimeout(c: Cluster): Cluster {
  const nodes = c.nodes.map((n) => ({ ...n }));
  const notes: string[] = [];
  for (const g of groups(c)) {
    const live = g.filter((i) => nodes[i].up);
    if (live.length === 0 || liveLeader(nodes, g)) continue;
    const cand = live[0];
    const term = nodes[cand].term + 1;
    nodes[cand] = { ...nodes[cand], term, votedFor: cand, role: "candidate", votes: 1 };
    for (const v of live.slice(1)) {
      if (nodes[v].term < term) {
        nodes[v] = { ...nodes[v], term, votedFor: cand, role: "follower", votes: 0 };
        nodes[cand].votes++;
      }
    }
    if (nodes[cand].votes >= MAJORITY) {
      nodes[cand].role = "leader";
      notes.push(`Node ${cand} won term ${term} with ${nodes[cand].votes}/${N} votes (needs ${MAJORITY}). Elected.`);
    } else {
      notes.push(`Node ${cand} ran for term ${term} but got only ${nodes[cand].votes}/${N} votes (needs ${MAJORITY}). No leader.`);
    }
  }
  return { ...c, nodes, note: notes.join(" ") || "Every reachable group already has a leader, so no timeout fires." };
}

export function killLeader(c: Cluster): Cluster {
  const leaders = c.nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.up && n.role === "leader");
  if (leaders.length === 0) return { ...c, note: "There is no live leader to kill." };
  const { i } = leaders.reduce((a, b) => (b.n.term > a.n.term ? b : a));
  const nodes = c.nodes.map((n, k) => (k === i ? { ...n, up: false, role: "follower" as Role, votes: 0 } : n));
  return { ...c, nodes, note: `Killed leader node ${i}.` };
}

export function restoreNode(c: Cluster): Cluster {
  const i = c.nodes.findIndex((n) => !n.up);
  if (i < 0) return { ...c, note: "All nodes are already up." };
  const nodes = c.nodes.map((n, k) => (k === i ? { ...n, up: true } : n));
  return { ...settle({ ...c, nodes }), note: `Node ${i} restarted as a follower and caught up to the highest term it can reach.` };
}

export function togglePartition(c: Cluster): Cluster {
  const partitioned = !c.partitioned;
  return {
    ...settle({ ...c, partitioned }),
    note: partitioned
      ? "Network split: nodes 0,1 (minority) cannot reach 2,3,4 (majority)."
      : "Partition healed. Stale leaders see a higher term and step down.",
  };
}

