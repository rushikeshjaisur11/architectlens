"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { deliver, MODES, START, TOTAL, type Fault, type Mode, type Sim } from "./deliveryLogic";

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`min-w-[5.5rem] flex-1 rounded border p-2 text-center ${warn ? "border-[#ff6b6b]" : "border-line-soft"}`}>
      <div className="text-paper-muted">{label}</div>
      <div className="text-lg text-paper">{value}</div>
    </div>
  );
}

export default function DeliveryGuarantees() {
  const [mode, setMode] = useState<Mode>("at-least-once");
  const [sim, setSim] = useState<Sim>(START);
  const [armed, setArmed] = useState<Fault>("none");

  const done = sim.next >= TOTAL;
  const owed = sim.next; // payments that should have been charged so far
  function step() {
    setSim(deliver(sim, mode, armed));
    setArmed("none");
  }
  function pick(next: Mode) {
    setMode(next);
    setSim(START);
    setArmed("none");
  }
  function toggle(f: Fault) {
    setArmed(armed === f ? "none" : f);
  }

  return (
    <AnimFrame
      title="Delivery guarantees under failure"
      caption="Each message is a payment of 1 unit. Arm a fault, then send the next message. Only the idempotent consumer keeps the charged total equal to the number of messages sent."
      controls={MODES.map((m) => (
        <AnimButton key={m} active={mode === m} onClick={() => pick(m)}>
          {m}
        </AnimButton>
      ))}
    >
      <Predict
        question="The consumer charges a card, then crashes before sending the ack. The broker has at-least-once delivery. What happens to that payment?"
        options={[
          { label: "Charged once" },
          { label: "Charged twice", correct: true },
          { label: "Never charged" },
        ]}
        why="No ack means the broker redelivers. Without an idempotent consumer the retry charges again. At-most-once would lose it instead; dedup by message id fixes it."
      />
      <div className="font-mono text-xs">
        <div className="flex items-center gap-2 text-paper-muted" aria-hidden>
          <span>producer</span>→<span>queue ({TOTAL - sim.next} left)</span>→<span>consumer</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Stat label="Deliveries" value={sim.deliveries} />
          <Stat label="Lost" value={sim.lost} warn={sim.lost > 0} />
          <Stat label="Redelivered" value={sim.redelivered} warn={sim.redelivered > 0} />
          <Stat label="Charged (units)" value={sim.charged} warn={sim.charged !== owed - sim.lost} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <AnimButton onClick={step} disabled={done}>Send next</AnimButton>
          <AnimButton active={armed === "crash"} onClick={() => toggle("crash")} disabled={done}>
            Crash consumer after processing, before ack
          </AnimButton>
          <AnimButton active={armed === "dropAck"} onClick={() => toggle("dropAck")} disabled={done}>
            Drop network ack
          </AnimButton>
          <AnimButton onClick={() => pick(mode)}>Reset</AnimButton>
        </div>
        <p className="mt-4 text-paper" aria-live="polite">
          {armed !== "none" ? `Fault armed for message #${sim.next + 1}: ${armed === "crash" ? "consumer crash" : "dropped ack"}. ` : ""}
          {sim.note}
          {done ? ` Done: ${sim.charged} charged for ${TOTAL} messages.` : ""}
        </p>
      </div>
    </AnimFrame>
  );
}
