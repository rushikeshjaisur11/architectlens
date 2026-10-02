import type { Scene } from "../scene/types";
import { bar, chip, fmt, hash32, server } from "./kit";

const P = "ai-systems";

const prompting: Scene = {
  title: "Prompting: the input decides the output",
  caption: "Each chip is a piece of the prompt that reaches the model. A vague prompt sends one piece and gets loose, uneven text back. Add role, context and format and the output lines up, and one example pins the shape down.",
  controls: [{ id: "p", kind: "choice", label: "Prompt", options: ["vague", "specific", "specific + example"], initial: 1 }],
  make: () => (g) => {
    const { pal } = g;
    const lvl = g.v.p;
    const parts: [string, string][] = [["task", pal.accent], ["role", pal.blue], ["context", pal.teal], ["format", pal.violet], ["example", pal.ok]];
    const used = lvl === 0 ? [0] : lvl === 1 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
    parts.forEach(([name, col], k) => {
      const y = 50 + k * 42;
      const on = used.includes(k);
      chip(g, 70, y, name, on ? col : pal.line, 12, on ? 1 : 0.3);
      if (on) g.packet(108, y, 205, 150, (g.t * 0.5 + k * 0.17) % 1, col, 2.4);
    });
    g.orb(lvl === 0 ? "searching" : "composing", 240, 150, 56, pal.paper, 1);
    g.text("model", 240, 196, { size: 11, color: pal.muted });
    g.frame(332, 40, 128, 190, pal.line, 1, 8, 1);
    const shown = Math.floor(g.loop(3.2) * 8);
    for (let k = 0; k < 6; k++) {
      if (k >= shown) break;
      const y = 62 + k * 28;
      if (lvl === 0) {
        const w = 30 + g.rnd(k * 4.1 + 1) * 80;
        g.rect(344 + g.rnd(k * 9.3) * 14, y, w, 8, pal.bad, 0.55, 4);
      } else {
        g.dot(348, y + 4, 3, lvl === 2 ? pal.ok : pal.accent);
        g.rect(356, y, 90 - (k % 3) * 8, 8, pal.paper, 0.7, 4);
      }
    }
    const q = [0.25, 0.7, 0.95][lvl];
    g.text("output quality", 100, 262, { size: 11 });
    bar(g, 150, 257, 230, 8, q, lvl === 0 ? pal.bad : pal.ok);
    g.text(`${Math.round(q * 100)}%`, 420, 262, { size: 12, color: pal.paper });
  },
};

