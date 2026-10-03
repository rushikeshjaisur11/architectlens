import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-systems";

const cotWhen: Scene = {
  title: "When chain of thought pays for itself",
  caption: "Reasoning out loud costs extra tokens. On a simple lookup it changes nothing, so the extra cost is wasted. On a multi-step problem the written steps lift accuracy a lot, which is where the cost is worth it.",
  controls: [
    { id: "q", kind: "choice", label: "Question", options: ["simple fact", "multi-step math"], initial: 1 },
    { id: "c", kind: "toggle", label: "Chain of thought", initial: true },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hard = g.v.q === 1;
    const cot = g.v.c === 1;
    const acc = hard ? (cot ? 0.85 : 0.45) : 0.95;
    const cost = cot ? 4 : 1;
    g.orb(cot ? "solving" : "working", 70, 90, 50, pal.paper, 1);
    g.text(hard ? "17 × 24 + 9 = ?" : "capital of France?", 70, 130, { size: 10, color: pal.muted });
    const steps = hard ? ["17×24=408", "408+9=417"] : ["Paris"];
    if (cot) steps.forEach((s, k) => chip(g, 230 + k * 100, 90, s, pal.teal, 10));
    else chip(g, 230, 90, hard ? "413" : "Paris", hard ? pal.bad : pal.ok, 11);
    g.packet(96, 90, 190, 90, g.loop(1.4), pal.accent, 2.6);
    g.text("accuracy", 70, 180, { size: 11 });
    bar(g, 140, 175, 250, 8, acc, acc > 0.8 ? pal.ok : pal.bad);
    g.text(`${Math.round(acc * 100)}%`, 430, 180, { size: 12, color: pal.paper });
    g.text("output tokens", 70, 208, { size: 11 });
    bar(g, 140, 203, 250, 8, cost / 4, cost > 2 ? pal.accent : pal.ok);
    g.text(`${cost}x`, 430, 208, { size: 12, color: pal.paper });
    g.text(!hard && cot ? "same accuracy, four times the tokens" : hard && cot ? "steps make the answer checkable ✓" : hard ? "one jump, often wrong" : "no reasoning needed", 240, 252, { size: 11, color: !hard && cot ? pal.bad : pal.paper });
  },
};

