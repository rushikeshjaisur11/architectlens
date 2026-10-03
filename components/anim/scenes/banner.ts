import type { G } from "../scene/types";
import { node, type Kind } from "./shapes";
import type { BannerSpec } from "../../../lib/banner-kinds";

type N = [Kind, string];
type Layout = "line" | "loop" | "fan";
type Motif = { id: string; re: RegExp; layout: Layout; nodes: N[] };

// First match wins, so specific concepts sit above general ones.
// "fan": first node is the hub, the rest surround it. "loop": a line plus a feedback edge.
export const MOTIFS: Motif[] = [
  // Specific concepts first. Matching runs on the title alone, then on title plus tags.
  { id: "incident", re: /case study: (the )?(crowdstrike|aws)|outage/, layout: "line", nodes: [["server", "change"], ["shield", "missing gate"], ["cloud", "all regions"], ["user", "outage"]] },
  { id: "text-to-sql", re: /text-to-sql|\bsql\b.*assistant|analytics assistant/, layout: "line", nodes: [["user", "question"], ["model", "LLM"], ["db", "warehouse"], ["doc", "chart"]] },
  { id: "tokens", re: /tokeniz|token count|token budget|context window|token economics/, layout: "line", nodes: [["doc", "text"], ["server", "tokenizer"], ["db", "vocabulary"], ["model", "token ids"]] },
  { id: "prompting", re: /prompting|prompt fundamentals|few-shot|zero-shot|system prompts?|sampling|temperature|instruction/, layout: "line", nodes: [["user", "prompt"], ["doc", "examples"], ["model", "LLM"], ["doc", "answer"]] },
  { id: "structured", re: /structured output|chain-of-thought|json mode|multimodal prompting/, layout: "line", nodes: [["user", "prompt"], ["model", "LLM"], ["shield", "schema"], ["doc", "JSON"]] },
  { id: "reasoning", re: /reasoning model|test-time|thinking/, layout: "line", nodes: [["user", "question"], ["model", "thinks"], ["model", "checks"], ["doc", "answer"]] },
  { id: "context-eng", re: /context engineering|context compression|summariz.*rag/, layout: "line", nodes: [["doc", "history"], ["server", "compact"], ["db", "notes"], ["model", "LLM"]] },
  { id: "parsing", re: /document parsing|ocr|intelligent document|contract review|document processing/, layout: "line", nodes: [["doc", "scan"], ["server", "parser"], ["db", "fields"], ["shield", "review"]] },
  { id: "web-search", re: /web search|grounding tools|answer engine|deep research/, layout: "line", nodes: [["user", "question"], ["cloud", "web"], ["model", "LLM"], ["doc", "cited answer"]] },
  { id: "graph", re: /graphrag|knowledge graph/, layout: "fan", nodes: [["db", "graph"], ["doc", "entity"], ["doc", "entity"], ["model", "LLM"]] },
  { id: "rag", re: /\brag\b|retrieval-augmented|document q&a|knowledge base|query rewriting|hyde|chunking|multi-hop/, layout: "line", nodes: [["doc", "docs"], ["db", "vectors"], ["model", "LLM"], ["user", "answer"]] },
  { id: "vector", re: /vector|embedding|semantic search|multimodal search|quantization.*memory|hybrid (search|retrieval)|retrieval:/, layout: "line", nodes: [["doc", "content"], ["model", "embed"], ["db", "index"], ["user", "query"]] },
  { id: "guardrails", re: /guardrail|moderation|prompt injection|jailbreak|red-teaming|adversarial/, layout: "line", nodes: [["user", "input"], ["shield", "check"], ["model", "LLM"], ["shield", "check"]] },
  { id: "pii", re: /pii|redaction|data governance|compliance/, layout: "line", nodes: [["doc", "text"], ["shield", "redact"], ["model", "LLM"], ["db", "audit log"]] },
  { id: "regulation", re: /regulation|governance|model risk|standards/, layout: "line", nodes: [["server", "AI system"], ["shield", "controls"], ["doc", "evidence"], ["user", "regulator"]] },
  { id: "identity", re: /identity|authoriz|authn|oauth|zero-trust|secrets|permission scoping|approval gates/, layout: "line", nodes: [["user", "user"], ["lock", "token"], ["shield", "policy"], ["server", "tool"]] },
  { id: "security", re: /security|threat|privacy|fraud|financial services/, layout: "line", nodes: [["server", "system"], ["shield", "controls"], ["doc", "audit log"], ["user", "review"]] },
  { id: "sandbox", re: /sandbox|computer-use|browser agent/, layout: "line", nodes: [["model", "agent"], ["shield", "sandbox"], ["client", "browser"], ["cloud", "web"]] },
  { id: "tenant", re: /multi-tenan|tenancy/, layout: "fan", nodes: [["shield", "isolation"], ["user", "tenant A"], ["user", "tenant B"], ["db", "data"]] },
  { id: "gateway", re: /gateway|rate limiter|rate limiting|model routing|routing and cascades|fallback chains/, layout: "fan", nodes: [["lb", "gateway"], ["client", "app"], ["model", "model A"], ["model", "model B"]] },
  { id: "mesh", re: /service mesh|sidecar|service discovery/, layout: "fan", nodes: [["lb", "control plane"], ["server", "service A"], ["server", "service B"], ["lock", "mTLS"]] },
  { id: "load-balancer", re: /load balanc/, layout: "fan", nodes: [["lb", "balancer"], ["server", "server"], ["server", "server"], ["server", "server"]] },
  { id: "file-sync", re: /file sync|distributed file system|gfs|hdfs/, layout: "line", nodes: [["client", "device"], ["server", "sync engine"], ["db", "metadata"], ["db", "blocks"]] },
  { id: "url-shortener", re: /url shortener/, layout: "line", nodes: [["user", "short link"], ["cache", "cache"], ["server", "resolver"], ["db", "url store"]] },
  { id: "analytics-pipeline", re: /analytics pipelines|lambda and kappa|stream processing/, layout: "line", nodes: [["queue", "events"], ["server", "stream job"], ["db", "OLAP store"], ["client", "dashboard"]] },
  { id: "cdn", re: /cdn|content delivery|live-streaming|video streaming|image optimization|object storage|large file|upload/, layout: "line", nodes: [["db", "origin"], ["cdn", "edge"], ["cdn", "edge"], ["user", "viewer"]] },
  { id: "video", re: /video|transcod|clip/, layout: "line", nodes: [["client", "upload"], ["queue", "queue"], ["server", "transcode"], ["cdn", "deliver"]] },
  { id: "inference", re: /inference|serving|gpu|multi-gpu|speculative|quantization for|small language|on-premises|capacity planning|autoscal|kv-cache|disaggregated/, layout: "line", nodes: [["queue", "queue"], ["gpu", "GPU"], ["gpu", "GPU"], ["client", "tokens"]] },
  { id: "semantic-cache", re: /semantic cach|caching llm|prompt caching|prefix/, layout: "line", nodes: [["user", "request"], ["cache", "cache"], ["model", "LLM"], ["db", "store"]] },
  { id: "cache", re: /cach(e|ing)|thundering herd|coherence/, layout: "line", nodes: [["user", "request"], ["cache", "cache"], ["server", "origin"], ["db", "store"]] },
  { id: "fine-tune", re: /fine-tun|lora|rlhf|dpo|grpo|verifiable rewards|synthetic data|training data|catastrophic|preference data|labeling/, layout: "line", nodes: [["db", "data"], ["gpu", "train"], ["model", "tuned"], ["shield", "eval"]] },
  { id: "flywheel", re: /flywheel|feedback loop|a\/b|experimentation|online evaluation/, layout: "loop", nodes: [["user", "users"], ["model", "model"], ["db", "logs"]] },
  { id: "eval", re: /evaluat|benchmark|golden dataset|llm-as-judge|slos?\b|error budget/, layout: "line", nodes: [["doc", "test set"], ["model", "model"], ["shield", "judge"], ["server", "score"]] },
  { id: "observability", re: /observab|monitoring|tracing|telemetry|logging and monitoring|drift/, layout: "line", nodes: [["server", "app"], ["queue", "traces"], ["db", "store"], ["client", "dashboard"]] },
  { id: "prompt-mgmt", re: /prompt management|versioning system/, layout: "line", nodes: [["doc", "prompt v7"], ["db", "registry"], ["shield", "eval gate"], ["server", "prod"]] },
  { id: "agent-runtime", re: /agent|workflow automation|orchestrat|tool use|tool and function|mcp|model context|planning strateg|runtime|human-in-the-loop/, layout: "fan", nodes: [["model", "agent"], ["server", "tool"], ["db", "memory"], ["doc", "files"]] },
  { id: "durable", re: /durable|task scheduler|cron|job scheduler/, layout: "line", nodes: [["server", "scheduler"], ["queue", "jobs"], ["server", "worker"], ["db", "state"]] },
  { id: "voice", re: /voice|speech|audio|meeting/, layout: "line", nodes: [["phone", "speech"], ["model", "STT"], ["model", "LLM"], ["doc", "notes"]] },
  { id: "media", re: /image generation|diffusion/, layout: "line", nodes: [["user", "prompt"], ["model", "model"], ["doc", "image"], ["cdn", "deliver"]] },
  { id: "translate", re: /translat|locali/, layout: "line", nodes: [["doc", "source"], ["model", "LLM"], ["shield", "QA"], ["doc", "target"]] },
  { id: "commerce", re: /commerce|payment|billing|checkout|inventory|ticket-booking|booking/, layout: "line", nodes: [["user", "buyer"], ["server", "checkout"], ["lock", "payment"], ["db", "ledger"]] },
  { id: "recommend", re: /recommend|personaliz|feed|ranking|collaborative filtering/, layout: "line", nodes: [["user", "user"], ["db", "candidates"], ["model", "ranker"], ["doc", "feed"]] },
  { id: "geo", re: /geospatial|ride-sharing|marketplace|eta/, layout: "line", nodes: [["phone", "location"], ["server", "geo index"], ["db", "cells"], ["user", "nearby"]] },
  { id: "bidding", re: /bidding|auction|matching engine/, layout: "line", nodes: [["user", "order"], ["queue", "sequencer"], ["server", "matcher"], ["db", "journal"]] },
  { id: "realtime", re: /notification|presence|websocket|chat system|long polling|server-sent/, layout: "line", nodes: [["server", "service"], ["lb", "gateway"], ["queue", "fanout"], ["phone", "devices"]] },
  { id: "chat", re: /chat|assistant|support|copilot|coding|clinical|tutoring/, layout: "line", nodes: [["user", "user"], ["model", "LLM"], ["server", "tools"], ["doc", "answer"]] },
  { id: "search", re: /search|retriev|index|inverted|autocomplete|spell|crawler|typeahead/, layout: "line", nodes: [["user", "query"], ["lb", "route"], ["db", "index"], ["doc", "results"]] },
  { id: "lakehouse", re: /lakehouse|data lake|table format|iceberg|columnar|olap|parquet/, layout: "line", nodes: [["queue", "stream"], ["doc", "parquet files"], ["db", "table format"], ["client", "engines"]] },
  { id: "sketches", re: /bloom|count-min|probabilistic|t-digest|percentile|sketch|hyperloglog/, layout: "line", nodes: [["user", "item"], ["server", "hash"], ["db", "bit array"], ["doc", "maybe / no"]] },
  { id: "tsdb", re: /time-series|metrics storage/, layout: "line", nodes: [["server", "agent"], ["queue", "ingest"], ["db", "blocks"], ["client", "dashboard"]] },
  { id: "api", re: /\bapis?\b|rest vs|grpc|graphql|pagination|webhook|idempotenc|long-running operations/, layout: "line", nodes: [["client", "client"], ["lb", "API"], ["server", "service"], ["db", "data"]] },
  { id: "lock", re: /\blocks?\b|mutex|lease|fencing/, layout: "line", nodes: [["server", "node A"], ["lock", "lock"], ["server", "node B"], ["db", "resource"]] },
  { id: "gossip", re: /gossip|heartbeat|failure detect/, layout: "fan", nodes: [["server", "node"], ["server", "peer"], ["server", "peer"], ["server", "peer"]] },
  { id: "crdt", re: /crdt|conflict resolution|collaborative/, layout: "fan", nodes: [["db", "merge"], ["phone", "replica A"], ["client", "replica B"], ["server", "replica C"]] },
  { id: "queue", re: /queue|stream processing|kafka|pulsar|event sourcing|cqrs|exactly-once|outbox|change data|dead letter|pub.?sub/, layout: "line", nodes: [["server", "producer"], ["queue", "broker"], ["server", "consumer"], ["db", "sink"]] },
  { id: "storage-engine", re: /b-tree|lsm|write-ahead|compaction|storage engine|compression/, layout: "line", nodes: [["server", "write"], ["db", "WAL"], ["db", "memtable"], ["doc", "sorted files"]] },
  { id: "database", re: /database|nosql|shard|partition|consistent hashing|replication|transaction|consisten|raft|paxos|consensus|leader|spanner|dynamo|key-value|normalization|indexing|query optim|connection pool|schema migration|distributed id|hot partition/, layout: "fan", nodes: [["db", "leader"], ["db", "replica"], ["db", "replica"], ["db", "replica"]] },
  { id: "multi-region", re: /multi-region|region|failover|disaster|cell-based|chaos|availability/, layout: "fan", nodes: [["cloud", "region A"], ["cloud", "region B"], ["cloud", "region C"], ["lb", "route"]] },
  { id: "degrade", re: /degrad|fallback|reliab|resilien|circuit|retries|failures|deployment strateg|canary|shadow|spend|cost runaway/, layout: "line", nodes: [["user", "request"], ["model", "primary"], ["cache", "fallback"], ["client", "reply"]] },
  { id: "cost", re: /cost|token|estimat|budget|finops|chargeback|pricing|economics|latency/, layout: "line", nodes: [["client", "usage"], ["gpu", "tokens"], ["db", "ledger"], ["doc", "invoice"]] },
  { id: "platform", re: /platform|architecture|framework|strategy|build vs buy|methodology|foundation|design|scaling|microservice|monolith/, layout: "fan", nodes: [["lb", "gateway"], ["model", "models"], ["db", "data"], ["shield", "control"]] },
];

