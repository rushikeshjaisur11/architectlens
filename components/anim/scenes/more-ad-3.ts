import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-system-design";
const L = `${P}/llm-platforms-and-infrastructure`;
const D = `${P}/data-feedback-and-training-loops`;

const cacheAwareRouting: Scene = {
  title: "Routing requests to GPU replicas",
  caption: "Round robin ignores both load and what each replica already has cached. Routing by load and by shared prefix sends a request where there is room and where its system prompt is already computed, cutting time to first token.",
  controls: [{ id: "r", kind: "choice", label: "Routing", options: ["round robin", "load + prefix aware"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const smart = g.v.r === 1;
    node(g, "lb", 50, 110, { label: "router", size: 38 });
    const load = smart ? [0.45, 0.5, 0.4] : [0.9, 0.35, 0.6];
    const hit = smart ? [0.8, 0.2, 0.1] : [0.15, 0.2, 0.1];
    for (let k = 0; k < 3; k++) {
      const y = 50 + k * 62;
      node(g, "gpu", 250, y, { label: `replica ${k + 1}`, size: 34, color: load[k] > 0.8 ? pal.bad : pal.paper, active: true });
      g.packet(76, 106, 226, y, (g.t * 0.8 + k * 0.25) % 1, pal.accent, 2.4);
      bar(g, 310, y - 8, 90, 7, load[k], load[k] > 0.8 ? pal.bad : pal.ok);
      bar(g, 310, y + 4, 90, 7, hit[k], pal.teal);
    }
    g.text("load", 424, 46, { size: 9, align: "left", color: pal.muted });
    g.text("prefix hits", 424, 58, { size: 9, align: "left", color: pal.teal });
    const ttft = smart ? 180 : 520;
    g.text(`time to first token ~${ttft} ms`, 240, 244, { size: 13, color: smart ? pal.ok : pal.bad });
  },
};

const warmPool: Scene = {
  title: "GPU cold starts and the warm pool",
  caption: "Traffic jumps at second ten. A new replica must pull and load many gigabytes of weights before it can serve, which takes minutes. A pool of pre-loaded replicas absorbs the spike while new ones start.",
  controls: [{ id: "w", kind: "toggle", label: "Warm pool", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const warm = g.v.w === 1;
    const t = (g.t * 3) % 40;
    const load = t < 10 ? 0.4 : 0.9;
    const base = 2;
    const pool = warm ? 2 : 0;
    const coldReady = t > 10 + 25;
    const served = base + (t > 10 ? pool : 0) + (coldReady ? 2 : 0);
    for (let k = 0; k < 6; k++) {
      const on = k < served;
      const loading = !on && t > 10 && k < base + pool + 2 && !coldReady;
      node(g, "gpu", 50 + k * 70, 90, { size: 30, color: on ? pal.ok : loading ? pal.accent : pal.muted, a: on ? 1 : loading ? 0.7 : 0.3, active: on });
      if (loading) g.text("loading", 50 + k * 70, 120, { size: 8, color: pal.accent });
    }
    const cap = served * 0.25;
    const over = load > cap;
    g.text("load vs capacity", 70, 166, { size: 10 });
    bar(g, 170, 161, 220, 8, load, pal.accent);
    bar(g, 170, 175, 220, 8, cap, over ? pal.bad : pal.ok);
    g.text(over ? "queue growing: users wait ✕" : "capacity keeps up ✓", 240, 224, { size: 12, color: over ? pal.bad : pal.ok });
    g.text("weights take ~25 s to load on a cold replica", 240, 250, { size: 10, color: pal.muted });
  },
};

const vectorSegments: Scene = {
  title: "Segments in a vector database",
  caption: "Writes go to a log and a small in-memory segment that is searched by brute force, so they are visible immediately. Full segments are sealed and indexed in the background, then compacted together. A query searches all segments and merges the results.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.8, 1.8, 1.8]);
    node(g, "client", 40, 100, { label: "upsert", size: 32 });
    node(g, "db", 150, 150, { label: "WAL", size: 30, color: pal.violet });
    node(g, "cache", 150, 70, { label: "mutable segment", size: 36, active: i === 0 });
    g.packet(62, 94, 126, 70, i === 0 ? p : 1, pal.accent, 2.6);
    g.packet(62, 108, 128, 148, i === 0 ? p : 1, pal.violet, 2.4);
    [0, 1, 2].forEach((k) => {
      const on = i >= 1 && (k < 2 || i >= 3);
      node(g, "db", 270 + k * 56, 70, { size: 32, color: i >= 2 ? pal.ok : pal.blue, a: on ? 1 : 0.25 });
    });
    g.text("indexed segments", 326, 106, { size: 9, color: pal.muted });
    if (i === 1) g.packet(176, 70, 250, 70, p, pal.accent, 2.6);
    if (i === 3) {
      g.packet(270, 90, 326, 160, p, pal.ok, 2.4);
      g.packet(382, 90, 330, 160, p, pal.ok, 2.4);
      node(g, "db", 326, 170, { size: 40, color: pal.ok, label: "compacted" });
    }
    g.text(["write lands in the log and the live segment", "full segment is sealed and an index is built", "queries search every segment and merge", "compaction merges segments and drops deleted vectors"][i], 240, 246, { size: 12, color: pal.paper });
  },
};

const filterStrategy: Scene = {
  title: "Picking a filter strategy per query",
  caption: "A very selective filter leaves so few candidates that brute force over them is cheapest. A moderate one is best served by a filter-aware graph walk. A loose filter can use plain search and drop the misses. The planner estimates selectivity and chooses.",
  controls: [{ id: "s", kind: "range", label: "Filter keeps %", min: 1, max: 100, step: 1, initial: 5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const strat = s < 3 ? 0 : s < 40 ? 1 : 2;
    const names = ["brute force over the matches", "filtered graph traversal", "plain ANN, then drop misses"];
    names.forEach((nm, k) => {
      const y = 50 + k * 44;
      const on = k === strat;
      g.rect(30, y - 16, 270, 32, on ? pal.ok : pal.line, on ? 0.22 : 0.07, 8);
      g.frame(30, y - 16, 270, 32, on ? pal.ok : pal.line, on ? 1 : 0.4, 8, on ? 2 : 1);
      g.text(nm, 44, y, { size: 11, align: "left", color: on ? pal.paper : pal.muted });
    });
    node(g, "db", 400, 80, { size: 54, color: pal.blue, fill: s / 100 });
    g.text(`${s}% of vectors match`, 400, 126, { size: 10, color: pal.muted });
    const cost = [s * 0.4, 8 + s * 0.05, 10 + (100 - s) * 0.35][strat];
    g.text("estimated cost", 60, 214, { size: 10 });
    bar(g, 150, 209, 200, 8, Math.min(1, cost / 40), pal.accent);
    g.text(`${cost.toFixed(0)} ms`, 400, 214, { size: 11, color: pal.paper });
    g.text("recall stays high because the strategy fits the selectivity", 240, 248, { size: 10, color: pal.muted });
  },
};

const tailSampling: Scene = {
  title: "Tail-based sampling of traces",
  caption: "Storing every full trace is too costly. Keep every trace that failed, scored badly or cost a lot, plus a small random sample of the healthy rest. Metrics are still computed from all traffic, so the dashboards stay accurate.",
  controls: [{ id: "s", kind: "range", label: "Healthy sample %", min: 0, max: 30, step: 2, initial: 6 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pct = g.v.s / 100;
    let kept = 0;
    let keptBad = 0;
    const N = 80;
    for (let k = 0; k < N; k++) {
      const bad = g.rnd(k * 3.7) < 0.1;
      const keep = bad || g.rnd(k * 9.1 + 4) < pct;
      if (keep) kept++;
      if (bad && keep) keptBad++;
      const x = 30 + (k % 20) * 21;
      const y = 50 + Math.floor(k / 20) * 22;
      g.rect(x, y, 17, 17, bad ? pal.bad : pal.blue, keep ? 0.7 : 0.15, 3);
      if (keep) g.frame(x - 1, y - 1, 19, 19, pal.ok, 0.8, 3, 1);
    }
    node(g, "db", 456, 180, { size: 30, color: pal.blue, fill: kept / N });
    g.text("red = failing traces, green outline = stored", 240, 160, { size: 9, color: pal.muted });
    g.text(`${kept} of ${N} traces stored, every failing one kept`, 240, 200, { size: 13, color: pal.paper });
    g.text(`storage ${Math.round((kept / N) * 100)}% of the full volume`, 240, 232, { size: 12, color: pal.ok });
  },
};

const metricToTrace: Scene = {
  title: "From a dropped metric to the failing trace",
  caption: "The quality score falls right after a deploy marker. Filtering low-score traces shows a pattern: the retrieval step returned nothing. Opening one trace tree points at the empty retrieval, which is a different fault from a bad prompt.",
  controls: [{ id: "s", kind: "choice", label: "Step", options: ["1 dashboard", "2 filter traces", "3 open a trace"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    if (s === 0) {
      let pv: [number, number] | null = null;
      for (let k = 0; k < 40; k++) {
        const v = k < 24 ? 0.9 + (g.rnd(k) - 0.5) * 0.04 : 0.72 + (g.rnd(k) - 0.5) * 0.04;
        const x = 40 + k * 10;
        const y = 190 - v * 130;
        if (pv) g.line(pv[0], pv[1], x, y, v < 0.8 ? pal.bad : pal.blue, 1, 2);
        pv = [x, y];
      }
      g.line(40 + 24 * 10, 50, 40 + 24 * 10, 190, pal.accent, 0.8, 1.6);
      g.text("deploy", 40 + 24 * 10, 44, { size: 9, color: pal.accent });
      g.text("faithfulness score drops after the deploy", 240, 226, { size: 12, color: pal.paper });
    } else if (s === 1) {
      for (let k = 0; k < 14; k++) {
        const y = 44 + k * 13;
        g.rect(40, y, 400, 10, pal.bad, 0.2, 3);
        g.text(`trace ${k + 1}   retrieval: 0 documents   score 0.${2 + (k % 3)}`, 50, y + 5, { size: 8, align: "left", color: pal.paper });
      }
      g.text("every low-score trace has an empty retrieval", 240, 240, { size: 12, color: pal.bad });
    } else {
      const nodes: [string, number, number, "client" | "db" | "gpu", boolean][] = [["request", 240, 50, "client", false], ["retrieve: 0 docs", 130, 120, "db", true], ["llm call", 350, 120, "gpu", false]];
      g.line(240, 50, 130, 120, pal.line, 0.8, 1.3);
      g.line(240, 50, 350, 120, pal.line, 0.8, 1.3);
      nodes.forEach(([nm, x, y, kind, bad]) => {
        node(g, kind, x, y, { label: nm, size: 34, color: bad ? pal.bad : pal.paper });
      });
      g.packet(240, 62, 130, 108, g.loop(1.8), pal.accent, 2.4);
      g.text("alias pointed at an empty collection: not a prompt problem", 240, 226, { size: 12, color: pal.ok });
    }
  },
};

const guardCascade: Scene = {
  title: "A cascade of cheap to expensive checks",
  caption: "Fast rules catch the obvious. A small classifier handles most of the rest. Only uncertain or high-risk requests reach the slower judge model. Pick a request to see where the cascade stops it.",
  controls: [{ id: "r", kind: "choice", label: "Request", options: ["clear violation", "normal request", "borderline case"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const r = g.v.r;
    const stop = r === 0 ? 0 : r === 1 ? 1 : 2;
    const stages: [string, string, string][] = [["rules", "<1 ms", "credit card number found"], ["small classifier", "~8 ms", "safe, 0.98"], ["judge model", "~300 ms", "reads the policy and decides"]];
    stages.forEach(([nm, t, note], k) => {
      const y = 50 + k * 50;
      const reach = k <= stop;
      g.rect(30, y - 18, 300, 36, reach ? [pal.ok, pal.blue, pal.violet][k] : pal.line, reach ? 0.2 : 0.06, 8);
      g.frame(30, y - 18, 300, 36, reach ? [pal.ok, pal.blue, pal.violet][k] : pal.line, reach ? 1 : 0.4, 8, 1.2);
      g.text(nm, 44, y - 4, { size: 11, align: "left", color: reach ? pal.paper : pal.muted });
      g.text(reach && k === stop ? note : t, 44, y + 10, { size: 9, align: "left", color: reach ? pal.muted : pal.muted });
      if (reach && k < stop) g.arrow(180, y + 18, 180, y + 32, pal.line, 0.8);
    });
    node(g, "shield", 400, 100, { size: 36, color: r === 0 ? pal.bad : pal.ok });
    g.text(r === 0 ? "blocked" : r === 1 ? "allowed" : "decided by the judge", 400, 138, { size: 10, color: r === 0 ? pal.bad : pal.ok });
    const lat = [1, 9, 310][stop];
    g.text(`added latency ~${lat} ms`, 240, 224, { size: 13, color: lat < 50 ? pal.ok : pal.accent });
  },
};

const chunkCheck: Scene = {
  title: "Checking a streaming reply",
  caption: "Waiting for the whole reply defeats streaming. The output rail checks it chunk by chunk and cuts the stream the moment a violation appears. A small holdback window lets the checker see enough context, at a small cost in latency.",
  controls: [{ id: "c", kind: "toggle", label: "Check as it streams", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.c === 1;
    const t = (g.t * 6) % 24;
    const bad = 14;
    g.orb("composing", 50, 70, 38, pal.paper, 1);
    for (let k = 0; k < 20; k++) {
      const shown = k < t;
      const isBad = k >= bad && k < bad + 3;
      const cut = on && t > bad + 1 && k >= bad;
      g.rect(100 + (k % 10) * 36, 50 + Math.floor(k / 10) * 36, 32, 28, cut ? pal.line : isBad ? pal.bad : pal.accent, shown ? (cut ? 0.1 : 0.55) : 0.1, 4);
    }
    node(g, "shield", 456, 70, { size: 28, color: on ? pal.ok : pal.muted });
    const shownBad = !on && t > bad;
    g.text(on ? (t > bad + 1 ? "violation detected: stream cut, safe message shown ✓" : "each chunk is screened as it arrives") : shownBad ? "the harmful text was already shown ✕" : "no rail on the stream", 240, 170, { size: 12, color: on ? (t > bad + 1 ? pal.ok : pal.paper) : shownBad ? pal.bad : pal.paper });
    g.text("red blocks are the policy-violating tokens", 240, 200, { size: 10, color: pal.muted });
  },
};

const simThreshold: Scene = {
  title: "Choosing the similarity threshold",
  caption: "Cached questions sit at different distances from a new one. A low threshold hits more often but starts returning answers for a different question. Raise it and false hits vanish, along with some real hits. Tune it on labelled pairs.",
  controls: [{ id: "t", kind: "range", label: "Similarity threshold", min: 0.7, max: 0.99, step: 0.01, initial: 0.9 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const th = g.v.t;
    const pairs: [string, number, boolean][] = [["how do I reset my password?", 0.99, true], ["forgot password help", 0.93, true], ["change my password", 0.9, true], ["how do I cancel my order?", 0.86, false], ["how do I cancel my subscription?", 0.78, false], ["reset my 2FA device", 0.74, false]];
    chip(g, 240, 28, 'cached: "how do I reset my password?"', pal.accent, 10);
    let hits = 0;
    let wrong = 0;
    pairs.forEach(([q, sim, same], k) => {
      const y = 66 + k * 30;
      const hit = sim >= th;
      const bad = hit && !same;
      if (hit) hits++;
      if (bad) wrong++;
      const col = bad ? pal.bad : hit ? pal.ok : pal.line;
      g.rect(24, y - 12, 300, 24, col, hit ? 0.2 : 0.07, 5);
      g.text(q, 32, y, { size: 10, align: "left", color: hit ? pal.paper : pal.muted });
      g.text(sim.toFixed(2), 304, y, { size: 10, color: pal.muted });
      g.text(bad ? "wrong answer served" : hit ? "cache hit" : "model call", 340, y, { size: 10, align: "left", color: bad ? pal.bad : hit ? pal.ok : pal.muted });
    });
    g.text(`${hits} hits, ${wrong} wrong`, 240, 262, { size: 13, color: wrong ? pal.bad : pal.ok });
  },
};

const scopeLeak: Scene = {
  title: "Scoping the cache by tenant",
  caption: "Two tenants ask the same question and the answer depends on each tenant's own data. A shared global cache hands tenant B the answer built from tenant A's documents. Scoping the key by tenant keeps the answers separate.",
  controls: [{ id: "s", kind: "toggle", label: "Scope by tenant", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const scoped = g.v.s === 1;
    const { i, p } = g.stage([2, 2.4]);
    node(g, "user", 50, 70, { label: "tenant A", size: 32 });
    node(g, "user", 50, 170, { label: "tenant B", size: 32, color: pal.violet });
    if (scoped) {
      node(g, "cache", 240, 70, { label: "A's cache", size: 40, color: pal.blue });
      node(g, "cache", 240, 170, { label: "B's cache", size: 40, color: pal.violet });
    } else node(g, "cache", 240, 120, { label: "shared cache", size: 46 });
    g.orb("working", 420, 120, 40, pal.paper, 1);
    if (i === 0) {
      g.packet(76, 70, scoped ? 214 : 214, scoped ? 70 : 112, p, pal.accent, 3);
      chip(g, 330, 70, "stored: A's HR policy", pal.blue, 9);
    } else {
      g.packet(76, 170, 214, scoped ? 170 : 128, p, pal.violet, 3);
      if (scoped) chip(g, 330, 170, "miss: B's own answer", pal.ok, 9);
      else {
        g.packet(214, 128, 76, 176, g.clamp(p * 1.1), pal.bad, 3);
        chip(g, 330, 190, "B receives A's policy ✕", pal.bad, 9);
      }
    }
    g.text(scoped ? "keys include the tenant: no cross-tenant hits" : "same question, same key: data leaks across tenants", 240, 244, { size: 11, color: scoped ? pal.ok : pal.bad });
  },
};

const taxonomyCoverage: Scene = {
  title: "Generating by taxonomy cell",
  caption: "Each cell is a combination of topic, persona and difficulty. One repeated prompt fills only a few cells with near-duplicates. Generating per cell covers the whole space, including the rare cases that matter.",
  controls: [{ id: "t", kind: "toggle", label: "Taxonomy-driven", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const tax = g.v.t === 1;
    const cols = 10;
    const rows = 5;
    let covered = 0;
    const sweep = g.clamp((g.t % 6) / 4);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const filled = tax ? k / (rows * cols) < sweep : (c < 3 && r < 2 && k / 30 < sweep) || (g.rnd(k * 3.3) < 0.12 && k / 50 < sweep);
        if (filled) covered++;
        g.rect(30 + c * 43, 40 + r * 34, 39, 30, filled ? pal.ok : pal.line, filled ? 0.45 : 0.08, 5);
      }
    g.text("topic →", 240, 34, { size: 9, color: pal.muted });
    g.orb("composing", 456, 40, 22, pal.paper, 1);
    g.text(`${covered} of ${rows * cols} cells covered`, 240, 226, { size: 13, color: covered > 40 ? pal.ok : pal.bad });
    g.text(tax ? "rare cells get examples too" : "a single prompt clusters in a corner", 240, 254, { size: 10, color: pal.muted });
  },
};

const collapse: Scene = {
  title: "Model collapse from training on its own output",
  caption: "Each generation is trained on the previous one's samples. Rare cases are under-sampled and drop out, so the distribution narrows with every round. Mixing in real data keeps the tails alive.",
  controls: [
    { id: "g", kind: "range", label: "Generations", min: 0, max: 6, step: 1, initial: 4 },
    { id: "r", kind: "toggle", label: "Mix in real data" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const gen = g.v.g;
    const real = g.v.r === 1;
    const width = real ? 1 - gen * 0.03 : Math.max(0.15, 1 - gen * 0.16);
    const x0 = 30;
    let pv: [number, number] | null = null;
    for (let k = 0; k <= 80; k++) {
      const u = (k / 80) * 2 - 1;
      const y = 190 - 110 * Math.exp(-((u / (0.45 * width)) ** 2));
      const x = x0 + (k / 80) * 420;
      if (pv) g.line(pv[0], pv[1], x, y, pal.accent, 1, 2.2);
      pv = [x, y];
    }
    g.line(x0, 190, 450, 190, pal.line, 1, 1.2);
    g.text("rare cases (the tails)", 60, 176, { size: 9, align: "left", color: pal.muted });
    g.text("rare cases", 440, 176, { size: 9, align: "right", color: pal.muted });
    node(g, "gpu", 456, 40, { size: 22 });
    g.text(`generation ${gen}: distribution ${Math.round(width * 100)}% as wide as the original`, 240, 226, { size: 12, color: width < 0.6 ? pal.bad : pal.ok });
    g.text(real ? "real data keeps the tails from vanishing" : "errors and narrowness compound each round", 240, 252, { size: 10, color: pal.muted });
  },
};

const labelVotes: Scene = {
  title: "Redundant labels and adjudication",
  caption: "Three annotators label each item. When they agree the label stands. When they split, the item goes to a senior reviewer whose decision becomes the consensus label and often a new example in the guidelines.",
  controls: [{ id: "i", kind: "choice", label: "Item", options: ["clear case", "hard case"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hard = g.v.i === 1;
    const votes = hard ? ["A", "B", "A"] : ["A", "A", "A"];
    node(g, "doc", 60, 110, { label: "item", size: 40, color: pal.blue });
    votes.forEach((v, k) => {
      const y = 50 + k * 60;
      node(g, "user", 190, y, { size: 28 });
      chip(g, 250, y, `label ${v}`, v === "A" ? pal.ok : pal.accent, 10);
      g.packet(84, 106, 168, y, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2);
      g.packet(278, y, 340, 110, (g.t * 0.8 + k * 0.2 + 0.4) % 1, v === "A" ? pal.ok : pal.accent, 2);
    });
    if (hard) {
      node(g, "user", 380, 110, { label: "senior reviewer", size: 34, color: pal.accent });
      chip(g, 380, 168, "final: A + guideline note", pal.ok, 9);
    } else chip(g, 380, 110, "agreed: label A", pal.ok, 11);
    g.text(hard ? "disagreement is signal: fix the guideline too" : "unanimous: accepted without review", 240, 244, { size: 12, color: pal.paper });
  },
};

const goldChecks: Scene = {
  title: "Gold questions find unreliable annotators",
  caption: "Hidden items with known answers are mixed into everyone's work. Each annotator's accuracy on them is tracked. Raise the bar and the annotators below it are flagged for retraining or removal, and their recent labels are re-checked.",
  controls: [{ id: "b", kind: "range", label: "Required gold accuracy %", min: 60, max: 95, step: 5, initial: 80 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const th = g.v.b / 100;
    const accs = [0.94, 0.88, 0.82, 0.76, 0.52];
    const names = ["Ana", "Raj", "Mei", "Lee", "Sam"];
    let flagged = 0;
    accs.forEach((a, k) => {
      const y = 50 + k * 32;
      const bad = a < th;
      if (bad) flagged++;
      node(g, "user", 40, y, { size: 18, color: bad ? pal.bad : pal.paper });
      g.text(names[k], 80, y, { size: 11, align: "left", color: bad ? pal.bad : pal.paper });
      bar(g, 130, y - 4, 230, 8, a, bad ? pal.bad : pal.ok);
      g.text(`${Math.round(a * 100)}%`, 390, y, { size: 11, color: pal.paper });
      if (bad) g.text("retrain", 436, y, { size: 9, color: pal.bad });
    });
    g.line(130 + th * 230, 36, 130 + th * 230, 196, pal.accent, 0.9, 1.6);
    g.text(`${flagged} of 5 annotators below the bar`, 240, 224, { size: 13, color: flagged ? pal.accent : pal.ok });
    g.text("also watch agreement and answer speed", 240, 250, { size: 10, color: pal.muted });
  },
};

const bucketAssign: Scene = {
  title: "Deterministic assignment and ramp-up",
  caption: "Each user id is hashed with the experiment id into a bucket from 0 to 99, so the same user always lands in the same variant with no lookup. Ramp the share up gradually, and guardrails can stop it automatically.",
  controls: [{ id: "r", kind: "range", label: "Traffic in experiment %", min: 5, max: 100, step: 5, initial: 30 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pct = g.v.r;
    for (let k = 0; k < 100; k++) {
      const x = 30 + (k % 20) * 21.5;
      const y = 40 + Math.floor(k / 20) * 24;
      const inExp = k < pct;
      const variant = k % 2 === 0;
      g.rect(x, y, 18, 18, inExp ? (variant ? pal.accent : pal.blue) : pal.line, inExp ? 0.55 : 0.1, 3);
    }
    g.text("each square is a bucket of users: hash(user, experiment) mod 100", 240, 30, { size: 9, color: pal.muted });
    node(g, "lb", 70, 190, { label: "assign", size: 28 });
    chip(g, 200, 190, "control", pal.blue, 10);
    chip(g, 300, 190, "treatment", pal.accent, 10);
    g.text(`${pct}% in the test, split evenly`, 240, 236, { size: 12, color: pal.paper });
    g.text(pct > 50 ? "full ramp only after guardrails held at lower shares" : "start small, check cost, latency and safety", 240, 258, { size: 10, color: pal.muted });
  },
};

const powerCurve: Scene = {
  title: "How much traffic does the test need?",
  caption: "The smaller the improvement you want to detect, the more users you need, and the need grows fast. Noisy LLM metrics make it worse. Slide the effect size to see why tiny changes are not worth a test.",
  controls: [{ id: "e", kind: "range", label: "Minimum effect (points)", min: 0.5, max: 5, step: 0.5, initial: 1.5 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const e = g.v.e;
    const n = (eff: number) => (16 * 0.25) / ((eff / 100) ** 2);
    const x = (eff: number) => 40 + ((eff - 0.5) / 4.5) * 400;
    const y = (v: number) => 195 - (Math.log10(v) / 6) * 130;
    let pv: [number, number] | null = null;
    for (let eff = 0.5; eff <= 5; eff += 0.1) {
      const px = x(eff);
      const py = y(n(eff));
      if (pv) g.line(pv[0], pv[1], px, py, pal.accent, 1, 2.2);
      pv = [px, py];
    }
    g.dot(x(e), y(n(e)), 6, pal.ok);
    g.glow(x(e), y(n(e)), 18, pal.ok, 0.4);
    g.line(40, 195, 440, 195, pal.line, 1, 1.2);
    g.text("smallest improvement worth detecting (points) →", 240, 214, { size: 9, color: pal.muted });
    g.text(`${fmt(n(e))} users per arm`, 240, 236, { size: 14, color: n(e) > 50000 ? pal.bad : pal.ok, bold: true });
    node(g, "user", 456, 50, { size: 22 });
  },
};

export const MORE_AD_3: Record<string, Scene[]> = {
  [`${L}/designing-an-llm-inference-platform`]: [cacheAwareRouting, warmPool],
  [`${L}/designing-a-vector-database-service`]: [vectorSegments, filterStrategy],
  [`${L}/designing-an-llm-observability-platform`]: [tailSampling, metricToTrace],
  [`${L}/designing-a-guardrails-service`]: [guardCascade, chunkCheck],
  [`${L}/designing-a-semantic-caching-service`]: [simThreshold, scopeLeak],
  [`${D}/designing-a-synthetic-data-generation-pipeline`]: [taxonomyCoverage, collapse],
  [`${D}/designing-a-human-labeling-and-preference-data-platform`]: [labelVotes, goldChecks],
  [`${D}/designing-an-online-experimentation-platform-for-llm-features`]: [bucketAssign, powerCurve],
};
