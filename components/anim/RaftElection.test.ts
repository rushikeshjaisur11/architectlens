import { describe, expect, it } from "vitest";
import { advanceTimeout, initialCluster, killLeader, togglePartition } from "./raftLogic";

describe("raft election", () => {
  it("majority side elects a leader, minority side does not", () => {
    // split {0,1} | {2,3,4}, kill old leader 0, then time out both sides
    const c = advanceTimeout(killLeader(togglePartition(initialCluster())));
    expect(c.nodes[1].role).toBe("candidate");
    expect(c.nodes[1].votes).toBe(1);
    expect(c.nodes[2].role).toBe("leader");
    expect(c.nodes[2].votes).toBe(3);
  });
});