const DEFAULT: Motif = { id: "default", re: /./, layout: "line", nodes: [["client", "client"], ["server", "service"], ["db", "data"]] };

// A lesson's own banner frontmatter wins; otherwise the title decides first and tags only break ties.
export function motifFor(title: string, tags = "", override?: BannerSpec): Motif {
  if (override) return { id: "custom", re: /./, layout: override.layout, nodes: override.nodes };
  const t = title.toLowerCase();
  const all = `${t} ${tags.toLowerCase()}`;
  return MOTIFS.find((m) => m.re.test(t)) ?? MOTIFS.find((m) => m.re.test(all)) ?? DEFAULT;
}

// Split a label into at most two short lines on word boundaries; anything longer is cut with an ellipsis.
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const cut = (t: string) => (t.length > max ? `${t.slice(0, max - 1)}\u2026` : t);
  return lines.length <= 2 ? lines.map(cut) : [cut(lines[0]), cut(lines.slice(1).join(" "))];
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

export const BANNER_W = 280;
export const BANNER_H = 92;

// Draw a concept diagram: shaped nodes, labelled, with packets flowing along the edges.
export function drawBanner(g: G, m: Motif): void {
  const n = m.nodes.length;
  const size = n >= 4 ? 36 : 40;
  const spoke = n >= 5 ? 22 : 26;
  const pos: [number, number][] = [];
  const fan = m.layout === "fan";
  if (fan) {
    pos.push([66, 40]);
    const rest = n - 1;
    for (let i = 0; i < rest; i++) pos.push([170, rest === 1 ? 40 : 14 + (i * 52) / (rest - 1)]);
  } else {
    const x0 = 42;
    const x1 = BANNER_W - 42;
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

  const focus = fan ? 0 : Math.max(0, m.nodes.findIndex(([k]) => k === "model"));
  g.glow(pos[focus][0], pos[focus][1], 34, g.pal.accent, 0.14);

  m.nodes.forEach(([k, label], i) => {
    const [x, y] = pos[i];
    if (fan && i > 0) {
      node(g, k, x, y, { size: spoke, color: tone(g, k), active: k === "model", state: "working" });
      if (k === "model") g.ring(x, y, spoke * 0.5, g.pal.accent, 0.85, 1.2);
      g.text(wrap(label, 14)[0], x + spoke * 0.5 + 6, y + 3, { size: 9.5, color: g.pal.muted, align: "left" });
      return;
    }
    node(g, k, x, y, { size, color: tone(g, k), active: k === "model", state: "working" });
    if (k === "model") g.ring(x, y, size * 0.5, g.pal.accent, 0.85, 1.4);
    wrap(label, n >= 5 ? 8 : 10).forEach((line, li) =>
      g.text(line, x, y + size * 0.5 + 10 + li * 10, { size: 9.5, color: g.pal.muted, align: "center" }),
    );
  });
}