const contextWindow: Scene = {
  title: "The context window fills, then forgets",
  caption: "Every request resends the system prompt plus the conversation. Slide the turn count: once the nine turn slots are full the oldest turns fall out, and the tokens you pay for per request stop growing while the total keeps climbing.",
  controls: [{ id: "n", kind: "range", label: "Turns so far", min: 1, max: 16, step: 1, initial: 6 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const cap = 9;
    const n = g.v.n;
    const vis = Math.min(n, cap);
    const dropped = n - vis;
    g.orb("working", 240, 44, 40, pal.paper, 1);
    g.frame(18, 98, 444, 78, pal.line, 1, 8, 1);
    g.text(`context window: 1 system + ${cap} turn slots`, 240, 90, { size: 11 });
    for (let k = 0; k < cap + 1; k++) {
      const x = 24 + k * 43.6;
      const filled = k === 0 || k <= vis;
      const col = k === 0 ? pal.accent : pal.blue;
      if (filled) {
        g.rect(x, 108, 40, 58, col, 0.28, 5);
        g.frame(x, 108, 40, 58, col, 1, 5, 1.2);
        g.text(k === 0 ? "sys" : `t${n - vis + k}`, x + 20, 137, { size: 11, color: pal.paper });
        if (k === vis && k > 0) g.glow(x + 20, 137, 30, col, 0.25 + 0.15 * Math.sin(g.t * 4));
        g.packet(x + 20, 108, 240, 70, (g.t * 0.6 + k * 0.1) % 1, col, 1.8);
      } else {
        g.c.setLineDash([3, 4]);
        g.frame(x, 108, 40, 58, pal.line, 0.6, 5, 1);
        g.c.setLineDash([]);
      }
    }
    if (dropped > 0) {
      g.text(`${dropped} oldest turn${dropped > 1 ? "s" : ""} dropped`, 130, 198, { size: 12, color: pal.bad });
      for (let k = 0; k < Math.min(dropped, 7); k++) g.rect(228 + k * 16, 192, 12, 12, pal.bad, 0.45, 3);
    } else g.text("everything still fits", 240, 198, { size: 12, color: pal.ok });
    const per = (1 + vis) * 400;
    let total = 0;
    for (let k = 1; k <= n; k++) total += (1 + Math.min(k, cap)) * 400;
    g.text("this request", 100, 236, { size: 11 });
    bar(g, 160, 231, 220, 8, per / 4000, pal.blue);
    g.text(fmt(per), 420, 236, { size: 12, color: pal.paper });
    g.text("total billed", 100, 262, { size: 11 });
    bar(g, 160, 257, 220, 8, total / 40000, pal.accent);
    g.text(fmt(total), 420, 262, { size: 12, color: pal.paper });
  },
};

const structured: Scene = {
  title: "Reasoning and structure shape the answer",
  caption: "Same question three ways. Direct answers skip the work and are often wrong. Chain of thought writes the steps first, so the answer follows from them. A schema leaves the reasoning alone but forces output a parser can accept.",
  controls: [{ id: "m", kind: "choice", label: "Mode", options: ["direct", "chain of thought", "JSON schema"], initial: 1 }],
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const p = g.loop(7);
    chip(g, 240, 28, "17 × 24 = ?", pal.accent, 13);
    g.orb(m === 1 ? "solving" : "working", 70, 150, 54, pal.paper, 1);
    g.text("model", 70, 192, { size: 11, color: pal.muted });
    if (m === 0) {
      g.packet(100, 150, 330, 150, g.clamp(p * 2), pal.accent);
      if (p > 0.45) {
        chip(g, 370, 150, "418", pal.bad, 18);
        g.text("one jump, no working shown", 370, 190, { size: 11, color: pal.bad });
      }
    } else if (m === 1) {
      const steps = ["17 × 20 = 340", "17 × 4 = 68", "340 + 68 = 408"];
      steps.forEach((s, k) => {
        const t0 = k / 4;
        if (p > t0 + 0.05) {
          g.packet(100, 150, 250, 82 + k * 42, g.clamp((p - t0) * 6), pal.teal);
          chip(g, 320, 82 + k * 42, s, pal.teal, 12, g.clamp((p - t0) * 5));
        }
      });
      if (p > 0.8) chip(g, 400, 220, "408", pal.ok, 18);
      if (p > 0.8) g.text("answer follows the steps", 320, 255, { size: 11, color: pal.ok });
    } else {
      g.frame(190, 70, 250, 130, pal.violet, 1, 8, 1.2);
      g.text("schema: { product: number }", 315, 86, { size: 11, color: pal.violet });
      const lines = ["{", '  "product": 408', "}"];
      lines.forEach((s, k) => {
        if (p > 0.15 + k * 0.15) g.text(s, 230, 118 + k * 22, { size: 14, color: pal.paper, align: "left" });
      });
      g.packet(100, 150, 190, 135, g.clamp(p * 3), pal.violet);
      if (p > 0.7) {
        chip(g, 315, 224, "parse ok ✓", pal.ok, 12);
      }
    }
  },
};

