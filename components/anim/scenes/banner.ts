import type { G } from "../scene/types";
import { node, type Kind } from "./shapes";

type N = [Kind, string];
type Layout = "line" | "loop" | "fan";
type Motif = { id: string; re: RegExp; layout: Layout; nodes: N[] };

// First match wins, so specific concepts sit above general ones.
// "fan": first node is the hub, the rest surround it. "loop": a line plus a feedback edge.
export const MOTIFS: Motif[] = [
  { id: "structured", re: /structured output|chain-of-thought|prompt(ing)? (tech|engineer)|json mode/, layout: "line", nodes: [["user", "prompt"], ["model", "LLM"], ["shield", "schema"], ["doc", "JSON"]] },
  { id: "api", re: /\bapis?\b|rest vs|grpc|graphql|pagination|webhook/, layout: "line", nodes: [["client", "client"], ["lb", "API"], ["server", "service"], ["db", "data"]] },
  { id: "lock", re: /\blocks?\b|mutex|lease|fencing/, layout: "line", nodes: [["server", "node A"], ["lock", "lock"], ["server", "node B"], ["db", "resource"]] },
  { id: "gossip", re: /gossip|heartbeat|failure detect|membership/, layout: "fan", nodes: [["server", "node"], ["server", "peer"], ["server", "peer"], ["server", "peer"]] },
  { id: "bidding", re: /bidding|auction/, layout: "line", nodes: [["user", "bid"], ["queue", "auction"], ["model", "ranker"], ["doc", "winner"]] },
  { id: "text-to-sql", re: /text-to-sql|sql|analytics assistant/, layout: "line", nodes: [["user", "question"], ["model", "LLM"], ["db", "warehouse"], ["doc", "chart"]] },
  { id: "rag", re: /\brag\b|retrieval-augmented|knowledge base|doc(ument)? q&a|answer engine/, layout: "line", nodes: [["doc", "docs"], ["db", "vectors"], ["model", "LLM"], ["user", "answer"]] },
  { id: "vector", re: /vector|embedding|semantic search|multimodal search/, layout: "line", nodes: [["doc", "content"], ["model", "embed"], ["db", "index"], ["user", "query"]] },
  { id: "search", re: /search|retriev|index|inverted|ranking/, layout: "line", nodes: [["user", "query"], ["lb", "route"], ["db", "index"], ["doc", "results"]] },
  { id: "gateway", re: /gateway|router|routing|proxy|load balanc|rate limit|throttl/, layout: "fan", nodes: [["lb", "gateway"], ["client", "app"], ["model", "model A"], ["model", "model B"]] },
  { id: "guardrails", re: /guardrail|safety|moderation|filter|injection|jailbreak/, layout: "line", nodes: [["user", "input"], ["shield", "check"], ["model", "LLM"], ["shield", "check"]] },
  { id: "identity", re: /identity|authoriz|authent|oauth|zero.?trust|secret|permission|access control/, layout: "line", nodes: [["user", "user"], ["lock", "token"], ["shield", "policy"], ["server", "tool"]] },
  { id: "security", re: /secur|threat|privacy|pii|complian|govern|audit|risk|regulat|fraud/, layout: "line", nodes: [["server", "system"], ["shield", "controls"], ["doc", "audit log"], ["user", "review"]] },
  { id: "tenant", re: /multi-tenant|tenan/, layout: "fan", nodes: [["shield", "isolation"], ["user", "tenant A"], ["user", "tenant B"], ["db", "data"]] },
  { id: "semantic-cache", re: /cache|caching|memoiz|cdn/, layout: "line", nodes: [["user", "request"], ["cache", "cache"], ["server", "origin"], ["db", "store"]] },
  { id: "inference", re: /inference|serving|gpu|batching|kv|quantiz|capacity/, layout: "line", nodes: [["queue", "queue"], ["gpu", "GPU"], ["gpu", "GPU"], ["client", "tokens"]] },
  { id: "fine-tune", re: /fine-tun|training|lora|distill|synthetic|preference|labeling/, layout: "line", nodes: [["db", "data"], ["gpu", "train"], ["model", "tuned"], ["shield", "eval"]] },
  { id: "flywheel", re: /feedback|flywheel|experiment|a\/b|online learning/, layout: "loop", nodes: [["user", "users"], ["model", "model"], ["db", "logs"]] },
  { id: "eval", re: /eval|benchmark|slo|quality|test|judge/, layout: "line", nodes: [["doc", "test set"], ["model", "model"], ["shield", "judge"], ["server", "score"]] },
  { id: "observability", re: /observab|monitor|trac|logging|telemetry/, layout: "line", nodes: [["server", "app"], ["queue", "traces"], ["db", "store"], ["client", "dashboard"]] },
  { id: "agent-runtime", re: /agent|workflow|automation|orchestrat|tool|mcp|runtime|planner/, layout: "fan", nodes: [["model", "agent"], ["server", "tool"], ["db", "memory"], ["doc", "files"]] },
  { id: "voice", re: /voice|speech|audio|meeting|call|transcri/, layout: "line", nodes: [["phone", "speech"], ["model", "STT"], ["model", "LLM"], ["doc", "notes"]] },
  { id: "media", re: /image|video|media|diffusion|clip/, layout: "line", nodes: [["user", "prompt"], ["model", "model"], ["doc", "frames"], ["cdn", "deliver"]] },
  { id: "translate", re: /translat|locali/, layout: "line", nodes: [["doc", "source"], ["model", "LLM"], ["shield", "QA"], ["doc", "target"]] },
  { id: "document", re: /document|ocr|extract|contract|legal|ingest|connector|etl|pipeline/, layout: "line", nodes: [["doc", "files"], ["queue", "queue"], ["model", "extract"], ["db", "records"]] },
  { id: "recommend", re: /recommend|personaliz|feed|ranking|ads/, layout: "line", nodes: [["user", "user"], ["db", "candidates"], ["model", "ranker"], ["doc", "feed"]] },
  { id: "multi-region", re: /region|multi-dc|geo|replicat|failover|disaster|availability/, layout: "fan", nodes: [["cloud", "region A"], ["cloud", "region B"], ["cloud", "region C"], ["lb", "route"]] },
  { id: "degrade", re: /degrad|fallback|reliab|resilien|circuit|retry/, layout: "line", nodes: [["user", "request"], ["model", "primary"], ["cache", "fallback"], ["client", "reply"]] },
  { id: "cost", re: /cost|token|estimat|budget|finops|chargeback|pricing/, layout: "line", nodes: [["client", "usage"], ["gpu", "tokens"], ["db", "ledger"], ["doc", "invoice"]] },
  { id: "queue", re: /queue|stream|kafka|pub.?sub|event|async|message/, layout: "line", nodes: [["server", "producer"], ["queue", "broker"], ["server", "consumer"], ["db", "sink"]] },
  { id: "database", re: /database|sql|nosql|shard|partition|storage|lsm|b-tree|index|transaction|consisten|raft|paxos|consensus|replica/, layout: "fan", nodes: [["db", "leader"], ["db", "replica"], ["db", "replica"], ["db", "replica"]] },
  { id: "tutor", re: /tutor|educat|student|learning/, layout: "loop", nodes: [["user", "student"], ["model", "tutor"], ["doc", "lesson"]] },
  { id: "clinical", re: /clinic|health|medical|patient/, layout: "line", nodes: [["phone", "visit"], ["model", "LLM"], ["doc", "note"], ["shield", "sign-off"]] },
  { id: "chat", re: /chat|assistant|support|copilot|coding|commerce|research|browser/, layout: "line", nodes: [["user", "user"], ["model", "LLM"], ["server", "tools"], ["doc", "answer"]] },
  { id: "platform", re: /platform|architecture|framework|strategy|build|methodology|foundation|design/, layout: "fan", nodes: [["lb", "gateway"], ["model", "models"], ["db", "data"], ["shield", "control"]] },
];

