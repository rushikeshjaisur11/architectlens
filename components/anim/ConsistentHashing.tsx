"use client";

import { useState } from "react";
import { AnimButton, AnimFrame } from "./AnimFrame";
import { useReducedMotion } from "./hooks";

const ALL_NODES = ["A", "B", "C", "D", "E"];
const COLORS: Record<string, string> = { A: "#e8a33d", B: "#4cc9f0", C: "#7bd88f", D: "#c792ea", E: "#ff6b6b" };
const KEYS = Array.from({ length: 24 }, (_, i) => `key-${i}`);
const VNODES = 8;
const CENTER = 160;

function hash(s: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

type Token = { node: string; pos: number };

function tokensFor(nodes: string[], virtual: boolean): Token[] {
  const tokens: Token[] = [];
  for (const node of nodes) {
    for (let i = 0; i < (virtual ? VNODES : 1); i++) {
      tokens.push({ node, pos: hash(virtual ? `${node}#${i}` : `node-${node}`) });
    }
  }
  return tokens.sort((a, b) => a.pos - b.pos);
}

function ringOwner(tokens: Token[], key: string): Token {
  const pos = hash(key);
  return tokens.find((t) => t.pos >= pos) ?? tokens[0];
}

function moduloOwner(nodes: string[], key: string): string {
  return nodes[hash(key) % nodes.length];
}

function point(pos: number, radius: number): [number, number] {
  const angle = (pos / 2 ** 32) * Math.PI * 2 - Math.PI / 2;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

type Change = { label: string; ringMoved: number; moduloMoved: number; movedKeys: Set<string> };

export default function ConsistentHashing() {
  const reduced = useReducedMotion();
  const [nodes, setNodes] = useState<string[]>(["A", "B", "C"]);
  const [virtual, setVirtual] = useState(false);
  const [change, setChange] = useState<Change | null>(null);

  const tokens = tokensFor(nodes, virtual);
  const owners = new Map(KEYS.map((k) => [k, ringOwner(tokens, k)]));
  const load = new Map(nodes.map((n) => [n, 0]));
  owners.forEach((t) => load.set(t.node, (load.get(t.node) ?? 0) + 1));

  function apply(next: string[], label: string) {
    const before = tokensFor(nodes, virtual);
    const after = tokensFor(next, virtual);
    const movedKeys = new Set(KEYS.filter((k) => ringOwner(before, k).node !== ringOwner(after, k).node));
    const moduloMoved = KEYS.filter((k) => moduloOwner(nodes, k) !== moduloOwner(next, k)).length;
    setNodes(next);
    setChange({ label, ringMoved: movedKeys.size, moduloMoved, movedKeys });
  }

  const nextNode = ALL_NODES.find((n) => !nodes.includes(n));
  const transition = reduced ? "" : "transition-[stroke,fill] duration-500";

  return (
    <AnimFrame
      title="Consistent hashing ring"
      caption="Each key belongs to the first node clockwise from it. Adding or removing a node only reassigns the keys in one arc. Hashing with key mod N reshuffles most keys instead."
      controls={
        <>
          <AnimButton disabled={!nextNode} onClick={() => nextNode && apply([...nodes, nextNode], `Added node ${nextNode}`)}>
            + Add node
          </AnimButton>
          <AnimButton
            disabled={nodes.length <= 2}
            onClick={() => {
              const removed = nodes[nodes.length - 1];
              apply(nodes.slice(0, -1), `Removed node ${removed}`);
            }}
          >
            − Remove node
          </AnimButton>
          <AnimButton
            active={virtual}
            onClick={() => {
              setVirtual((v) => !v);
              setChange(null);
            }}
          >
            Virtual nodes: {virtual ? "on" : "off"}
          </AnimButton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <svg viewBox="0 0 320 320" role="img" aria-label="Hash ring with nodes and keys" className="w-full max-w-[320px] shrink-0">
          <circle cx={CENTER} cy={CENTER} r={120} fill="none" stroke="var(--color-line)" strokeWidth={1.5} />
          {KEYS.map((k) => {
            const owner = owners.get(k)!;
            const [kx, ky] = point(hash(k), 96);
            const [ox, oy] = point(owner.pos, 120);
            const moved = change?.movedKeys.has(k);
            return (
              <g key={k}>
                <line x1={kx} y1={ky} x2={ox} y2={oy} stroke={COLORS[owner.node]} strokeOpacity={0.3} className={transition} />
                <circle
                  cx={kx}
                  cy={ky}
                  r={moved ? 5.5 : 4}
                  fill={COLORS[owner.node]}
                  stroke={moved ? "var(--color-paper)" : "none"}
                  strokeWidth={1.5}
                  className={transition}
                />
              </g>
            );
          })}
          {tokens.map((t, i) => {
            const [x, y] = point(t.pos, 120);
            return <circle key={`${t.node}-${i}`} cx={x} cy={y} r={virtual ? 5 : 8} fill={COLORS[t.node]} stroke="var(--color-ink)" strokeWidth={2} />;
          })}
          {!virtual &&
            tokens.map((t) => {
              const [x, y] = point(t.pos, 136);
              return (
                <text key={t.node} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="var(--color-paper)" fontFamily="var(--font-mono)">
                  {t.node}
                </text>
              );
            })}
        </svg>
        <div className="w-full min-w-0 flex-1 font-mono text-xs">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {nodes.map((n) => (
              <li key={n} className="flex items-center gap-1.5 text-paper-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[n] }} />
                {n}: <span className="text-paper">{load.get(n)}</span> keys
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded border border-line-soft bg-ink p-3 leading-relaxed" aria-live="polite">
            {change ? (
              <>
                <p className="text-paper">{change.label}</p>
                <p className="mt-2 text-paper-muted">
                  Ring: <span className="text-accent">{change.ringMoved}</span> of {KEYS.length} keys moved
                </p>
                <p className="text-paper-muted">
                  key mod N: <span className="text-paper">{change.moduloMoved}</span> of {KEYS.length} would move
                </p>
              </>
            ) : (
              <p className="text-paper-muted">Add or remove a node and compare how many of the {KEYS.length} keys have to move. Moved keys are outlined.</p>
            )}
          </div>
          <p className="mt-3 text-paper-muted">
            {virtual
              ? `Each node owns ${VNODES} points on the ring, so load evens out and a change is spread across many small arcs.`
              : "With one point per node, arcs are uneven. Turn virtual nodes on to see load balance out."}
          </p>
        </div>
      </div>
    </AnimFrame>
  );
}
