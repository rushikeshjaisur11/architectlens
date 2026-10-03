import type { G, Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-systems";

// Small meter used by several scenes: label, value 0..1, text.
function meter(g: G, x: number, y: number, w: number, label: string, v: number, text: string, color: string): void {
  g.text(label, x, y - 6, { size: 9, color: g.pal.muted, align: "left" });
  bar(g, x, y, w, 8, v, color);
  g.text(text, x + w + 8, y + 5, { size: 10, color: g.pal.paper, align: "left" });
}

const contextEng: Scene = {
  title: "Context grows every turn: curate it or it rots",
  caption: "Each agent turn adds tool output. The naive agent appends everything, so the window fills with stale text and recall of the important facts falls. The curated agent trims tool results, keeps notes outside the window and compacts when it gets large.",
  controls: [
    { id: "s", kind: "choice", label: "Strategy", options: ["append everything", "curate + compact"], initial: 0 },
    { id: "t", kind: "range", label: "Turn", min: 1, max: 24, step: 1, initial: 12 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const turn = g.v.t;
    const cur = g.v.s === 1;
    const sys = 3;
    const tools = 5;
    let hist = 0;
    for (let i = 1; i <= turn; i++) {
      hist += cur ? 0.6 : 8;
      if (cur && hist > 14) hist = 4;
    }
    const total = sys + tools + hist;
    const cap = 200;
    const x0 = 30;
    const w = 420;
    g.text("context window (thousands of tokens)", x0, 34, { size: 10, color: pal.muted, align: "left" });
    g.rect(x0, 44, w, 26, pal.line, 0.25, 6);
    const seg = (a: number, b: number, c: string) => g.rect(x0 + (a / cap) * w, 44, Math.max(0, ((b - a) / cap) * w), 26, c, 0.9, 4);
    seg(0, sys, pal.violet);
    seg(sys, sys + tools, pal.blue);
    seg(sys + tools, Math.min(cap, total), cur ? pal.ok : pal.accent);
    g.text(`${fmt(Math.round(total))}k of ${cap}k`, x0 + w, 88, { size: 10, color: pal.paper, align: "right" });
    chip(g, 70, 100, "system 3k", pal.violet, 9);
    chip(g, 160, 100, "tools 5k", pal.blue, 9);
    chip(g, 262, 100, cur ? `history ${hist.toFixed(1)}k (trimmed)` : `history ${fmt(Math.round(hist))}k`, cur ? pal.ok : pal.accent, 9);
    const rot = Math.min(1, Math.max(0, (total - 20) / 180));
    const recall = 0.98 - 0.45 * rot;
    meter(g, 30, 150, 300, "recall of an early instruction", recall, `${Math.round(recall * 100)}%`, recall > 0.8 ? pal.ok : recall > 0.65 ? pal.accent : pal.bad);
    const cost = (total * 1000 * 2) / 1e6;
    meter(g, 30, 195, 300, "input cost this turn at $2 / M", Math.min(1, cost / 0.4), `$${cost.toFixed(3)}`, pal.blue);
    meter(g, 30, 240, 300, "notes kept outside the window", cur ? Math.min(1, turn / 24) : 0, cur ? `${turn} lines` : "none", pal.violet);
    g.text(cur ? "tool output trimmed at the tool, decisions saved as notes, history compacted" : "every tool result stays in the window", 240, 285, { size: 10, color: cur ? pal.ok : pal.bad });
  },
};

const reasoning: Scene = {
  title: "Thinking tokens buy accuracy at a price",
  caption: "More thinking tokens raise accuracy with diminishing returns, while latency and cost grow in a straight line. An easy task saturates early, so extra thinking is pure cost; a hard multi-step task keeps improving for longer.",
  controls: [
    { id: "e", kind: "range", label: "Effort level", min: 0, max: 4, step: 1, initial: 2 },
    { id: "k", kind: "choice", label: "Task", options: ["easy lookup", "hard multi-step"], initial: 1 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const tokens = [0, 600, 2500, 8000, 32000][g.v.e];
    const hard = g.v.k === 1;
    const base = hard ? 0.42 : 0.9;
    const rate = hard ? 0.00022 : 0.0035;
    const acc = base + (0.97 - base) * (1 - Math.exp(-rate * tokens));
    const secs = (tokens + 300) / 80;
    const cost = ((tokens + 300) * 10) / 1e6;
    g.orb("solving", 70, 70, 56, pal.accent, 0.6 + g.v.e * 0.4);
    g.text(`${fmt(tokens)} thinking tokens`, 70, 118, { size: 10, color: pal.paper });
    meter(g, 150, 60, 200, "accuracy", acc, `${Math.round(acc * 100)}%`, acc > 0.9 ? pal.ok : pal.accent);
    meter(g, 150, 100, 200, "latency at 80 tok/s", Math.min(1, secs / 420), `${secs < 10 ? secs.toFixed(1) : Math.round(secs)} s`, pal.blue);
    meter(g, 150, 140, 200, "cost per request at $10 / M", Math.min(1, cost / 0.35), `$${cost.toFixed(3)}`, pal.violet);
    const curveY = (t: number) => 250 - (base + (0.97 - base) * (1 - Math.exp(-rate * t))) * 90;
    g.text("accuracy vs thinking tokens", 30, 172, { size: 9, color: pal.muted, align: "left" });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * 32000;
      const b = ((k + 1) / 4) * 32000;
      g.line(30 + (a / 32000) * 420, curveY(a), 30 + (b / 32000) * 420, curveY(b), pal.accent, 1, 2);
    }
    g.dot(30 + (tokens / 32000) * 420, curveY(tokens), 5, pal.accent, 1);
    g.line(30, 252, 450, 252, pal.line, 1, 1);
    g.text(acc - base < 0.03 && g.v.e > 0 ? "saturated: more thinking adds cost, not accuracy" : "still improving", 240, 285, { size: 10, color: acc - base < 0.03 && g.v.e > 0 ? pal.bad : pal.ok });
  },
};

const parsing: Scene = {
  title: "Pick the parser by page type, not once for everything",
  caption: "A text-layer reader is free and exact on clean digital pages but returns nothing on scans. Layout-aware OCR handles scans; a vision model is best on complex tables and costs more per page. Routing by page type keeps quality high and cost low.",
  controls: [
    { id: "p", kind: "choice", label: "Parser", options: ["text layer", "layout + OCR", "vision model"], initial: 1 },
    { id: "g", kind: "choice", label: "Page", options: ["clean digital", "scanned", "complex table"], initial: 2 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const acc = [[0.97, 0.04, 0.45], [0.97, 0.9, 0.7], [0.96, 0.92, 0.9]][g.v.p][g.v.g];
    const cost = [0, 0.002, 0.02][g.v.p];
    node(g, "doc", 90, 110, { label: ["digital PDF", "scan", "table page"][g.v.g], size: 70, color: pal.paper });
    if (g.v.g === 2) for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.rect(66 + c * 17, 118 + r * 8, 14, 5, pal.accent, 0.5, 1);
    g.packet(130, 110, 220, 110, g.loop(1.4), pal.accent, 3);
    node(g, "model", 250, 110, { label: ["text layer", "layout + OCR", "vision model"][g.v.p], size: 44, color: pal.accent, state: "searching" });
    g.packet(276, 110, 360, 110, g.loop(1.4, 0.3), pal.accent, 3);
    node(g, "db", 400, 110, { label: "index", size: 40, color: pal.teal });
    meter(g, 40, 200, 280, "usable text (reading order, headers, tables)", acc, `${Math.round(acc * 100)}%`, acc > 0.85 ? pal.ok : acc > 0.5 ? pal.accent : pal.bad);
    meter(g, 40, 245, 280, "cost per page", Math.min(1, cost / 0.02), cost === 0 ? "free" : `$${cost.toFixed(3)}`, pal.blue);
    g.text(acc < 0.3 ? "scan: empty text, nothing to retrieve" : acc < 0.6 ? "table headers lost: numbers without meaning" : "good enough to index", 240, 288, { size: 10, color: acc < 0.6 ? pal.bad : pal.ok });
  },
};

const webSearch: Scene = {
  title: "Search budget, sources and what ends up cited",
  caption: "Each search costs money and adds results to the context. Restricting the tool to trusted domains raises the share of good sources and cuts unsupported claims; capping uses stops one prompt from triggering dozens of paid searches.",
  controls: [
    { id: "u", kind: "range", label: "Max searches", min: 1, max: 10, step: 1, initial: 4 },
    { id: "d", kind: "choice", label: "Domains", options: ["open web", "allow-listed"], initial: 0 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const uses = g.v.u;
    const good = g.v.d === 1 ? 0.92 : 0.6;
    node(g, "user", 40, 80, { label: "question", size: 34, color: pal.paper });
    node(g, "model", 130, 80, { label: "model", size: 38, color: pal.accent, state: "searching" });
    g.packet(60, 80, 108, 80, g.loop(1.4), pal.accent, 3);
    node(g, "cloud", 240, 80, { label: `${uses} searches`, size: 40, color: pal.blue });
    g.packet(152, 80, 218, 80, g.loop(1.4, 0.2), pal.accent, 3);
    const n = Math.min(10, uses * 2);
    for (let i = 0; i < 10; i++) {
      const ok = g.rnd(i + 3) < good;
      const x = 320 + (i % 5) * 28;
      const y = 60 + Math.floor(i / 5) * 28;
      g.rect(x, y, 22, 20, i < n ? (ok ? pal.ok : pal.bad) : pal.line, i < n ? 0.75 : 0.2, 3);
    }
    g.text("results (green good, red spam)", 390, 126, { size: 9, color: pal.muted });
    const tokens = uses * 3000;
    const fee = uses * 0.01;
    const tokCost = (tokens * 2) / 1e6;
    const unsupported = Math.round((1 - good) * 100 * (1 - Math.min(0.5, uses * 0.05)));
    meter(g, 40, 190, 260, "search fees", Math.min(1, fee / 0.1), `$${fee.toFixed(2)}`, pal.blue);
    meter(g, 40, 230, 260, "tokens added to context", Math.min(1, tokens / 30000), `${fmt(tokens)}  ($${tokCost.toFixed(3)})`, pal.violet);
    meter(g, 40, 270, 260, "claims with a weak source", unsupported / 40, `${unsupported}%`, unsupported > 15 ? pal.bad : pal.ok);
  },
};

const text2sql: Scene = {
  title: "Give the model a semantic layer, not the whole schema",
  caption: "Pasting every table into the prompt costs tokens and confuses the model as the warehouse grows. Retrieving relevant tables helps; a governed semantic layer with certified metrics helps most because the model queries definitions instead of guessing joins.",
  controls: [
    { id: "c", kind: "choice", label: "Context given to the model", options: ["full schema", "retrieved tables", "semantic layer"], initial: 0 },
    { id: "n", kind: "range", label: "Tables in warehouse", min: 10, max: 2000, step: 10, initial: 400 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const mode = g.v.c;
    const acc = [Math.max(0.08, 0.82 - n * 0.00036), Math.max(0.2, 0.8 - n * 0.00012), Math.max(0.55, 0.9 - n * 0.00004)][mode];
    const tokens = [n * 150, 6 * 150, 4 * 120][mode];
    node(g, "user", 40, 90, { label: "question", size: 34, color: pal.paper });
    node(g, "model", 140, 90, { label: "LLM", size: 40, color: pal.accent, state: "weaving" });
    g.packet(60, 90, 116, 90, g.loop(1.4), pal.accent, 3);
    node(g, mode === 2 ? "shield" : "doc", 250, 90, { label: ["schema dump", "relevant tables", "semantic layer"][mode], size: 40, color: [pal.bad, pal.accent, pal.ok][mode] });
    g.packet(164, 90, 226, 90, g.loop(1.4, 0.3), pal.accent, 3);
    node(g, "db", 400, 90, { label: "warehouse", size: 42, color: pal.teal });
    g.packet(276, 90, 376, 90, g.loop(1.4, 0.6), pal.accent, 3);
    meter(g, 40, 190, 280, "chance the number is right", acc, `${Math.round(acc * 100)}%`, acc > 0.75 ? pal.ok : acc > 0.5 ? pal.accent : pal.bad);
    meter(g, 40, 235, 280, "prompt tokens spent on schema", Math.min(1, tokens / 150000), fmt(tokens), pal.blue);
    g.text(mode === 2 ? "metrics defined once: revenue means the same thing every time" : mode === 1 ? "better, but joins and definitions are still guessed" : "huge prompt, many look-alike tables", 240, 285, { size: 10, color: mode === 2 ? pal.ok : pal.muted });
  },
};

const slm: Scene = {
  title: "Will it fit, and how fast will it run?",
  caption: "Weights take parameters times bits per parameter. Four-bit quantisation shrinks an 8B model from 16 GB to about 4 GB. Generation speed is roughly memory bandwidth divided by the bytes read per token, so small quantised models fly on modest hardware.",
  controls: [
    { id: "p", kind: "range", label: "Parameters (billions)", min: 1, max: 14, step: 1, initial: 4 },
    { id: "b", kind: "choice", label: "Precision", options: ["16-bit", "8-bit", "4-bit"], initial: 2 },
    { id: "d", kind: "choice", label: "Device", options: ["phone (4 GB free)", "laptop (10 GB free)", "workstation GPU (24 GB)"], initial: 0 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const bits = [16, 8, 4][g.v.b];
    const gb = (g.v.p * bits) / 8;
    const kv = 0.4;
    const need = gb + kv;
    const cap = [4, 10, 24][g.v.d];
    const bw = [60, 100, 900][g.v.d];
    const fits = need <= cap;
    const tps = bw / Math.max(0.5, gb);
    node(g, g.v.d === 0 ? "phone" : g.v.d === 1 ? "client" : "gpu", 70, 90, { label: ["phone", "laptop", "GPU"][g.v.d], size: 52, color: pal.paper });
    const x0 = 150;
    const w = 280;
    g.rect(x0, 70, w, 28, pal.line, 0.3, 6);
    g.rect(x0, 70, Math.min(w, (need / cap) * w), 28, fits ? pal.ok : pal.bad, 0.85, 6);
    g.text(`${need.toFixed(1)} GB needed of ${cap} GB`, x0 + w / 2, 120, { size: 10, color: fits ? pal.ok : pal.bad });
    chip(g, 240, 150, fits ? "fits" : "does not fit", fits ? pal.ok : pal.bad, 11);
    meter(g, 40, 200, 280, "generation speed (tokens per second)", fits ? Math.min(1, tps / 200) : 0, fits ? `${Math.round(tps)}` : "n/a", pal.blue);
    meter(g, 40, 245, 280, "weights only", Math.min(1, gb / 28), `${gb.toFixed(1)} GB`, pal.violet);
    g.text("speed is an estimate: bandwidth / weight bytes", 240, 288, { size: 9, color: pal.muted });
  },
};

const disagg: Scene = {
  title: "Same GPUs, three routers",
  caption: "Requests share long prefixes per customer. Random and load-only routers send a customer's next request to a replica that has not cached the prefix, so the prefill is repeated. A cache-aware router sends it where the prefix already lives, so first-token latency collapses.",
  controls: [{ id: "r", kind: "choice", label: "Router", options: ["random", "load only", "cache-aware"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const mode = g.v.r;
    const cols = [pal.accent, pal.blue, pal.violet];
    const hit = [0.25, 0.28, 0.92][mode];
    const ttft = 0.1 + (1 - hit) * 2.6;
    const thr = 1 / (0.35 + (1 - hit));
    const reps = [0, 1, 2, 3];
    reps.forEach((i) => {
      const x = 80 + i * 105;
      node(g, "gpu", x, 190, { label: `replica ${i + 1}`, size: 44, color: pal.paper });
      const owner = i < 3 ? i : -1;
      if (mode === 2 && owner >= 0) g.rect(x - 18, 224, 36, 8, cols[owner], 0.9, 3);
      else if (owner >= 0) g.rect(x - 18, 224, 36, 8, cols[(owner + Math.floor(g.t * 0.6)) % 3], 0.5, 3);
    });
    for (let k = 0; k < 3; k++) {
      const c = Math.floor(g.t * 1.2 + k * 1.7) % 3;
      const p = g.loop(1.5, k * 0.5);
      const target = mode === 2 ? c : Math.floor(g.rnd(Math.floor(g.t * 1.2 + k * 1.7) + 9) * 4);
      g.packet(240, 60 + k * 12, 80 + target * 105, 166, p, cols[c], 3);
    }
    node(g, "lb", 240, 56, { label: "router", size: 34, color: pal.paper });
    meter(g, 30, 258, 190, "prefix cache hit rate", hit, `${Math.round(hit * 100)}%`, hit > 0.7 ? pal.ok : pal.bad);
    g.text(`time to first token ~${ttft.toFixed(1)} s`, 330, 262, { size: 11, color: ttft < 0.6 ? pal.ok : pal.bad, align: "left" });
    g.text(`relative throughput ${thr.toFixed(1)}x`, 330, 280, { size: 10, color: pal.muted, align: "left" });
  },
};

const sandbox: Scene = {
  title: "What each isolation level stops",
  caption: "A malicious snippet tries three things: escape to the host kernel, read host secrets, and send data out. Containers share the host kernel; gVisor narrows it; a microVM has its own kernel. Network and credentials are separate switches that matter just as much.",
  controls: [
    { id: "i", kind: "choice", label: "Isolation", options: ["process", "container", "gVisor", "microVM"], initial: 1 },
    { id: "n", kind: "toggle", label: "Network allowed" },
    { id: "c", kind: "toggle", label: "Credentials mounted" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const lvl = g.v.i;
    const escape = lvl === 0 ? "reaches host" : lvl === 1 ? "possible via kernel bug" : lvl === 2 ? "mostly blocked" : "blocked";
    const escBad = lvl <= 1;
    const secrets = g.v.c === 1 ? "tokens inside: readable" : "nothing to read";
    const secBad = g.v.c === 1;
    const out = g.v.n === 1 ? "data leaves" : "no route out";
    const outBad = g.v.n === 1;
    node(g, "model", 60, 70, { label: "model code", size: 40, color: pal.accent, state: "working" });
    for (let k = 0; k < lvl + 1; k++) g.frame(120 + k * 6, 40 + k * 6, 110 - k * 12, 62 - k * 10, pal.ok, 0.8, 6, 1.4);
    node(g, "server", 350, 70, { label: "host", size: 44, color: pal.paper });
    [["escape to host kernel", escape, escBad], ["read secrets", secrets, secBad], ["exfiltrate over network", out, outBad]].forEach((row, k) => {
      const y = 160 + k * 38;
      g.rect(40, y - 14, 400, 30, pal.line, 0.15, 6);
      g.text(row[0] as string, 54, y + 2, { size: 10, color: pal.paper, align: "left" });
      g.text(row[1] as string, 430, y + 2, { size: 10, color: row[2] ? pal.bad : pal.ok, align: "right" });
    });
    g.packet(84, 70, 326, 70, g.loop(2), escBad ? pal.bad : pal.line, 3);
  },
};

const computerUse: Scene = {
  title: "Long tasks multiply small error rates",
  caption: "If each step succeeds with probability p, a task of n steps succeeds with p to the power n. Ninety-seven percent per step sounds great but gives about 30% over 40 steps. Shorter paths, better tools and checkpoints matter as much as a better model.",
  controls: [
    { id: "p", kind: "range", label: "Per-step success (%)", min: 90, max: 99.9, step: 0.1, initial: 97 },
    { id: "n", kind: "range", label: "Steps in the task", min: 5, max: 80, step: 1, initial: 40 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const p = g.v.p / 100;
    const n = g.v.n;
    const succ = Math.pow(p, n);
    const tokens = 4500 + n * 3200;
    const cost = (tokens * 2) / 1e6;
    for (let i = 0; i < 40; i++) {
      const step = Math.round((i / 39) * 79) + 1;
      const h = Math.pow(p, step) * 90;
      g.rect(40 + i * 10.4, 150 - h, 8, h, step <= n ? pal.accent : pal.line, step <= n ? 0.85 : 0.35, 2);
    }
    g.text("success chance after k steps", 40, 28, { size: 9, color: pal.muted, align: "left" });
    g.line(40, 152, 456, 152, pal.line, 1, 1);
    g.dot(40 + ((n - 1) / 79) * 39 * 10.4 + 4, 150 - succ * 90, 5, pal.paper, 1);
    meter(g, 40, 195, 280, `task success over ${n} steps`, succ, `${Math.round(succ * 100)}%`, succ > 0.8 ? pal.ok : succ > 0.5 ? pal.accent : pal.bad);
    meter(g, 40, 235, 280, "tokens (toolset + screenshots)", Math.min(1, tokens / 300000), `${fmt(tokens)}`, pal.blue);
    g.text(`about $${cost.toFixed(2)} per attempt at $2 / M input`, 240, 280, { size: 10, color: pal.muted });
  },
};

const durable: Scene = {
  title: "A crash mid-run: restart, checkpoint, or durable",
  caption: "Five steps, two with side effects (email, payment). The worker crashes during step 3. An in-memory agent restarts from the top and repeats the email. A checkpoint resumes but may redo step 3. A durable engine replays stored results and idempotency keys prevent duplicates.",
  controls: [{ id: "e", kind: "choice", label: "Execution", options: ["in-memory", "checkpoint only", "durable + idempotent"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const mode = g.v.e;
    const names = ["extract", "match", "email", "approve", "pay"];
    const kinds: ("model" | "db" | "client" | "user" | "lock")[] = ["model", "db", "client", "user", "lock"];
    const crashAt = 2;
    const { i, p } = g.stage([0.9, 0.9, 0.9, 1.4, 0.9, 0.9, 0.9]);
    names.forEach((nm, k) => {
      const x = 52 + k * 96;
      const done = i > k || (i === 3 && k <= crashAt - 0);
      const col = k === crashAt && i === 2 ? pal.bad : done ? pal.ok : pal.line;
      node(g, kinds[k], x, 80, { label: nm, size: 40, color: col });
    });
    if (i === 2) g.text("worker crashes", 52 + crashAt * 96, 36, { size: 11, color: pal.bad });
    if (i >= 3) g.text("new worker starts", 240, 36, { size: 11, color: pal.accent });
    const repeatsModel = mode === 0 ? 2 : mode === 1 ? 1 : 0;
    const dupEmail = mode === 0 ? 1 : mode === 1 ? 1 : 0;
    const resume = ["from step 1", "from last snapshot (step 2 or 3)", "exactly where it stopped"][mode];
    g.text(`resumes ${resume}`, 240, 150, { size: 11, color: pal.paper });
    meter(g, 40, 195, 260, "model calls repeated (cost)", repeatsModel / 2, `${repeatsModel}`, repeatsModel ? pal.accent : pal.ok);
    meter(g, 40, 235, 260, "duplicate side effects", dupEmail, dupEmail ? "1 extra email" : "none", dupEmail ? pal.bad : pal.ok);
    g.text(mode === 2 ? "stored results replayed, idempotency keys block repeats" : "a retry cannot tell which side effects already happened", 240, 285, { size: 10, color: mode === 2 ? pal.ok : pal.bad });
    void p;
  },
};

const voice: Scene = {
  title: "The 500 ms conversation budget",
  caption: "People expect a reply within a few hundred milliseconds. A cascaded pipeline pays for speech-to-text, the model and text-to-speech in sequence; a speech-to-speech model skips the text hops. Turn detection that waits too long adds dead air.",
  controls: [
    { id: "a", kind: "choice", label: "Architecture", options: ["cascaded STT + LLM + TTS", "speech-to-speech"], initial: 0 },
    { id: "t", kind: "range", label: "Turn-end wait (ms)", min: 100, max: 800, step: 20, initial: 300 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s2s = g.v.a === 1;
    const parts: [string, number, string][] = s2s
      ? [["turn end", g.v.t, pal.muted], ["speech model", 260, pal.accent]]
      : [["turn end", g.v.t, pal.muted], ["STT", 150, pal.blue], ["LLM first token", 250, pal.accent], ["TTS first audio", 150, pal.violet]];
    const total = parts.reduce((a, b) => a + b[1], 0);
    const x0 = 30;
    const scale = 420 / 1000;
    let x = x0;
    parts.forEach(([nm, ms, c]) => {
      g.rect(x, 90, ms * scale, 34, c, 0.85, 4);
      if (ms * scale > 40) g.text(nm, x + (ms * scale) / 2, 104, { size: 9, color: pal.ink });
      g.text(`${ms}`, x + (ms * scale) / 2, 142, { size: 9, color: pal.muted });
      x += ms * scale;
    });
    g.c.setLineDash([4, 4]);
    g.line(x0 + 500 * scale, 70, x0 + 500 * scale, 160, pal.ok, 0.9, 1.4);
    g.c.setLineDash([]);
    g.text("500 ms", x0 + 500 * scale, 62, { size: 9, color: pal.ok });
    g.text(`time to first audio: ${total} ms`, 240, 200, { size: 14, color: total <= 500 ? pal.ok : total <= 800 ? pal.accent : pal.bad });
    g.text(total <= 500 ? "feels natural" : total <= 800 ? "noticeable pause" : "feels broken", 240, 226, { size: 11, color: pal.muted });
    chip(g, 240, 262, s2s ? "tone and interruptions heard directly" : "text in the middle: easy to log and guard", s2s ? pal.accent : pal.blue, 9);
  },
};

const agentEval: Scene = {
  title: "One run lies: measure pass-every-time",
  caption: "Per-step accuracy compounds over a trajectory, and a customer experiences every run. Report the pass rate of a single run and the stricter rate of passing all K repeats; the gap shows how reliable the agent really is.",
  controls: [
    { id: "p", kind: "range", label: "Per-step accuracy (%)", min: 90, max: 99.5, step: 0.5, initial: 96 },
    { id: "n", kind: "range", label: "Steps per task", min: 3, max: 30, step: 1, initial: 10 },
    { id: "k", kind: "range", label: "Repeats K", min: 1, max: 10, step: 1, initial: 5 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const one = Math.pow(g.v.p / 100, g.v.n);
    const all = Math.pow(one, g.v.k);
    for (let k = 0; k < g.v.k; k++) {
      const ok = g.rnd(k * 13 + Math.floor(g.t * 0.5)) < one;
      g.rect(40 + k * 40, 50, 32, 32, ok ? pal.ok : pal.bad, 0.8, 5);
      g.text(ok ? "pass" : "fail", 56 + k * 40, 70, { size: 9, color: pal.ink });
    }
    g.text("repeated runs of the same task (re-rolled)", 40, 98, { size: 9, color: pal.muted, align: "left" });
    meter(g, 40, 160, 280, "single-run pass rate", one, `${Math.round(one * 100)}%`, one > 0.8 ? pal.ok : pal.accent);
    meter(g, 40, 205, 280, `passes all ${g.v.k} runs`, all, `${Math.round(all * 100)}%`, all > 0.6 ? pal.ok : pal.bad);
    g.text("customers feel the second number", 240, 268, { size: 11, color: pal.muted });
  },
};

const otel: Scene = {
  title: "A trace finds the slow span and the fat prompt",
  caption: "One trace per request, with a span for retrieval, each model call and each tool call. The tool call dominates latency and its giant output inflates the second model call. Trim the tool output and both fall. Content capture stays off unless you opt in.",
  controls: [
    { id: "t", kind: "toggle", label: "Trim tool output" },
    { id: "c", kind: "toggle", label: "Capture prompt text" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const trim = g.v.t === 1;
    const spans: [string, number, number, string][] = [
      ["retrieve", 0.4, 0, pal.teal],
      ["llm call 1", 2.1, 0.4, pal.accent],
      ["crm tool", trim ? 1.4 : 7.8, 2.5, pal.blue],
      ["llm call 2", trim ? 0.8 : 1.9, trim ? 3.9 : 10.3, pal.accent],
      ["answer", 1.8, trim ? 4.7 : 12.2, pal.violet],
    ];
    const total = spans[4][1] + spans[4][2];
    const sc = 340 / 14;
    spans.forEach(([nm, d, s0, c], k) => {
      const y = 44 + k * 28;
      g.text(nm, 30, y + 7, { size: 9, color: pal.muted, align: "left" });
      g.rect(110 + s0 * sc, y, Math.max(3, d * sc), 14, c, 0.85, 3);
      g.text(`${d}s`, 114 + (s0 + d) * sc, y + 10, { size: 8, color: pal.paper, align: "left" });
    });
    const tokens = trim ? 5800 : 38000;
    meter(g, 40, 215, 260, "total latency", total / 14, `${total.toFixed(1)} s`, total < 6 ? pal.ok : pal.bad);
    meter(g, 40, 250, 260, "input tokens, llm call 2", tokens / 40000, fmt(tokens), tokens > 20000 ? pal.bad : pal.ok);
    chip(g, 390, 232, g.v.c === 1 ? "prompt text stored" : "metadata only", g.v.c === 1 ? pal.bad : pal.ok, 9);
  },
};

const regulation: Scene = {
  title: "The EU AI Act clock after the 2026 amendment",
  caption: "Move the date to see which obligations apply. General-purpose model duties began in August 2025, transparency duties in August 2026 (with a watermarking grace period), stand-alone high-risk duties in December 2027 and embedded-product duties in August 2028.",
  controls: [{ id: "d", kind: "range", label: "Date (months from Jan 2025)", min: 0, max: 48, step: 1, initial: 21 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.d;
    const ev: [number, string, string][] = [
      [7, "GPAI duties (Aug 2025)", pal.blue],
      [19, "Article 50 transparency (Aug 2026)", pal.accent],
      [23, "watermark grace ends (Dec 2026)", pal.violet],
      [35, "Annex III high-risk (Dec 2027)", pal.bad],
      [43, "Annex I embedded (Aug 2028)", pal.teal],
    ];
    const x0 = 30;
    const sc = 420 / 48;
    g.line(x0, 90, x0 + 420, 90, pal.line, 1, 2);
    [0, 12, 24, 36, 48].forEach((mm, k) => {
      g.line(x0 + mm * sc, 84, x0 + mm * sc, 96, pal.line, 1, 1);
      g.text(String(2025 + k), x0 + mm * sc, 112, { size: 9, color: pal.muted });
    });
    ev.forEach(([mm, , c]) => g.dot(x0 + mm * sc, 90, 5, mm <= m ? c : pal.line, 1));
    g.line(x0 + m * sc, 70, x0 + m * sc, 110, pal.paper, 1, 1.5);
    ev.forEach(([mm, label, c], k) => {
      const on = mm <= m;
      g.text((on ? "in force: " : "from: ") + label, 40, 150 + k * 24, { size: 10, color: on ? c : pal.muted, align: "left" });
    });
    g.text("dates moved in 2026: track them as data", 240, 288, { size: 10, color: pal.muted });
  },
};

const grpo: Scene = {
  title: "GRPO: score a group, learn from the differences",
  caption: "Sample several answers to one prompt and grade each with a checker. Answers above the group average get pushed up; those below get pushed down. No separate value network is needed, but a weak checker teaches the model to cheat.",
  controls: [
    { id: "g", kind: "range", label: "Group size", min: 4, max: 16, step: 1, initial: 8 },
    { id: "p", kind: "range", label: "Chance each answer is correct (%)", min: 10, max: 90, step: 5, initial: 40 },
    { id: "h", kind: "toggle", label: "Tests visible to model (hackable)" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.g;
    const pc = g.v.p / 100;
    const rw: number[] = [];
    const hacked: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const ok = g.rnd(i * 7 + 3) < pc;
      const hack = g.v.h === 1 && !ok && g.rnd(i * 11 + 5) < 0.35;
      rw.push(ok || hack ? 1 : 0);
      hacked.push(hack);
    }
    const mean = rw.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(rw.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n) || 1;
    const w = Math.min(34, 420 / n - 4);
    rw.forEach((r, i) => {
      const x = 30 + i * (w + 4);
      const adv = (r - mean) / sd;
      g.rect(x, 60, w, 28, hacked[i] ? pal.bad : r ? pal.ok : pal.line, r ? 0.85 : 0.4, 4);
      const h = Math.min(60, Math.abs(adv) * 30);
      g.rect(x, adv >= 0 ? 150 - h : 150, w, h, adv >= 0 ? pal.accent : pal.violet, 0.85, 3);
    });
    g.line(30, 150, 450, 150, pal.line, 1, 1);
    g.text("sampled answers (green correct, red reward-hacked)", 30, 52, { size: 9, color: pal.muted, align: "left" });
    g.text("advantage: above average pushed up, below pushed down", 30, 232, { size: 9, color: pal.muted, align: "left" });
    g.text(`group mean reward ${mean.toFixed(2)}`, 30, 262, { size: 11, color: pal.paper, align: "left" });
    const hk = hacked.filter(Boolean).length;
    g.text(hk ? `${hk} answers gamed the visible tests and were rewarded` : mean === 0 || mean === 1 ? "all equal: no learning signal" : "signal comes from differences inside the group", 30, 284, { size: 10, color: hk ? pal.bad : pal.muted, align: "left" });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/foundations-and-prompting/context-engineering-for-agents-and-long-contexts`]: contextEng,
  [`${P}/foundations-and-prompting/reasoning-models-and-test-time-compute`]: reasoning,
  [`${P}/context-and-rag/document-parsing-and-ocr-for-rag`]: parsing,
  [`${P}/context-and-rag/web-search-and-grounding-tools`]: webSearch,
  [`${P}/context-and-rag/text-to-sql-and-structured-data-retrieval`]: text2sql,
  [`${P}/model-serving-and-inference/small-language-models-and-on-device-inference`]: slm,
  [`${P}/model-serving-and-inference/disaggregated-serving-and-kv-cache-aware-routing`]: disagg,
  [`${P}/agents-and-tool-use/code-execution-sandboxes-for-agents`]: sandbox,
  [`${P}/agents-and-tool-use/computer-use-and-browser-agents`]: computerUse,
  [`${P}/agents-and-tool-use/durable-execution-for-long-running-agents`]: durable,
  [`${P}/agents-and-tool-use/realtime-voice-agents`]: voice,
  [`${P}/evaluation-and-observability/evaluating-agents-and-agentic-benchmarks`]: agentEval,
  [`${P}/evaluation-and-observability/opentelemetry-and-standards-for-genai-observability`]: otel,
  [`${P}/safety-and-guardrails/ai-regulation-and-standards-landscape`]: regulation,
  [`${P}/fine-tuning-and-adaptation/reinforcement-learning-with-verifiable-rewards-grpo`]: grpo,
};