const fewShot: Scene = {
  title: "Few-shot: examples teach the format",
  caption: "Add labeled examples one at a time. Each card flows into the prompt, and the accuracy bar on a tricky review rises with them. Zero shots leave the model guessing at the label set and the format.",
  controls: [{ id: "s", kind: "range", label: "Examples in prompt", min: 0, max: 5, step: 1, initial: 2 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const acc = 0.5 + 0.45 * (1 - Math.exp(-0.75 * s));
    const labels = ["positive", "negative", "mixed", "positive", "negative"];
    for (let k = 0; k < 5; k++) {
      const y = 42 + k * 38;
      const on = k < s;
      g.rect(20, y - 14, 130, 28, on ? pal.blue : pal.line, on ? 0.22 : 0.1, 6);
      g.frame(20, y - 14, 130, 28, on ? pal.blue : pal.line, on ? 1 : 0.4, 6, 1);
      g.text(on ? `ex ${k + 1} → ${labels[k]}` : "empty slot", 85, y, { size: 11, color: on ? pal.paper : pal.muted });
      if (on) g.packet(150, y, 222, 140, (g.t * 0.55 + k * 0.2) % 1, pal.blue, 2.2);
    }
    g.orb(s === 0 ? "searching" : "composing", 255, 140, 58, pal.paper, 1);
    chip(g, 255, 54, "Great battery, awful screen", pal.accent, 11);
    g.packet(255, 66, 255, 106, g.loop(2), pal.accent);
    const good = acc > 0.8;
    chip(g, 390, 140, good ? "mixed ✓" : "positive ✕", good ? pal.ok : pal.bad, 13);
    g.packet(285, 140, 345, 140, g.loop(2, 0.5), good ? pal.ok : pal.bad);
    g.text("accuracy on test set", 100, 262, { size: 11 });
    bar(g, 160, 257, 220, 8, acc, good ? pal.ok : pal.accent);
    g.text(`${Math.round(acc * 100)}%`, 425, 262, { size: 12, color: pal.paper });
  },
};

const sysUser: Scene = {
  title: "System prompt versus user prompt",
  caption: "The system box carries the rules, the user box carries whatever a person types. In a flat prompt both are just text, so 'ignore all rules' can win. A hierarchy ranks the system layer above the user, and the shield holds.",
  controls: [
    { id: "h", kind: "choice", label: "Prompt layout", options: ["flat prompt", "system > user"], initial: 1 },
    { id: "u", kind: "choice", label: "User says", options: ["translate this", "ignore all rules"], initial: 1 },
  ],
  make: () => (g) => {
    const { pal } = g;
    const hier = g.v.h === 1;
    const atk = g.v.u === 1;
    g.rect(20, 40, 150, 62, pal.blue, 0.2, 8);
    g.frame(20, 40, 150, 62, pal.blue, 1, 8, 1.2);
    g.text("system", 95, 58, { size: 11, color: pal.blue });
    g.text("only translate", 95, 80, { size: 12, color: pal.paper });
    g.rect(20, 170, 150, 62, atk ? pal.bad : pal.accent, 0.2, 8);
    g.frame(20, 170, 150, 62, atk ? pal.bad : pal.accent, 1, 8, 1.2);
    g.text("user", 95, 188, { size: 11, color: atk ? pal.bad : pal.accent });
    g.text(atk ? "ignore all rules" : "bonjour le monde", 95, 210, { size: 12, color: pal.paper });
    g.packet(170, 72, 222, 128, g.loop(2.2), pal.blue, 2.6);
    g.packet(170, 200, 222, 148, g.loop(2.2, 0.4), atk ? pal.bad : pal.accent, 2.6);
    g.orb(atk && !hier ? "weaving" : "working", 255, 138, 58, pal.paper, 1);
    if (hier) g.ring(255, 138, 40 + 2 * Math.sin(g.t * 3), pal.blue, 0.9, 2.5);
    const out = atk ? (hier ? "refused ✓" : "rules ignored ✕") : "translated ✓";
    const col = atk && !hier ? pal.bad : pal.ok;
    g.packet(290, 138, 345, 138, g.loop(2.2, 0.7), col);
    chip(g, 400, 138, out, col, 13);
    const why = atk ? (hier ? "system layer outranks user text" : "both layers look like equal text") : "no conflict, either layout works";
    g.text(why, 240, 270, { size: 12, color: pal.paper });
  },
};

const tokenization: Scene = {
  title: "Tokenization: text becomes pieces",
  caption: "Pick a string. The tokenizer cuts it into sub-word pieces and each piece becomes an integer id. Count the chips, not the words: that count is what you pay for and what fills the window.",
  controls: [{ id: "w", kind: "choice", label: "Text", options: ["hello world", "unbelievably", "12345678", "ChatGPT"], initial: 1 }],
  aspect: 0.5,
  make: () => (g) => {
    const { pal } = g;
    const sets = [["hello", " world"], ["un", "believ", "ably"], ["123", "456", "78"], ["Chat", "G", "PT"]];
    const raw = ["hello world", "unbelievably", "12345678", "ChatGPT"][g.v.w];
    const toks = sets[g.v.w];
    g.text("input", 40, 40, { size: 11, align: "left" });
    g.text(`"${raw}"`, 240, 62, { size: 20, color: pal.paper });
    const shown = Math.min(toks.length, Math.floor(g.loop(4) * (toks.length + 1.5)));
    const widths = toks.map((t) => t.length * 11 + 22);
    const total = widths.reduce((a, b) => a + b, 0) + (toks.length - 1) * 8;
    let x = 240 - total / 2;
    const cols = [pal.accent, pal.blue, pal.teal, pal.violet];
    toks.forEach((t, k) => {
      const w = widths[k];
      if (k < shown) {
        g.rect(x, 105, w, 34, cols[k % 4], 0.22, 6);
        g.frame(x, 105, w, 34, cols[k % 4], 1, 6, 1.2);
        g.text(t.replace(" ", "·"), x + w / 2, 122, { size: 15, color: pal.paper });
        g.text(String(Math.floor(hash32(t) * 50000)), x + w / 2, 160, { size: 12, color: cols[k % 4] });
        g.arrow(x + w / 2, 142, x + w / 2, 150, cols[k % 4], 0.7);
      }
      x += w + 8;
    });
    g.text("pieces", 40, 105, { size: 11, align: "left", color: pal.muted });
    g.text("ids", 40, 160, { size: 11, align: "left", color: pal.muted });
    g.text(`${raw.split(" ").length} word${raw.includes(" ") ? "s" : ""}  →  ${toks.length} tokens`, 240, 205, { size: 16, color: pal.accent, bold: true });
    g.text("splits shown are illustrative, real vocabularies differ", 240, 232, { size: 11 });
  },
};

const sampling: Scene = {
  title: "Sampling: temperature and top-p",
  caption: "Bars are next-token probabilities. Raise temperature and the distribution flattens, so rarer tokens get drawn. Turn on top-p 0.8 and the tail is cut off and the rest renormalised. The falling dot is the draw.",
  controls: [
    { id: "t", kind: "range", label: "Temperature", min: 0.1, max: 2, step: 0.1, initial: 1 },
    { id: "p", kind: "toggle", label: "top-p 0.8" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const names = ["the", "a", "cat", "dog", "sat", "zebra"];
    const logits = [3.2, 2.6, 2, 1.6, 0.8, -0.5];
    const T = g.v.t;
    const ex = logits.map((l) => Math.exp(l / T - logits[0] / T));
    const sum = ex.reduce((a, b) => a + b, 0);
    let pr = ex.map((e) => e / sum);
    const keep = pr.map(() => true);
    if (g.v.p === 1) {
      let c = 0;
      pr.forEach((q, k) => {
        keep[k] = c < 0.8;
        c += q;
      });
      const ks = pr.reduce((a, q, k) => a + (keep[k] ? q : 0), 0);
      pr = pr.map((q, k) => (keep[k] ? q / ks : 0));
    }
    const bucket = Math.floor(g.t / 1.8);
    const r = g.rnd(bucket * 7.13 + 3);
    let acc = 0;
    let pick = 0;
    for (let k = 0; k < pr.length; k++) {
      acc += pr[k];
      if (r <= acc) {
        pick = k;
        break;
      }
    }
    const frac = (g.t % 1.8) / 1.8;
    names.forEach((nm, k) => {
      const x = 48 + k * 70;
      const h = pr[k] * 170;
      const col = !keep[k] ? pal.line : k === pick ? pal.accent : pal.blue;
      g.rect(x - 16, 224 - h, 32, Math.max(h, 1), col, !keep[k] ? 0.4 : 0.85, 4);
      g.text(`${Math.round(pr[k] * 100)}%`, x, 214 - h, { size: 11, color: pal.paper });
      g.text(nm, x, 242, { size: 12, color: k === pick ? pal.accent : pal.muted });
    });
    const px = 48 + pick * 70;
    const py = g.mix(30, 224 - pr[pick] * 170 - 8, g.ease(Math.min(1, frac * 1.6)));
    g.dot(px, py, 5, pal.accent);
    g.glow(px, py, 16, pal.accent, 0.4);
    g.text(`picked: "${names[pick]}"`, 240, 276, { size: 13, color: pal.paper });
  },
};

const multimodal: Scene = {
  title: "Multimodal input becomes tokens too",
  caption: "An image is cut into patches and a clip into frames, and each one costs tokens like text does. Drag the size: a bigger image or a longer clip claims more of the same context window.",
  controls: [
    { id: "m", kind: "choice", label: "Input", options: ["image", "audio"], initial: 0 },
    { id: "s", kind: "range", label: "Size", min: 2, max: 12, step: 1, initial: 6 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.s;
    const audio = g.v.m === 1;
    const tokens = audio ? n * 25 : n * n;
    if (!audio) {
      const cell = 168 / n;
      const sx = scanIdx(g.t, n * n);
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const k = r * n + c;
          const v = g.rnd(k * 1.7 + 4);
          g.rect(40 + c * cell, 50 + r * cell, cell - 1, cell - 1, pal.blue, 0.15 + 0.45 * v, 2);
          if (k === sx) g.frame(40 + c * cell, 50 + r * cell, cell - 1, cell - 1, pal.accent, 1, 2, 2);
        }
      g.text(`${n}×${n} patches`, 124, 236, { size: 12, color: pal.paper });
    } else {
      const bars = 36;
      for (let k = 0; k < bars; k++) {
        const h = 10 + 60 * Math.abs(Math.sin(k * 0.7 + g.t * 2)) * (0.4 + g.rnd(k * 2.3) * 0.6);
        const inFrame = k < Math.min(bars, n * 3);
        g.rect(30 + k * 5, 140 - h / 2, 3, h, inFrame ? pal.teal : pal.line, inFrame ? 0.9 : 0.4, 1.5);
      }
      g.text(`${n} seconds of audio`, 124, 236, { size: 12, color: pal.paper });
    }
    g.packet(220, 140, 290, 140, g.loop(1.2), pal.accent);
    g.orb("listening", 320, 140, 50, pal.paper, 1);
    g.text("model", 320, 178, { size: 11, color: pal.muted });
    g.text("tokens used", 395, 90, { size: 11 });
    g.text(fmt(tokens), 395, 118, { size: 22, color: pal.accent, bold: true });
    g.text("of a 200K window", 395, 146, { size: 11 });
    bar(g, 350, 160, 90, 8, tokens / 600, pal.accent);
    g.text("rough rule: patches or ~25 tokens per second, illustrative only", 240, 275, { size: 11 });
  },
};

function scanIdx(t: number, n: number): number {
  return Math.floor(t * 8) % n;
}

const hybrid: Scene = {
  title: "Hybrid search and reranking",
  caption: "Keyword and vector search each return their own top five. Reciprocal rank fusion merges the lists by rank, then a reranker reads each query-document pair and keeps the best three. Toggle the reranker to see the cut.",
  controls: [{ id: "r", kind: "toggle", label: "Rerank", initial: true }],
  aspect: 0.7,
  make: () => (g) => {
    const { pal } = g;
    const bm = ["C", "A", "E", "B", "D"];
    const vec = ["B", "A", "F", "C", "D"];
    const score: Record<string, number> = {};
    [bm, vec].forEach((l) => l.forEach((d, k) => (score[d] = (score[d] ?? 0) + 1 / (60 + k + 1))));
    const fused = Object.keys(score).sort((a, b) => score[b] - score[a]);
    const best = ["A", "B", "C", "D", "E", "F"];
    const { i, p } = g.stage([2.2, 2.2, 2.6]);
    g.text("keyword", 70, 28, { size: 12, color: pal.blue });
    g.text("vector", 190, 28, { size: 12, color: pal.teal });
    g.text(g.v.r === 1 ? "fused, reranked" : "fused (RRF)", 370, 28, { size: 12, color: pal.accent });
    bm.forEach((d, k) => chip(g, 70, 62 + k * 40, `${k + 1}. doc ${d}`, pal.blue, 12));
    vec.forEach((d, k) => chip(g, 190, 62 + k * 40, `${k + 1}. doc ${d}`, pal.teal, 12));
    g.orb(i === 0 ? "searching" : i === 1 ? "weaving" : "solving", 290, 140, 38, pal.paper, 1);
    if (i === 0) {
      g.packet(115, 62, 262, 135, p, pal.blue);
      g.packet(235, 62, 266, 140, p, pal.teal);
    }
    const rr = g.v.r === 1 && i === 2;
    const order = rr ? [...fused].sort((a, b) => best.indexOf(a) - best.indexOf(b)) : fused;
    if (i >= 1) {
      order.forEach((d, k) => {
        const cut = g.v.r === 1 && i === 2 && k >= 3 && p > 0.5;
        g.packet(310, 140, 370, 62 + k * 34, g.clamp(p * 1.4 - k * 0.04), pal.accent, 1.8);
        chip(g, 370, 62 + k * 34, `${k + 1}. doc ${d}`, cut ? pal.line : rr && k < 3 ? pal.ok : pal.accent, 12, cut ? 0.35 : 1);
      });
    }
    const note = i === 0 ? "two retrievers, two rankings" : i === 1 ? "score = sum of 1 / (60 + rank)" : g.v.r === 1 ? "cross-encoder keeps the top 3 for the LLM" : "top results go straight to the LLM";
    g.text(note, 240, 285, { size: 12, color: pal.paper });
  },
};

const multiHop: Scene = {
  title: "Multi-hop retrieval chains queries",
  caption: "Some questions cannot be answered by one lookup. The agent retrieves, reads a bridging fact, rewrites the query with it and retrieves again. Raise the hop count to lengthen the chain.",
  controls: [{ id: "h", kind: "range", label: "Hops", min: 1, max: 3, step: 1, initial: 2 }],
  aspect: 0.55,
  make: () => (g) => {
    const { pal } = g;
    const h = g.v.h;
    const nodes: [string, string][] = [["question", pal.accent]];
    for (let k = 0; k < h; k++) nodes.push([`search ${k + 1}`, pal.blue], [k === h - 1 ? "final fact" : "bridge", pal.teal]);
    nodes.push(["answer", pal.ok]);
    const n = nodes.length;
    const pts = nodes.map((_, k) => [34 + (k * 412) / (n - 1), k % 2 === 0 ? 108 : 188] as [number, number]);
    const pos = g.loop(1.4 * n) * (n - 1);
    const cur = Math.floor(pos);
    for (let k = 0; k < n - 1; k++) {
      g.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], pal.line, k < cur ? 1 : 0.5, 1.2);
      if (k < cur) g.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], nodes[k][1], 0.7, 1.6);
    }
    nodes.forEach(([label, col], k) => {
      const reached = k <= cur;
      g.ring(pts[k][0], pts[k][1], 17, reached ? col : pal.line, reached ? 1 : 0.5, 1.4);
      g.dot(pts[k][0], pts[k][1], 5, reached ? col : pal.line);
      g.text(label, pts[k][0], pts[k][1] + (k % 2 === 0 ? -30 : 34), { size: 10, color: reached ? pal.paper : pal.muted });
    });
    if (cur < n - 1) {
      const f = pos - cur;
      g.packet(pts[cur][0], pts[cur][1], pts[cur + 1][0], pts[cur + 1][1], f, pal.accent, 3);
      g.orb(cur % 2 === 0 ? "searching" : "solving", g.mix(pts[cur][0], pts[cur + 1][0], f), g.mix(pts[cur][1], pts[cur + 1][1], f) - 4, 30, pal.paper, 1);
    }
    g.text(`${h} hop${h > 1 ? "s" : ""}, ${h} retrievals`, 240, 255, { size: 13, color: pal.paper });
  },
};

