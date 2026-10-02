import type { Scene } from "../scene/types";
import { bar, chip, fmt, server } from "./kit";

const P = "ai-systems";

type Pt = [number, number];

function cloud(n: number, seed: number, x0: number, y0: number, w: number, h: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = Math.sin((k + seed) * 12.9898) * 43758.5453;
    const b = Math.sin((k + seed) * 78.233 + 1.7) * 24634.6345;
    out.push([x0 + (a - Math.floor(a)) * w, y0 + (b - Math.floor(b)) * h]);
  }
  return out;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function knn(pts: Pt[], ids: number[], k: number): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  ids.forEach((i) => {
    out[i] = ids
      .filter((j) => j !== i)
      .sort((a, b) => dist(pts[i], pts[a]) - dist(pts[i], pts[b]))
      .slice(0, k);
  });
  return out;
}

function greedy(pts: Pt[], nbrs: Record<number, number[]>, start: number, q: Pt): { path: number[]; cmp: number } {
  const path = [start];
  let cur = start;
  let cmp = 1;
  for (let guard = 0; guard < 40; guard++) {
    let best = cur;
    for (const nb of nbrs[cur]) {
      cmp++;
      if (dist(pts[nb], q) < dist(pts[best], q)) best = nb;
    }
    if (best === cur) break;
    path.push(best);
    cur = best;
  }
  return { path, cmp };
}

function nearest(pts: Pt[], q: Pt): number {
  let b = 0;
  pts.forEach((p, k) => {
    if (dist(p, q) < dist(pts[b], q)) b = k;
  });
  return b;
}

const ann: Scene = {
  title: "ANN: skip most of the comparisons",
  caption: "Exact search measures the query against every vector. An ANN graph starts at one entry point and hops to whichever neighbour is closer, stopping at a local minimum. Far fewer comparisons, and it usually lands on the true nearest.",
  controls: [{ id: "m", kind: "choice", label: "Search", options: ["exact (flat)", "ANN (graph walk)"], initial: 1 }],
  aspect: 0.66,
  make: () => {
    const pts = cloud(60, 3, 28, 36, 424, 170);
    const all = pts.map((_, k) => k);
    const nbrs = knn(pts, all, 4);
    return (g) => {
      const { pal } = g;
      const bucket = Math.floor(g.t / 6);
      const p = (g.t % 6) / 6;
      const q: Pt = [60 + g.rnd(bucket * 3.7 + 1) * 360, 50 + g.rnd(bucket * 5.1 + 2) * 140];
      const truth = nearest(pts, q);
      all.forEach((i) => nbrs[i].slice(0, 2).forEach((j) => g.line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], pal.line, 0.25, 1)));
      const exact = g.v.m === 0;
      let found = truth;
      let cmp = pts.length;
      if (exact) {
        const upto = Math.floor(g.clamp(p * 1.6) * pts.length);
        all.forEach((i) => {
          if (i < upto) g.line(q[0], q[1], pts[i][0], pts[i][1], pal.blue, 0.18, 1);
        });
        cmp = upto;
      } else {
        const { path, cmp: c } = greedy(pts, nbrs, 0, q);
        found = path[path.length - 1];
        const shown = Math.min(path.length, Math.floor(g.clamp(p * 1.6) * (path.length + 1)));
        for (let k = 0; k < shown - 1; k++) g.line(pts[path[k]][0], pts[path[k]][1], pts[path[k + 1]][0], pts[path[k + 1]][1], pal.accent, 1, 2);
        cmp = shown >= path.length ? c : Math.round((c * shown) / path.length);
        path.slice(0, shown).forEach((i) => g.ring(pts[i][0], pts[i][1], 7, pal.accent, 0.9, 1.4));
      }
      all.forEach((i) => g.dot(pts[i][0], pts[i][1], 3, pal.paper, 0.7));
      g.dot(pts[0][0], pts[0][1], 4, pal.teal);
      g.dot(q[0], q[1], 5, pal.accent);
      g.glow(q[0], q[1], 16, pal.accent, 0.35);
      g.text("query", q[0], q[1] - 12, { size: 10, color: pal.accent });
      g.text("entry", pts[0][0], pts[0][1] + 14, { size: 10, color: pal.teal });
      const ok = found === truth;
      g.text(`${cmp} of ${pts.length} compared`, 130, 250, { size: 13, color: pal.paper });
      chip(g, 360, 250, ok ? "found true nearest" : "missed true nearest", ok ? pal.ok : pal.bad, 12);
    };
  },
};

