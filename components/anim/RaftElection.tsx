"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { N, MINORITY_IDS, advanceTimeout, initialCluster, killLeader, restoreNode, togglePartition } from "./raftLogic";

const POS = [0, 1, 2, 3, 4].map((i) => {
  const a = (-90 + (360 / N) * i) * (Math.PI / 180);
  return { x: 150 + 90 * Math.cos(a), y: 100 + 70 * Math.sin(a) };
});

export default function RaftElection() {
  const [c, setC] = useState(initialCluster);
  const leader = c.nodes.findIndex((n) => n.up && n.role === "leader");

  return (
    <AnimFrame
      title="Raft leader election"
      caption="Kill the leader or split the network, then advance the election timeout. A candidate needs 3 of 5 votes, counting every node in the cluster, so the 2-node side can never win."
    >
      <Predict
        question="The network splits into {0,1} and {2,3,4}, and the old leader (node 0) is on the 2-node side. Which side can elect a legitimate new leader?"
        options={[
          { label: "2-node side" },
          { label: "3-node side", correct: true },
          { label: "Both sides" },
          { label: "Neither side" },
        ]}
        why="Only 3 of 5 is a majority. Run it below: partition, kill the leader, then advance the timeout. The minority candidate never collects enough votes."
      />
      <div className="font-mono text-xs">
        <svg viewBox="0 0 300 200" className="mx-auto w-full max-w-sm" role="img" aria-label="Five Raft nodes on a ring">
          {c.nodes.map((n, i) => {
            const minority = c.partitioned && MINORITY_IDS.includes(i);
            const stroke = !n.up ? "#ff6b6b" : n.role === "leader" ? "#7bd88f" : minority ? "#ff6b6b" : "currentColor";
            return (
              <g key={i} opacity={n.up ? 1 : 0.45} className="text-line">
                <circle
                  cx={POS[i].x}
                  cy={POS[i].y}
                  r="26"
                  fill="none"
                  stroke={stroke}
                  strokeWidth={n.role === "leader" ? 3 : 1.5}
                  strokeDasharray={n.up ? undefined : "4 3"}
                />
                <text x={POS[i].x} y={POS[i].y - 3} textAnchor="middle" fontSize="11" className="fill-paper">
                  {i} {n.role === "leader" ? "L" : n.role === "candidate" ? "C" : "F"}
                </text>
                <text x={POS[i].x} y={POS[i].y + 10} textAnchor="middle" fontSize="9" className="fill-paper-muted">
                  {n.up ? `t${n.term} v${n.votes}` : "down"}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-center text-paper-muted">
          L leader, C candidate, F follower, t term, v votes received
          {c.partitioned ? ". Red rings: minority side {0,1}." : "."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <AnimButton onClick={() => setC(advanceTimeout(c))}>Advance election timeout</AnimButton>
          <AnimButton onClick={() => setC(killLeader(c))}>Kill leader</AnimButton>
          <AnimButton onClick={() => setC(restoreNode(c))}>Restore a node</AnimButton>
          <AnimButton active={c.partitioned} onClick={() => setC(togglePartition(c))}>
            {c.partitioned ? "Heal partition" : "Partition 2 / 3"}
          </AnimButton>
          <AnimButton onClick={() => setC(initialCluster())}>Reset</AnimButton>
        </div>
        <p className="mt-4 text-paper" aria-live="polite">
          {c.note} {leader >= 0 ? `Current leader: node ${leader}.` : "No leader."}
        </p>
      </div>
    </AnimFrame>
  );
}