const lostMiddle: Scene = {
  title: "Lost in the middle",
  caption: "Models attend best to the start and end of a long context and worst to the middle. Place a key fact at different positions and the chance it is used dips in the centre, so order matters even when everything fits.",
  controls: [{ id: "p", kind: "range", label: "Fact position %", min: 0, max: 100, step: 5, initial: 50 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pos = g.v.p / 100;
    const rec = (u: number) => 0.55 + 0.4 * Math.pow(Math.abs(u - 0.5) * 2, 1.6);
    let pv: [number, number] | null = null;
    for (let k = 0; k <= 40; k++) {
      const u = k / 40;
      const x = 40 + u * 400;
      const y = 200 - rec(u) * 130;
      if (pv) g.line(pv[0], pv[1], x, y, pal.blue, 1, 2);
      pv = [x, y];
    }
    for (let k = 0; k < 30; k++) g.rect(40 + k * 13.3, 52, 11, 22, k / 30 === Math.round(pos * 30) / 30 ? pal.accent : pal.line, 0.5, 2);
    g.text("context, front to back", 240, 40, { size: 10, color: pal.muted });
    const x = 40 + pos * 400;
    const r = rec(pos);
    g.line(x, 76, x, 200 - r * 130, pal.accent, 0.8, 1.4);
    g.dot(x, 200 - r * 130, 6, pal.accent);
    g.glow(x, 200 - r * 130, 18, pal.accent, 0.4);
    g.orb("searching", 456, 40, 22, pal.paper, 1);
    g.text(`chance the fact is used: ${Math.round(r * 100)}%`, 240, 232, { size: 13, color: r > 0.8 ? pal.ok : pal.bad });
    g.text("put the key facts first or last, trim the rest", 240, 262, { size: 10, color: pal.muted });
  },
};

const constrained: Scene = {
  title: "Constrained decoding",
  caption: "At each step the model scores every token. A grammar mask removes the tokens that would break the schema, so only valid continuations remain and the sampler picks among those. The output parses every time, not just most of the time.",
  controls: [{ id: "c", kind: "toggle", label: "Grammar mask on", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const mask = g.v.c === 1;
    const steps = [
      { text: '{"age": ', cands: [["42", 0.35, true], ["forty", 0.3, false], ["null", 0.1, true], ["\"", 0.15, false], ["}", 0.1, false]] },
      { text: '{"age": 42, "ok": ', cands: [["true", 0.4, true], ["yes", 0.3, false], ["false", 0.2, true], ["maybe", 0.1, false]] },
    ];
    const s = steps[Math.floor((g.t / 4) % 2)];
    g.orb("composing", 50, 60, 40, pal.paper, 1);
    g.rect(100, 40, 350, 40, pal.line, 0.15, 6);
    g.text(s.text, 112, 60, { size: 13, align: "left", color: pal.paper });
    g.text("next token candidates", 240, 108, { size: 10, color: pal.muted });
    let kept = 0;
    s.cands.forEach(([tok, p, valid], k) => {
      const x = 90 + k * 76;
      const ok = !mask || valid;
      if (ok) kept += p as number;
      g.rect(x - 30, 124, 60, 80, ok ? pal.accent : pal.line, ok ? 0.2 : 0.06, 6);
      g.rect(x - 22, 196 - (p as number) * 160, 44, (p as number) * 160, ok ? pal.accent : pal.line, ok ? 0.7 : 0.25, 4);
      g.text(String(tok), x, 140, { size: 11, color: ok ? pal.paper : pal.muted });
      if (!ok) g.text("✕", x, 172, { size: 16, color: pal.bad });
    });
    g.text(mask ? "invalid tokens are impossible, output always parses ✓" : "model may pick a token that breaks the JSON ✕", 240, 240, { size: 12, color: mask ? pal.ok : pal.bad });
    g.text(`mass left to sample from: ${Math.round(kept * 100)}%`, 240, 264, { size: 10, color: pal.muted });
  },
};

const exampleSelect: Scene = {
  title: "Choosing the few-shot examples",
  caption: "The example pool covers many kinds of question. Random picks may miss the kind you are asking about. Picking the nearest examples by similarity gives the model a close precedent and usually raises accuracy.",
  controls: [{ id: "m", kind: "choice", label: "Pick examples", options: ["random", "nearest to the query"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const near = g.v.m === 1;
    const q: [number, number] = [320, 100];
    const pool: [number, number][] = [];
    for (let k = 0; k < 18; k++) pool.push([40 + g.rnd(k * 2.7 + 1) * 400, 40 + g.rnd(k * 4.3 + 2) * 150]);
    const order = pool.map((p, k) => k).sort((a, b) => Math.hypot(pool[a][0] - q[0], pool[a][1] - q[1]) - Math.hypot(pool[b][0] - q[0], pool[b][1] - q[1]));
    const picks = near ? order.slice(0, 3) : [1, 6, 11];
    pool.forEach(([x, y], k) => {
      const on = picks.includes(k);
      node(g, "doc", x, y, { size: on ? 24 : 14, color: on ? pal.accent : pal.muted, a: on ? 1 : 0.5 });
      if (on) g.line(x, y, q[0], q[1], pal.accent, 0.35, 1);
    });
    g.orb("searching", q[0], q[1], 30, pal.paper, 1);
    g.text("query", q[0], q[1] + 24, { size: 9, color: pal.paper });
    const avg = picks.reduce((a, k) => a + Math.hypot(pool[k][0] - q[0], pool[k][1] - q[1]), 0) / 3;
    const acc = Math.max(0.5, 0.95 - avg / 500);
    g.text("accuracy", 80, 232, { size: 11 });
    bar(g, 140, 227, 250, 8, acc, acc > 0.85 ? pal.ok : pal.accent);
    g.text(`${Math.round(acc * 100)}%`, 430, 232, { size: 12, color: pal.paper });
    g.text("orange cards go into the prompt", 240, 262, { size: 10, color: pal.muted });
  },
};

const promptCacheLayout: Scene = {
  title: "Stable system prompt, cacheable prefix",
  caption: "The system prompt is identical on every request, so its processed state can be reused. Put per-user data inside the system prompt and every request looks different from the first token, which defeats the cache.",
  controls: [{ id: "u", kind: "toggle", label: "User data inside the system prompt" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const mixed = g.v.u === 1;
    [0, 1].forEach((r) => {
      const y = 50 + r * 74;
      g.text(`request ${r + 1}`, 24, y + 22, { size: 10, align: "left", color: pal.muted });
      const parts: [string, number, string][] = mixed ? [["system + user " + (r + 1), 200, pal.violet], ["question", 120, pal.accent]] : [["system (same)", 200, pal.blue], ["question " + (r + 1), 120, pal.accent]];
      let x = 100;
      parts.forEach(([nm, w, col], k) => {
        const reused = !mixed && k === 0 && r === 1;
        g.rect(x, y, w, 44, col, reused ? 0.55 : 0.22, 6);
        g.frame(x, y, w, 44, reused ? pal.ok : col, 1, 6, reused ? 2 : 1.2);
        g.text(nm, x + w / 2, y + 22, { size: 10, color: pal.paper });
        if (reused) g.text("cache hit", x + w / 2, y + 56, { size: 9, color: pal.ok });
        x += w + 6;
      });
    });
    node(g, "cache", 440, 100, { label: "KV cache", size: 32, active: !mixed });
    g.text(mixed ? "every prefix differs: nothing to reuse ✕" : "second request skips the shared prefix ✓", 240, 228, { size: 12, color: mixed ? pal.bad : pal.ok });
    g.text("static content first, dynamic content last", 240, 256, { size: 10, color: pal.muted });
  },
};

const tokensPerText: Scene = {
  title: "Token cost differs by kind of text",
  caption: "The same hundred characters cost different numbers of tokens depending on what they are. Prose is cheap, code and JSON punctuation split into more pieces, and text in less common scripts can take twice as many.",
  controls: [{ id: "k", kind: "choice", label: "Text type", options: ["English prose", "Python code", "JSON", "non-English script"], initial: 2 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const k = g.v.k;
    const tok = [25, 34, 46, 62][k];
    const samples = ["The quick brown fox jumps over the lazy dog today", "def f(x): return [i*2 for i in x if i>0]", '{"id":1,"tags":["a","b"],"ok":true,"n":null}', "नमस्ते दुनिया यह एक परीक्षण वाक्य है"][k];
    g.text("100 characters of", 240, 34, { size: 10, color: pal.muted });
    g.text(samples, 240, 60, { size: 11, color: pal.paper });
    for (let i = 0; i < tok; i++) {
      const x = 40 + (i % 31) * 13;
      const y = 96 + Math.floor(i / 31) * 22;
      g.rect(x, y, 11, 18, [pal.blue, pal.violet, pal.teal, pal.accent][i % 4], 0.55, 3);
    }
    g.text(`${tok} tokens`, 240, 188, { size: 20, color: pal.accent, bold: true });
    g.text("share of a 128K window used by 100 pages", 100, 226, { size: 10 });
    bar(g, 100, 236, 280, 8, Math.min(1, (tok * 30 * 100) / 128000), tok > 50 ? pal.bad : pal.ok);
    g.text(`${Math.round(Math.min(1, (tok * 3000) / 128000) * 100)}%`, 430, 240, { size: 11, color: pal.paper });
  },
};

const topKP: Scene = {
  title: "Top-k versus top-p",
  caption: "Top-k keeps a fixed number of tokens no matter how the probability is spread. Top-p keeps just enough tokens to cover the chosen share. On a peaked distribution top-p keeps few, on a flat one it keeps many, so it adapts.",
  controls: [
    { id: "d", kind: "choice", label: "Distribution", options: ["peaked", "flat"], initial: 0 },
    { id: "m", kind: "choice", label: "Cut", options: ["top-k = 3", "top-p = 0.9"], initial: 1 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const flat = g.v.d === 1;
    const raw = flat ? [0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.06, 0.04] : [0.7, 0.14, 0.06, 0.04, 0.025, 0.02, 0.01, 0.005];
    const keepN = g.v.m === 0 ? 3 : (() => {
      let c = 0;
      let n = 0;
      raw.forEach((p) => {
        if (c < 0.9) {
          c += p;
          n++;
        }
      });
      return n;
    })();
    raw.forEach((p, k) => {
      const x = 50 + k * 52;
      const on = k < keepN;
      g.rect(x - 18, 190 - p * 220, 36, Math.max(2, p * 220), on ? pal.accent : pal.line, on ? 0.8 : 0.35, 4);
      g.text(`${Math.round(p * 100)}%`, x, 180 - p * 220, { size: 10, color: on ? pal.paper : pal.muted });
    });
    g.line(50 + keepN * 52 - 26, 40, 50 + keepN * 52 - 26, 200, pal.paper, 0.7, 1.6);
    g.orb("working", 440, 50, 26, pal.paper, 1);
    g.text(`${keepN} of 8 tokens kept`, 240, 228, { size: 14, color: pal.paper, bold: true });
    g.text(g.v.m === 0 ? "fixed count: wastes tokens when peaked, cuts good ones when flat" : "adapts to how confident the model is", 240, 256, { size: 10, color: pal.muted });
  },
};

const imageCrop: Scene = {
  title: "Give the model the part that matters",
  caption: "A full-page screenshot is downscaled until small text turns to mush. Cropping to the table keeps more patches on the part you care about, so the same model reads it correctly and uses fewer tokens.",
  controls: [{ id: "c", kind: "choice", label: "Image sent", options: ["whole page", "cropped to the table"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const crop = g.v.c === 1;
    g.rect(40, 40, 190, 150, pal.paper, 0.06, 6);
    g.frame(40, 40, 190, 150, pal.line, 1, 6, 1.2);
    for (let r = 0; r < 4; r++) g.rect(54, 56 + r * 10, 130 - r * 14, 5, pal.muted, 0.4, 2);
    g.rect(54, 106, 160, 70, pal.accent, 0.15, 3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.rect(60 + c * 38, 112 + r * 15, 30, 8, pal.accent, 0.5, 2);
    g.text("table", 134, 184, { size: 9, color: pal.accent });
    if (crop) g.frame(52, 104, 164, 74, pal.ok, 1, 4, 2);
    const patches = crop ? 70 : 24;
    g.arrow(236, 115, 270, 115, pal.accent, 1);
    for (let i = 0; i < 30; i++) {
      const on = i < (crop ? 30 : 10);
      g.rect(280 + (i % 6) * 22, 70 + Math.floor(i / 6) * 22, 19, 19, on ? pal.ok : pal.line, on ? 0.45 : 0.1, 3);
    }
    g.text("patches covering the table", 345, 56, { size: 9, color: pal.muted });
    g.orb("listening", 440, 190, 28, pal.paper, 1);
    const acc = crop ? 0.93 : 0.58;
    g.text(`read the numbers correctly: ${Math.round(acc * 100)}%`, 240, 226, { size: 12, color: acc > 0.8 ? pal.ok : pal.bad });
    g.text(`${patches} patches on the table, same image budget`, 240, 254, { size: 10, color: pal.muted });
  },
};

const retrievalK: Scene = {
  title: "How many chunks to retrieve",
  caption: "Retrieving more chunks raises recall, since the right passage is more likely to be among them, but precision falls and the prompt fills with noise. Answer quality peaks in the middle. Slide k to find it.",
  controls: [{ id: "k", kind: "range", label: "Chunks retrieved (k)", min: 1, max: 12, step: 1, initial: 4 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const k = g.v.k;
    const recall = (n: number) => 1 - Math.exp(-n * 0.45);
    const prec = (n: number) => 0.9 / (1 + (n - 1) * 0.18);
    const qual = (n: number) => Math.max(0.1, recall(n) * 0.75 + prec(n) * 0.25 - 0.012 * n * n * 0.15);
    const curve = (fn: (n: number) => number, col: string) => {
      let pv: [number, number] | null = null;
      for (let n = 1; n <= 12; n += 0.25) {
        const x = 40 + ((n - 1) / 11) * 400;
        const y = 190 - fn(n) * 130;
        if (pv) g.line(pv[0], pv[1], x, y, col, 0.9, 1.8);
        pv = [x, y];
      }
    };
    curve(recall, pal.blue);
    curve(prec, pal.violet);
    curve(qual, pal.accent);
    const x = 40 + ((k - 1) / 11) * 400;
    g.line(x, 50, x, 192, pal.paper, 0.5, 1.2);
    g.dot(x, 190 - qual(k) * 130, 5, pal.accent);
    g.text("recall", 90, 56, { size: 10, color: pal.blue });
    g.text("precision", 160, 56, { size: 10, color: pal.violet });
    g.text("answer quality", 250, 56, { size: 10, color: pal.accent });
    for (let i = 0; i < 12; i++) node(g, "doc", 46 + i * 36, 222, { size: 16, color: i < k ? pal.accent : pal.muted, a: i < k ? 1 : 0.3 });
    g.text(`k = ${k}`, 240, 252, { size: 12, color: pal.paper });
  },
};

const crossEncoder: Scene = {
  title: "Bi-encoder versus cross-encoder",
  caption: "A bi-encoder embeds the query and each document separately, so documents can be embedded ahead of time and compared fast. A cross-encoder reads query and document together, which is far more precise but too slow to run on everything.",
  controls: [{ id: "m", kind: "choice", label: "Model", options: ["bi-encoder (retrieve)", "cross-encoder (rerank)"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const cross = g.v.m === 1;
    if (!cross) {
      g.orb("working", 100, 70, 36, pal.paper, 1);
      g.orb("working", 100, 160, 36, pal.paper, 1);
      g.text("query", 100, 98, { size: 9, color: pal.muted });
      g.text("document", 100, 188, { size: 9, color: pal.muted });
      node(g, "db", 260, 115, { label: "two vectors", size: 36, color: pal.blue });
      g.packet(124, 74, 236, 108, g.loop(1.4), pal.accent, 2.6);
      g.packet(124, 156, 236, 122, g.loop(1.4, 0.4), pal.accent, 2.6);
      g.text("cos(q, d)", 360, 115, { size: 13, color: pal.ok });
    } else {
      chip(g, 90, 70, "query", pal.accent, 10);
      chip(g, 90, 160, "document", pal.violet, 10);
      g.packet(120, 74, 210, 112, g.loop(1.4), pal.accent, 2.6);
      g.packet(120, 156, 210, 120, g.loop(1.4, 0.4), pal.violet, 2.6);
      g.orb("solving", 250, 115, 50, pal.paper, 1);
      g.text("one joint pass", 250, 150, { size: 9, color: pal.muted });
      g.text("relevance 0.93", 370, 115, { size: 13, color: pal.ok });
    }
    g.text("precision", 80, 226, { size: 10 });
    bar(g, 140, 221, 120, 8, cross ? 0.9 : 0.6, pal.ok);
    g.text("speed", 290, 226, { size: 10 });
    bar(g, 330, 221, 120, 8, cross ? 0.12 : 0.95, cross ? pal.bad : pal.ok);
    g.text(cross ? "run it on the top 50, not on a million" : "run it over the whole index", 240, 258, { size: 11, color: pal.muted });
  },
};

const decompose: Scene = {
  title: "Query decomposition",
  caption: "One question can hide several lookups. Decomposing it into sub-questions lets each retrieve its own evidence, in parallel, and the final answer combines them. A single combined query usually finds neither fact well.",
  controls: [{ id: "d", kind: "toggle", label: "Decompose the question", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const dec = g.v.d === 1;
    chip(g, 240, 36, "Who founded the firm that built the Falcon engine, and where were they born?", pal.accent, 9);
    g.orb("shaping", 240, 90, 34, pal.paper, 1);
    const subs = dec ? ["who built the engine?", "who founded that firm?", "where was founder born?"] : ["whole question as one query"];
    subs.forEach((s, k) => {
      const x = dec ? 80 + k * 160 : 240;
      chip(g, x, 140, s, pal.blue, 9);
      g.packet(240, 106, x, 128, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2.4);
      node(g, "db", x, 190, { size: 28, color: pal.blue, active: true });
      g.packet(x, 154, x, 172, (g.t * 0.8 + k * 0.2 + 0.4) % 1, pal.ok, 2.2);
      node(g, "doc", x + 30, 190, { size: 20, color: dec ? pal.ok : pal.bad });
    });
    g.text(dec ? "each part finds its own evidence, answers merge ✓" : "mixed query pulls vague, off-target passages ✕", 240, 252, { size: 12, color: dec ? pal.ok : pal.bad });
  },
};

const sentenceWindow: Scene = {
  title: "Sentence-window retrieval",
  caption: "Small chunks match queries precisely but lack context. Index single sentences, find the best match, then hand the model the sentence plus its neighbours. Widen the window for more context at the price of more tokens.",
  controls: [{ id: "w", kind: "range", label: "Window (sentences each side)", min: 0, max: 3, step: 1, initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const w = g.v.w;
    const hit = 6;
    for (let k = 0; k < 13; k++) {
      const x = 30 + k * 33;
      const inWin = Math.abs(k - hit) <= w;
      g.rect(x, 70, 30, 40, k === hit ? pal.accent : inWin ? pal.ok : pal.line, k === hit ? 0.6 : inWin ? 0.4 : 0.1, 5);
      g.text(String(k + 1), x + 15, 90, { size: 10, color: pal.paper });
    }
    g.text("indexed per sentence", 240, 56, { size: 10, color: pal.muted });
    g.dot(30 + hit * 33 + 15, 56, 4, pal.accent);
    g.glow(30 + hit * 33 + 15, 90, 24, pal.accent, 0.3);
    g.arrow(240, 118, 240, 150, pal.accent, 1);
    g.orb("listening", 240, 180, 36, pal.paper, 1);
    const toks = (2 * w + 1) * 25;
    g.text(`model sees ${2 * w + 1} sentence${w ? "s" : ""}, about ${toks} tokens`, 240, 232, { size: 12, color: pal.paper });
    g.text(w === 0 ? "precise but may be missing the surrounding context" : "context restored around the matching sentence", 240, 258, { size: 10, color: pal.muted });
  },
};

const lingua: Scene = {
  title: "Dropping low-value tokens",
  caption: "A small model scores each word by how much it adds. Compression removes the lowest-scoring words and the sentence stays mostly understandable to the larger model. Push the keep rate down and meaning starts to break.",
  controls: [{ id: "k", kind: "range", label: "Keep %", min: 20, max: 100, step: 10, initial: 60 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const keep = g.v.k / 100;
    const words = ["The", "invoice", "from", "Acme", "Corp", "was", "paid", "in", "full", "on", "March", "3rd", "by", "wire", "transfer"];
    const imp = [0.1, 0.8, 0.2, 0.9, 0.7, 0.15, 0.6, 0.1, 0.5, 0.1, 0.85, 0.8, 0.1, 0.4, 0.4];
    const thr = [...imp].sort((a, b) => b - a)[Math.max(0, Math.round(words.length * keep) - 1)];
    let x = 30;
    let y = 60;
    let kept = 0;
    words.forEach((wd, k) => {
      const w = wd.length * 8 + 12;
      if (x + w > 450) {
        x = 30;
        y += 34;
      }
      const on = imp[k] >= thr;
      if (on) kept++;
      g.rect(x, y, w, 24, on ? pal.ok : pal.line, on ? 0.3 : 0.08, 5);
      g.text(wd, x + w / 2, y + 12, { size: 11, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.4 });
      if (!on) g.line(x + 4, y + 12, x + w - 4, y + 12, pal.bad, 0.6, 1.2);
      x += w + 4;
    });
    g.orb("shaping", 440, 36, 24, pal.paper, 1);
    g.text(`${kept} of ${words.length} words kept`, 240, 190, { size: 13, color: pal.paper });
    g.text(keep < 0.4 ? "too aggressive: names and dates start to vanish ✕" : "key entities survive, filler words go", 240, 224, { size: 11, color: keep < 0.4 ? pal.bad : pal.ok });
  },
};

const communities: Scene = {
  title: "GraphRAG for global questions",
  caption: "'What are the main themes?' has no single matching passage, so top-k vector search returns scraps. GraphRAG clusters the graph into communities, summarises each, and answers by combining those summaries.",
  controls: [{ id: "m", kind: "choice", label: "Retrieval", options: ["vector top-k", "community summaries"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const comm = g.v.m === 1;
    const cs: [number, number, string][] = [[110, 90, pal.blue], [290, 70, pal.violet], [380, 170, pal.teal], [150, 180, pal.accent]];
    cs.forEach(([cx, cy, col], c) => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + c;
        const x = cx + 28 * Math.cos(a);
        const y = cy + 22 * Math.sin(a);
        g.line(cx, cy, x, y, col, 0.3, 1);
        g.dot(x, y, 3, col, 0.8);
      }
      if (comm) {
        g.ring(cx, cy, 40, col, 0.6, 1.4);
        node(g, "doc", cx, cy, { size: 20, color: col });
      } else if (c === 0) {
        g.dot(cx + 28, cy, 5, pal.bad);
        g.ring(cx + 28, cy, 10, pal.bad, 0.9, 1.4);
      }
    });
    g.orb("composing", 250, 125, 28, pal.paper, 1);
    if (comm) cs.forEach(([cx, cy], k) => g.packet(cx, cy, 250, 125, (g.t * 0.7 + k * 0.2) % 1, pal.accent, 2.4));
    g.text(comm ? "answer drawn from every community ✓" : "top-k grabs a few passages from one corner ✕", 240, 236, { size: 12, color: comm ? pal.ok : pal.bad });
  },
};

const multiQuery: Scene = {
  title: "Multi-query expansion",
  caption: "One phrasing finds only the passages that happen to share its words. Several paraphrases of the question each retrieve their own list, and merging the lists catches passages any single wording would miss.",
  controls: [{ id: "n", kind: "range", label: "Query variants", min: 1, max: 4, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const docs = 12;
    const found = new Set<number>();
    for (let v = 0; v < n; v++) {
      const y = 44 + v * 30;
      chip(g, 80, y, `phrasing ${v + 1}`, [pal.blue, pal.violet, pal.teal, pal.accent][v], 9);
      for (let k = 0; k < 4; k++) {
        const d = Math.floor(g.rnd(v * 5.1 + k * 2.3 + 1) * docs);
        found.add(d);
        g.rect(160 + k * 34, y - 10, 30, 20, [pal.blue, pal.violet, pal.teal, pal.accent][v], 0.35, 4);
        g.text(`d${d + 1}`, 175 + k * 34, y, { size: 9, color: pal.paper });
      }
      g.packet(120, y, 156, y, (g.t + v * 0.2) % 1, pal.accent, 2);
    }
    for (let d = 0; d < docs; d++) node(g, "doc", 330 + (d % 4) * 34, 54 + Math.floor(d / 4) * 40, { size: 22, color: found.has(d) ? pal.ok : pal.muted, a: found.has(d) ? 1 : 0.35 });
    g.text(`${found.size} of ${docs} documents reached`, 240, 192, { size: 13, color: pal.paper });
    g.text("duplicates are merged, rank by how many lists agree", 240, 232, { size: 10, color: pal.muted });
  },
};

const faithfulness: Scene = {
  title: "Faithfulness: is every claim supported?",
  caption: "The answer is split into individual claims and each is checked against the retrieved context. Faithfulness is the share of claims the context actually supports. One invented detail lowers the score even if the rest is right.",
  controls: [{ id: "h", kind: "toggle", label: "Answer invents a detail" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const bad = g.v.h === 1;
    const claims: [string, boolean][] = [["founded in 1998", true], ["based in Austin", true], ["has 400 employees", true], [bad ? "won the 2021 award" : "makes routers", !bad]];
    node(g, "doc", 60, 90, { label: "context", size: 50, color: pal.blue });
    claims.forEach(([c, ok], k) => {
      const y = 44 + k * 38;
      g.rect(150, y - 14, 220, 28, ok ? pal.ok : pal.bad, 0.18, 6);
      g.frame(150, y - 14, 220, 28, ok ? pal.ok : pal.bad, 1, 6, 1.2);
      g.text(c, 160, y, { size: 11, align: "left", color: pal.paper });
      g.text(ok ? "✓" : "✕", 392, y, { size: 14, color: ok ? pal.ok : pal.bad });
      g.packet(86, 90, 148, y, (g.t * 0.8 + k * 0.15) % 1, ok ? pal.ok : pal.bad, 2);
    });
    const score = claims.filter((c) => c[1]).length / claims.length;
    g.text(`faithfulness ${score.toFixed(2)}`, 240, 214, { size: 15, color: score === 1 ? pal.ok : pal.bad, bold: true });
    g.text("each claim must be traceable to a retrieved passage", 240, 252, { size: 10, color: pal.muted });
  },
};

const efSearch: Scene = {
  title: "The recall versus speed knob",
  caption: "An ANN index exposes a search-effort setting. A larger beam explores more candidates and finds more true neighbours, but takes longer. Slide it: recall climbs fast at first, then flattens while latency keeps growing.",
  controls: [{ id: "e", kind: "range", label: "Search effort (ef)", min: 10, max: 400, step: 10, initial: 80 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ef = g.v.e;
    const rec = (e: number) => 1 - Math.exp(-e / 70) * 0.5;
    const lat = (e: number) => 0.6 + e * 0.045;
    let pv: [number, number] | null = null;
    for (let e = 10; e <= 400; e += 10) {
      const x = 40 + ((e - 10) / 390) * 400;
      const y = 190 - rec(e) * 130;
      if (pv) g.line(pv[0], pv[1], x, y, pal.ok, 1, 2);
      pv = [x, y];
    }
    pv = null;
    for (let e = 10; e <= 400; e += 10) {
      const x = 40 + ((e - 10) / 390) * 400;
      const y = 190 - (lat(e) / 20) * 130;
      if (pv) g.line(pv[0], pv[1], x, y, pal.bad, 1, 2);
      pv = [x, y];
    }
    const x = 40 + ((ef - 10) / 390) * 400;
    g.line(x, 50, x, 192, pal.paper, 0.5, 1.2);
    g.text("recall", 90, 56, { size: 10, color: pal.ok });
    g.text("latency", 150, 56, { size: 10, color: pal.bad });
    g.text(`recall ${(rec(ef) * 100).toFixed(0)}%  ·  ${lat(ef).toFixed(1)} ms`, 240, 232, { size: 13, color: pal.paper });
    g.text("pick the knee: past it you pay time for little recall", 240, 258, { size: 10, color: pal.muted });
  },
};

const matryoshka: Scene = {
  title: "Truncating embedding dimensions",
  caption: "Some embedding models are trained so that the first dimensions carry the most meaning. Keeping only the first few hundred saves memory and speeds search, with only a small recall loss until the vector gets very short.",
  controls: [{ id: "d", kind: "range", label: "Dimensions kept", min: 64, max: 1024, step: 64, initial: 256 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const d = g.v.d;
    for (let k = 0; k < 64; k++) {
      const on = (k / 64) * 1024 < d;
      g.rect(30 + k * 6.6, 50, 5, 40, on ? pal.accent : pal.line, on ? 0.4 + 0.5 * (1 - k / 64) : 0.12, 1);
    }
    g.text("1024-dim vector, front dimensions matter most", 240, 40, { size: 10, color: pal.muted });
    const rec = 1 - 0.35 * Math.exp(-d / 180);
    node(g, "db", 70, 150, { label: "memory", size: 38, color: pal.blue, fill: d / 1024 });
    g.text("recall", 200, 150, { size: 11 });
    bar(g, 250, 145, 180, 8, rec, rec > 0.9 ? pal.ok : pal.accent);
    g.text(`${Math.round(rec * 100)}%`, 456, 150, { size: 11, color: pal.paper });
    g.text(`${d} dims = ${Math.round((d / 1024) * 100)}% of the memory`, 240, 224, { size: 13, color: pal.paper });
    g.text("shortlist with short vectors, rerank with full ones", 240, 256, { size: 10, color: pal.muted });
  },
};

const pqSteps: Scene = {
  title: "Product quantization step by step",
  caption: "Split the vector into sub-vectors. Each sub-vector is replaced by the id of its nearest entry in a small codebook. The vector becomes a handful of one-byte ids, and distances are computed from lookup tables.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 2, 2]);
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent];
    for (let k = 0; k < 4; k++) {
      g.rect(40 + k * 100, 40, 90, 34, cols[k], 0.3, 5);
      g.text(["0.12 .41 .88", "0.55 .02 .73", "0.91 .36 .20", "0.44 .67 .09"][k], 85 + k * 100, 57, { size: 9, color: pal.paper });
    }
    g.text("sub-vector " + "1–4", 240, 30, { size: 9, color: pal.muted });
    if (i >= 1) {
      for (let k = 0; k < 4; k++) {
        node(g, "db", 85 + k * 100, 120, { size: 30, color: cols[k], label: "codebook" });
        g.packet(85 + k * 100, 76, 85 + k * 100, 100, i === 1 ? p : 1, cols[k], 2.4);
      }
    }
    if (i >= 2) {
      [17, 203, 88, 41].forEach((id, k) => {
        chip(g, 85 + k * 100, 190, String(id), cols[k], 12, p);
        g.packet(85 + k * 100, 140, 85 + k * 100, 178, p, cols[k], 2.2);
      });
    }
    g.text(["a 768-float vector is split in four pieces", "each piece looks up its nearest codeword", "stored as 4 bytes instead of 3,072"][i], 240, 250, { size: 12, color: pal.paper });
  },
};

const indexMemory: Scene = {
  title: "Memory for a billion vectors",
  caption: "Raw vectors for a billion records need terabytes of RAM. HNSW keeps everything in memory, IVF-PQ compresses it hard at some recall cost, and DiskANN keeps the graph on SSD with only compressed copies in RAM.",
  controls: [{ id: "i", kind: "choice", label: "Index", options: ["HNSW (RAM)", "IVF-PQ", "DiskANN"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const i = g.v.i;
    const ram = [3200, 96, 120][i];
    const rec = [0.98, 0.88, 0.95][i];
    const qps = [1, 0.8, 0.5][i];
    node(g, "cache", 90, 80, { label: "RAM", size: 52, color: i === 0 ? pal.bad : pal.ok, active: true });
    node(g, "db", 240, 80, { label: i === 2 ? "SSD graph" : "disk", size: 52, color: pal.blue, fill: i === 2 ? 0.9 : 0.1 });
    node(g, "gpu", 390, 80, { label: "CPU search", size: 40 });
    g.packet(116, 80, 214, 80, g.loop(1.6), pal.accent, 2.6);
    g.packet(266, 80, 364, 80, g.loop(1.6, 0.4), pal.accent, 2.6);
    [["RAM needed", ram, 3200, "GB"], ["recall", rec, 1, ""], ["throughput", qps, 1, ""]].forEach(([nm, v, mx, u], k) => {
      const y = 158 + k * 32;
      g.text(nm as string, 20, y, { size: 10, align: "left" });
      bar(g, 150, y - 5, 230, 8, (v as number) / (mx as number), k === 0 ? ((v as number) > 1000 ? pal.bad : pal.ok) : pal.accent);
      g.text(k === 0 ? `${fmt(v as number)} ${u}` : `${Math.round((v as number) * 100)}%`, 430, y, { size: 11, color: pal.paper });
    });
  },
};

const bm25Saturation: Scene = {
  title: "BM25 term-frequency saturation",
  caption: "Repeating a word helps a document rank only up to a point. The k1 setting controls how quickly extra occurrences stop adding score, so a page that spams a term cannot outrank a page that uses it naturally.",
  controls: [{ id: "k", kind: "range", label: "k1", min: 0.2, max: 3, step: 0.2, initial: 1.2 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const k1 = g.v.k;
    const sat = (tf: number) => (tf * (k1 + 1)) / (tf + k1);
    const maxv = k1 + 1;
    g.line(40, 190, 450, 190, pal.line, 1, 1.2);
    g.line(40, 60, 40, 190, pal.line, 1, 1.2);
    let pv: [number, number] | null = null;
    for (let tf = 0; tf <= 20; tf += 0.5) {
      const x = 40 + (tf / 20) * 400;
      const y = 190 - (sat(tf) / 4) * 130;
      if (pv) g.line(pv[0], pv[1], x, y, pal.accent, 1, 2.2);
      pv = [x, y];
    }
    g.line(40, 190 - (maxv / 4) * 130, 450, 190 - (maxv / 4) * 130, pal.muted, 0.5, 1);
    g.text("ceiling", 440, 184 - (maxv / 4) * 130, { size: 9, color: pal.muted, align: "right" });
    const tf = 1 + ((g.t * 3) % 19);
    g.dot(40 + (tf / 20) * 400, 190 - (sat(tf) / 4) * 130, 5, pal.ok);
    g.text("occurrences of the term in the document →", 240, 212, { size: 10, color: pal.muted });
    g.text(`${tf.toFixed(0)} occurrences score ${sat(tf).toFixed(2)} of a max ${maxv.toFixed(1)}`, 240, 244, { size: 12, color: pal.paper });
  },
};

const filterRecall: Scene = {
  title: "Filtering and recall",
  caption: "When a filter keeps only a small share of the data, post-filtering throws away most of the nearest neighbours it just found and returns few or none. Filtering inside the search keeps recall up. Tighten the filter to see the gap.",
  controls: [{ id: "s", kind: "range", label: "Filter keeps %", min: 1, max: 100, step: 1, initial: 10 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const sel = g.v.s / 100;
    const post = Math.min(1, sel * 4 + 0.05);
    const inline = Math.min(1, 0.7 + sel * 0.3);
    node(g, "db", 70, 80, { label: "index", size: 46, color: pal.blue });
    node(g, "shield", 240, 80, { label: "filter", size: 38, color: pal.accent });
    g.packet(96, 80, 216, 80, g.loop(1.4), pal.accent, 2.6);
    for (let k = 0; k < 10; k++) g.dot(300 + k * 14, 80, 4, g.rnd(k * 3.3) < sel ? pal.ok : pal.line, g.rnd(k * 3.3) < sel ? 1 : 0.4);
    g.text("top-10 neighbours, kept by the filter", 370, 108, { size: 9, color: pal.muted });
    g.text("post-filter recall", 60, 168, { size: 10 });
    bar(g, 170, 163, 230, 8, post, post > 0.6 ? pal.ok : pal.bad);
    g.text(`${Math.round(post * 100)}%`, 430, 168, { size: 11, color: pal.paper });
    g.text("filtered search recall", 60, 196, { size: 10 });
    bar(g, 170, 191, 230, 8, inline, pal.ok);
    g.text(`${Math.round(inline * 100)}%`, 430, 196, { size: 11, color: pal.paper });
    g.text(sel < 0.2 ? "tight filter: post-filtering returns too few results ✕" : "mild filter: both approaches cope", 240, 246, { size: 11, color: sel < 0.2 ? pal.bad : pal.muted });
  },
};

const driftMonitor: Scene = {
  title: "Spotting embedding drift",
  caption: "Track the average similarity of live queries to a fixed set of anchor documents. A new embedding model deployed without re-indexing makes that similarity collapse at once, which is the alarm to catch before users complain.",
  controls: [{ id: "n", kind: "toggle", label: "New model deployed, no re-index" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const bad = g.v.n === 1;
    const floor = 0.62;
    const t = Math.floor(g.t * 6);
    const val = (T: number) => {
      const c = ((T % 160) + 160) % 160;
      return 0.74 + (g.rnd(T * 1.3 + 2) - 0.5) * 0.04 - (bad && c > 90 ? 0.22 : 0);
    };
    const y = (v: number) => 200 - ((v - 0.4) / 0.4) * 130;
    g.line(30, y(floor), 450, y(floor), pal.bad, 0.6, 1.2);
    g.text("alert floor", 450, y(floor) + 12, { size: 9, color: pal.bad, align: "right" });
    let pv: [number, number] | null = null;
    let recent = 0;
    for (let k = 0; k < 60; k++) {
      const T = t - 59 + k;
      const v = val(T);
      const x = 30 + k * 7;
      if (pv) g.line(pv[0], pv[1], x, y(v), v < floor ? pal.bad : pal.blue, 1, 1.8);
      pv = [x, y(v)];
      if (k >= 52) recent += v / 8;
    }
    node(g, "db", 456, 50, { size: 24, color: recent < floor ? pal.bad : pal.blue });
    g.text("mean similarity of live queries to anchors", 240, 40, { size: 10, color: pal.muted });
    chip(g, 240, 236, recent < floor ? "ALERT: retrieval quality dropped" : "stable", recent < floor ? pal.bad : pal.ok, 12);
  },
};

export const MORE_AI_1: Record<string, Scene[]> = {
  [`${P}/foundations-and-prompting/prompting-fundamentals`]: [cotWhen],
  [`${P}/foundations-and-prompting/context-windows-and-token-economics`]: [lostMiddle],
  [`${P}/foundations-and-prompting/structured-output-and-chain-of-thought-variants`]: [constrained],
  [`${P}/foundations-and-prompting/few-shot-vs-zero-shot-and-templates`]: [exampleSelect],
  [`${P}/foundations-and-prompting/system-vs-user-prompts-and-role-conditioning`]: [promptCacheLayout],
  [`${P}/foundations-and-prompting/tokenization-mechanics`]: [tokensPerText],
  [`${P}/foundations-and-prompting/sampling-parameters`]: [topKP],
  [`${P}/foundations-and-prompting/multimodal-prompting`]: [imageCrop],
  [`${P}/context-and-rag/rag-fundamentals`]: [retrievalK],
  [`${P}/context-and-rag/advanced-retrieval-hybrid-search-and-reranking`]: [crossEncoder],
  [`${P}/context-and-rag/multi-hop-rag-and-agentic-retrieval`]: [decompose],
  [`${P}/context-and-rag/chunking-strategies`]: [sentenceWindow],
  [`${P}/context-and-rag/context-compression-and-summarization`]: [lingua],
  [`${P}/context-and-rag/graphrag-knowledge-graph-retrieval`]: [communities],
  [`${P}/context-and-rag/query-rewriting-expansion-hyde`]: [multiQuery],
  [`${P}/context-and-rag/rag-evaluation`]: [faithfulness],
  [`${P}/retrieval-and-vector-search/vector-search-and-ann`]: [efSearch],
  [`${P}/retrieval-and-vector-search/choosing-and-evaluating-embedding-models`]: [matryoshka],
  [`${P}/retrieval-and-vector-search/vector-quantization-and-memory-efficiency`]: [pqSteps],
  [`${P}/retrieval-and-vector-search/vector-index-architectures-compared`]: [indexMemory],
  [`${P}/retrieval-and-vector-search/hybrid-sparse-dense-retrieval`]: [bm25Saturation],
  [`${P}/retrieval-and-vector-search/metadata-filtering-multi-tenant-vector-search`]: [filterRecall],
  [`${P}/retrieval-and-vector-search/embedding-drift-versioning-reindexing`]: [driftMonitor],
};
