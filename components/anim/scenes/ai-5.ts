import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";

const P = "ai-systems";

const ftChoice: Scene = {
  title: "Fine-tuning, prompting or RAG?",
  caption: "Pick the problem you have. The orb moves to the cheapest tool that actually solves it: fresh or private facts belong in retrieval, a house style or format fits a prompt first, and a skill the model lacks at high volume is what fine-tuning is for.",
  controls: [{ id: "p", kind: "choice", label: "Problem", options: ["needs fresh facts", "needs a style or format", "needs a new skill, high volume"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pick = g.v.p === 0 ? 1 : g.v.p === 1 ? 0 : 2;
    const xs = [80, 240, 400];
    const names = ["prompting", "RAG", "fine-tuning"];
    const cost = ["minutes, no training", "index + retriever", "data, GPUs, evals"];
    const cols = [pal.blue, pal.teal, pal.violet];
    const f = g.ease(g.clamp((g.t % 5) / 1.2));
    const cur = g.v.p;
    xs.forEach((x, k) => {
      const on = k === pick;
      g.rect(x - 64, 120, 128, 90, cols[k], on ? 0.22 : 0.07, 10);
      g.frame(x - 64, 120, 128, 90, on ? cols[k] : pal.line, on ? 1 : 0.5, 10, on ? 2 : 1.2);
      g.text(names[k], x, 148, { size: 13, color: on ? pal.paper : pal.muted, bold: on });
      g.text(cost[k], x, 176, { size: 9, color: pal.muted });
      g.text(["cheapest first", "knowledge changes", "behaviour changes"][k], x, 194, { size: 9, color: on ? cols[k] : pal.muted });
    });
    const start = 240;
    const ox = g.mix(start, xs[pick], f);
    const oy = g.mix(48, 100, f);
    g.orb(f < 1 ? "searching" : "solving", ox, oy, 42, pal.paper, 1);
    g.text(`problem ${cur + 1}`, 240, 22, { size: 10, color: pal.muted });
    g.text(["facts change daily, the model cannot know them", "tone and output shape are cheap to ask for", "the model cannot do it reliably even with examples"][cur], 240, 250, { size: 11, color: pal.paper });
    g.text(["→ retrieve them at question time", "→ try a prompt, fine-tune only if it fails", "→ train it in, and amortise over volume"][cur], 240, 272, { size: 12, color: cols[pick] });
  },
};

const dataPrep: Scene = {
  title: "Preparing training data",
  caption: "A thousand raw examples go through the pipeline: drop duplicates, remove low-quality and sensitive ones, then split off a held-out set. Tighten the quality filter and the set shrinks but gets cleaner.",
  controls: [{ id: "q", kind: "range", label: "Quality filter strictness", min: 0, max: 1, step: 0.1, initial: 0.5 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.q;
    const n0 = 1000;
    const dup = Math.round(n0 * 0.15);
    const n1 = n0 - dup;
    const low = Math.round(n1 * (0.1 + 0.35 * s));
    const n2 = n1 - low;
    const pii = Math.round(n2 * 0.03);
    const n3 = n2 - pii;
    const val = Math.round(n3 * 0.1);
    const stages: [string, number, number, string][] = [["raw", n0, 0, pal.paper], ["dedupe", n1, dup, pal.blue], ["quality", n2, low, pal.violet], ["no PII", n3, pii, pal.teal]];
    stages.forEach(([nm, n, removed, col], k) => {
      const y = 40 + k * 44;
      g.text(nm, 20, y + 10, { size: 11, align: "left", color: pal.paper });
      g.rect(90, y, (n / n0) * 300, 20, col, 0.7, 4);
      g.text(String(n), 90 + (n / n0) * 300 + 22, y + 10, { size: 11, color: pal.paper });
      if (removed > 0) g.text(`-${removed}`, 440, y + 10, { size: 11, color: pal.bad });
      if (k < 3) g.packet(250, y + 20, 250, y + 44, (g.t * 0.7 + k * 0.25) % 1, col, 2.4);
    });
    g.orb("shaping", 440, 60, 28, pal.paper, 1);
    g.rect(90, 222, (n3 - val) * 0.3, 14, pal.ok, 0.8, 3);
    g.rect(90 + (n3 - val) * 0.3, 222, val * 0.3, 14, pal.accent, 0.8, 3);
    g.text("train / held-out", 20, 229, { size: 10, align: "left", color: pal.muted });
    g.text(`${fmt(n3 - val)} train, ${val} eval`, 360, 229, { size: 11, color: pal.paper });
    g.text("never let the eval split leak into training", 240, 270, { size: 10, color: pal.muted });
  },
};

const ppoDpo: Scene = {
  title: "RLHF with PPO versus DPO",
  caption: "PPO needs a reward model, sampled answers and a penalty that keeps the policy near a reference model, so it is a loop with several parts. DPO uses the preference pairs directly in one supervised-style update, with no reward model and no sampling.",
  controls: [{ id: "m", kind: "choice", label: "Method", options: ["RLHF with PPO", "DPO"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const dpo = g.v.m === 1;
    if (!dpo) {
      const nodes: [number, number, string, string][] = [
        [70, 80, "policy", pal.blue], [240, 50, "sample answers", pal.accent], [410, 80, "reward model", pal.violet],
        [410, 190, "PPO update", pal.ok], [70, 190, "KL to reference", pal.teal],
      ];
      for (let k = 0; k < nodes.length; k++) {
        const a = nodes[k];
        const b = nodes[(k + 1) % nodes.length];
        g.line(a[0], a[1], b[0], b[1], pal.line, 0.8, 1.3);
        g.packet(a[0], a[1], b[0], b[1], (g.t * 0.35 + k * 0.2) % 1, pal.accent, 2.6);
      }
      nodes.forEach(([x, y, s, c]) => {
        g.ring(x, y, 20, c, 1, 1.5);
        g.text(s, x, y + 34, { size: 10, color: pal.paper });
      });
      g.orb("solving", 240, 130, 44, pal.paper, 1);
      g.text("five moving parts, can be unstable", 240, 268, { size: 12, color: pal.paper });
    } else {
      g.rect(30, 70, 150, 70, pal.accent, 0.15, 8);
      g.frame(30, 70, 150, 70, pal.accent, 1, 8, 1.2);
      g.text("preference pair", 105, 90, { size: 10, color: pal.accent });
      g.text("chosen > rejected", 105, 114, { size: 11, color: pal.paper });
      g.orb("shaping", 300, 105, 54, pal.paper, 1);
      g.text("policy (+ frozen reference)", 300, 146, { size: 10, color: pal.muted });
      g.packet(180, 105, 270, 105, g.loop(1.6), pal.accent, 3);
      g.arrow(330, 105, 420, 105, pal.ok, 0.9);
      chip(g, 440, 105, "better policy", pal.ok, 10);
      g.text("one supervised-style loss, no reward model, no sampling", 240, 222, { size: 12, color: pal.paper });
      g.text("simpler and stable, bounded by the pairs you have", 240, 262, { size: 10, color: pal.muted });
    }
  },
};

const lora: Scene = {
  title: "LoRA and QLoRA",
  caption: "The big weight matrix W stays frozen. LoRA learns two thin matrices whose product is added to it, and their size is set by the rank. Raise the rank for capacity, lower it to train far fewer parameters. QLoRA also stores W in 4 bits.",
  controls: [
    { id: "r", kind: "range", label: "Rank", min: 1, max: 8, step: 1, initial: 2 },
    { id: "q", kind: "toggle", label: "QLoRA (4-bit W)" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const r = g.v.r;
    const q = g.v.q === 1;
    const n = 8;
    const cs = 15;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let v = g.rnd(i * 9 + j * 3.1);
        if (q) v = Math.round(v * 3) / 3;
        g.rect(30 + j * cs, 50 + i * cs, cs - 1, cs - 1, pal.paper, 0.12 + 0.35 * v, 1.5);
      }
    g.frame(28, 48, n * cs + 2, n * cs + 2, pal.line, 1, 3, 1.3);
    g.text("W frozen", 30 + (n * cs) / 2, 38, { size: 10, color: pal.muted });
    g.text("+", 180, 110, { size: 20, color: pal.paper });
    for (let i = 0; i < n; i++) for (let j = 0; j < r; j++) g.rect(200 + j * cs, 50 + i * cs, cs - 1, cs - 1, pal.accent, 0.5 + 0.3 * Math.sin(g.t * 2 + i + j), 1.5);
    g.text("B", 200 + (r * cs) / 2, 38, { size: 10, color: pal.accent });
    g.text("×", 200 + r * cs + 14, 110, { size: 16, color: pal.paper });
    const ax = 200 + r * cs + 28;
    for (let i = 0; i < r; i++) for (let j = 0; j < n; j++) g.rect(ax + j * cs * 0.7, 50 + i * cs, cs * 0.7 - 1, cs - 1, pal.teal, 0.5 + 0.3 * Math.cos(g.t * 2 + i + j), 1.5);
    g.text("A", ax + (n * cs * 0.7) / 2, 38, { size: 10, color: pal.teal });
    g.orb("shaping", 420, 80, 34, pal.paper, 1);
    const full = n * n;
    const lo = 2 * n * r;
    g.text("trained params", 70, 210, { size: 11 });
    bar(g, 150, 205, 230, 8, lo / full, pal.accent);
    g.text(`${lo} of ${full} (${Math.round((lo / full) * 100)}%)`, 430, 210, { size: 11, color: pal.paper });
    g.text("weights memory", 70, 238, { size: 11 });
    bar(g, 150, 233, 230, 8, q ? 0.25 : 1, q ? pal.ok : pal.blue);
    g.text(q ? "4-bit: a quarter" : "16-bit", 430, 238, { size: 11, color: pal.paper });
    g.text("same frozen W, tiny trainable adapter", 240, 275, { size: 10, color: pal.muted });
  },
};

const forgetting: Scene = {
  title: "Catastrophic forgetting",
  caption: "Training on a new task can overwrite what the model already knew. The naive run climbs on task B while task A collapses. Mixing in replayed task A examples with a lower learning rate keeps both lines up.",
  controls: [{ id: "m", kind: "choice", label: "Training", options: ["naive fine-tune", "replay + low LR"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const replay = g.v.m === 1;
    const x0 = 50;
    const x1 = 450;
    const yOf = (v: number) => 220 - v * 160;
    g.line(x0, 220, x1, 220, pal.line, 1, 1.2);
    g.line(x0, 60, x0, 220, pal.line, 1, 1.2);
    g.text("training steps →", 250, 244, { size: 10, color: pal.muted });
    const A = (u: number) => (replay ? 0.9 - 0.06 * u : 0.9 - 0.55 * (1 - Math.exp(-3 * u)));
    const B = (u: number) => 0.2 + 0.65 * (1 - Math.exp(-3.2 * u));
    const prog = g.clamp((g.t % 6) / 4.5);
    const steps = 50;
    let pa: [number, number] | null = null;
    let pb: [number, number] | null = null;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      if (u > prog) break;
      const x = x0 + u * (x1 - x0);
      const ya = yOf(A(u));
      const yb = yOf(B(u));
      if (pa && pb) {
        g.line(pa[0], pa[1], x, ya, pal.blue, 1, 2);
        g.line(pb[0], pb[1], x, yb, pal.accent, 1, 2);
      }
      pa = [x, ya];
      pb = [x, yb];
    }
    if (pa && pb) {
      g.dot(pa[0], pa[1], 4, pal.blue);
      g.dot(pb[0], pb[1], 4, pal.accent);
    }
    g.text("task A (old skill)", 130, 50, { size: 11, color: pal.blue });
    g.text("task B (new skill)", 330, 50, { size: 11, color: pal.accent });
    const aNow = A(prog);
    g.orb("shaping", 44, 36, 24, pal.paper, 1);
    g.text(replay ? "old skill preserved" : aNow < 0.65 ? "old skill is being overwritten" : "training…", 240, 270, { size: 12, color: replay ? pal.ok : aNow < 0.65 ? pal.bad : pal.paper });
  },
};

const synthetic: Scene = {
  title: "Synthetic data generation",
  caption: "A strong teacher model writes examples, some of them poor. A judge scores each one and only those above the bar reach the student's training set. Raise the bar and the set shrinks but the share of good examples rises.",
  controls: [{ id: "s", kind: "range", label: "Quality bar", min: 0.1, max: 0.9, step: 0.05, initial: 0.5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const bar0 = g.v.s;
    g.orb("composing", 50, 110, 48, pal.paper, 1);
    g.text("teacher", 50, 146, { size: 10, color: pal.muted });
    g.orb("weaving", 230, 110, 36, pal.paper, 1);
    g.text("judge", 230, 142, { size: 10, color: pal.muted });
    g.rect(290, 50, 8, 120, pal.blue, 0.7, 3);
    g.text(`bar ${bar0.toFixed(2)}`, 294, 44, { size: 10, color: pal.blue });
    g.frame(350, 50, 110, 130, pal.ok, 1, 8, 1.3);
    g.text("student training set", 405, 42, { size: 10, color: pal.ok });
    let kept = 0;
    let good = 0;
    const N = 40;
    for (let k = 0; k < N; k++) {
      const q = g.rnd(k * 2.3 + 1);
      const isGood = q > 0.35;
      const pass = q + (g.rnd(k * 7.1) - 0.5) * 0.15 >= bar0;
      if (pass) {
        kept++;
        if (isGood) good++;
        const c = (kept - 1) % 8;
        const r = Math.floor((kept - 1) / 8);
        g.dot(364 + c * 12.5, 66 + r * 14, 3, isGood ? pal.ok : pal.bad);
      }
      const f = (g.t * 0.35 + k / N) % 1;
      if (k < 14) {
        const x = 80 + f * 200;
        g.dot(x, 110 + (g.rnd(k * 5.1) - 0.5) * 70, 2.5, isGood ? pal.paper : pal.bad, 0.8);
      }
    }
    const prec = kept ? Math.round((good / kept) * 100) : 0;
    g.text(`${kept} of ${N} kept`, 130, 220, { size: 12, color: pal.paper });
    g.text(`${prec}% of kept examples are good`, 360, 220, { size: 12, color: prec > 85 ? pal.ok : pal.accent });
    g.text("red dots are flawed examples that slipped through", 240, 262, { size: 10, color: pal.muted });
  },
};

const llmFailures: Scene = {
  title: "Handling LLM failures in production",
  caption: "Three common failures and the matching recovery. A timeout is retried with growing backoff. A rate-limit error waits as long as the server asks. Malformed output is repaired with a corrective prompt. The wrong handler wastes time or repeats the failure.",
  controls: [{ id: "f", kind: "choice", label: "Failure", options: ["timeout", "429 rate limit", "malformed JSON"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const f = g.v.f;
    const evs: [number, string, boolean][][] = [
      [[0, "call", false], [2, "retry +1s", false], [5, "retry +2s", true]],
      [[0, "call 429", false], [4, "wait: Retry-After 4s", false], [6, "retry", true]],
      [[0, "call", false], [1, "validate ✕", false], [3, "repair prompt", false], [4.5, "valid ✓", true]],
    ];
    const total = [6.5, 7.5, 6][f];
    const events = evs[f];
    const cur = (g.t % (total + 1.5));
    g.line(30, 130, 450, 130, pal.line, 1, 1.5);
    events.forEach(([t0, label, ok], k) => {
      const x = 40 + (t0 / total) * 390;
      if (cur >= t0) {
        const col = ok ? pal.ok : k === 0 ? pal.bad : pal.accent;
        g.dot(x, 130, 5, col);
        chip(g, Math.min(430, Math.max(60, x + 20)), 100 - (k % 2) * 34, label, col, 10);
      }
    });
    const px = 40 + (Math.min(cur, total) / total) * 390;
    g.glow(px, 130, 16, pal.accent, 0.4);
    g.orb(cur > events[events.length - 1][0] ? "composing" : "working", px, 175, 28, pal.paper, 1);
    g.text(["exponential backoff: wait 1s, then 2s", "honour the server's Retry-After, do not hammer", "feed the parse error back, ask for a fix"][f], 240, 238, { size: 12, color: pal.paper });
    g.text(["transient: retrying usually works", "capacity limit: more calls make it worse", "output problem: retrying blindly repeats it"][f], 240, 264, { size: 10, color: pal.muted });
  },
};

const canary: Scene = {
  title: "Shadow deployments and canary releases",
  caption: "Shadow mode copies live traffic to the new version and throws its answers away, so you compare it risk-free. A canary sends a small share of real users to the new version and watches the metrics before widening.",
  controls: [
    { id: "m", kind: "choice", label: "Mode", options: ["shadow", "canary"], initial: 1 },
    { id: "p", kind: "range", label: "Canary share %", min: 1, max: 50, step: 1, initial: 10 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const canary = g.v.m === 1;
    const share = g.v.p / 100;
    g.orb("listening", 40, 120, 30, pal.paper, 1);
    g.text("users", 40, 148, { size: 10, color: pal.muted });
    g.orb("working", 400, 70, 44, pal.paper, 1);
    g.text("v1 (live)", 400, 104, { size: 10, color: pal.muted });
    g.orb("solving", 400, 190, 44, pal.accent, 1);
    g.text("v2 (new)", 400, 224, { size: 10, color: pal.accent });
    for (let k = 0; k < 10; k++) {
      const f = (g.t * 0.4 + k / 10) % 1;
      const toNew = canary ? g.rnd(Math.floor(g.t * 0.4 + k / 10) * 10 + k + 3) < share : false;
      g.packet(60, 120, 372, toNew ? 190 : 72, f, toNew ? pal.accent : pal.ok, 2.6);
      if (!canary) g.packet(60, 120, 372, 190, f, pal.line, 1.8);
    }
    g.text(canary ? `${g.v.p}% of real users see v2` : "100% see v1, v2 gets a silent copy", 215, 250, { size: 11, color: pal.paper });
    const err = canary ? 1 + 0.8 * Math.sin(g.t * 0.7) : 0;
    g.text(canary ? "watch error rate and quality, roll back on a bad signal" : "compare outputs offline, nothing reaches users", 215, 272, { size: 10, color: pal.muted });
    if (canary && err > 1.6) chip(g, 215, 40, "metrics regressing: roll back", pal.bad, 10);
    else chip(g, 215, 40, canary ? "metrics healthy: widen" : "compare v1 vs v2 answers", pal.ok, 10);
  },
};

const multiRegion: Scene = {
  title: "Multi-region LLM deployment",
  caption: "Users go to the nearest region. Take the EU region down: with free routing its users fail over to another region at higher latency, but a data-residency lock refuses to move EU data out, so those requests error instead.",
  controls: [
    { id: "d", kind: "toggle", label: "EU region down" },
    { id: "l", kind: "toggle", label: "Residency lock" },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const down = g.v.d === 1;
    const lock = g.v.l === 1;
    const reg: [number, number, string][] = [[90, 80, "EU"], [390, 80, "US"], [240, 210, "APAC"]];
    reg.forEach(([x, y, nm], k) => {
      const dead = down && k === 0;
      g.ring(x, y, 34, dead ? pal.bad : pal.ok, 1, 1.6);
      g.orb(dead ? "breathing" : "working", x, y, dead ? 28 : 46, dead ? pal.line : pal.paper, 1);
      g.text(nm, x, y + 50, { size: 11, color: dead ? pal.bad : pal.muted });
      if (dead) g.text("✕", x, y, { size: 22, color: pal.bad });
    });
    const users: [number, number, number][] = [[40, 25, 0], [440, 25, 1], [340, 262, 2]];
    users.forEach(([ux, uy, home], k) => {
      g.dot(ux, uy, 4, pal.paper);
      const dead = down && home === 0;
      let tgt = home;
      let col = pal.ok;
      if (dead) {
        tgt = lock ? -1 : 2;
        col = lock ? pal.bad : pal.accent;
      }
      if (tgt < 0) {
        g.packet(ux, uy, reg[0][0], reg[0][1] - 34, (g.t * 0.5 + k * 0.3) % 0.6, col, 3);
        g.text("rejected: cannot leave EU", 130, 20, { size: 10, color: pal.bad });
      } else g.packet(ux, uy, reg[tgt][0], reg[tgt][1] - 36, (g.t * 0.5 + k * 0.3) % 1, col, 3);
    });
    const msg = !down ? "each user hits the nearest region" : lock ? "EU users get errors, residency kept" : "EU users fail over to APAC, +160 ms";
    g.text(msg, 240, 300, { size: 12, color: !down ? pal.paper : lock ? pal.bad : pal.accent });
  },
};

const backpressure: Scene = {
  title: "Rate limiting and backpressure",
  caption: "Requests arrive faster than the API's limit of eight per second. An unbounded queue just grows and every request waits longer. A bounded queue sheds the excess immediately so admitted requests stay fast and callers know to back off.",
  controls: [
    { id: "r", kind: "range", label: "Incoming req/s", min: 2, max: 20, step: 1, initial: 12 },
    { id: "b", kind: "toggle", label: "Bounded queue + shed", initial: true },
  ],
  aspect: 0.62,
  make: () => {
    let queue = 0;
    let shed = 0;
    let last = -1;
    return (g) => {
      const { pal } = g;
      if (g.t < last) {
        queue = 0;
        shed = 0;
      }
      last = g.t;
      const dt = Math.min(g.dt, 0.1);
      const rate = g.v.r;
      const limit = 8;
      const bound = g.v.b === 1;
      queue += (rate - limit) * dt;
      queue = Math.max(0, queue);
      let dropping = 0;
      if (bound && queue > 10) {
        dropping = queue - 10;
        shed += dropping;
        queue = 10;
      }
      if (!bound) queue = Math.min(queue, 60);
      g.orb("listening", 40, 80, 30, pal.paper, 1);
      g.text(`${rate}/s in`, 40, 108, { size: 10, color: pal.muted });
      for (let k = 0; k < 6; k++) g.packet(60, 80, 130, 80, (g.t * (rate / 10) + k / 6) % 1, pal.accent, 2.2);
      g.frame(130, 50, 220, 60, pal.line, 1, 6, 1.2);
      const cells = bound ? 10 : 22;
      const cw = 212 / cells;
      for (let k = 0; k < cells; k++) g.rect(134 + k * cw, 56, cw - 2, 48, pal.line, 0.15, 2);
      const fill = Math.min(cells, Math.round((queue / (bound ? 10 : 60)) * cells));
      for (let k = 0; k < fill; k++) g.rect(134 + k * cw, 56, cw - 2, 48, bound ? pal.accent : pal.bad, 0.7, 2);
      g.text(bound ? "bounded queue (10)" : "unbounded queue", 240, 40, { size: 10, color: pal.muted });
      g.orb("working", 410, 80, 46, pal.paper, 1);
      g.text(`${limit}/s limit`, 410, 114, { size: 10, color: pal.muted });
      g.packet(350, 80, 385, 80, g.loop(0.6), pal.ok, 2.4);
      if (bound && dropping > 0.01) {
        g.packet(240, 112, 240, 160, g.loop(0.5), pal.bad, 3);
        chip(g, 240, 176, "429 shed fast", pal.bad, 10);
      }
      const wait = (queue / limit).toFixed(1);
      g.text(`wait in queue: ${wait} s`, 120, 226, { size: 12, color: Number(wait) > 3 ? pal.bad : pal.paper });
      g.text(bound ? `${Math.round(shed)} shed so far` : "nothing is shed, waits keep growing", 360, 226, { size: 11, color: bound ? pal.accent : pal.bad });
      g.text(rate > limit ? "overloaded: something must give" : "load is under the limit", 240, 264, { size: 11, color: rate > limit ? pal.bad : pal.ok });
    };
  },
};

const fallback: Scene = {
  title: "Fallback chains across providers",
  caption: "Each request tries the primary model first. On failure it falls to the secondary, then the tertiary. Raise the primary's failure rate: users still get answers because every extra link multiplies the chance that all of them fail.",
  controls: [{ id: "f", kind: "range", label: "Primary failure %", min: 0, max: 100, step: 5, initial: 40 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const p1 = g.v.f / 100;
    const p2 = 0.2;
    const p3 = 0.1;
    const xs = [90, 240, 390];
    ["primary", "secondary", "tertiary"].forEach((nm, k) => {
      g.orb("working", xs[k], 100, 46, pal.paper, 1);
      g.text(nm, xs[k], 138, { size: 10, color: pal.muted });
      if (k < 2) g.arrow(xs[k] + 28, 100, xs[k + 1] - 28, 100, pal.line, 0.7);
    });
    const ps = [p1, p2, p3];
    for (let k = 0; k < 8; k++) {
      const cyc = Math.floor(g.t * 0.35 + k / 8);
      const f = (g.t * 0.35 + k / 8) % 1;
      let stop = -1;
      for (let s = 0; s < 3; s++) {
        if (g.rnd(cyc * 8 + k * 3.7 + s * 1.3 + 2) >= ps[s]) {
          stop = s;
          break;
        }
      }
      const end = stop >= 0 ? xs[stop] : xs[2] + 50;
      const x = 20 + (end - 20) * g.clamp(f * 1.2);
      g.dot(x, 170 + (k % 4) * 8, 3.5, stop < 0 ? pal.bad : stop === 0 ? pal.ok : pal.accent);
    }
    const succ = 1 - p1 * p2 * p3;
    g.text("served by primary (green), fallback (orange), failed (red)", 240, 218, { size: 10, color: pal.muted });
    g.text(`overall success ${(succ * 100).toFixed(1)}%`, 240, 246, { size: 14, color: pal.ok, bold: true });
    g.text(`vs ${((1 - p1) * 100).toFixed(0)}% with only the primary`, 240, 270, { size: 11, color: pal.muted });
  },
};

const spendBreaker: Scene = {
  title: "Cost-runaway protection: the spend circuit breaker",
  caption: "Spend grows steadily, then an agent loop multiplies it. Without a breaker the cumulative cost sails through the budget. With one, the breaker trips at the limit, requests are refused and the curve stays flat.",
  controls: [
    { id: "b", kind: "toggle", label: "Circuit breaker", initial: true },
    { id: "m", kind: "range", label: "Runaway multiplier", min: 3, max: 20, step: 1, initial: 10 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const brk = g.v.b === 1;
    const m = g.v.m;
    const budget = 100;
    const T = 10;
    const cyc = g.t % (T + 2);
    const tt = Math.min(cyc, T);
    const spend = (t: number) => (t < 3 ? 5 * t : 15 + 5 * m * (t - 3));
    const x0 = 40;
    const x1 = 450;
    const maxS = spend(T) > 400 ? 400 : spend(T);
    const yOf = (v: number) => 220 - Math.min(1, v / Math.max(maxS, 120)) * 160;
    g.line(x0, 220, x1, 220, pal.line, 1, 1.2);
    g.line(x0, yOf(budget), x1, yOf(budget), pal.accent, 0.9, 1.3);
    g.text("budget $100", x1, yOf(budget) - 8, { size: 10, color: pal.accent, align: "right" });
    let tripAt = -1;
    let px = x0;
    let py = 220;
    const steps = 80;
    for (let k = 1; k <= steps; k++) {
      const t = (k / steps) * tt;
      let v = spend(t);
      if (brk && v >= budget) {
        if (tripAt < 0) tripAt = t;
        v = budget;
      }
      const x = x0 + (t / T) * (x1 - x0);
      const y = yOf(v);
      g.line(px, py, x, y, v > budget ? pal.bad : pal.blue, 1, 2);
      px = x;
      py = y;
    }
    g.dot(px, py, 4, brk && tripAt >= 0 ? pal.ok : pal.accent);
    const shown = brk ? Math.min(budget, spend(tt)) : spend(tt);
    g.orb(brk && tripAt >= 0 ? "breathing" : "working", 60, 50, 28, brk && tripAt >= 0 ? pal.line : pal.paper, 1);
    g.text(`spent $${Math.round(shown)}`, 240, 244, { size: 14, color: shown > budget ? pal.bad : pal.paper, bold: true });
    const msg = brk ? (tripAt >= 0 ? "breaker open: requests refused, spend capped" : "breaker closed, watching spend") : shown > budget ? `overspent by $${Math.round(shown - budget)}` : "no protection in place";
    g.text(msg, 240, 270, { size: 12, color: brk && tripAt >= 0 ? pal.ok : shown > budget ? pal.bad : pal.muted });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/fine-tuning-and-adaptation/fine-tuning-vs-prompting-vs-rag`]: ftChoice,
  [`${P}/fine-tuning-and-adaptation/preparing-training-data-for-fine-tuning`]: dataPrep,
  [`${P}/fine-tuning-and-adaptation/rlhf-ppo-and-dpo-for-fine-tuning`]: ppoDpo,
  [`${P}/fine-tuning-and-adaptation/lora-and-qlora-parameter-efficient-fine-tuning`]: lora,
  [`${P}/fine-tuning-and-adaptation/continual-learning-and-catastrophic-forgetting`]: forgetting,
  [`${P}/fine-tuning-and-adaptation/synthetic-data-generation-for-fine-tuning`]: synthetic,
  [`${P}/production-reliability/handling-llm-failures-in-production`]: llmFailures,
  [`${P}/production-reliability/shadow-deployments-and-canary-releases-for-llm-features`]: canary,
  [`${P}/production-reliability/multi-region-llm-deployment`]: multiRegion,
  [`${P}/production-reliability/rate-limiting-and-backpressure-for-llm-apis`]: backpressure,
  [`${P}/production-reliability/fallback-chains-across-providers-and-models`]: fallback,
  [`${P}/production-reliability/cost-runaway-protection-and-spend-circuit-breakers`]: spendBreaker,
};
