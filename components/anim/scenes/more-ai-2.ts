import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-systems";

const batchTradeoff: Scene = {
  title: "Batching: throughput versus per-user speed",
  caption: "Serving more requests together keeps the GPU busy and raises total tokens per second, but each request then shares the hardware, so every user's own tokens arrive more slowly. Pick the batch size that meets your latency target.",
  controls: [{ id: "b", kind: "range", label: "Batch size", min: 1, max: 64, step: 1, initial: 16 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const b = g.v.b;
    const total = (n: number) => 1 - Math.exp(-n / 18);
    const per = (n: number) => 1 / (1 + n / 28);
    const curve = (fn: (n: number) => number, col: string) => {
      let pv: [number, number] | null = null;
      for (let n = 1; n <= 64; n += 1) {
        const x = 40 + ((n - 1) / 63) * 400;
        const y = 190 - fn(n) * 130;
        if (pv) g.line(pv[0], pv[1], x, y, col, 0.9, 2);
        pv = [x, y];
      }
    };
    curve(total, pal.ok);
    curve(per, pal.blue);
    const x = 40 + ((b - 1) / 63) * 400;
    g.line(x, 50, x, 192, pal.paper, 0.5, 1.2);
    node(g, "gpu", 450, 44, { size: 28, active: true });
    g.text("total tokens/s", 100, 56, { size: 10, color: pal.ok });
    g.text("tokens/s per user", 210, 56, { size: 10, color: pal.blue });
    g.text(`batch ${b}: GPU ${Math.round(total(b) * 100)}% busy, each user ${Math.round(per(b) * 100)}% of solo speed`, 240, 228, { size: 11, color: pal.paper });
    g.text("raise the batch until the latency target starts to break", 240, 256, { size: 10, color: pal.muted });
  },
};

const distill: Scene = {
  title: "Distillation: the student learns the teacher's distribution",
  caption: "The teacher outputs a full probability distribution, not just the right answer. The student is trained to match it, which carries information about which wrong answers are nearly right. Slide the training steps to watch the student converge.",
  controls: [{ id: "s", kind: "range", label: "Training steps", min: 0, max: 100, step: 5, initial: 60 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s / 100;
    const teacher = [0.55, 0.25, 0.1, 0.06, 0.04];
    const toks = ["cat", "dog", "fox", "owl", "ant"];
    g.orb("solving", 60, 70, 48, pal.paper, 1);
    g.text("teacher", 60, 104, { size: 10, color: pal.muted });
    g.orb("working", 60, 180, 30, pal.paper, 1);
    g.text("student", 60, 206, { size: 10, color: pal.muted });
    let err = 0;
    teacher.forEach((p, k) => {
      const sv = 0.2 + (p - 0.2) * s;
      err += Math.abs(sv - p);
      const x = 150 + k * 60;
      g.rect(x - 14, 110 - p * 90, 12, p * 90, pal.accent, 0.8, 2);
      g.rect(x + 2, 200 - sv * 90, 12, sv * 90, pal.blue, 0.8, 2);
      g.text(toks[k], x, 216, { size: 9, color: pal.muted });
    });
    g.packet(90, 90, 130, 150, g.loop(1.6), pal.accent, 2.4);
    g.text("teacher", 440, 60, { size: 9, color: pal.accent });
    g.text("student", 440, 168, { size: 9, color: pal.blue });
    g.text(`gap to the teacher: ${err.toFixed(2)}`, 240, 246, { size: 12, color: err < 0.2 ? pal.ok : pal.paper });
  },
};

const allReduce: Scene = {
  title: "The communication cost of tensor parallelism",
  caption: "Tensor parallelism synchronises every layer, so the speedup depends on how fast the GPUs can talk. Over a fast interconnect eight GPUs get close to eight times faster. Over a slow link most of the time goes to waiting.",
  controls: [
    { id: "g", kind: "range", label: "GPUs", min: 1, max: 8, step: 1, initial: 4 },
    { id: "l", kind: "choice", label: "Interconnect", options: ["PCIe (slow)", "NVLink (fast)"], initial: 1 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.g;
    const fast = g.v.l === 1;
    const comm = fast ? 0.04 : 0.22;
    const speed = n / (1 + comm * (n - 1));
    for (let k = 0; k < n; k++) {
      const x = 40 + k * (400 / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0) + (n === 1 ? 200 : 0);
      node(g, "gpu", x, 80, { size: 30, active: true });
      if (k < n - 1) g.packet(x + 16, 80, x + 400 / (n - 1) - 16, 80, (g.t * (fast ? 1.8 : 0.6) + k * 0.1) % 1, fast ? pal.ok : pal.bad, 2.2);
    }
    g.text("ideal", 70, 160, { size: 10 });
    bar(g, 120, 155, 280, 8, n / 8, pal.line);
    g.text(`${n}x`, 440, 160, { size: 11, color: pal.paper });
    g.text("actual", 70, 190, { size: 10 });
    bar(g, 120, 185, 280, 8, speed / 8, fast ? pal.ok : pal.bad);
    g.text(`${speed.toFixed(1)}x`, 440, 190, { size: 11, color: pal.paper });
    g.text(fast ? "fast links keep the GPUs busy" : "GPUs spend much of the time waiting on each other", 240, 244, { size: 11, color: fast ? pal.ok : pal.bad });
  },
};

const precisionTable: Scene = {
  title: "FP16, INT8 and INT4 side by side",
  caption: "Lower precision shrinks the weights, which cuts memory and speeds up memory-bound decoding. Quality loss is negligible at INT8 and small but real at INT4. Pick the lowest precision your own evals still accept.",
  controls: [{ id: "p", kind: "choice", label: "Precision", options: ["FP16", "INT8", "INT4"], initial: 2 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const p = g.v.p;
    const gb = [14, 7, 3.7][p];
    const speed = [1, 1.6, 2.4][p];
    const qual = [1, 0.995, 0.97][p];
    for (let k = 0; k < 16; k++) {
      const v = g.rnd(k * 2.9 + 1);
      const lv = [256, 16, 4][p];
      const q = Math.round(v * (lv - 1)) / (lv - 1);
      g.rect(30 + k * 26, 50, 22, 34, pal.blue, 0.1 + 0.8 * q, 3);
    }
    g.text("weights at this precision", 240, 40, { size: 10, color: pal.muted });
    node(g, "gpu", 60, 140, { label: "24 GB card", size: 36, color: gb > 24 ? pal.bad : pal.ok });
    [["7B model size", gb, 14, `${gb} GB`], ["decode speed", speed, 2.4, `${speed}x`], ["quality kept", qual, 1, `${(qual * 100).toFixed(1)}%`]].forEach(([nm, v, mx, lab], k) => {
      const y = 126 + k * 30;
      g.text(nm as string, 130, y, { size: 10, align: "left" });
      bar(g, 250, y - 5, 140, 8, (v as number) / (mx as number), k === 2 && qual < 0.98 ? pal.accent : pal.ok);
      g.text(lab as string, 440, y, { size: 11, color: pal.paper });
    });
    g.text("measure on your task before committing to INT4", 240, 246, { size: 10, color: pal.muted });
  },
};

const moe: Scene = {
  title: "Mixture-of-experts routing",
  caption: "Inside one model a small router sends each token to a couple of expert networks instead of all of them. Only those experts run, so the model has many parameters but costs little per token, if the load stays balanced.",
  controls: [{ id: "k", kind: "range", label: "Experts per token", min: 1, max: 4, step: 1, initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const k = g.v.k;
    const E = 8;
    const tok = Math.floor(g.t * 1.2);
    const picks = new Set<number>();
    for (let j = 0; j < k; j++) picks.add(Math.floor(g.rnd(tok * 7.3 + j * 3.1) * E));
    chip(g, 60, 70, `token "${["the", "cat", "sat", "on"][tok % 4]}"`, pal.accent, 10);
    node(g, "lb", 150, 70, { label: "router", size: 34 });
    for (let e = 0; e < E; e++) {
      const x = 240 + (e % 4) * 56;
      const y = 40 + Math.floor(e / 4) * 70;
      const on = picks.has(e);
      node(g, "server", x, y + 10, { size: 30, color: on ? pal.accent : pal.muted, a: on ? 1 : 0.35, active: on });
      g.text(`E${e + 1}`, x, y + 36, { size: 8, color: pal.muted });
      if (on) g.packet(172, 70, x - 14, y + 10, (g.t * 1.6 + e * 0.1) % 1, pal.accent, 2.2);
    }
    g.text(`${k} of ${E} experts run: ${Math.round((k / E) * 100)}% of the compute`, 240, 210, { size: 13, color: pal.paper });
    g.text("a load-balancing loss keeps tokens from piling on a few experts", 240, 242, { size: 10, color: pal.muted });
  },
};

const scalingSignals: Scene = {
  title: "Which signal should drive scaling?",
  caption: "Traffic doubles at second ten. GPU utilisation barely moves until the queue is already long. Queue depth reacts earlier, and tokens in flight earlier still. The sooner the signal moves, the sooner new replicas start.",
  controls: [{ id: "s", kind: "choice", label: "Scale on", options: ["GPU utilisation", "queue depth", "tokens in flight"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const lag = [9, 5, 2][g.v.s];
    const load = (t: number) => (t < 10 ? 0.4 : 0.8);
    const cap = (t: number) => (t < 10 + lag ? 0.5 : 0.9);
    const x = (t: number) => 40 + (t / 30) * 400;
    const y = (v: number) => 200 - v * 130;
    let pl: [number, number] | null = null;
    let pc: [number, number] | null = null;
    const now = (g.t * 3) % 30;
    for (let t = 0; t <= now; t += 0.5) {
      if (pl && pc) {
        g.line(pl[0], pl[1], x(t), y(load(t)), pal.accent, 1, 2);
        g.line(pc[0], pc[1], x(t), y(cap(t)), pal.blue, 1, 2);
      }
      pl = [x(t), y(load(t))];
      pc = [x(t), y(cap(t))];
      if (load(t) > cap(t)) g.rect(x(t), y(load(t)), 400 / 60 + 0.5, y(cap(t)) - y(load(t)), pal.bad, 0.3, 0);
    }
    g.text("load", 70, 52, { size: 10, color: pal.accent });
    g.text("capacity", 120, 52, { size: 10, color: pal.blue });
    g.text(`new replicas start ~${lag} s after the load jump`, 240, 230, { size: 12, color: lag > 4 ? pal.bad : pal.ok });
    g.text("red = requests waiting for capacity", 240, 256, { size: 10, color: pal.muted });
  },
};

const prefixOrder: Scene = {
  title: "Prompt order decides the cache hit",
  caption: "Prefix caching only reuses the part of the prompt that is identical from the first token. Put the stable instructions and documents first and the user's question last, and most of the prompt is a hit. Start with something unique and none is.",
  controls: [{ id: "o", kind: "choice", label: "Prompt layout", options: ["question first", "static first, question last"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const good = g.v.o === 1;
    [0, 1].forEach((r) => {
      const y = 50 + r * 70;
      g.text(`request ${r + 1}`, 24, y + 22, { size: 10, align: "left", color: pal.muted });
      const parts: [string, number, string][] = good ? [["instructions", 90, pal.blue], ["documents", 150, pal.violet], ["q" + (r + 1), 60, pal.accent]] : [["q" + (r + 1), 60, pal.accent], ["instructions", 90, pal.blue], ["documents", 150, pal.violet]];
      let x = 100;
      parts.forEach(([nm, w, col], k) => {
        const reuse = r === 1 && good && k < 2;
        g.rect(x, y, w, 44, col, reuse ? 0.55 : 0.22, 6);
        g.frame(x, y, w, 44, reuse ? pal.ok : col, 1, 6, reuse ? 2 : 1.1);
        g.text(nm, x + w / 2, y + 22, { size: 10, color: pal.paper });
        x += w + 4;
      });
    });
    const hit = good ? 240 : 0;
    node(g, "cache", 440, 100, { label: "KV cache", size: 32, active: good });
    g.text(`${hit} of 300 tokens reused`, 240, 210, { size: 13, color: good ? pal.ok : pal.bad });
    g.text(good ? "the shared prefix is computed once" : "the first token already differs: no prefix to match", 240, 240, { size: 10, color: pal.muted });
  },
};

const paged: Scene = {
  title: "PagedAttention memory",
  caption: "Reserving one contiguous block per request for its maximum length strands most of it unused. Paging the KV cache into small blocks allocated on demand lets many more requests fit in the same GPU memory.",
  controls: [{ id: "p", kind: "toggle", label: "Paged KV cache", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const paged = g.v.p === 1;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent, pal.ok];
    const used = [5, 3, 7, 2, 4];
    let ymem = 0;
    g.text("GPU memory for KV caches", 240, 30, { size: 10, color: pal.muted });
    const cells = 40;
    let cursor = 0;
    used.forEach((u, r) => {
      const reserve = paged ? u : 8;
      for (let k = 0; k < reserve; k++) {
        const idx = cursor++;
        if (idx >= cells) return;
        const x = 30 + (idx % 20) * 21;
        const y = 50 + Math.floor(idx / 20) * 30;
        const usedCell = k < u;
        g.rect(x, y, 19, 26, cols[r], usedCell ? 0.55 : 0.12, 3);
        if (!usedCell) g.line(x + 3, y + 3, x + 16, y + 23, pal.bad, 0.5, 1);
      }
      ymem += reserve;
    });
    const fits = paged ? 5 : 4;
    node(g, "gpu", 450, 130, { size: 24, active: true });
    const waste = paged ? 0 : ymem - 21;
    g.text(`${fits} requests fit, ${waste} blocks wasted`, 240, 136, { size: 13, color: paged ? pal.ok : pal.bad });
    g.text(paged ? "blocks are allocated as tokens are produced" : "crossed blocks are reserved but never used", 240, 164, { size: 10, color: pal.muted });
    g.text("more concurrent requests means higher throughput", 240, 214, { size: 11, color: pal.paper });
  },
};

const toolCallFlow: Scene = {
  title: "How a tool call actually works",
  caption: "The model never runs anything. It emits a structured request naming a tool and its arguments, the application executes it, and the result goes back into the conversation as a new message for the model to read.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.6, 1.6, 1.8]);
    g.orb(i === 1 ? "connecting" : "solving", 70, 100, 48, pal.paper, 1);
    g.text("model", 70, 136, { size: 10, color: pal.muted });
    node(g, "server", 250, 100, { label: "your runtime", size: 40, active: i === 2 });
    node(g, "cloud", 410, 100, { label: "weather API", size: 40 });
    if (i === 0) chip(g, 160, 60, "what is the weather in Pune?", pal.accent, 9);
    if (i === 1) {
      chip(g, 160, 60, '{"tool":"get_weather","city":"Pune"}', pal.accent, 9);
      g.packet(96, 100, 224, 100, p, pal.accent, 3);
    }
    if (i === 2) g.packet(276, 100, 384, 100, p, pal.teal, 3);
    if (i === 3) {
      g.packet(250, 124, 96, 114, p, pal.ok, 3);
      chip(g, 250, 168, '{"temp": 29, "sky": "clear"}', pal.ok, 9);
    }
    g.text(["user asks something the model cannot know", "model emits a tool call, not an answer", "runtime executes the call", "result returns as a message, model answers"][i], 240, 242, { size: 12, color: pal.paper });
  },
};

const multiAgentCost: Scene = {
  title: "What multi-agent costs",
  caption: "Each extra agent re-reads context, writes hand-off messages and waits on others. Tokens and latency grow faster than the number of agents, so add them only when the task truly splits into independent parts.",
  controls: [{ id: "n", kind: "range", label: "Agents", min: 1, max: 6, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const tokens = 10 * (1 + (n - 1) * 1.7);
    const lat = 1 + (n - 1) * 0.45;
    for (let k = 0; k < n; k++) {
      const x = n === 1 ? 240 : 60 + k * (360 / (n - 1));
      g.orb("working", x, 80, 34, pal.paper, 1);
      for (let j = k + 1; j < n; j++) g.line(x, 80, 60 + j * (360 / (n - 1)), 80, pal.line, 0.25, 1);
      if (k < n - 1) g.packet(x + 16, 80, 60 + (k + 1) * (360 / (n - 1)) - 16, 80, (g.t * 0.9 + k * 0.2) % 1, pal.accent, 2);
    }
    g.text("tokens used", 70, 160, { size: 10 });
    bar(g, 140, 155, 250, 8, tokens / 90, tokens > 40 ? pal.bad : pal.ok);
    g.text(`${fmt(tokens)}K`, 430, 160, { size: 11, color: pal.paper });
    g.text("wall-clock time", 70, 188, { size: 10 });
    bar(g, 140, 183, 250, 8, lat / 3.5, lat > 2 ? pal.bad : pal.ok);
    g.text(`${lat.toFixed(1)}x`, 430, 188, { size: 11, color: pal.paper });
    g.text(n > 3 ? "coordination now costs more than the work it splits" : "split only what is genuinely independent", 240, 236, { size: 11, color: n > 3 ? pal.bad : pal.muted });
  },
};

const memoryPaging: Scene = {
  title: "Paging memory in and out of the context",
  caption: "The context window is small and fast, like RAM. The memory store is large and slow, like disk. The agent moves older items out to the store and pulls back only what the current step needs.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.8, 1.8, 2.2]);
    g.rect(30, 50, 170, 110, pal.blue, 0.1, 10);
    g.frame(30, 50, 170, 110, pal.blue, 1, 10, 1.3);
    g.text("context window", 115, 42, { size: 10, color: pal.blue });
    node(g, "db", 370, 105, { label: "memory store", size: 64, color: pal.violet, fill: i >= 1 ? 0.7 : 0.4 });
    const ctx = i === 0 ? ["A", "B", "C", "D"] : i === 1 ? ["C", "D", "E", "F"] : ["D", "E", "F", "B"];
    ctx.forEach((c, k) => {
      const fresh = (i === 1 && k >= 2) || (i === 2 && k === 3);
      g.rect(42 + (k % 2) * 76, 62 + Math.floor(k / 2) * 44, 66, 36, fresh ? pal.accent : pal.blue, fresh ? 0.45 : 0.25, 6);
      g.text(c, 75 + (k % 2) * 76, 80 + Math.floor(k / 2) * 44, { size: 13, color: pal.paper });
    });
    if (i === 1) {
      g.packet(200, 90, 330, 100, p, pal.violet, 3);
      g.text("A, B evicted", 270, 74, { size: 9, color: pal.violet });
    }
    if (i === 2) {
      g.packet(330, 116, 200, 126, p, pal.ok, 3);
      g.text("B recalled", 270, 142, { size: 9, color: pal.ok });
    }
    g.orb("searching", 115, 200, 26, pal.paper, 1);
    g.text(["window is full of recent context", "oldest items are paged out to the store", "a query pulls the relevant item back in"][i], 240, 244, { size: 12, color: pal.paper });
  },
};

const toolDescriptions: Scene = {
  title: "The tool description is a prompt",
  caption: "The model chooses a tool and fills its arguments from the name and description alone. Vague descriptions make it pick the wrong tool or guess arguments. Precise ones say when to use it and what each argument means.",
  controls: [{ id: "d", kind: "choice", label: "Descriptions", options: ["vague", "precise"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const good = g.v.d === 1;
    chip(g, 240, 36, "refund order 8841 for the damaged item", pal.accent, 10);
    g.orb("solving", 60, 120, 44, pal.paper, 1);
    const tools = good ? [["issue_refund", "refund a paid order by id"], ["cancel_order", "cancel an unshipped order"]] : [["order_tool", "does order things"], ["order_helper", "helps with orders"]];
    tools.forEach(([nm, desc], k) => {
      const y = 90 + k * 60;
      const pick = good ? k === 0 : k === 1;
      g.rect(150, y - 22, 220, 44, pick ? (good ? pal.ok : pal.bad) : pal.line, pick ? 0.22 : 0.08, 8);
      g.frame(150, y - 22, 220, 44, pick ? (good ? pal.ok : pal.bad) : pal.line, 1, 8, pick ? 2 : 1);
      g.text(nm, 160, y - 6, { size: 11, align: "left", color: pal.paper, bold: true });
      g.text(desc, 160, y + 10, { size: 9, align: "left", color: pal.muted });
    });
    g.packet(86, 120, 148, good ? 90 : 150, g.loop(1.4), pal.accent, 3);
    g.text(good ? "right tool, order id extracted ✓" : "wrong tool chosen, arguments guessed ✕", 240, 236, { size: 12, color: good ? pal.ok : pal.bad });
  },
};

const replan: Scene = {
  title: "Plan, execute, replan",
  caption: "Plan-and-execute writes the whole plan first and then runs it step by step. When a step fails the plan is no longer valid, so a replanner revises the remaining steps instead of pressing on blindly.",
  controls: [{ id: "f", kind: "toggle", label: "Step 3 fails", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const fail = g.v.f === 1;
    const t = (g.t * 1.1) % 9;
    const steps = ["find the report", "extract revenue", "compute growth", "write summary"];
    steps.forEach((s, k) => {
      const y = 50 + k * 42;
      const done = t > k + 0.6;
      const failed = fail && k === 2 && t > 2.6;
      const replanned = fail && t > 5 && k >= 2;
      const col = failed && !replanned ? pal.bad : replanned && done ? pal.teal : done ? pal.ok : pal.line;
      g.rect(30, y - 15, 200, 30, col, 0.2, 7);
      g.frame(30, y - 15, 200, 30, col, 1, 7, 1.2);
      g.text(replanned && k === 2 ? "compute growth (new method)" : s, 40, y, { size: 10, align: "left", color: pal.paper });
      g.text(failed && !replanned ? "✕" : done ? "✓" : "", 214, y, { size: 13, color: failed && !replanned ? pal.bad : pal.ok });
    });
    g.orb(fail && t > 3 && t < 5 ? "shaping" : "working", 360, 120, 52, pal.paper, 1);
    g.text(fail && t > 3 && t < 5 ? "replanning" : "executing", 360, 160, { size: 10, color: pal.muted });
    g.text(fail && t > 5 ? "plan revised, run continues from the failed step" : fail && t > 2.6 ? "a failed step invalidates the rest" : "plan runs top to bottom", 240, 240, { size: 12, color: fail && t > 2.6 && t < 5 ? pal.bad : pal.paper });
  },
};

const agentCard: Scene = {
  title: "A2A: discover an agent, then delegate",
  caption: "A remote agent publishes a card that lists its skills and how to reach it. The client agent reads the card, decides whether this agent can help, and only then submits a task. Discovery comes before delegation.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.8, 1.8, 2.2]);
    g.orb("solving", 60, 110, 46, pal.paper, 1);
    g.text("your agent", 60, 144, { size: 10, color: pal.muted });
    node(g, "doc", 250, 60, { label: "agent card", size: 44, color: pal.violet });
    g.text("skills: book_travel", 250, 100, { size: 8, color: pal.muted });
    g.orb("working", 410, 130, 46, pal.paper, 1);
    g.text("travel agent", 410, 164, { size: 10, color: pal.muted });
    if (i === 0) g.packet(86, 100, 224, 66, p, pal.accent, 3);
    if (i === 1) g.packet(224, 76, 86, 112, p, pal.violet, 3);
    if (i === 2) {
      g.packet(86, 118, 384, 128, g.clamp(p * 1.2), pal.accent, 3);
      chip(g, 240, 160, "task: book Pune → Delhi", pal.accent, 9);
    }
    g.text(["client fetches the agent card", "card lists skills: it can book travel", "client submits a task to that agent"][i], 240, 236, { size: 12, color: pal.paper });
  },
};

const loopGuard: Scene = {
  title: "Stopping a runaway loop",
  caption: "An agent that repeats the same failing call burns tokens forever. A loop guard watches the history, notices repeated identical calls or an exhausted step budget, and stops the run with a clear error instead of spending on.",
  controls: [{ id: "g", kind: "toggle", label: "Loop guard", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const guard = g.v.g === 1;
    const n = Math.floor((g.t * 1.4) % 12);
    const stopAt = 5;
    const shown = guard ? Math.min(n, stopAt) : n;
    for (let k = 0; k < shown; k++) {
      const x = 30 + (k % 6) * 72;
      const y = 60 + Math.floor(k / 6) * 44;
      g.rect(x, y, 66, 34, pal.bad, 0.15 + (k > 2 ? 0.15 : 0), 6);
      g.text("search('x')", x + 33, y + 17, { size: 9, color: pal.paper });
    }
    g.orb(guard && n >= stopAt ? "breathing" : "searching", 440, 40, 26, pal.paper, 1);
    const spent = shown * 3;
    g.text("tokens spent", 80, 190, { size: 10 });
    bar(g, 150, 185, 230, 8, Math.min(1, spent / 36), spent > 20 ? pal.bad : pal.accent);
    g.text(`${spent}K`, 430, 190, { size: 11, color: pal.paper });
    g.text(guard && n >= stopAt ? "same call repeated 4 times: stopped with an error ✓" : guard ? "watching for repeats…" : "no guard: the loop keeps spending ✕", 240, 232, { size: 12, color: guard && n >= stopAt ? pal.ok : guard ? pal.paper : pal.bad });
  },
};

const approvalFatigue: Scene = {
  title: "Approval fatigue",
  caption: "If a person must approve every action they soon click through without reading, and the gate protects nothing. Gating only the risky actions keeps the queue small, so each approval still gets real attention.",
  controls: [{ id: "m", kind: "choice", label: "Gate", options: ["every action", "risky actions only"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const all = g.v.m === 0;
    const q = all ? 24 : 4;
    for (let k = 0; k < q; k++) {
      const x = 30 + (k % 12) * 36;
      const y = 50 + Math.floor(k / 12) * 30;
      g.rect(x, y, 30, 22, all ? pal.accent : pal.bad, 0.4, 4);
    }
    g.text(`${q} approvals waiting`, 240, 40, { size: 10, color: pal.muted });
    node(g, "user", 100, 160, { label: "reviewer", size: 36, color: all ? pal.muted : pal.ok });
    const attn = all ? 0.15 : 0.9;
    g.text("attention per approval", 180, 150, { size: 10, align: "left" });
    bar(g, 180, 156, 220, 8, attn, all ? pal.bad : pal.ok);
    g.text(all ? "clicks approve without reading ✕" : "reads the diff before approving ✓", 240, 226, { size: 12, color: all ? pal.bad : pal.ok });
    g.text("a gate people rubber-stamp is worse than none", 240, 254, { size: 10, color: pal.muted });
  },
};

const transports: Scene = {
  title: "MCP transports: local pipe or remote HTTP",
  caption: "A local MCP server runs as a child process and talks over stdin and stdout, which needs no network or auth. A remote server is reached over HTTP, so it can be shared, but it needs authentication and careful trust.",
  controls: [{ id: "t", kind: "choice", label: "Transport", options: ["stdio (local)", "HTTP (remote)"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const http = g.v.t === 1;
    g.rect(14, 50, 170, 120, pal.blue, 0.08, 10);
    g.frame(14, 50, 170, 120, pal.blue, 1, 10, 1.3);
    g.text("host app", 99, 42, { size: 10, color: pal.blue });
    g.orb("solving", 70, 110, 38, pal.paper, 1);
    node(g, "lb", 140, 110, { label: "client", size: 28 });
    if (!http) {
      g.rect(210, 70, 110, 80, pal.teal, 0.1, 8);
      g.frame(210, 70, 110, 80, pal.teal, 1, 8, 1.2);
      node(g, "server", 265, 110, { label: "child process", size: 36, color: pal.teal, active: true });
      g.packet(160, 104, 210, 104, g.loop(1.2), pal.accent, 2.4);
      g.packet(210, 118, 160, 118, g.loop(1.2, 0.5), pal.ok, 2.4);
      g.text("stdin / stdout", 185, 90, { size: 9, color: pal.muted });
      g.text("same machine, same user", 240, 214, { size: 12, color: pal.paper });
    } else {
      node(g, "cloud", 330, 110, { label: "MCP server", size: 54, color: pal.teal });
      g.packet(160, 104, 300, 104, g.loop(1.6), pal.accent, 2.4);
      g.packet(300, 118, 160, 118, g.loop(1.6, 0.5), pal.ok, 2.4);
      node(g, "lock", 240, 70, { label: "auth", size: 26, color: pal.accent });
      g.text("shared by many hosts, must be authenticated", 240, 214, { size: 12, color: pal.paper });
    }
    g.text("tools exposed by the server look the same either way", 240, 248, { size: 10, color: pal.muted });
  },
};

const evalLayers: Scene = {
  title: "The three layers of evaluation",
  caption: "Cheap deterministic checks run on everything, model-graded checks run on a sample, and human review covers a small slice. Pick a layer: the lower it sits the more it costs per example and the fewer examples it can cover.",
  controls: [{ id: "l", kind: "choice", label: "Layer", options: ["unit checks", "model-graded", "human review"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const l = g.v.l;
    const cols = [pal.ok, pal.accent, pal.violet];
    const names = ["unit checks", "model-graded", "human review"];
    [0, 1, 2].forEach((k) => {
      const y = 60 + k * 50;
      const w = [340, 220, 100][k];
      g.rect(240 - w / 2, y, w, 42, cols[k], k === l ? 0.4 : 0.12, 8);
      g.frame(240 - w / 2, y, w, 42, cols[k], k === l ? 1 : 0.4, 8, k === l ? 2 : 1);
      g.text(names[k], 240, y + 21, { size: 11, color: pal.paper });
    });
    const cost = ["$0.00", "$0.01", "$2.00"][l];
    const cover = ["every example", "a sample", "a few dozen"][l];
    node(g, ["gpu", "gpu", "user"][l] as "gpu", 60, 100, { size: 28, color: cols[l] });
    g.text(`cost per example ${cost}`, 240, 230, { size: 12, color: pal.paper });
    g.text(`covers ${cover}`, 240, 254, { size: 11, color: pal.muted });
  },
};

const traceTree: Scene = {
  title: "A trace is a tree",
  caption: "One user request fans out into nested steps: a retrieval, a model call, a tool call that triggers another model call. Showing them as a tree with token counts and timings lets you point at the exact node that went wrong.",
  controls: [{ id: "f", kind: "choice", label: "Failing step", options: ["none", "retrieval", "tool call"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const f = g.v.f;
    const nodes: [string, number, number, number, number, number][] = [
      ["request", 240, 40, -1, 0, 0], ["retrieve", 120, 100, 0, 1, 1], ["llm call", 240, 100, 0, 2, 0], ["tool call", 360, 100, 0, 3, 2], ["llm call 2", 360, 170, 3, 4, 0],
    ];
    nodes.forEach(([nm, x, y, parent], k) => {
      if (parent >= 0) g.line(nodes[parent][1], nodes[parent][2], x, y, pal.line, 0.8, 1.3);
    });
    nodes.forEach(([nm, x, y, , , badId], k) => {
      const bad = (f === 1 && badId === 1) || (f === 2 && badId === 2);
      node(g, k === 0 ? "client" : k === 1 ? "db" : k === 3 ? "cloud" : "gpu", x, y, { size: 28, color: bad ? pal.bad : pal.paper });
      g.text(nm, x, y + 28, { size: 9, color: bad ? pal.bad : pal.muted });
      g.text(["412 ms", "90 ms", "1.1 s", "300 ms", "700 ms"][k], x, y - 22, { size: 8, color: pal.muted });
    });
    g.packet(240, 52, 120, 90, g.loop(2), pal.accent, 2);
    g.packet(240, 52, 240, 90, g.loop(2, 0.3), pal.accent, 2);
    g.text(f === 0 ? "healthy trace" : f === 1 ? "retrieval returned nothing: the answer is ungrounded" : "tool call errored: second llm call saw no result", 240, 250, { size: 11, color: f === 0 ? pal.ok : pal.bad });
  },
};

const labelNoise: Scene = {
  title: "Noisy labels cap the reward model",
  caption: "Human raters disagree with each other. If a quarter of preference labels are flipped, even a perfect reward model cannot score above the agreement ceiling. Cleaner preference data raises the ceiling.",
  controls: [{ id: "n", kind: "range", label: "Label noise %", min: 0, max: 40, step: 5, initial: 20 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const noise = g.v.n / 100;
    const ceil = 1 - noise;
    for (let k = 0; k < 20; k++) {
      const flipped = g.rnd(k * 3.1 + 5) < noise;
      const x = 30 + (k % 10) * 43;
      const y = 50 + Math.floor(k / 10) * 40;
      g.rect(x, y, 38, 30, flipped ? pal.bad : pal.ok, 0.25, 5);
      g.text("A > B", x + 19, y + 15, { size: 9, color: flipped ? pal.bad : pal.paper });
    }
    node(g, "user", 60, 160, { label: "raters", size: 28 });
    g.text("best possible reward-model accuracy", 150, 160, { size: 10, align: "left" });
    bar(g, 150, 168, 230, 8, ceil, ceil > 0.8 ? pal.ok : pal.accent);
    g.text(`${Math.round(ceil * 100)}%`, 430, 172, { size: 12, color: pal.paper });
    g.text("red labels disagree with the majority", 240, 222, { size: 10, color: pal.muted });
    g.text("write clear guidelines and measure agreement", 240, 250, { size: 11, color: pal.paper });
  },
};

const judgeAgreement: Scene = {
  title: "How closely does the judge match humans?",
  caption: "Before trusting an LLM judge, compare its verdicts with human labels. A single 1 to 5 score drifts and is noisy. Pairwise comparison is steadier, and a rubric plus swapped order raises agreement further at a higher cost.",
  controls: [{ id: "j", kind: "choice", label: "Judge setup", options: ["pointwise 1–5", "pairwise", "pairwise + swap + rubric"], initial: 2 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const j = g.v.j;
    const agree = [0.62, 0.78, 0.9][j];
    const cost = [1, 1.5, 3.2][j];
    g.orb("weaving", 70, 80, 44, pal.paper, 1);
    g.text("judge", 70, 114, { size: 10, color: pal.muted });
    node(g, "user", 300, 80, { label: "human labels", size: 34, color: pal.ok });
    g.packet(96, 80, 270, 80, g.loop(1.6), pal.accent, 3);
    [["agreement with humans", agree, 1, `${Math.round(agree * 100)}%`], ["cost per verdict", cost, 3.2, `${cost}x`]].forEach(([nm, v, mx, lab], k) => {
      const y = 160 + k * 34;
      g.text(nm as string, 20, y, { size: 10, align: "left" });
      bar(g, 170, y - 5, 220, 8, (v as number) / (mx as number), k === 0 ? (agree > 0.85 ? pal.ok : pal.accent) : pal.blue);
      g.text(lab as string, 440, y, { size: 11, color: pal.paper });
    });
    g.text("calibrate against humans on a few hundred examples", 240, 240, { size: 10, color: pal.muted });
  },
};

const failureToDataset: Scene = {
  title: "Production failures become test cases",
  caption: "A bad answer reported in production is sampled from the logs, labelled with the correct behaviour and added to the golden set. The next prompt change is then tested against it, so a fixed bug cannot quietly return.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.6, 1.6, 1.8]);
    const stages: [string, "user" | "db" | "doc" | "shield" | "server"][] = [["bad answer", "user"], ["logged trace", "db"], ["labelled fix", "doc"], ["golden set", "shield"], ["CI run", "server"]];
    stages.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const on = k <= i + 1;
      node(g, kind, x, 100, { label: nm, size: 34, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.4, active: k === i + 1 });
      if (k < 4) g.arrow(x + 24, 100, x + 74, 100, pal.line, on ? 0.9 : 0.3);
    });
    const px = 44 + Math.min(4, i + p) * 98;
    g.dot(px, 100, 5, pal.accent);
    g.glow(px, 100, 14, pal.accent, 0.4);
    g.text(["a user reports a wrong answer", "the trace is found in the logs", "an engineer writes the expected output", "it joins the golden dataset and runs on every change"][i], 240, 190, { size: 12, color: pal.paper });
  },
};

const sampleMonitor: Scene = {
  title: "Judging a sample of live traffic",
  caption: "Scoring every production response with a judge is too costly, so a small random sample is scored. The estimate of the hallucination rate has a confidence interval that narrows as the sample grows. Slide the sample size.",
  controls: [{ id: "s", kind: "range", label: "Sample size 10^", min: 1.5, max: 4, step: 0.25, initial: 2.5 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const n = 10 ** g.v.s;
    const p = 0.04;
    const se = Math.sqrt((p * (1 - p)) / n);
    const obs = p + (g.rnd(Math.floor(g.v.s * 7)) - 0.5) * se * 2;
    const xOf = (v: number) => 40 + (v / 0.1) * 400;
    g.line(40, 150, 440, 150, pal.line, 1, 1.2);
    [0, 0.02, 0.04, 0.06, 0.08, 0.1].forEach((v) => {
      g.line(xOf(v), 146, xOf(v), 154, pal.line, 1, 1);
      g.text(`${Math.round(v * 100)}%`, xOf(v), 168, { size: 9, color: pal.muted });
    });
    const lo = Math.max(0, obs - 1.96 * se);
    const hi = obs + 1.96 * se;
    g.line(xOf(lo), 110, xOf(hi), 110, pal.accent, 0.9, 3);
    g.dot(xOf(obs), 110, 6, pal.accent);
    g.text("estimated hallucination rate", 240, 84, { size: 10, color: pal.muted });
    node(g, "db", 456, 40, { size: 22 });
    g.text(`${Math.round(n)} judged responses`, 240, 204, { size: 13, color: pal.paper });
    g.text(`interval ${(lo * 100).toFixed(1)}% to ${(hi * 100).toFixed(1)}%`, 240, 232, { size: 12, color: hi - lo > 0.03 ? pal.bad : pal.ok });
  },
};

const peeking: Scene = {
  title: "Peeking at an A/B test",
  caption: "The two variants are identical, so the true effect is zero. The line is the p-value checked every day. If you stop the first time it dips under 0.05 you will often declare a winner that is just noise. Fix the sample size in advance.",
  controls: [{ id: "p", kind: "toggle", label: "Stop at first significance" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const stop = g.v.p === 1;
    const days = 30;
    const seed = Math.floor(g.t / 8);
    let walk = 0;
    const pv: number[] = [];
    let hit = -1;
    for (let d = 1; d <= days; d++) {
      walk += g.rnd(seed * 31 + d * 1.7) - 0.5;
      const z = Math.abs(walk) / Math.sqrt(d * 0.083);
      const pval = Math.max(0.001, Math.exp(-0.717 * z - 0.416 * z * z));
      pv.push(pval);
      if (hit < 0 && pval < 0.05 && d > 3) hit = d;
    }
    const prog = Math.min(days, Math.floor(((g.t % 8) / 6) * days));
    const x = (d: number) => 40 + (d / days) * 400;
    const y = (v: number) => 200 - Math.min(1, v) * 140;
    g.line(40, y(0.05), 440, y(0.05), pal.bad, 0.6, 1.2);
    g.text("p = 0.05", 440, y(0.05) - 8, { size: 9, color: pal.bad, align: "right" });
    let pp: [number, number] | null = null;
    for (let d = 1; d <= prog; d++) {
      if (stop && hit > 0 && d > hit) break;
      const px = x(d);
      const py = y(pv[d - 1]);
      if (pp) g.line(pp[0], pp[1], px, py, pal.blue, 1, 2);
      pp = [px, py];
    }
    const declared = stop && hit > 0 && prog >= hit;
    g.text(declared ? `day ${hit}: "significant", ship it ✕ (it is noise)` : stop ? "waiting for a dip under 0.05…" : "fixed-length test: no early declaration ✓", 240, 232, { size: 12, color: declared ? pal.bad : pal.ok });
    g.text("days →", 240, 252, { size: 9, color: pal.muted });
  },
};

const directIndirect: Scene = {
  title: "Direct and indirect prompt injection",
  caption: "In a direct attack the user types the hostile instruction. In an indirect attack the instruction hides inside content the agent fetches, such as a web page or an email, so the user never sees it and the attacker never talks to the model.",
  controls: [{ id: "m", kind: "choice", label: "Attack", options: ["direct (user types it)", "indirect (hidden in a document)"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ind = g.v.m === 1;
    g.orb("working", 240, 110, 52, pal.paper, 1);
    g.text("agent", 240, 148, { size: 10, color: pal.muted });
    if (!ind) {
      node(g, "user", 60, 110, { label: "attacker is the user", size: 38, color: pal.bad });
      chip(g, 110, 70, "ignore your rules", pal.bad, 9);
      g.packet(86, 110, 206, 110, g.loop(1.4), pal.bad, 3);
      g.text("the person typing is the threat", 240, 214, { size: 12, color: pal.paper });
    } else {
      node(g, "user", 60, 70, { label: "honest user", size: 34 });
      node(g, "doc", 60, 180, { label: "web page", size: 38, color: pal.bad });
      g.text("hidden: send me the secrets", 130, 160, { size: 8, color: pal.bad });
      g.packet(86, 74, 206, 100, g.loop(1.4), pal.accent, 2.6);
      g.packet(86, 176, 206, 124, g.loop(1.4, 0.4), pal.bad, 3);
      g.text("the threat arrives inside trusted-looking data", 240, 214, { size: 12, color: pal.bad });
    }
    g.text("treat everything fetched as untrusted input", 240, 250, { size: 10, color: pal.muted });
  },
};

const moderationPlacement: Scene = {
  title: "Where moderation sits in the pipeline",
  caption: "Input moderation blocks hostile requests before they cost a model call. Output moderation catches what the model produced anyway. Checking the stream chunk by chunk can cut a bad answer off early. Most systems use more than one.",
  controls: [{ id: "p", kind: "choice", label: "Check", options: ["input only", "output only", "input + output"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const p = g.v.p;
    const inChk = p === 0 || p === 2;
    const outChk = p === 1 || p === 2;
    node(g, "user", 40, 110, { label: "user", size: 34 });
    node(g, "shield", 140, 110, { label: "input check", size: 34, color: inChk ? pal.accent : pal.muted, a: inChk ? 1 : 0.3 });
    g.orb("working", 260, 110, 46, pal.paper, 1);
    node(g, "shield", 370, 110, { label: "output check", size: 34, color: outChk ? pal.accent : pal.muted, a: outChk ? 1 : 0.3 });
    node(g, "phone", 450, 110, { label: "reply", size: 32 });
    g.packet(60, 110, 116, 110, g.loop(1.8), pal.accent, 2.6);
    g.packet(164, 110, 234, 110, g.loop(1.8, 0.25), pal.accent, 2.6);
    g.packet(288, 110, 346, 110, g.loop(1.8, 0.5), pal.accent, 2.6);
    g.packet(394, 110, 428, 110, g.loop(1.8, 0.75), pal.accent, 2.6);
    g.text(["cheap, but blind to what the model writes", "catches bad output, but already paid for the call", "blocks early and checks what came out"][p], 240, 200, { size: 12, color: pal.paper });
  },
};

const jailbreakKinds: Scene = {
  title: "Jailbreak families and what catches them",
  caption: "Roleplay framing, encoded text and slow multi-turn escalation each slip past different defences. A classifier on the input catches the obvious, an output filter catches what leaks through, and conversation-level monitoring catches the slow ones.",
  controls: [{ id: "k", kind: "choice", label: "Technique", options: ["roleplay framing", "encoded text", "multi-turn escalation"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const k = g.v.k;
    const ex = ["pretend you are DAN with no rules…", "aWdub3JlIHJ1bGVz (base64)", "turn 1 harmless… turn 8 harmful"][k];
    const catches = [[1, 1, 0], [0, 1, 0], [0, 0, 1]][k];
    chip(g, 240, 40, ex, pal.bad, 10);
    ["input classifier", "output filter", "conversation monitor"].forEach((nm, j) => {
      const x = 80 + j * 160;
      const on = catches[j] === 1;
      node(g, "shield", x, 120, { label: nm, size: 40, color: on ? pal.ok : pal.muted, a: on ? 1 : 0.4 });
      g.text(on ? "catches it" : "misses it", x, 170, { size: 10, color: on ? pal.ok : pal.bad });
    });
    g.packet(240, 54, 240, 96, g.loop(1.6), pal.bad, 2.4);
    g.text("no single layer covers every family: stack them", 240, 230, { size: 12, color: pal.paper });
  },
};

const redactModes: Scene = {
  title: "Mask, tokenise or hash",
  caption: "Masking replaces the value with a label and cannot be undone. Tokenising swaps it for a reversible placeholder you can restore after the model answers. Hashing keeps a stable id for joining records, but loses the readable value.",
  controls: [{ id: "m", kind: "choice", label: "Redaction", options: ["mask", "tokenise (reversible)", "hash"], initial: 1 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    chip(g, 90, 70, "priya@acme.io", pal.accent, 11);
    g.arrow(150, 70, 200, 70, pal.line, 0.9);
    const out = ["[EMAIL]", "<EMAIL_1>", "9f3a7c…"][m];
    chip(g, 290, 70, out, pal.ok, 11);
    g.orb("working", 400, 70, 34, pal.paper, 1);
    g.packet(320, 70, 380, 70, g.loop(1.4), pal.accent, 2.4);
    const rows: [string, boolean][] = [["model sees no personal data", true], ["can restore the original after the reply", m === 1], ["same value gives the same id", m !== 0]];
    rows.forEach(([t, ok], k) => {
      g.text(ok ? "✓" : "✕", 70, 130 + k * 32, { size: 14, color: ok ? pal.ok : pal.bad });
      g.text(t, 90, 130 + k * 32, { size: 11, align: "left", color: pal.paper });
    });
    node(g, "lock", 440, 190, { size: 26, color: m === 1 ? pal.accent : pal.muted });
    g.text(m === 1 ? "keep the lookup table secure" : "", 360, 232, { size: 10, color: pal.muted });
  },
};

const trifecta: Scene = {
  title: "The lethal trifecta",
  caption: "An agent is dangerous when it combines access to private data, exposure to untrusted content and a way to send data out. Any two are manageable. All three together let a hidden instruction steal the data. Remove one leg.",
  controls: [
    { id: "a", kind: "toggle", label: "Private data", initial: true },
    { id: "b", kind: "toggle", label: "Untrusted content", initial: true },
    { id: "c", kind: "toggle", label: "Outbound channel", initial: true },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const on = [g.v.a === 1, g.v.b === 1, g.v.c === 1];
    const pos: [number, number, string, string][] = [[180, 100, "private data", pal.blue], [300, 100, "untrusted content", pal.accent], [240, 170, "outbound channel", pal.violet]];
    pos.forEach(([x, y, nm, col], k) => {
      g.dot(x, y, 52, col, on[k] ? 0.22 : 0.04);
      g.ring(x, y, 52, on[k] ? col : pal.line, on[k] ? 1 : 0.4, 1.6);
      g.text(nm, x, y + (k === 2 ? 62 : -62), { size: 10, color: on[k] ? col : pal.muted });
    });
    const all = on.every(Boolean);
    if (all) {
      g.glow(240, 125, 36, pal.bad, 0.4 + 0.2 * Math.sin(g.t * 4));
      node(g, "shield", 240, 125, { size: 24, color: pal.bad });
    }
    g.text(all ? "all three: a hidden instruction can leak the data ✕" : `${on.filter(Boolean).length} of 3: the exfiltration path is broken ✓`, 240, 252, { size: 12, color: all ? pal.bad : pal.ok });
  },
};

const attackRate: Scene = {
  title: "Attack success rate by category",
  caption: "Red-teaming reports how often each attack category succeeds. Run it before and after a fix and the bars show whether the defence helped, and whether it merely moved the problem to a category you were not watching.",
  controls: [{ id: "f", kind: "toggle", label: "After defences added" }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const after = g.v.f === 1;
    const cats = ["injection", "jailbreak", "PII leak", "tool abuse", "bias"];
    const before = [0.42, 0.3, 0.18, 0.35, 0.12];
    const aft = [0.12, 0.14, 0.05, 0.22, 0.1];
    cats.forEach((c, k) => {
      const y = 50 + k * 34;
      const v = after ? aft[k] : before[k];
      g.text(c, 20, y + 4, { size: 10, align: "left" });
      bar(g, 110, y, 270, 10, v / 0.5, v > 0.2 ? pal.bad : v > 0.1 ? pal.accent : pal.ok);
      g.text(`${Math.round(v * 100)}%`, 440, y + 5, { size: 11, color: pal.paper });
    });
    node(g, "shield", 456, 30, { size: 22, color: after ? pal.ok : pal.bad });
    g.text(after ? "tool abuse is still the weakest area: fix it next" : "start with the highest bars", 240, 238, { size: 11, color: pal.paper });
  },
};

const retention: Scene = {
  title: "Retention policy by data type",
  caption: "Different records deserve different lifetimes. Raw prompts that may contain personal data are kept briefly, redacted traces a little longer, and audit records of who did what for years. Slide the age to see what survives.",
  controls: [{ id: "d", kind: "range", label: "Age (days)", min: 0, max: 400, step: 10, initial: 60 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const age = g.v.d;
    const types: [string, number, string][] = [["raw prompts", 30, pal.bad], ["redacted traces", 180, pal.accent], ["audit log", 365, pal.ok]];
    types.forEach(([nm, keep, col], k) => {
      const x = 90 + k * 150;
      const alive = age <= keep;
      node(g, "db", x, 90, { label: nm, size: 54, color: alive ? col : pal.muted, a: alive ? 1 : 0.3, fill: alive ? 1 - age / keep : 0 });
      g.text(`keep ${keep} days`, x, 140, { size: 9, color: pal.muted });
      g.text(alive ? "kept" : "deleted", x, 160, { size: 11, color: alive ? pal.ok : pal.bad });
    });
    g.text(`records at ${age} days old`, 240, 214, { size: 13, color: pal.paper });
    g.text("shorter retention for riskier data limits the blast radius of a breach", 240, 244, { size: 10, color: pal.muted });
  },
};

export const MORE_AI_2: Record<string, Scene[]> = {
  [`${P}/model-serving-and-inference/inference-serving-fundamentals`]: [batchTradeoff],
  [`${P}/model-serving-and-inference/speculative-decoding-and-distillation`]: [distill],
  [`${P}/model-serving-and-inference/multi-gpu-serving-and-parallelism`]: [allReduce],
  [`${P}/model-serving-and-inference/quantization-for-inference`]: [precisionTable],
  [`${P}/model-serving-and-inference/model-routing-and-cascades`]: [moe],
  [`${P}/model-serving-and-inference/autoscaling-gpu-inference-fleets`]: [scalingSignals],
  [`${P}/model-serving-and-inference/prefix-and-prompt-caching`]: [prefixOrder],
  [`${P}/model-serving-and-inference/serving-frameworks-compared`]: [paged],
  [`${P}/agents-and-tool-use/agent-loops-and-tool-use`]: [toolCallFlow],
  [`${P}/agents-and-tool-use/multi-agent-orchestration`]: [multiAgentCost],
  [`${P}/agents-and-tool-use/agent-memory-architectures`]: [memoryPaging],
  [`${P}/agents-and-tool-use/tool-schema-design-and-argument-validation`]: [toolDescriptions],
  [`${P}/agents-and-tool-use/planning-strategies-react-tot-plan-and-execute`]: [replan],
  [`${P}/agents-and-tool-use/agent-to-agent-and-tool-protocols`]: [agentCard],
  [`${P}/agents-and-tool-use/failure-recovery-and-self-correction-loops`]: [loopGuard],
  [`${P}/agents-and-tool-use/human-in-the-loop-and-approval-gates`]: [approvalFatigue],
  [`${P}/agents-and-tool-use/model-context-protocol`]: [transports],
  [`${P}/evaluation-and-observability/evaluating-llm-applications`]: [evalLayers],
  [`${P}/evaluation-and-observability/tracing-and-debugging-multi-step-llm-pipelines`]: [traceTree],
  [`${P}/evaluation-and-observability/human-feedback-and-rlhf-basics`]: [labelNoise],
  [`${P}/evaluation-and-observability/llm-as-judge-design-calibration-and-bias-pitfalls`]: [judgeAgreement],
  [`${P}/evaluation-and-observability/golden-datasets-and-regression-testing-for-prompts`]: [failureToDataset],
  [`${P}/evaluation-and-observability/production-monitoring-drift-and-hallucination-tracking`]: [sampleMonitor],
  [`${P}/evaluation-and-observability/ab-testing-and-online-evaluation-for-llm-features`]: [peeking],
  [`${P}/safety-and-guardrails/prompt-injection-and-input-guardrails`]: [directIndirect],
  [`${P}/safety-and-guardrails/content-moderation-and-output-safety`]: [moderationPlacement],
  [`${P}/safety-and-guardrails/jailbreaks-and-adversarial-robustness`]: [jailbreakKinds],
  [`${P}/safety-and-guardrails/pii-detection-and-redaction-pipelines`]: [redactModes],
  [`${P}/safety-and-guardrails/multi-agent-security-boundaries-and-tool-permission-scoping`]: [trifecta],
  [`${P}/safety-and-guardrails/red-teaming-methodology-for-llm-applications`]: [attackRate],
  [`${P}/safety-and-guardrails/data-governance-and-compliance-for-llm-systems`]: [retention],
};
