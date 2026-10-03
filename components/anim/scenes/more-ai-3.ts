import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-systems";

const latencyBreakdown: Scene = {
  title: "Where the time goes in one call",
  caption: "Latency is network, queueing, prefill (reading the input) and then decode (writing the output, one token at a time). Output tokens dominate long answers, which is why shortening the reply helps more than trimming the prompt.",
  controls: [
    { id: "i", kind: "range", label: "Input tokens", min: 200, max: 8000, step: 200, initial: 2000 },
    { id: "o", kind: "range", label: "Output tokens", min: 20, max: 1000, step: 20, initial: 300 },
  ],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const net = 80;
    const queue = 40;
    const pre = g.v.i * 0.05;
    const dec = g.v.o * 12;
    const total = net + queue + pre + dec;
    const parts: [string, number, string][] = [["network", net, pal.line], ["queue", queue, pal.muted], ["prefill", pre, pal.blue], ["decode", dec, pal.accent]];
    let x = 30;
    parts.forEach(([nm, v, col]) => {
      const w = (v / total) * 420;
      g.rect(x, 80, w - 1, 40, col, 0.7, 3);
      if (w > 40) g.text(nm, x + w / 2, 100, { size: 10, color: pal.paper });
      x += w;
    });
    g.orb("working", 456, 40, 24, pal.paper, 1);
    g.text(`${(total / 1000).toFixed(1)} s total`, 240, 162, { size: 20, color: pal.paper, bold: true });
    g.text(`first token after ~${((net + queue + pre) / 1000).toFixed(2)} s`, 240, 192, { size: 12, color: pal.ok });
    g.text(dec > pre + net ? "decode dominates: ask for shorter answers" : "prefill dominates: trim or cache the prompt", 240, 230, { size: 11, color: pal.muted });
  },
};