const DEFAULT: Motif = { id: "default", re: /./, layout: "line", nodes: [["client", "client"], ["server", "service"], ["db", "data"]] };

export function motifFor(text: string): Motif {
  const t = text.toLowerCase();
  return MOTIFS.find((m) => m.re.test(t)) ?? DEFAULT;
}

function tone(g: G, k: Kind): string {
  switch (k) {
    case "model":
      return g.pal.accent;
    case "db":
    case "cache":
    case "queue":
      return g.pal.teal;
    case "shield":
    case "lock":
      return g.pal.ok;
    case "gpu":
      return g.pal.violet;
    case "lb":
    case "cdn":
    case "cloud":
      return g.pal.blue;
    default:
      return g.pal.paper;
  }
}

export const BANNER_W = 320;
export const BANNER_H = 92;

// Draw a concept diagram: shaped nodes, labelled, with packets flowing along the edges.
export function drawBanner(g: G, m: Motif): void {
  const n = m.nodes.length;
  const size = n >= 4 ? 34 : 38;
  const spoke = 26;
  const pos: [number, number][] = [];
  const fan = m.layout === "fan";
  if (fan) {
    pos.push([84, 40]);
    const rest = n - 1;
    for (let i = 0; i < rest; i++) pos.push([212, rest === 1 ? 40 : 16 + (i * 48) / (rest - 1)]);
  } else {
    const x0 = 40;
    const x1 = BANNER_W - 40;
    for (let i = 0; i < n; i++) pos.push([x0 + ((x1 - x0) * i) / Math.max(1, n - 1), m.layout === "loop" ? 34 : 38]);
  }

  const edges: [number, number][] = [];
  if (m.layout === "fan") for (let i = 1; i < n; i++) edges.push([0, i]);
  else for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
  if (m.layout === "loop") edges.push([n - 1, 0]);

  edges.forEach(([a, b], idx) => {
    const [ax, ay] = pos[a];
    const [bx, by] = pos[b];
    const back = m.layout === "loop" && idx === edges.length - 1;
    if (back) {
      const y = 80;
      g.line(ax, ay + size * 0.5, ax, y, g.pal.line, 1, 1.2);
      g.line(ax, y, bx, y, g.pal.line, 1, 1.2);
      g.line(bx, y, bx, by + size * 0.5, g.pal.line, 1, 1.2);
      const p = g.loop(2.4, idx * 0.5);
      const px = g.mix(bx, ax, p);
      g.dot(px, y, 2.6, g.pal.accent, 1);
      g.glow(px, y, 9, g.pal.accent, 0.3);
      return;
    }
    const sx = ax + (bx - ax) * (fan ? 0.32 : 0.3);
    const sy = ay + (by - ay) * 0.3;
    const ex = ax + (bx - ax) * 0.7;
    const ey = ay + (by - ay) * 0.7;
    g.line(sx, sy, ex, ey, g.pal.line, 1, 1.2);
    g.packet(sx, sy, ex, ey, g.loop(1.6, idx * 0.35), g.pal.accent, 2.4);
  });

  m.nodes.forEach(([k, label], i) => {
    const [x, y] = pos[i];
    if (fan && i > 0) {
      node(g, k, x, y, { size: spoke, color: tone(g, k), active: k === "model", state: "working" });
      if (k === "model") g.ring(x, y, spoke * 0.5, g.pal.accent, 0.85, 1.2);
      g.text(label, x + spoke * 0.5 + 6, y + 3, { size: 8.5, color: g.pal.muted, align: "left" });
      return;
    }
    node(g, k, x, y, { size, color: tone(g, k), active: k === "model", state: "working" });
    if (k === "model") g.ring(x, y, size * 0.5, g.pal.accent, 0.85, 1.4);
    g.text(label, x, y + size * 0.5 + 9, { size: 8.5, color: g.pal.muted, align: "center" });
  });
}