const chunking: Scene = {
  title: "Chunking: where the cuts fall",
  caption: "Twenty-four sentences, one answer spanning sentences 6 to 9 (outlined). Fixed cuts every seven sentences slice the answer in half unless overlap rescues it. Sentence-aware and semantic cuts follow the text's own seams.",
  controls: [
    { id: "s", kind: "choice", label: "Strategy", options: ["fixed size", "sentence-aware", "semantic"], initial: 0 },
    { id: "o", kind: "range", label: "Overlap (fixed)", min: 0, max: 3, step: 1, initial: 0 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const N = 24;
    const bounds = g.v.s === 0 ? [0, 7, 14, 21, 24] : g.v.s === 1 ? [0, 4, 10, 16, 21, 24] : [0, 5, 10, 17, 24];
    const ov = g.v.s === 0 ? g.v.o : 0;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent];
    const chunks = bounds.slice(0, -1).map((b, k) => ({ s: Math.max(0, b - (k === 0 ? 0 : ov)), e: bounds[k + 1], own: b, col: cols[k % 4] }));
    const sweep = Math.min(N, Math.floor(g.loop(3) * 1.4 * N));
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / 12);
      const c = k % 12;
      const x = 24 + c * 37;
      const y = 40 + r * 62;
      const ch = chunks.find((q) => k >= q.own && k < q.e) ?? chunks[0];
      const inOv = chunks.some((q) => k >= q.s && k < q.own);
      g.rect(x, y, 33, 40, ch.col, k < sweep ? 0.32 : 0.1, 4);
      if (inOv) g.frame(x, y, 33, 40, pal.paper, 0.9, 4, 1.4);
      g.text(String(k + 1), x + 16.5, y + 20, { size: 11, color: pal.paper });
      if (k >= 5 && k <= 8) g.frame(x - 2, y - 2, 37, 44, pal.ok, 1, 5, 1.6);
    }
    bounds.slice(1, -1).forEach((b) => {
      const r = Math.floor(b / 12);
      const x = 24 + (b % 12) * 37 - 2;
      g.line(x, 36 + r * 62, x, 84 + r * 62, pal.paper, 0.9, 2);
    });
    const whole = chunks.some((q) => q.s <= 5 && q.e >= 9);
    g.text(`${chunks.length} chunks`, 240, 188, { size: 13, color: pal.paper });
    chip(g, 240, 230, whole ? "answer fits in one chunk ✓" : "answer split across chunks ✕", whole ? pal.ok : pal.bad, 12);
    g.text("white frame = overlapped sentences", 240, 268, { size: 11 });
  },
};