const cacheKey: Scene = {
  title: "Cache keys and privacy",
  caption: "A cached answer is returned to whoever asks the same question. If the answer depended on one user's private data and the key ignores the user, the next person receives it. Include the user or tenant in the key when the answer is personal.",
  controls: [{ id: "k", kind: "toggle", label: "User id in the cache key", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const scoped = g.v.k === 1;
    const { i, p } = g.stage([2, 2.4]);
    node(g, "user", 50, 70, { label: "Ana", size: 32 });
    node(g, "user", 50, 170, { label: "Raj", size: 32, color: pal.violet });
    node(g, "cache", 230, 120, { label: "response cache", size: 46, active: true });
    node(g, "gpu", 410, 120, { label: "model", size: 36 });
    g.text("what is my balance?", 130, 58, { size: 10, color: pal.muted });
    if (i === 0) {
      g.packet(76, 70, 204, 112, p, pal.accent, 3);
      g.packet(256, 120, 384, 120, p, pal.accent, 3);
      chip(g, 230, 176, "stored: Ana's balance $4,210", pal.accent, 9);
    } else {
      g.packet(76, 170, 204, 128, p, pal.violet, 3);
      if (!scoped) {
        g.packet(204, 128, 76, 176, g.clamp(p * 1.1), pal.bad, 3);
        chip(g, 230, 176, "Raj receives Ana's balance ✕", pal.bad, 10);
      } else {
        g.packet(256, 124, 384, 124, p, pal.violet, 3);
        chip(g, 230, 176, "different key: Raj's own answer ✓", pal.ok, 10);
      }
    }
    g.text(scoped ? "key = hash(user, question)" : "key = hash(question) only", 240, 238, { size: 12, color: scoped ? pal.ok : pal.bad });
  },
};

const cancelStream: Scene = {
  title: "Cancelling a stream saves the rest",
  caption: "Output tokens are billed as they are produced. If the user clicks stop, or the answer is clearly going nowhere, cancelling the stream stops the generation and the charge. Without cancellation the model finishes a reply nobody reads.",
  controls: [{ id: "c", kind: "toggle", label: "User stops at 40%", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const cancel = g.v.c === 1;
    const t = (g.t * 0.5) % 1.4;
    const frac = cancel ? Math.min(0.4, t) : Math.min(1, t);
    const stopped = cancel && t > 0.4;
    g.rect(30, 50, 420, 70, pal.line, 0.1, 8);
    for (let k = 0; k < 24; k++) {
      const on = k / 24 < frac;
      g.rect(42 + (k % 12) * 34, 60 + Math.floor(k / 12) * 28, 28, 18, on ? pal.accent : pal.line, on ? 0.6 : 0.12, 4);
    }
    g.orb(stopped ? "breathing" : "composing", 456, 40, 24, pal.paper, 1);
    g.text("tokens generated and billed", 90, 160, { size: 10 });
    bar(g, 200, 155, 200, 8, frac, stopped ? pal.ok : pal.accent);
    g.text(`${Math.round(frac * 100)}%`, 440, 160, { size: 11, color: pal.paper });
    g.text(stopped ? "stream cancelled: the remaining 60% is never generated ✓" : cancel ? "streaming…" : "runs to the end whether it is read or not", 240, 214, { size: 12, color: stopped ? pal.ok : pal.paper });
  },
};

const taskTiers: Scene = {
  title: "Task tiering",
  caption: "Most traffic is routine work a small model handles fine. Only the hard minority needs the large model. Slide the share of hard tasks and compare the bill for routing by difficulty against sending everything to the large model.",
  controls: [{ id: "h", kind: "range", label: "Hard tasks %", min: 5, max: 80, step: 5, initial: 20 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hard = g.v.h / 100;
    node(g, "lb", 60, 100, { label: "router", size: 36 });
    g.orb("working", 300, 60, 30, pal.paper, 1);
    g.text("small $0.5", 300, 88, { size: 9, color: pal.muted });
    g.orb("solving", 300, 160, 50, pal.paper, 1);
    g.text("large $15", 300, 196, { size: 9, color: pal.muted });
    for (let k = 0; k < 10; k++) {
      const isHard = g.rnd(k * 3.7 + Math.floor(g.t * 0.5) * 11) < hard;
      g.packet(84, 100, isHard ? 270 : 276, isHard ? 156 : 64, (g.t * 0.6 + k / 10) % 1, isHard ? pal.bad : pal.ok, 2.2);
    }
    const mixed = hard * 15 + (1 - hard) * 0.5;
    g.text("cost per 1M tokens", 20, 228, { size: 10, align: "left" });
    bar(g, 150, 223, 160, 8, mixed / 15, pal.ok);
    g.text(`$${mixed.toFixed(1)} routed`, 330, 228, { size: 11, align: "left", color: pal.paper });
    g.text(`vs $15 all large: ${Math.round((1 - mixed / 15) * 100)}% saved`, 240, 258, { size: 11, color: pal.ok });
  },
};

const parallelCalls: Scene = {
  title: "Parallel calls inside a request",
  caption: "Five independent lookups run one after another take the sum of their times. Fired together they take only as long as the slowest. Dependent steps must still wait for each other, but independent ones should not.",
  controls: [{ id: "p", kind: "toggle", label: "Run in parallel", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const par = g.v.p === 1;
    const durs = [1.2, 0.8, 1.5, 0.9, 1.1];
    const total = par ? Math.max(...durs) : durs.reduce((a, b) => a + b, 0);
    const t = (g.t * 0.9) % (total + 1);
    let start = 0;
    durs.forEach((d, k) => {
      const s = par ? 0 : start;
      start += d;
      const y = 50 + k * 28;
      const f = g.clamp((t - s) / d);
      g.text(`call ${k + 1}`, 20, y + 10, { size: 9, align: "left", color: pal.muted });
      g.rect(80 + (s / 6) * 340, y, (d / 6) * 340, 20, pal.line, 0.1, 4);
      g.rect(80 + (s / 6) * 340, y, (d / 6) * 340 * f, 20, par ? pal.ok : pal.blue, 0.7, 4);
    });
    g.orb("working", 456, 40, 22, pal.paper, 1);
    g.text(`${total.toFixed(1)} s to finish`, 240, 214, { size: 15, color: par ? pal.ok : pal.bad, bold: true });
    g.text(par ? "total = the slowest call" : "total = the sum of every call", 240, 242, { size: 10, color: pal.muted });
  },
};

const budgetLeaks: Scene = {
  title: "Where the token budget leaks",
  caption: "Each turn adds the user's message, the model's reply and any tool output to the history that is resent next time. Verbose tool results are the biggest leak. Trimming them keeps the history flat instead of climbing toward the limit.",
  controls: [{ id: "t", kind: "toggle", label: "Trim tool outputs" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const trim = g.v.t === 1;
    const turns = 8;
    const cap = 8000;
    const tool = trim ? 150 : 900;
    const x0 = 40;
    let acc = 600;
    let pv: [number, number] | null = null;
    for (let k = 0; k <= turns; k++) {
      if (k > 0) acc += 120 + 180 + tool;
      const x = x0 + (k / turns) * 400;
      const y = 200 - Math.min(1.1, acc / cap) * 130;
      if (pv) g.line(pv[0], pv[1], x, y, acc > cap ? pal.bad : pal.accent, 1, 2.4);
      pv = [x, y];
      g.rect(x - 10, y, 20, 200 - y, acc > cap ? pal.bad : pal.accent, 0.15, 2);
    }
    g.line(x0, 200 - 130, 440, 200 - 130, pal.bad, 0.7, 1.3);
    g.text("limit", 440, 200 - 138, { size: 9, color: pal.bad, align: "right" });
    g.text("turn →", 240, 218, { size: 9, color: pal.muted });
    node(g, "cloud", 456, 60, { size: 22 });
    g.text(acc > cap ? "history overflows the budget by turn 8 ✕" : "history stays well under the limit ✓", 240, 244, { size: 12, color: acc > cap ? pal.bad : pal.ok });
  },
};

const breakEven: Scene = {
  title: "Fine-tuning break-even",
  caption: "Fine-tuning costs a lot up front but can shorten every prompt, since you no longer need long instructions and examples. Add request volume and the cumulative cost lines cross at the break-even point.",
  controls: [{ id: "v", kind: "range", label: "Requests per month (K)", min: 10, max: 1000, step: 10, initial: 300 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const rpm = g.v.v;
    const prompt = (m: number) => m * rpm * 0.012;
    const tuned = (m: number) => 800 + m * rpm * 0.005;
    const x = (m: number) => 40 + (m / 12) * 400;
    const maxv = Math.max(prompt(12), tuned(12));
    const y = (v: number) => 200 - (v / maxv) * 130;
    let pa: [number, number] | null = null;
    let pb: [number, number] | null = null;
    let cross = -1;
    for (let m = 0; m <= 12; m += 0.25) {
      if (pa && pb) {
        g.line(pa[0], pa[1], x(m), y(prompt(m)), pal.blue, 1, 2);
        g.line(pb[0], pb[1], x(m), y(tuned(m)), pal.accent, 1, 2);
      }
      pa = [x(m), y(prompt(m))];
      pb = [x(m), y(tuned(m))];
      if (cross < 0 && prompt(m) > tuned(m)) cross = m;
    }
    g.text("prompting with long instructions", 70, 54, { size: 10, align: "left", color: pal.blue });
    g.text("fine-tuned, short prompt", 70, 70, { size: 10, align: "left", color: pal.accent });
    if (cross > 0) {
      g.dot(x(cross), y(prompt(cross)), 6, pal.ok);
      g.glow(x(cross), y(prompt(cross)), 18, pal.ok, 0.4);
    }
    node(g, "gpu", 456, 50, { size: 22 });
    g.text("months →", 240, 218, { size: 9, color: pal.muted });
    g.text(cross > 0 ? `pays back after about ${cross.toFixed(1)} months` : "does not pay back within a year", 240, 246, { size: 12, color: cross > 0 ? pal.ok : pal.bad });
  },
};

const overfit: Scene = {
  title: "Overfitting in fine-tuning",
  caption: "Training loss keeps falling with every epoch, but validation loss, measured on examples the model never trained on, turns upward once it starts memorising. Stop at the minimum of the validation curve.",
  controls: [{ id: "e", kind: "range", label: "Epochs", min: 1, max: 12, step: 1, initial: 8 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const E = g.v.e;
    const tr = (e: number) => 1.6 * Math.exp(-e * 0.35) + 0.08;
    const va = (e: number) => 1.6 * Math.exp(-e * 0.3) + 0.2 + 0.012 * e * e * 0.9;
    const x = (e: number) => 40 + (e / 12) * 400;
    const y = (v: number) => 200 - (v / 1.8) * 140;
    let a: [number, number] | null = null;
    let b: [number, number] | null = null;
    let best = 0;
    for (let e = 0; e <= E; e += 0.25) {
      if (a && b) {
        g.line(a[0], a[1], x(e), y(tr(e)), pal.blue, 1, 2);
        g.line(b[0], b[1], x(e), y(va(e)), pal.accent, 1, 2);
      }
      a = [x(e), y(tr(e))];
      b = [x(e), y(va(e))];
      if (va(e) < va(best)) best = e;
    }
    g.text("training loss", 80, 50, { size: 10, color: pal.blue });
    g.text("validation loss", 170, 50, { size: 10, color: pal.accent });
    g.dot(x(best), y(va(best)), 6, pal.ok);
    g.text("best checkpoint", x(best), y(va(best)) - 14, { size: 9, color: pal.ok });
    const over = E - best > 1.5;
    g.text(over ? "validation is rising: the model is memorising ✕" : "still improving on unseen data", 240, 232, { size: 12, color: over ? pal.bad : pal.ok });
    g.text("epochs →", 240, 252, { size: 9, color: pal.muted });
  },
};

const dpoShift: Scene = {
  title: "What a DPO update does",
  caption: "For each preference pair the update raises the model's probability of the chosen answer relative to the rejected one, while a reference model keeps it from drifting too far. Slide the training steps to watch the gap open.",
  controls: [{ id: "s", kind: "range", label: "Training steps", min: 0, max: 100, step: 5, initial: 50 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s / 100;
    const base = 0.5;
    const chosen = base + 0.32 * s;
    const rejected = base - 0.3 * s;
    node(g, "doc", 110, 70, { label: "chosen", size: 40, color: pal.ok });
    node(g, "doc", 110, 150, { label: "rejected", size: 40, color: pal.bad });
    g.orb("shaping", 260, 110, 46, pal.paper, 1);
    g.packet(140, 76, 232, 104, g.loop(1.4), pal.ok, 2.6);
    g.packet(140, 146, 232, 118, g.loop(1.4, 0.4), pal.bad, 2.6);
    g.text("probability under the model", 400, 60, { size: 9, color: pal.muted });
    bar(g, 340, 80, 110, 10, chosen, pal.ok);
    bar(g, 340, 130, 110, 10, rejected, pal.bad);
    g.text(`${Math.round(chosen * 100)}%`, 340, 100, { size: 10, align: "left", color: pal.ok });
    g.text(`${Math.round(rejected * 100)}%`, 340, 150, { size: 10, align: "left", color: pal.bad });
    g.text(`margin ${(chosen - rejected).toFixed(2)}`, 240, 218, { size: 13, color: pal.paper });
    g.text("a frozen reference model limits how far the policy drifts", 240, 246, { size: 10, color: pal.muted });
  },
};

const loraModules: Scene = {
  title: "Which weights get a LoRA adapter",
  caption: "A transformer block has attention projections and MLP layers. Adapters on only the query and value projections train the fewest parameters. Adding more modules raises capacity and memory. Pick where to attach them.",
  controls: [{ id: "m", kind: "choice", label: "Adapters on", options: ["q, v only", "all attention", "attention + MLP"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const mods: [string, number, number, number][] = [["q", 60, 70, 0], ["k", 140, 70, 1], ["v", 220, 70, 0], ["o", 300, 70, 1], ["MLP up", 120, 150, 2], ["MLP down", 260, 150, 2]];
    g.rect(30, 40, 320, 150, pal.line, 0.06, 10);
    g.frame(30, 40, 320, 150, pal.line, 1, 10, 1.2);
    g.text("one transformer block", 190, 34, { size: 9, color: pal.muted });
    let train = 0;
    mods.forEach(([nm, x, y, lvl]) => {
      const qv = nm === "q" || nm === "v";
      const on = m === 0 ? qv : m === 1 ? lvl <= 1 : true;
      if (on) train++;
      g.rect(x - 32, y - 20, 64, 40, on ? pal.accent : pal.blue, on ? 0.3 : 0.1, 7);
      g.frame(x - 32, y - 20, 64, 40, on ? pal.accent : pal.blue, on ? 1 : 0.5, 7, on ? 1.8 : 1);
      g.text(nm, x, y, { size: 11, color: pal.paper });
    });
    node(g, "gpu", 420, 100, { size: 34, color: pal.accent });
    g.text("trainable params", 380, 150, { size: 9, color: pal.muted });
    bar(g, 380, 158, 90, 8, train / 6, pal.accent);
    g.text(`${train} of 6 modules adapted`, 240, 222, { size: 12, color: pal.paper });
    g.text("more modules: better fit, more memory", 240, 250, { size: 10, color: pal.muted });
  },
};

const adapterSwap: Scene = {
  title: "One base model, many adapters",
  caption: "The large base model is loaded once. Each task has a small LoRA adapter that is swapped in per request, so a single GPU serves many specialised behaviours without keeping many full copies of the model.",
  controls: [{ id: "t", kind: "choice", label: "Request type", options: ["support replies", "SQL generation", "legal summaries"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const t = g.v.t;
    const cols = [pal.blue, pal.accent, pal.violet];
    g.orb("solving", 260, 100, 76, pal.paper, 1);
    g.text("base model (loaded once)", 260, 152, { size: 10, color: pal.muted });
    ["support", "SQL", "legal"].forEach((nm, k) => {
      const y = 50 + k * 50;
      const on = k === t;
      node(g, "doc", 80, y, { label: nm, size: 30, color: cols[k], a: on ? 1 : 0.35 });
      if (on) {
        g.packet(100, y, 224, 100, g.loop(1.4), cols[k], 3);
        g.ring(260, 100, 44, cols[k], 0.9, 2.4);
      }
    });
    node(g, "user", 420, 100, { size: 30 });
    g.packet(300, 100, 396, 100, g.loop(1.4, 0.5), cols[t], 2.6);
    g.text("adapters are megabytes, the base model is gigabytes", 240, 216, { size: 11, color: pal.paper });
    g.text(`serving the ${["support", "SQL", "legal"][t]} adapter on the shared base`, 240, 244, { size: 10, color: pal.muted });
  },
};

const syntheticDiversity: Scene = {
  title: "Synthetic data and diversity",
  caption: "A model asked for examples with the same prompt tends to produce near-duplicates that cluster tightly. Raising temperature and varying the seed topics spreads them across the space, which trains a more robust student.",
  controls: [{ id: "d", kind: "range", label: "Variation (temperature + topics)", min: 0, max: 10, step: 1, initial: 5 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const v = g.v.d / 10;
    const cx = 240;
    const cy = 110;
    let covered = 0;
    const cell = new Set<string>();
    for (let k = 0; k < 60; k++) {
      const a = g.rnd(k * 2.3 + 1) * Math.PI * 2;
      const r = (0.05 + v * 0.95) * (0.3 + g.rnd(k * 5.7 + 3) * 0.7) * 150;
      const x = cx + r * Math.cos(a) * 1.5;
      const y = cy + r * Math.sin(a) * 0.9;
      g.dot(x, y, 3, pal.accent, 0.8);
      cell.add(`${Math.floor(x / 40)},${Math.floor(y / 40)}`);
    }
    covered = cell.size;
    for (let gx = 0; gx < 12; gx++) for (let gy = 0; gy < 6; gy++) g.rect(gx * 40 + 1, gy * 40 + 1, 38, 38, pal.line, 0.04, 2);
    g.orb("composing", 456, 36, 24, pal.paper, 1);
    g.text(`${covered} regions of the space covered`, 240, 238, { size: 12, color: covered > 14 ? pal.ok : pal.bad });
    g.text(covered > 14 ? "wide coverage: the student sees varied cases" : "tight cluster: near-duplicates teach little", 240, 262, { size: 10, color: pal.muted });
  },
};

const repairLoop: Scene = {
  title: "Validate, repair, retry",
  caption: "A call can succeed technically yet return output that fails the schema. The caller validates, feeds the error back in a repair prompt and retries a bounded number of times, then falls back instead of passing bad data downstream.",
  controls: [{ id: "n", kind: "range", label: "Attempts needed", min: 1, max: 4, step: 1, initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const need = g.v.n;
    const max = 3;
    const ok = need <= max;
    const tries = Math.min(need, max);
    const pos = (g.t * 0.9) % (tries + 1.5);
    for (let k = 0; k < tries; k++) {
      const x = 60 + k * 120;
      const pass = k === need - 1;
      const reached = pos > k;
      g.orb(reached ? "composing" : "breathing", x, 80, 36, pal.paper, reached ? 1 : 0.4);
      chip(g, x, 126, pass ? "valid ✓" : "invalid ✕", reached ? (pass ? pal.ok : pal.bad) : pal.line, 10, reached ? 1 : 0.4);
      if (!pass && k < tries - 1) {
        g.arrow(x + 24, 80, x + 96, 80, pal.accent, reached ? 0.9 : 0.3);
        g.text("repair prompt", x + 60, 64, { size: 8, color: pal.accent });
      }
    }
    chip(g, 240, 190, ok ? `accepted on attempt ${need}` : "limit reached: use the fallback", ok ? pal.ok : pal.bad, 12);
    g.text("bounded retries, then degrade gracefully", 240, 240, { size: 10, color: pal.muted });
  },
};

const releaseGate: Scene = {
  title: "Comparing a candidate release",
  caption: "The new version is compared with the old on LLM-specific metrics, not just errors and latency. A small drop in quality or a jump in refusals can be invisible to standard dashboards. Promote only if every guard metric holds.",
  controls: [{ id: "r", kind: "toggle", label: "Candidate refuses more" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const reg = g.v.r === 1;
    const rows: [string, number, number, boolean][] = [["answer quality", 0.84, 0.86, true], ["latency (lower better)", 0.5, 0.46, false], ["cost (lower better)", 0.6, 0.55, false], ["refusal rate (lower better)", 0.05, reg ? 0.14 : 0.05, false]];
    let pass = true;
    rows.forEach(([nm, a, b, hi], k) => {
      const y = 50 + k * 40;
      const worse = hi ? b < a - 0.02 : b > a + (k === 3 ? 0.02 : 0.05);
      if (worse) pass = false;
      g.text(nm, 20, y + 4, { size: 10, align: "left" });
      bar(g, 190, y - 4, 100, 7, k === 3 ? a * 5 : a, pal.blue);
      bar(g, 190, y + 6, 100, 7, k === 3 ? b * 5 : b, worse ? pal.bad : pal.ok);
      g.text(worse ? "✕" : "✓", 320, y + 4, { size: 14, color: worse ? pal.bad : pal.ok });
    });
    g.text("blue = current, green/red = candidate", 240, 222, { size: 9, color: pal.muted });
    chip(g, 240, 252, pass ? "all guard metrics hold: promote" : "refusals regressed: hold the rollout", pass ? pal.ok : pal.bad, 12);
  },
};

const providerRegion: Scene = {
  title: "Provider region alignment",
  caption: "Your app runs in Europe but calls a model endpoint in the US. Every request crosses the Atlantic twice and may move user data across a border. Calling an endpoint in the same region cuts latency and keeps data local.",
  controls: [{ id: "r", kind: "choice", label: "Model endpoint", options: ["same region (EU)", "other region (US)"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const far = g.v.r === 1;
    node(g, "cloud", 90, 100, { label: "your app (EU)", size: 54, color: pal.blue });
    node(g, "cloud", far ? 400 : 230, far ? 100 : 100, { label: far ? "model API (US)" : "model API (EU)", size: 54, color: far ? pal.bad : pal.ok });
    const tx = far ? 400 : 230;
    g.packet(120, 92, tx - 30, 92, g.loop(far ? 2.4 : 1), pal.accent, 3);
    g.packet(tx - 30, 110, 120, 110, g.loop(far ? 2.4 : 1, 0.5), pal.ok, 3);
    g.text("added network latency", 80, 186, { size: 10 });
    bar(g, 200, 181, 190, 8, far ? 0.8 : 0.1, far ? pal.bad : pal.ok);
    g.text(far ? "+140 ms" : "+10 ms", 430, 186, { size: 11, color: pal.paper });
    g.text(far ? "user data crosses a border: check residency rules ✕" : "traffic and data stay in the region ✓", 240, 236, { size: 12, color: far ? pal.bad : pal.ok });
  },
};

const tokenLimits: Scene = {
  title: "Requests per minute versus tokens per minute",
  caption: "Providers limit both the number of requests and the number of tokens per minute. Short prompts hit the request limit first, long prompts hit the token limit first. The binding limit sets your real throughput.",
  controls: [{ id: "t", kind: "range", label: "Tokens per request", min: 200, max: 8000, step: 200, initial: 3000 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const rpmLimit = 500;
    const tpmLimit = 400000;
    const tok = g.v.t;
    const byTpm = tpmLimit / tok;
    const rate = Math.min(rpmLimit, byTpm);
    const bindingTpm = byTpm < rpmLimit;
    g.text("requests/min limit", 20, 70, { size: 10, align: "left" });
    bar(g, 150, 65, 240, 10, rate / rpmLimit, bindingTpm ? pal.ok : pal.bad);
    g.text(`${Math.round(rate)} of ${rpmLimit}`, 440, 70, { size: 10, color: pal.paper });
    g.text("tokens/min limit", 20, 110, { size: 10, align: "left" });
    bar(g, 150, 105, 240, 10, (rate * tok) / tpmLimit, bindingTpm ? pal.bad : pal.ok);
    g.text(`${fmt(rate * tok)} of ${fmt(tpmLimit)}`, 440, 110, { size: 10, color: pal.paper });
    node(g, "shield", 60, 180, { size: 30, color: pal.accent });
    g.text(`max throughput ${Math.round(rate)} requests/min`, 240, 176, { size: 14, color: pal.paper, bold: true });
    g.text(bindingTpm ? "the token limit binds: shorten prompts to go faster" : "the request limit binds: batch or cache more", 240, 212, { size: 11, color: pal.muted });
  },
};

const chainQuality: Scene = {
  title: "Quality along a fallback chain",
  caption: "The primary model is the best but sometimes fails. Each fallback is cheaper or weaker. Raise the primary's failure rate and more traffic spills down the chain, so average quality slips even though every request still gets an answer.",
  controls: [{ id: "f", kind: "range", label: "Primary failure %", min: 0, max: 100, step: 5, initial: 30 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pf = g.v.f / 100;
    const tiers: [string, number, number][] = [["primary", 0.95, 1 - pf], ["secondary", 0.85, pf * 0.8], ["tertiary", 0.7, pf * 0.2]];
    let avg = 0;
    tiers.forEach(([nm, q, share], k) => {
      const x = 90 + k * 150;
      g.orb(k === 0 ? "solving" : "working", x, 76, 36 - k * 4, pal.paper, 1);
      g.text(nm, x, 108, { size: 10, color: pal.muted });
      g.rect(x - 12, 136 - share * 60, 24, share * 60, [pal.ok, pal.accent, pal.bad][k], 0.7, 3);
      g.text(`${Math.round(share * 100)}% of traffic`, x, 152, { size: 9, color: pal.muted });
      g.text(`quality ${q}`, x, 168, { size: 9, color: pal.muted });
      avg += q * share;
      if (k < 2) g.arrow(x + 30, 76, x + 118, 76, pal.line, 0.7);
    });
    g.text(`average quality ${avg.toFixed(2)}`, 240, 216, { size: 14, color: avg > 0.9 ? pal.ok : pal.bad, bold: true });
    g.text("availability stays high, so watch quality separately", 240, 244, { size: 10, color: pal.muted });
  },
};

const anomalyBand: Scene = {
  title: "Spend anomaly detection",
  caption: "Hourly spend normally stays inside a band around its recent average. A bug or an abusive user pushes it far outside. Alerting on the band catches a runaway within hours, well before a monthly budget does.",
  controls: [{ id: "s", kind: "toggle", label: "Inject a runaway loop", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const spike = g.v.s === 1;
    const t = Math.floor(g.t * 5);
    const val = (T: number) => {
      const c = ((T % 120) + 120) % 120;
      return 40 + (g.rnd(T * 1.9 + 3) - 0.5) * 12 + (spike && c > 80 ? (c - 80) * 4 : 0);
    };
    const y = (v: number) => 210 - (v / 160) * 140;
    g.rect(30, y(55), 420, y(25) - y(55), pal.ok, 0.1, 0);
    g.text("normal band", 450, y(55) - 4, { size: 9, color: pal.ok, align: "right" });
    let pv: [number, number] | null = null;
    let alert = false;
    for (let k = 0; k < 60; k++) {
      const v = val(t - 59 + k);
      const x = 30 + k * 7;
      if (v > 55 + 12 && k > 50) alert = true;
      if (pv) g.line(pv[0], pv[1], x, y(v), v > 67 ? pal.bad : pal.blue, 1, 1.8);
      pv = [x, y(v)];
    }
    node(g, "shield", 456, 40, { size: 24, color: alert ? pal.bad : pal.ok });
    chip(g, 240, 244, alert ? "ALERT: spend far above the band" : "within the normal band", alert ? pal.bad : pal.ok, 12);
    g.text("dollars per hour", 80, 40, { size: 10, color: pal.muted });
  },
};

export const MORE_AI_3: Record<string, Scene[]> = {
  [`${P}/cost-and-latency/cost-and-latency-optimization`]: [latencyBreakdown],
  [`${P}/cost-and-latency/caching-llm-responses`]: [cacheKey],
  [`${P}/cost-and-latency/streaming-and-perceived-latency`]: [cancelStream],
  [`${P}/cost-and-latency/model-selection-economics`]: [taskTiers],
  [`${P}/cost-and-latency/batch-and-async-processing`]: [parallelCalls],
  [`${P}/cost-and-latency/token-budget-management`]: [budgetLeaks],
  [`${P}/fine-tuning-and-adaptation/fine-tuning-vs-prompting-vs-rag`]: [breakEven],
  [`${P}/fine-tuning-and-adaptation/preparing-training-data-for-fine-tuning`]: [overfit],
  [`${P}/fine-tuning-and-adaptation/rlhf-ppo-and-dpo-for-fine-tuning`]: [dpoShift],
  [`${P}/fine-tuning-and-adaptation/lora-and-qlora-parameter-efficient-fine-tuning`]: [loraModules],
  [`${P}/fine-tuning-and-adaptation/continual-learning-and-catastrophic-forgetting`]: [adapterSwap],
  [`${P}/fine-tuning-and-adaptation/synthetic-data-generation-for-fine-tuning`]: [syntheticDiversity],
  [`${P}/production-reliability/handling-llm-failures-in-production`]: [repairLoop],
  [`${P}/production-reliability/shadow-deployments-and-canary-releases-for-llm-features`]: [releaseGate],
  [`${P}/production-reliability/multi-region-llm-deployment`]: [providerRegion],
  [`${P}/production-reliability/rate-limiting-and-backpressure-for-llm-apis`]: [tokenLimits],
  [`${P}/production-reliability/fallback-chains-across-providers-and-models`]: [chainQuality],
  [`${P}/production-reliability/cost-runaway-protection-and-spend-circuit-breakers`]: [anomalyBand],
};