const embedModels: Scene = {
  title: "Choosing an embedding model by task",
  caption: "Recall@10 on a small labelled set, per model, for each task. The general model wins on prose, the code model on code, and only the large one holds up across languages. Higher dimensions cost more to store and search.",
  controls: [{ id: "t", kind: "choice", label: "Task", options: ["general text", "code search", "multilingual"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const models = [["small", 384], ["large", 3072], ["code", 1024]] as const;
    const recall = [[0.78, 0.82, 0.55], [0.55, 0.62, 0.83], [0.5, 0.76, 0.58]];
    const r = recall[g.v.t];
    const best = r.indexOf(Math.max(...r));
    g.orb("searching", 240, 36, 34, pal.paper, 1);
    g.text("eval queries", 240, 66, { size: 10, color: pal.muted });
    models.forEach(([name, dim], k) => {
      const x = 90 + k * 150;
      const win = k === best;
      const col = win ? pal.ok : pal.blue;
      g.rect(x - 62, 90, 124, 150, col, 0.1, 8);
      g.frame(x - 62, 90, 124, 150, win ? pal.ok : pal.line, 1, 8, win ? 1.8 : 1);
      g.packet(240, 52, x, 92, (g.t * 0.5 + k * 0.2) % 1, col, 2);
      g.text(`${name}`, x, 106, { size: 13, color: pal.paper, bold: true });
      g.text("recall@10", x, 128, { size: 10, color: pal.muted });
      g.rect(x - 14, 220 - r[k] * 70 - 20, 28, r[k] * 70, col, 0.85, 3);
      g.text(r[k].toFixed(2), x, 220 - r[k] * 70 - 30, { size: 11, color: pal.paper });
      g.text(`${fmt(dim)} dims`, x, 232, { size: 10, color: pal.muted });
    });
    g.text(`best for ${["general text", "code search", "multilingual"][g.v.t]}: ${models[best][0]}`, 240, 270, { size: 13, color: pal.ok });
  },
};

const quantVec: Scene = {
  title: "Vector quantization trades precision for memory",
  caption: "One 768-number vector, stored four ways. The strip shows how coarse each stored value gets. Memory for a million vectors drops from 3 GB to under 100 MB while recall slips a little.",
  controls: [{ id: "q", kind: "choice", label: "Storage", options: ["float32", "int8", "product quant.", "binary"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const mode = g.v.q;
    const mem = [3072, 768, 96, 96][mode];
    const rec = [1, 0.99, 0.9, 0.86][mode];
    g.text("one vector", 24, 36, { size: 11, align: "left" });
    for (let k = 0; k < 32; k++) {
      const raw = 0.5 + 0.5 * Math.sin(k * 0.55 + g.t * 1.2) * Math.cos(k * 0.21);
      let v = raw;
      if (mode === 1) v = Math.round(raw * 15) / 15;
      if (mode === 3) v = raw > 0.5 ? 1 : 0;
      if (mode === 2) v = Math.round(raw * 3) / 3;
      const x = 24 + k * 13.6;
      g.rect(x, 50, 12, 40, pal.blue, 0.1 + 0.85 * v, 2);
      if (mode === 2 && k % 4 === 0) g.frame(x - 1, 48, 4 * 13.6 - 1, 44, pal.violet, 0.8, 3, 1);
    }
    g.text(["32-bit floats, full precision", "256 levels, one byte each (16 shown)", "groups of 4 values map to a codebook entry", "1 bit each: above or below zero"][mode], 240, 112, { size: 11, color: pal.paper });
    g.orb("shaping", 240, 160, 36, pal.paper, 1);
    g.text("1,000,000 vectors in RAM", 240, 195, { size: 11, color: pal.muted });
    g.text("memory", 70, 226, { size: 11 });
    bar(g, 110, 221, 260, 8, Math.log10(mem) / Math.log10(3072), mode === 0 ? pal.bad : pal.accent);
    g.text(mem >= 1000 ? `${(mem / 1000).toFixed(1)} GB` : `${mem} MB`, 425, 226, { size: 12, color: pal.paper });
    g.text("recall", 70, 254, { size: 11 });
    bar(g, 110, 249, 260, 8, rec, pal.ok);
    g.text(`${Math.round(rec * 100)}%`, 425, 254, { size: 12, color: pal.paper });
  },
};

const indexes: Scene = {
  title: "Index architectures: flat, IVF, HNSW",
  caption: "Same data, same query, three ways to search. Flat reads everything. IVF jumps to the nearest few cells and scans only those. HNSW descends layer by layer, coarse to fine. Count the comparisons.",
  controls: [
    { id: "m", kind: "choice", label: "Index", options: ["flat", "IVF", "HNSW"], initial: 2 },
    { id: "n", kind: "range", label: "IVF cells probed", min: 1, max: 3, step: 1, initial: 1 },
  ],
  aspect: 0.66,
  make: () => {
    const pts = cloud(48, 9, 24, 34, 432, 170);
    const cents: Pt[] = [[90, 80], [230, 65], [390, 85], [130, 170], [330, 175]];
    const cell = pts.map((p) => nearest(cents, p));
    const idx = pts.map((_, k) => k);
    const setA = idx.filter((k) => k % 12 === 0);
    const setB = idx.filter((k) => k % 3 === 0);
    const nA = knn(pts, setA, 3);
    const nB = knn(pts, setB, 4);
    const nC = knn(pts, idx, 4);
    return (g) => {
      const { pal } = g;
      const bucket = Math.floor(g.t / 6);
      const p = (g.t % 6) / 6;
      const q: Pt = [60 + g.rnd(bucket * 3.9 + 5) * 360, 50 + g.rnd(bucket * 6.1 + 1) * 130];
      const cols = [pal.blue, pal.violet, pal.teal, pal.accent, pal.ok];
      const m = g.v.m;
      let cmp = pts.length;
      const live = new Set<number>();
      if (m === 0) idx.forEach((k) => live.add(k));
      if (m === 1) {
        const order = cents.map((c, k) => ({ k, d: dist(c, q) })).sort((a, b) => a.d - b.d).slice(0, g.v.n).map((o) => o.k);
        idx.forEach((k) => {
          if (order.includes(cell[k])) live.add(k);
        });
        cmp = cents.length + live.size;
        order.forEach((c) => g.ring(cents[c][0], cents[c][1], 46, cols[c], 0.7, 1.4));
        cents.forEach((c, k) => g.dot(c[0], c[1], 5, cols[k]));
      }
      const paths: number[][] = [];
      if (m === 2) {
        const a = greedy(pts, nA, setA[0], q);
        const b = greedy(pts, nB, a.path[a.path.length - 1], q);
        const c = greedy(pts, nC, b.path[b.path.length - 1], q);
        paths.push(a.path, b.path, c.path);
        cmp = a.cmp + b.cmp + c.cmp;
        const lc = [pal.violet, pal.blue, pal.accent];
        const shown = g.clamp(p * 1.5) * 3;
        paths.forEach((pa, li) => {
          const f = g.clamp(shown - li);
          const n = Math.floor(f * pa.length);
          for (let k = 0; k < n - 1; k++) g.line(pts[pa[k]][0], pts[pa[k]][1], pts[pa[k + 1]][0], pts[pa[k + 1]][1], lc[li], 1, 2);
          pa.slice(0, n).forEach((i) => g.ring(pts[i][0], pts[i][1], 6 + li, lc[li], 0.9, 1.3));
        });
        [setA, setB].forEach((s, li) => s.forEach((i) => g.dot(pts[i][0], pts[i][1], 4.5 - li, li === 0 ? pal.violet : pal.blue)));
      }
      idx.forEach((k) => {
        const on = m === 2 || live.has(k);
        g.dot(pts[k][0], pts[k][1], 3, m === 1 ? cols[cell[k]] : pal.paper, on ? 0.85 : 0.25);
        if (m === 0) g.line(q[0], q[1], pts[k][0], pts[k][1], pal.blue, 0.08 + 0.1 * Math.sin(g.t * 3 + k), 1);
      });
      g.dot(q[0], q[1], 5, pal.accent);
      g.glow(q[0], q[1], 16, pal.accent, 0.35);
      g.text(m === 2 ? "violet top layer, blue middle, orange base" : m === 1 ? "colour = cell, rings = probed" : "every vector measured", 240, 232, { size: 11, color: pal.muted });
      g.text(`${cmp} distance computations`, 240, 262, { size: 14, color: pal.paper });
      g.text(`vs ${pts.length} for a full scan`, 240, 282, { size: 11 });
    };
  },
};

const sparseDense: Scene = {
  title: "Sparse and dense retrieval, blended",
  caption: "Keyword scores catch exact strings like error codes, dense scores catch paraphrases. The slider weighs dense against sparse and the ranking reshuffles. Neither end puts both the exact-match and paraphrase documents on top.",
  controls: [{ id: "a", kind: "range", label: "Dense weight", min: 0, max: 1, step: 0.05, initial: 0.5 }],
  aspect: 0.68,
  make: () => {
    const y0 = [0, 1, 2, 3, 4].map((k) => 70 + k * 40);
    const cur = y0.slice();
    return (g) => {
      const { pal } = g;
      const docs = ["error 0x80070005 fix", "how to resolve access denied", "permissions overview page", "why can't I open this file", "release notes 3.2"];
      const sp = [0.95, 0.2, 0.6, 0.1, 0.25];
      const de = [0.2, 0.9, 0.55, 0.85, 0.2];
      const a = g.v.a;
      const fused = docs.map((_, k) => (1 - a) * sp[k] + a * de[k]);
      const rank = fused.map((f, k) => fused.filter((o, j) => o > f || (o === f && j < k)).length);
      g.text("sparse", 300, 38, { size: 11, color: pal.blue });
      g.text("dense", 350, 38, { size: 11, color: pal.teal });
      g.text("blend", 420, 38, { size: 11, color: pal.accent });
      docs.forEach((d, k) => {
        const target = 70 + rank[k] * 40;
        cur[k] += (target - cur[k]) * Math.min(1, g.dt * 6);
        const y = cur[k];
        const top = rank[k] < 2;
        g.rect(20, y - 14, 235, 28, top ? pal.accent : pal.line, top ? 0.16 : 0.08, 6);
        g.frame(20, y - 14, 235, 28, top ? pal.accent : pal.line, 1, 6, 1);
        g.text(d, 30, y, { size: 11, align: "left", color: pal.paper });
        bar(g, 275, y - 4, 50, 8, sp[k], pal.blue);
        bar(g, 330, y - 4, 50, 8, de[k], pal.teal);
        bar(g, 390, y - 4, 70, 8, fused[k], pal.accent);
      });
      g.orb("weaving", 466, 20, 22, pal.paper, 1);
      g.text("exact string match favours sparse, paraphrase favours dense", 240, 285, { size: 11, color: pal.muted });
    };
  },
};

const tenantFilter: Scene = {
  title: "Metadata filters and tenant isolation",
  caption: "Three tenants share one index. With no filter the nearest vectors can belong to anyone, which is a leak. A post-filter drops them after search and returns fewer than requested. A pre-filter searches only your tenant's vectors.",
  controls: [{ id: "f", kind: "choice", label: "Filter", options: ["none", "post-filter", "pre-filter"], initial: 2 }],
  aspect: 0.66,
  make: () => {
    const pts = cloud(54, 21, 26, 34, 428, 170);
    const tenant = pts.map((_, k) => k % 3);
    return (g) => {
      const { pal } = g;
      const tc = [pal.blue, pal.accent, pal.violet];
      const mine = 1;
      const q: Pt = [240, 120];
      const f = g.v.f;
      const idx = pts.map((_, k) => k).sort((a, b) => dist(pts[a], q) - dist(pts[b], q));
      let res: number[];
      if (f === 0) res = idx.slice(0, 5);
      else if (f === 1) res = idx.slice(0, 5).filter((k) => tenant[k] === mine);
      else res = idx.filter((k) => tenant[k] === mine).slice(0, 5);
      pts.forEach((p, k) => {
        const dim = f === 2 && tenant[k] !== mine;
        g.dot(p[0], p[1], 3.5, tc[tenant[k]], dim ? 0.18 : 0.8);
      });
      res.forEach((k) => {
        const leak = tenant[k] !== mine;
        g.ring(pts[k][0], pts[k][1], 9 + Math.sin(g.t * 4) * 1, leak ? pal.bad : pal.ok, 1, 1.8);
        g.packet(q[0], q[1], pts[k][0], pts[k][1], (g.t * 0.6 + k * 0.1) % 1, leak ? pal.bad : pal.ok, 2);
      });
      g.dot(q[0], q[1], 5, pal.paper);
      g.glow(q[0], q[1], 18, pal.paper, 0.3);
      g.text("you: tenant B (orange)", 240, 226, { size: 11, color: pal.accent });
      const leaks = res.filter((k) => tenant[k] !== mine).length;
      const msg = leaks > 0 ? `${leaks} result${leaks > 1 ? "s" : ""} from other tenants: leak` : `${res.length} of 5 results, all yours`;
      g.text(msg, 240, 256, { size: 13, color: leaks > 0 ? pal.bad : res.length < 5 ? pal.accent : pal.ok });
      if (f === 1) g.text("post-filter shrank the result set", 240, 278, { size: 11, color: pal.muted });
    };
  },
};

const drift: Scene = {
  title: "Embedding drift and blue-green reindexing",
  caption: "Vectors from two model versions do not live in the same space, so mixing them breaks search. The safe path builds a complete v2 index beside v1, checks it, then flips the alias in one step.",
  controls: [{ id: "m", kind: "choice", label: "Rollout", options: ["mixed index (bug)", "blue-green reindex"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const mixed = g.v.m === 0;
    const { i, p } = g.stage([3.4, 1.6, 2.2]);
    const prog = i === 0 ? p : 1;
    g.frame(24, 48, 190, 110, pal.blue, 1, 8, 1.4);
    g.text(mixed ? "one index" : "index v1 (live)", 119, 40, { size: 11, color: pal.blue });
    g.frame(266, 48, 190, 110, pal.violet, mixed ? 0.3 : 1, 8, 1.4);
    if (!mixed) g.text("index v2 (building)", 361, 40, { size: 11, color: pal.violet });
    for (let k = 0; k < 18; k++) {
      const c = k % 6;
      const r = Math.floor(k / 6);
      const migrated = k / 18 < prog;
      if (mixed) {
        g.dot(40 + k * 9.5, 100 + (k % 2) * 16, 3.5, migrated ? pal.violet : pal.blue, 0.9);
      } else {
        g.dot(50 + c * 28, 70 + r * 28, 4, pal.blue, migrated && i > 0 ? 0.3 : 0.9);
        if (migrated) g.dot(292 + c * 28, 70 + r * 28, 4, pal.violet, 0.95);
      }
    }
    if (i === 0) g.orb("working", 240, 104, 30, pal.paper, 1);
    g.text(mixed ? "old and new vectors in one index" : `${Math.round(prog * 100)}% re-embedded`, 240, 182, { size: 11, color: pal.muted });
    const aliasToV2 = !mixed && i === 2;
    g.text("alias: search", 240, 214, { size: 11 });
    g.arrow(240, 222, aliasToV2 ? 340 : 120, 250, aliasToV2 ? pal.violet : pal.blue, 1);
    const ok = !mixed;
    g.text(ok ? (i < 2 ? "queries still hit v1" : "flipped, v1 kept for rollback") : "v2 queries compared to v1 vectors: recall falls", 240, 278, { size: 12, color: ok ? pal.ok : pal.bad });
    if (mixed) for (let k = 0; k < 5; k++) g.packet(360, 60, 100 + k * 10, 110, (g.t * 0.5 + k * 0.2) % 1, pal.bad, 2);
  },
};

const serving: Scene = {
  title: "Inference serving: prefill, decode and the KV cache",
  caption: "The prompt is processed in one parallel pass (prefill), then each new token is decoded one at a time. The KV cache keeps past keys and values so a step touches one token. Turn it off and every step recomputes the whole prefix.",
  controls: [
    { id: "c", kind: "toggle", label: "KV cache", initial: true },
    { id: "n", kind: "range", label: "Output tokens", min: 4, max: 20, step: 1, initial: 12 },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const L = 8;
    const N = g.v.n;
    const cache = g.v.c === 1;
    const total = 1.2 + N * 0.4;
    const tt = (g.t % (total + 1.5));
    const decoded = tt < 1.2 ? 0 : Math.min(N, Math.floor((tt - 1.2) / 0.4) + 1);
    const prefillGlow = tt < 1.2;
    g.text("prompt", 24, 34, { size: 11, align: "left" });
    for (let k = 0; k < L; k++) {
      g.rect(24 + k * 24, 44, 21, 26, pal.blue, prefillGlow ? 0.65 : 0.3, 4);
      if (prefillGlow) g.glow(34 + k * 24, 57, 14, pal.blue, 0.25);
    }
    g.text(prefillGlow ? "prefill: all at once" : "prefilled", 24 + L * 12, 84, { size: 10, color: pal.muted });
    for (let k = 0; k < N; k++) {
      const col = k % 10;
      const row = Math.floor(k / 10);
      const done = k < decoded;
      g.rect(248 + col * 21, 44 + row * 30, 18, 24, pal.accent, done ? 0.7 : 0.1, 4);
    }
    g.text("decode: one token per step", 340, 112, { size: 10, color: pal.muted });
    g.orb(prefillGlow ? "working" : "composing", 240, 150, 36, pal.paper, 1);
    const prefix = L + decoded;
    const work = cache ? 1 : prefix;
    g.text("KV cache memory", 24, 205, { size: 11, align: "left" });
    bar(g, 150, 200, 200, 8, cache ? prefix / (L + 20) : 0, pal.teal);
    g.text(cache ? `${prefix} tokens cached` : "nothing kept", 400, 205, { size: 11, color: pal.paper });
    g.text("work this step", 24, 235, { size: 11, align: "left" });
    bar(g, 150, 230, 200, 8, work / (L + 20), cache ? pal.ok : pal.bad);
    g.text(`${work} token${work > 1 ? "s" : ""} recomputed`, 400, 235, { size: 11, color: pal.paper });
    g.text(cache ? "memory grows, compute per step stays flat" : "no memory, but work grows every step", 240, 270, { size: 12, color: cache ? pal.ok : pal.bad });
  },
};

const speculative: Scene = {
  title: "Speculative decoding",
  caption: "A small draft model guesses four tokens ahead. The large model checks all four in one pass and keeps the leading run it agrees with, then adds its own token. Raise the agreement rate and each big pass yields more tokens.",
  controls: [{ id: "r", kind: "range", label: "Draft agreement", min: 0.3, max: 0.95, step: 0.05, initial: 0.7 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const r = g.v.r;
    const k = 4;
    const bucket = Math.floor(g.t / 4.4);
    let acc = 0;
    while (acc < k && g.rnd(bucket * 5.3 + acc * 1.9 + 1) < r) acc++;
    const { i, p } = g.stage([1.6, 1.6, 1.2]);
    g.orb("working", 70, 80, 34, pal.paper, 1);
    g.text("draft (small)", 70, 112, { size: 10, color: pal.muted });
    g.orb("solving", 70, 200, 52, pal.paper, 1);
    g.text("target (large)", 70, 236, { size: 10, color: pal.muted });
    for (let j = 0; j < k; j++) {
      const x = 160 + j * 62;
      const shown = i > 0 || p > j / k;
      if (shown) chip(g, x, 80, `d${j + 1}`, pal.blue, 13, i === 0 ? g.clamp(p * k - j) : 1);
      if (i >= 1) {
        const ok = j < acc;
        const dead = j > acc;
        g.packet(x, 92, x, 188, i === 1 ? g.clamp(p * 1.3) : 1, pal.accent, 2);
        if (i >= 2 || p > 0.7) chip(g, x, 200, dead ? "✕" : ok ? "✓" : "✕", dead ? pal.line : ok ? pal.ok : pal.bad, 15, dead ? 0.4 : 1);
      }
    }
    if (i === 2) chip(g, 160 + 4 * 62, 200, "+1", pal.accent, 13);
    g.text(i === 0 ? "draft proposes 4 tokens" : i === 1 ? "target verifies all 4 in one pass" : `${acc} accepted + 1 from target = ${acc + 1} tokens`, 290, 140, { size: 12, color: pal.paper });
    const e = (1 - r ** (k + 1)) / (1 - r);
    g.text(`average ${e.toFixed(1)} tokens per large-model pass`, 290, 270, { size: 13, color: pal.accent });
  },
};

const multiGpu: Scene = {
  title: "Multi-GPU serving: three ways to split",
  caption: "Tensor parallel splits each layer across GPUs that must exchange partial results every layer. Pipeline parallel gives each GPU a block of layers and passes activations along. Data parallel copies the model so GPUs serve different requests.",
  controls: [{ id: "m", kind: "choice", label: "Split", options: ["tensor", "pipeline", "data"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const gx = [70, 190, 310, 430];
    const gy = 150;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent];
    gx.forEach((x, k) => {
      g.rect(x - 38, gy - 44, 76, 88, cols[k], 0.1, 8);
      g.frame(x - 38, gy - 44, 76, 88, cols[k], 1, 8, 1.3);
      g.orb("working", x, gy - 4, 34, pal.paper, 1);
      g.text(`GPU ${k + 1}`, x, gy + 34, { size: 10, color: pal.muted });
    });
    if (m === 0) {
      g.text("every layer is sliced 4 ways", 240, 40, { size: 12, color: pal.paper });
      const ph = g.loop(1.6);
      for (let k = 0; k < 3; k++) {
        g.packet(gx[k] + 38, gy - 10, gx[k + 1] - 38, gy - 10, ph, pal.ok, 2.4);
        g.packet(gx[k + 1] - 38, gy + 10, gx[k] + 38, gy + 10, ph, pal.ok, 2.4);
      }
      g.text("all-reduce after every layer: needs fast links", 240, 250, { size: 12, color: pal.ok });
    } else if (m === 1) {
      g.text("GPU k holds layers 8k to 8k+7", 240, 40, { size: 12, color: pal.paper });
      for (let b = 0; b < 4; b++) {
        const f = (g.t * 0.5 + b * 0.25) % 1;
        const seg = f * 3;
        const k = Math.min(2, Math.floor(seg));
        g.packet(gx[k] + 38, gy, gx[k + 1] - 38, gy, seg - k, cols[b], 3);
      }
      g.text("micro-batches keep every stage busy", 240, 250, { size: 12, color: pal.ok });
    } else {
      g.text("each GPU holds the full model", 240, 40, { size: 12, color: pal.paper });
      gx.forEach((x, k) => g.packet(x, 60, x, gy - 40, (g.t * 0.55 + k * 0.23) % 1, cols[k], 3));
      gx.forEach((x, k) => g.packet(x, gy + 46, x, 215, (g.t * 0.55 + k * 0.23 + 0.5) % 1, cols[k], 3));
      g.text("4x throughput, but the model must fit on one GPU", 240, 250, { size: 12, color: pal.ok });
    }
  },
};

const quantInf: Scene = {
  title: "Quantization for inference",
  caption: "Weights are bell-shaped numbers. Fewer bits means fewer allowed levels (vertical lines) and each weight snaps to the nearest one. Drag the bits: memory for a 7B model falls fast, error grows once the levels get sparse.",
  controls: [{ id: "b", kind: "range", label: "Bits per weight", min: 2, max: 8, step: 1, initial: 4 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const bits = g.v.b;
    const levels = 2 ** bits;
    const x0 = 30;
    const x1 = 450;
    const base = 170;
    g.c.beginPath();
    g.c.moveTo(x0, base);
    for (let x = x0; x <= x1; x += 4) {
      const z = ((x - 240) / 210) * 3;
      g.c.lineTo(x, base - 90 * Math.exp(-z * z / 2));
    }
    g.c.lineTo(x1, base);
    g.c.closePath();
    g.c.globalAlpha = 0.18;
    g.c.fillStyle = pal.blue;
    g.c.fill();
    g.c.globalAlpha = 1;
    const show = Math.min(levels, 64);
    for (let k = 0; k < show; k++) {
      const x = x0 + ((k + 0.5) / show) * (x1 - x0);
      g.line(x, base - 8, x, base + 6, pal.accent, 0.85, 1.4);
    }
    const w = Math.sin(g.t * 0.8) * 2.2;
    const step = 6 / levels;
    const snapped = Math.max(-3 + step / 2, Math.min(3 - step / 2, (Math.floor((w + 3) / step) + 0.5) * step - 3));
    const px = 240 + (w / 3) * 210;
    const sx = 240 + (snapped / 3) * 210;
    g.dot(px, base - 10, 4, pal.paper);
    g.dot(sx, base - 10, 4, pal.accent);
    g.line(px, base - 20, sx, base - 20, pal.bad, 1, 2);
    g.text(`${levels} levels`, 240, 200, { size: 13, color: pal.paper });
    const gb = (7e9 * bits) / 8 / 1e9;
    g.text("7B model", 80, 238, { size: 11 });
    bar(g, 120, 233, 250, 8, gb / 14, gb > 24 ? pal.bad : pal.ok);
    g.text(`${gb.toFixed(1)} GB`, 425, 238, { size: 12, color: pal.paper });
    g.text(gb <= 24 ? "fits a 24 GB card" : "does not fit a 24 GB card", 240, 270, { size: 12, color: gb <= 24 ? pal.ok : pal.bad });
  },
};

const routing: Scene = {
  title: "Model routing and cascades",
  caption: "Most requests are easy. Always calling the large model pays top price for all of them. A router sends easy ones to the small model, and a cascade tries small first and escalates only on low confidence.",
  controls: [{ id: "m", kind: "choice", label: "Strategy", options: ["always large", "router", "cascade"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    g.orb("working", 390, 70, 30, pal.paper, 1);
    g.text("small", 390, 98, { size: 10, color: pal.muted });
    g.orb("solving", 390, 190, 52, pal.paper, 1);
    g.text("large", 390, 228, { size: 10, color: pal.muted });
    server(g, 90, 130, "router", { size: 36, state: "searching", ring: m === 0 ? pal.line : pal.accent });
    const cost = [1, 0.31, 0.38][m];
    for (let k = 0; k < 6; k++) {
      const f = (g.t * 0.3 + k / 6) % 1;
      const seed = Math.floor(g.t * 0.3 + k / 6) * 6 + k;
      const hard = g.rnd(seed * 3.1 + 2) > 0.7;
      const col = hard ? pal.bad : pal.ok;
      if (f < 0.35) g.packet(20, 130, 72, 130, f / 0.35, col, 3);
      else if (m === 0 || (m === 1 && hard)) g.packet(108, 130, 360, 190, g.clamp((f - 0.35) / 0.65), col, 3);
      else if (m === 1) g.packet(108, 130, 362, 74, g.clamp((f - 0.35) / 0.65), col, 3);
      else {
        g.packet(108, 130, 362, 74, g.clamp((f - 0.35) / 0.3), col, 3);
        if (hard && f > 0.65) g.packet(396, 90, 396, 160, g.clamp((f - 0.65) / 0.35), pal.accent, 3);
      }
    }
    const qual = [1, 0.94, 0.97][m];
    g.text("avg cost", 100, 254, { size: 11 });
    bar(g, 150, 249, 90, 8, cost, pal.accent);
    g.text("quality", 300, 254, { size: 11 });
    bar(g, 345, 249, 90, 8, qual, pal.ok);
    g.text("30% hard (red), 70% easy (green)", 240, 280, { size: 10, color: pal.muted });
  },
};

const autoscale: Scene = {
  title: "Autoscaling a GPU fleet",
  caption: "Traffic rises in waves and each replica serves a fixed rate. New replicas need a cold start to load weights, shown as dim orbs. Lengthen the cold start and the queue grows before capacity arrives.",
  controls: [{ id: "c", kind: "range", label: "Cold start (s)", min: 1, max: 8, step: 1, initial: 4 }],
  aspect: 0.66,
  make: () => {
    let ready = 2;
    let pending: number[] = [];
    let queue = 0;
    let last = -1;
    return (g) => {
      const { pal } = g;
      if (g.t < last) {
        ready = 2;
        pending = [];
        queue = 0;
      }
      last = g.t;
      const dt = Math.min(g.dt, 0.1);
      const load = 6 + 5 * Math.sin(g.t * 0.35) + 2 * Math.sin(g.t * 0.9);
      const cap = ready * 2;
      queue = Math.max(0, queue + (load - cap) * dt);
      const want = Math.min(8, Math.ceil(load / 2) + (queue > 3 ? 1 : 0));
      if (ready + pending.length < want) pending.push(g.t + g.v.c);
      const arrived = pending.filter((tt) => tt <= g.t).length;
      ready += arrived;
      pending = pending.filter((tt) => tt > g.t);
      if (ready > want + 1 && queue < 0.5) ready -= 1;
      for (let k = 0; k < 8; k++) {
        const x = 40 + k * 56;
        const on = k < ready;
        const soon = !on && k < ready + pending.length;
        g.ring(x, 70, 20, on ? pal.ok : soon ? pal.accent : pal.line, on ? 1 : 0.6, 1.3);
        g.orb(on ? "working" : "breathing", x, 70, on ? 30 : 22, soon ? pal.accent : pal.paper, 1);
        if (!on && !soon) g.rect(x - 14, 54, 28, 32, pal.ink, 0.5, 14);
        if (soon) g.text("loading", x, 104, { size: 9, color: pal.accent });
      }
      g.text("request queue", 24, 146, { size: 11, align: "left" });
      for (let k = 0; k < Math.min(40, Math.round(queue * 3)); k++) g.rect(24 + k * 10.5, 156, 8, 22, pal.bad, 0.75, 2);
      g.text("load vs capacity", 24, 208, { size: 11, align: "left" });
      bar(g, 150, 203, 260, 8, load / 16, pal.accent);
      bar(g, 150, 220, 260, 8, cap / 16, cap >= load ? pal.ok : pal.bad);
      g.text(`load ${load.toFixed(1)}`, 440, 208, { size: 10, color: pal.paper });
      g.text(`cap ${cap}`, 440, 225, { size: 10, color: pal.paper });
      g.text(queue > 2 ? "queue building: capacity is late" : "capacity keeps up", 240, 268, { size: 12, color: queue > 2 ? pal.bad : pal.ok });
    };
  },
};

const prefixCache: Scene = {
  title: "Prefix and prompt caching",
  caption: "Requests that share a long system prompt repeat the same prefill work. With caching the first request pays and later ones reuse the stored prefix, computing only their own tail. Grow the shared share to save more.",
  controls: [
    { id: "c", kind: "toggle", label: "Prefix cache", initial: true },
    { id: "s", kind: "range", label: "Shared prefix %", min: 20, max: 90, step: 10, initial: 70 },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.c === 1;
    const sh = g.v.s / 100;
    const { i, p } = g.stage([1.8, 1.8, 1.8, 1.8]);
    const W = 300;
    let computed = 0;
    for (let r = 0; r < 4; r++) {
      const y = 50 + r * 40;
      const reuse = on && r > 0;
      const reached = r <= i;
      const prog = r < i ? 1 : r === i ? p : 0;
      g.text(`req ${r + 1}`, 24, y + 10, { size: 11, align: "left" });
      g.rect(70, y, W * sh, 20, reuse ? pal.ok : pal.blue, reached ? (reuse ? 0.35 : 0.2 + 0.5 * Math.min(1, prog * 2)) : 0.1, 4);
      g.rect(70 + W * sh, y, W * (1 - sh), 20, pal.accent, reached ? 0.2 + 0.6 * Math.min(1, prog * 1.3) : 0.1, 4);
      if (reached && !reuse) g.rect(70, y + 22, W * prog, 3, pal.blue, 0.8, 1.5);
      if (reuse && reached) g.text("cached", 70 + (W * sh) / 2, y + 10, { size: 10, color: pal.ok });
      if (r < i || (r === i && p > 0.9)) computed += reuse ? 1 - sh : 1;
    }
    g.orb(on ? "composing" : "working", 420, 90, 40, pal.paper, 1);
    g.text(on ? "cache hit path" : "full prefill each time", 420, 124, { size: 10, color: pal.muted });
    const frac = computed / 4;
    g.text("tokens computed", 24, 240, { size: 11, align: "left" });
    bar(g, 150, 235, 220, 8, frac, pal.accent);
    g.text(`${Math.round(frac * 100)}% of no-cache`, 425, 240, { size: 11, color: pal.paper });
    g.text(on ? "blue = prefix, orange = unique tail" : "every request recomputes its shared prefix", 240, 272, { size: 11, color: pal.muted });
  },
};

const frameworks: Scene = {
  title: "Serving frameworks: static versus continuous batching",
  caption: "Each lane is a request generating tokens. Static batching waits for the longest sequence before starting new work, leaving red gaps. Continuous batching refills a lane the moment it frees, which is what modern serving frameworks do.",
  controls: [{ id: "m", kind: "choice", label: "Batching", options: ["static", "continuous"], initial: 1 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const lens = [[6, 14, 4, 10], [12, 5, 9, 7], [3, 8, 13, 4], [9, 4, 6, 12]];
    const W = 24;
    const sx = 70;
    const sc = 380 / W;
    const cont = g.v.m === 1;
    let used = 0;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent];
    for (let lane = 0; lane < 4; lane++) {
      const y = 50 + lane * 40;
      g.text(`lane ${lane + 1}`, 24, y + 12, { size: 10, align: "left" });
      let t0 = 0;
      for (let b = 0; b < 4; b++) {
        const len = lens[lane][b];
        let start = t0;
        if (!cont) start = [0, 1, 2, 3].slice(0, b).reduce((a, bb) => a + Math.max(...lens.map((l) => l[bb])), 0);
        if (start + len > W) {
          const rest = Math.max(0, W - start);
          if (rest > 0) g.rect(sx + start * sc, y, rest * sc - 1, 24, cols[b], 0.6, 3);
          used += rest;
          break;
        }
        g.rect(sx + start * sc, y, len * sc - 1, 24, cols[b], 0.6, 3);
        used += len;
        if (!cont) {
          const bl = Math.max(...lens.map((l) => l[b]));
          if (len < bl) g.rect(sx + (start + len) * sc, y, (bl - len) * sc - 1, 24, pal.bad, 0.22, 3);
        }
        t0 = start + len;
      }
    }
    const cx = sx + ((g.t * 3) % W) * sc;
    g.line(cx, 42, cx, 210, pal.paper, 0.8, 1.5);
    const util = used / (4 * W);
    g.text("time", 260, 224, { size: 10, color: pal.muted });
    g.text("GPU busy", 100, 250, { size: 11 });
    bar(g, 150, 245, 220, 8, util, util > 0.8 ? pal.ok : pal.bad);
    g.text(`${Math.round(util * 100)}%`, 425, 250, { size: 12, color: pal.paper });
    g.text(cont ? "freed lanes take new requests at once" : "red = idle waiting for the longest request", 240, 280, { size: 11, color: pal.muted });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/retrieval-and-vector-search/vector-search-and-ann`]: ann,
  [`${P}/retrieval-and-vector-search/choosing-and-evaluating-embedding-models`]: embedModels,
  [`${P}/retrieval-and-vector-search/vector-quantization-and-memory-efficiency`]: quantVec,
  [`${P}/retrieval-and-vector-search/vector-index-architectures-compared`]: indexes,
  [`${P}/retrieval-and-vector-search/hybrid-sparse-dense-retrieval`]: sparseDense,
  [`${P}/retrieval-and-vector-search/metadata-filtering-multi-tenant-vector-search`]: tenantFilter,
  [`${P}/retrieval-and-vector-search/embedding-drift-versioning-reindexing`]: drift,
  [`${P}/model-serving-and-inference/inference-serving-fundamentals`]: serving,
  [`${P}/model-serving-and-inference/speculative-decoding-and-distillation`]: speculative,
  [`${P}/model-serving-and-inference/multi-gpu-serving-and-parallelism`]: multiGpu,
  [`${P}/model-serving-and-inference/quantization-for-inference`]: quantInf,
  [`${P}/model-serving-and-inference/model-routing-and-cascades`]: routing,
  [`${P}/model-serving-and-inference/autoscaling-gpu-inference-fleets`]: autoscale,
  [`${P}/model-serving-and-inference/prefix-and-prompt-caching`]: prefixCache,
  [`${P}/model-serving-and-inference/serving-frameworks-compared`]: frameworks,
};