const compression: Scene = {
  title: "Context compression keeps the signal",
  caption: "Eight retrieved passages carry one key sentence each. Slide how much to keep. Down to about a third nothing important is lost, and below that the compressor starts dropping key sentences and the answer goes with them.",
  controls: [{ id: "k", kind: "range", label: "Keep fraction", min: 0.1, max: 1, step: 0.05, initial: 0.4 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const keep = g.v.k;
    const sweep = g.loop(3.2);
    let lost = 0;
    for (let k = 0; k < 8; k++) {
      const y = 38 + k * 28;
      const w = 80 + g.rnd(k * 3.3) * 40;
      g.rect(24, y, w, 14, pal.line, 0.5, 4);
      g.rect(24 + w * 0.25, y, 20, 14, pal.accent, 0.9, 3);
      const kept = keep >= 0.34 || g.rnd(k * 5.9 + 1) < keep * 2.2;
      if (!kept) lost++;
      const nw = Math.max(26, w * keep + 18);
      const px = 330;
      g.rect(px, y, nw, 14, pal.line, 0.5, 4);
      if (kept) g.rect(px + 4, y, 20, 14, pal.accent, 0.9, 3);
      else g.text("✕", px + nw / 2, y + 7, { size: 10, color: pal.bad });
      g.packet(24 + w + 4, y + 7, px - 4, y + 7, (sweep + k * 0.08) % 1, kept ? pal.accent : pal.bad, 1.8);
    }
    g.orb("shaping", 240, 140, 52, pal.paper, 1);
    g.text("compressor", 240, 180, { size: 11, color: pal.muted });
    const toks = Math.round(keep * 4000);
    g.text(`${fmt(toks)} of 4K tokens kept`, 240, 270, { size: 12, color: pal.paper });
    if (lost > 0) g.text(`${lost} key sentence${lost > 1 ? "s" : ""} lost`, 240, 252, { size: 12, color: pal.bad });
    else g.text("all key sentences kept", 240, 252, { size: 12, color: pal.ok });
  },
};

const graphRag: Scene = {
  title: "GraphRAG follows the relationships",
  caption: "The question needs a company, its founder and the founder's earlier firm. Vector search lights the passages that look similar and misses the middle link. Graph traversal walks the edges and returns the whole chain.",
  controls: [{ id: "m", kind: "choice", label: "Retrieval", options: ["vector only", "graph traversal"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const nodes: { x: number; y: number; n: string }[] = [
      { x: 70, y: 90, n: "Acme" }, { x: 190, y: 60, n: "Rao" }, { x: 320, y: 90, n: "Beta Labs" },
      { x: 420, y: 60, n: "seed fund" }, { x: 80, y: 200, n: "pricing" }, { x: 200, y: 215, n: "Mumbai" },
      { x: 320, y: 205, n: "chips" }, { x: 420, y: 190, n: "IPO" },
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7], [5, 6]];
    const path = [0, 1, 2];
    const graph = g.v.m === 1;
    const lit = graph ? path : [0, 4];
    edges.forEach(([a, b]) => g.line(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y, pal.line, 0.7, 1.2));
    if (graph) {
      for (let k = 0; k < path.length - 1; k++) {
        const a = nodes[path[k]];
        const b = nodes[path[k + 1]];
        g.line(a.x, a.y, b.x, b.y, pal.ok, 0.9, 2);
        g.packet(a.x, a.y, b.x, b.y, (g.t * 0.5 + k * 0.4) % 1, pal.ok, 3);
      }
    }
    nodes.forEach((nd, k) => {
      const on = lit.includes(k);
      const col = on ? (graph ? pal.ok : pal.bad) : pal.line;
      g.glow(nd.x, nd.y, 22, col, on ? 0.2 : 0.05);
      g.ring(nd.x, nd.y, 14, col, on ? 1 : 0.6, 1.4);
      g.dot(nd.x, nd.y, 5, on ? col : pal.paper, on ? 1 : 0.6);
      g.text(nd.n, nd.x, nd.y + 28, { size: 11, color: on ? pal.paper : pal.muted });
    });
    g.text(graph ? "found: Acme, Rao, Beta Labs" : "found: Acme, pricing (similar text, wrong links)", 240, 270, { size: 12, color: graph ? pal.ok : pal.bad });
  },
};

const rewriting: Scene = {
  title: "Query rewriting moves the query closer",
  caption: "Dots are passages in embedding space, green ones are relevant. A raw question sits far from them and pulls in look-alikes. Expansion adds nearby phrasings. HyDE has the model write a fake answer first and searches with that.",
  controls: [{ id: "m", kind: "choice", label: "Query", options: ["raw", "expanded", "HyDE"], initial: 2 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const rel = [[320, 100], [350, 125], [305, 130], [340, 90], [362, 105]];
    const bad = [[140, 195], [175, 215], [120, 240], [200, 185], [160, 150], [235, 235]];
    const m = g.v.m;
    const qs: number[][] = m === 0 ? [[130, 205]] : m === 1 ? [[215, 160], [255, 135], [235, 190]] : [[318, 112]];
    const docs = [...rel.map((p) => ({ p, rel: true })), ...bad.map((p) => ({ p, rel: false }))];
    const dist = (d: number[]) => Math.min(...qs.map((q) => Math.hypot(q[0] - d[0], q[1] - d[1])));
    const order = docs.map((d, k) => ({ k, d: dist(d.p) })).sort((a, b) => a.d - b.d).slice(0, 3);
    const top = order.map((o) => o.k);
    g.glow(335, 108, 50, pal.ok, 0.1);
    docs.forEach((d, k) => {
      const hit = top.includes(k);
      const col = d.rel ? pal.ok : pal.muted;
      g.dot(d.p[0], d.p[1], hit ? 5 : 3.5, col, hit ? 1 : 0.65);
      if (hit) g.ring(d.p[0], d.p[1], 9 + Math.sin(g.t * 4) * 1.5, pal.accent, 0.9, 1.4);
    });
    qs.forEach((q) => {
      g.dot(q[0], q[1], 4.5, pal.accent);
      g.ring(q[0], q[1], 8, pal.accent, 0.7, 1.2);
      top.forEach((k) => g.line(q[0], q[1], docs[k].p[0], docs[k].p[1], pal.accent, 0.12, 1));
    });
    if (m === 2) g.orb("composing", 120, 110, 40, pal.paper, 1);
    if (m === 2) g.text("writes a fake answer", 120, 142, { size: 10, color: pal.muted });
    g.text(m === 0 ? "raw question" : m === 1 ? "3 rewritten variants" : "hypothetical answer", qs[0][0], qs[0][1] + 22, { size: 10, color: pal.accent });
    const hits = top.filter((k) => docs[k].rel).length;
    g.text(`relevant in top 3: ${hits}/3`, 240, 270, { size: 13, color: hits === 3 ? pal.ok : hits === 0 ? pal.bad : pal.paper });
  },
};

const ragEval: Scene = {
  title: "RAG evaluation: measure each stage",
  caption: "The pipeline fails in different places, so each metric looks at one hop: did retrieval bring the right context, did the answer stay faithful to it, did it address the question. Switch retrievers to watch the scores move.",
  controls: [{ id: "w", kind: "toggle", label: "Weak retriever" }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const weak = g.v.w === 1;
    const vals = weak ? [0.4, 0.5, 0.88, 0.55] : [0.9, 0.85, 0.92, 0.9];
    const names = ["context precision", "context recall", "faithfulness", "answer relevance"];
    const stages = ["query", "retriever", "context", "LLM", "answer"];
    const xs = [40, 135, 240, 345, 440];
    stages.forEach((s, k) => {
      g.ring(xs[k], 70, 16, k === 1 || k === 3 ? pal.blue : pal.line, 1, 1.3);
      g.text(s, xs[k], 104, { size: 10, color: pal.muted });
      if (k < 4) g.arrow(xs[k] + 18, 70, xs[k + 1] - 18, 70, pal.line, 0.8);
    });
    g.orb(weak ? "searching" : "working", 135, 70, 24, pal.paper, 1);
    g.orb("composing", 345, 70, 24, pal.paper, 1);
    const act = Math.floor(g.loop(8) * 4);
    const spans = [[1, 2], [1, 2], [2, 4], [0, 4]];
    const [a, b] = spans[act];
    g.line(xs[a], 124, xs[b], 124, pal.accent, 0.9, 2);
    g.dot(xs[a], 124, 3, pal.accent);
    g.dot(xs[b], 124, 3, pal.accent);
    names.forEach((nm, k) => {
      const y = 160 + k * 30;
      const on = k === act;
      g.text(nm, 20, y, { size: 12, align: "left", color: on ? pal.accent : pal.muted });
      bar(g, 170, y - 4, 230, 8, vals[k], vals[k] < 0.6 ? pal.bad : on ? pal.accent : pal.ok);
      g.text(vals[k].toFixed(2), 440, y, { size: 12, color: pal.paper });
    });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/foundations-and-prompting/prompting-fundamentals`]: prompting,
  [`${P}/foundations-and-prompting/context-windows-and-token-economics`]: contextWindow,
  [`${P}/foundations-and-prompting/structured-output-and-chain-of-thought-variants`]: structured,
  [`${P}/foundations-and-prompting/few-shot-vs-zero-shot-and-templates`]: fewShot,
  [`${P}/foundations-and-prompting/system-vs-user-prompts-and-role-conditioning`]: sysUser,
  [`${P}/foundations-and-prompting/tokenization-mechanics`]: tokenization,
  [`${P}/foundations-and-prompting/sampling-parameters`]: sampling,
  [`${P}/foundations-and-prompting/multimodal-prompting`]: multimodal,
  [`${P}/context-and-rag/advanced-retrieval-hybrid-search-and-reranking`]: hybrid,
  [`${P}/context-and-rag/multi-hop-rag-and-agentic-retrieval`]: multiHop,
  [`${P}/context-and-rag/chunking-strategies`]: chunking,
  [`${P}/context-and-rag/context-compression-and-summarization`]: compression,
  [`${P}/context-and-rag/graphrag-knowledge-graph-retrieval`]: graphRag,
  [`${P}/context-and-rag/query-rewriting-expansion-hyde`]: rewriting,
  [`${P}/context-and-rag/rag-evaluation`]: ragEval,
};
