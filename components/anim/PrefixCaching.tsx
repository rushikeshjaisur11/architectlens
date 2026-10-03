"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { Predict } from "./Predict";
import { buildPrompt, commonPrefix, DEFAULT_DISCOUNT, relativeCost, totalTokens, type Block, type Order } from "./prefixCacheLogic";

type Sent = { blocks: Block[]; hitBlocks: number; cached: number; total: number };

export default function PrefixCaching() {
  const [order, setOrder] = useState<Order>("stable-first");
  const [timestamp, setTimestamp] = useState(false);
  const [discount, setDiscount] = useState(DEFAULT_DISCOUNT);
  const [n, setN] = useState(0);
  const [last, setLast] = useState<Sent | null>(null);
  const [sum, setSum] = useState({ cached: 0, total: 0 });

  function send() {
    const blocks = buildPrompt(order, timestamp, n + 1);
    const { blocks: hitBlocks, tokens } = commonPrefix(last?.blocks ?? null, blocks);
    const total = totalTokens(blocks);
    setN(n + 1);
    setLast({ blocks, hitBlocks, cached: tokens, total });
    setSum((s) => ({ cached: s.cached + tokens, total: s.total + total }));
  }

  function reset() {
    setN(0);
    setLast(null);
    setSum({ cached: 0, total: 0 });
  }

  const preview = last?.blocks ?? buildPrompt(order, timestamp, 1);
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <AnimFrame
      title="Prefix cache hits"
      caption="Assumptions: block sizes are illustrative (system 1200, tools 800, docs 3000, question 50, timestamp 20 tokens). The question and timestamp change every request; other blocks are identical. Matching is exact and prefix-only, so reuse stops at the first changed block. Cost counts a cached token at the price below (lesson: 0.1x read price) and ignores the write premium; latency is assumed to scale the same way, with recomputed tokens. After toggling, send two requests to compare like with like."
      controls={
        <>
          <AnimButton onClick={send}>Send request</AnimButton>
          <AnimButton active={order === "volatile-first"} onClick={() => setOrder(order === "stable-first" ? "volatile-first" : "stable-first")}>
            Order: {order}
          </AnimButton>
          <AnimButton active={timestamp} onClick={() => setTimestamp((t) => !t)}>
            Timestamp on top: {timestamp ? "on" : "off"}
          </AnimButton>
          <AnimButton onClick={reset}>Reset</AnimButton>
        </>
      }
    >
      <Predict
        question="You move the changing user question from the end of the prompt to the very start, ahead of the long static blocks. What happens to cache hits?"
        options={[{ label: "Hits stay high" }, { label: "Hits drop to about zero", correct: true }, { label: "Hits halve" }]}
        why="Caching is prefix-based. The question differs on every request, so the match ends at the first token and nothing after it can be reused. Try it with the order toggle."
      />
      <div className="font-mono text-xs">
        <div className="flex flex-col gap-1.5" role="list" aria-label="Prompt blocks, first to last">
          {preview.map((b, i) => {
            const hit = last !== null && i < last.hitBlocks;
            return (
              <div
                key={b.id}
                role="listitem"
                className={`flex items-center justify-between gap-2 rounded border px-3 py-1.5 ${
                  last === null ? "border-line text-paper-muted" : hit ? "border-[#7bd88f] text-paper" : "border-[#ff6b6b] text-paper"
                }`}
              >
                <span>{b.label}</span>
                <span className="text-paper-muted">
                  {b.tokens} tok{last !== null && (hit ? " · cached" : " · recomputed")}
                </span>
              </div>
            );
          })}
        </div>
        <label className="mt-4 flex flex-wrap items-center gap-3 text-paper-muted">
          Cached-token price
          <input
            type="range"
            min={0.025}
            max={0.5}
            step={0.025}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="accent-[#7bd88f]"
            aria-label="Cached token price as a fraction of base input price"
          />
          <span className="text-paper">{discount.toFixed(3)}x</span>
        </label>
        <p className="mt-4 text-paper-muted" aria-live="polite">
          {last === null ? (
            "Send a request. The first one has no previous prompt, so everything is computed."
          ) : (
            <>
              Request {n}: cached <span className="text-paper">{last.cached}</span> · recomputed{" "}
              <span className="text-paper">{last.total - last.cached}</span> · hit ratio{" "}
              <span className="text-paper">{pct(last.cached / last.total)}</span> · relative cost and latency{" "}
              <span className="text-paper">{pct(relativeCost(last.cached, last.total, discount))}</span> of uncached. Running hit ratio{" "}
              <span className="text-paper">{pct(sum.cached / sum.total)}</span>.
            </>
          )}
        </p>
      </div>
    </AnimFrame>
  );
}
