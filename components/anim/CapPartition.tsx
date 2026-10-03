"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { heal, initialCap, read, togglePartition, write, type Cap, type Mode, type Op } from "./capLogic";

export default function CapPartition() {
  const [s, setS] = useState<Cap>(initialCap("CP"));
  const [last, setLast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function run(op: Op) {
    setS(op.state);
    setLast({ ok: op.ok, msg: op.msg });
    setLog((l) => [op.msg, ...l].slice(0, 6));
  }
  function setMode(m: Mode) {
    setS(initialCap(m));
    setLast(null);
    setLog([]);
  }

  return (
    <AnimFrame
      title="CAP during a partition"
      caption="Cut the network, write on one side, then read from the other. CP stays consistent by refusing requests; AP stays available but replicas diverge and last-write-wins discards a write on heal."
      controls={(["CP", "AP"] as Mode[]).map((m) => (
        <AnimButton key={m} active={s.mode === m} onClick={() => setMode(m)}>
          {m}
        </AnimButton>
      ))}
    >
      <Predict
        question="The network is partitioned and a client writes x = 2 to node A. Another client then reads from node B. What does it see?"
        options={[
          { label: "CP: error, AP: stale x = 1", correct: true },
          { label: "CP: x = 2, AP: x = 2" },
          { label: "CP: x = 1, AP: error" },
        ]}
        why="CP refuses requests it cannot confirm with a quorum, so the read errors (consistent, not available). AP answers from B's local copy, so it returns the stale x = 1 (available, not consistent)."
      />
      <div className="font-mono text-xs">
        <div className="flex gap-3">
          {s.nodes.map((n, i) => (
            <div key={i} className={`flex-1 rounded border p-3 text-center ${s.nodes[0].v !== s.nodes[1].v ? "border-[#ff6b6b]" : "border-line-soft"}`}>
              <div className="text-paper-muted">Node {i ? "B" : "A"}</div>
              <div className="text-lg text-paper">x = {n.v}</div>
            </div>
          ))}
        </div>
        <p className={`mt-2 text-center ${s.partitioned ? "text-[#ff6b6b]" : "text-[#7bd88f]"}`}>
          {s.partitioned ? "network: PARTITIONED" : "network: connected"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AnimButton onClick={() => run(write(s, 0, 2))}>Write x=2 to A</AnimButton>
          <AnimButton onClick={() => run(write(s, 1, 3))}>Write x=3 to B</AnimButton>
          <AnimButton onClick={() => run(read(s, 0))}>Read A</AnimButton>
          <AnimButton onClick={() => run(read(s, 1))}>Read B</AnimButton>
          <AnimButton onClick={() => run(togglePartition(s))}>Toggle partition</AnimButton>
          <AnimButton onClick={() => run(heal(s))} disabled={!s.partitioned}>
            Heal
          </AnimButton>
        </div>
        <p className="mt-4 h-4 text-paper" aria-live="polite">
          {last && <span className={last.ok ? "text-[#7bd88f]" : "text-[#ff6b6b]"}>{last.msg}</span>}
        </p>
        <ul className="mt-3 space-y-1 border-t border-line-soft pt-2 text-paper-muted">
          {log.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>
    </AnimFrame>
  );
}
