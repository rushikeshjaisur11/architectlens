"use client";

import { useEffect, useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { BUDGET_TOKENS, start, step, totalCost, totalTokens, type StopReason } from "./agentLoopLogic";

const RUN_MS = 500;
const STOP_TEXT: Record<StopReason, string> = {
  done: "Done: the model answered without calling a tool.",
  max_steps: "Hit max steps: the guard cut the loop and would hand off to a human.",
  loop_detected: "Loop detected: the same call repeated, so the loop stopped and would escalate.",
  budget: "Budget exhausted: the billing backstop killed a runaway loop.",
};

export default function AgentLoop() {
  const [run, setRun] = useState(start);
  const [running, setRunning] = useState(false);
  const [toolFails, setToolFails] = useState(true);
  const [capOn, setCapOn] = useState(false);
  const [maxSteps, setMaxSteps] = useState(6);
  const [detectLoops, setDetectLoops] = useState(false);
  const config = { toolFails, maxSteps: capOn ? maxSteps : null, detectLoops };

  useEffect(() => {
    if (!running) return;
    if (run.stop) {
      setRunning(false);
      return;
    }
    const id = setTimeout(() => setRun((r) => step(r, config)), RUN_MS);
    return () => clearTimeout(id);
  }, [running, run, toolFails, capOn, maxSteps, detectLoops]);

  function reset() {
    setRun(start());
    setRunning(false);
  }
  const tokens = totalTokens(run);
  const bad = run.stop === "budget";

  return (
    <AnimFrame
      title="Agent loop: think, call, observe"
      caption="Task: refund order 4182. Every step re-sends the whole context, so each call costs more than the last. With a failing tool and no guards the scripted agent retries until the budget backstop trips."
      controls={
        <>
          <AnimButton disabled={!!run.stop} onClick={() => setRun((r) => step(r, config))}>
            Step
          </AnimButton>
          <AnimButton active={running} disabled={!!run.stop} onClick={() => setRunning((x) => !x)}>
            {running ? "Pause" : "Run"}
          </AnimButton>
          <AnimButton onClick={reset}>Reset</AnimButton>
        </>
      }
    >
      <Predict
        question="The agent's tool keeps failing and the model keeps retrying the same call. What actually stops it?"
        options={[
          { label: "The model realises it is stuck" },
          { label: "A step cap, loop detection or budget outside the model", correct: true },
          { label: "The tool eventually succeeds" },
        ]}
        why="Nothing in the model's loop forces it to stop. Guards live in the application layer, and each retry costs more than the last because context accumulates."
      />
      <div className="font-mono text-xs">
        <div className="flex flex-wrap gap-2">
          <AnimButton
            active={toolFails}
            onClick={() => {
              setToolFails((x) => !x);
              reset();
            }}
          >
            Tool: {toolFails ? "fails" : "works"}
          </AnimButton>
          <AnimButton active={capOn} onClick={() => setCapOn((x) => !x)}>
            Max-steps guard: {capOn ? "on" : "off"}
          </AnimButton>
          <AnimButton active={detectLoops} onClick={() => setDetectLoops((x) => !x)}>
            Repeat detection: {detectLoops ? "on" : "off"}
          </AnimButton>
        </div>
        <label className={`mt-3 flex items-center gap-3 ${capOn ? "text-paper-muted" : "opacity-40"}`}>
          Max steps
          <input
            type="range"
            min={3}
            max={12}
            value={maxSteps}
            disabled={!capOn}
            onChange={(e) => setMaxSteps(+e.target.value)}
            className="accent-[#7bd88f]"
          />
          <span className="text-paper">{maxSteps}</span>
        </label>

        <p className="mt-4 text-paper-muted">
          Steps <span className="text-paper">{run.entries.length}</span> · Tokens billed{" "}
          <span className={bad ? "text-[#ff6b6b]" : "text-paper"}>{tokens.toLocaleString()}</span> / {BUDGET_TOKENS.toLocaleString()} · Cost{" "}
          <span className={bad ? "text-[#ff6b6b]" : "text-paper"}>${totalCost(run).toFixed(3)}</span>
        </p>
        <div className="mt-2 h-1.5 rounded bg-line">
          <div
            className={`h-full rounded ${bad ? "bg-[#ff6b6b]" : "bg-accent"}`}
            style={{ width: `${Math.min(100, (tokens / BUDGET_TOKENS) * 100)}%` }}
          />
        </div>

        <ol className="mt-4 max-h-64 space-y-1 overflow-y-auto" aria-label="Agent transcript">
          {run.entries.map((e) => (
            <li key={e.n} className="rounded border border-line-soft p-2">
              <span className="text-accent">{e.n}.</span> <span className="text-paper-muted">think:</span>{" "}
              <span className="text-paper">{e.thought}</span>
              {e.call && (
                <>
                  <br />
                  <span className="text-paper-muted">call:</span> <span className="text-paper">{e.call}</span>
                </>
              )}
              <br />
              <span className="text-paper-muted">observe:</span>{" "}
              <span className={e.observation.startsWith("ERROR") ? "text-[#ff6b6b]" : "text-[#7bd88f]"}>{e.observation}</span>
              <span className="text-paper-muted"> · {e.inTokens} in</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-paper" aria-live="polite">
          {run.stop ? STOP_TEXT[run.stop] : run.entries.length ? "Running..." : "Press Step or Run."}
        </p>
      </div>
    </AnimFrame>
  );
}
