import type { Scene } from "../scene/types";
import { arcStroke, bar, chip, fmt, hash32, server } from "./kit";

const P = "system-design";
const TAU = Math.PI * 2;

const bloomMemory: Scene = {
  title: "A Bloom filter: memory against false positives",
  caption: "Twelve items are hashed into a bit array, three bits each. A key that was never added still looks present if its three bits happen to be set. More bits per item makes that rare, and there are never false negatives.",
  controls: [{ id: "b", kind: "range", label: "Bits per item", min: 2, max: 16, step: 1, initial: 6 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const n = 12;
    const k = 3;
    const m = n * g.v.b;
    const bits = new Array(m).fill(false);
    for (let i = 0; i < n; i++) for (let h = 0; h < k; h++) bits[Math.floor(hash32(`item${i}:${h}`) * m)] = true;
    const filled = bits.filter(Boolean).length;
    let fp = 0;
    const probes = 300;
    for (let q = 0; q < probes; q++) {
      let all = true;
      for (let h = 0; h < k; h++) if (!bits[Math.floor(hash32(`absent${q}:${h}`) * m)]) all = false;
      if (all) fp++;
    }
    const cols = 24;
    const cell = 16;
    for (let i = 0; i < m; i++) {
      const x = 48 + (i % cols) * cell;
      const y = 28 + Math.floor(i / cols) * cell;
      g.rect(x, y, cell - 2, cell - 2, bits[i] ? pal.accent : pal.ink, bits[i] ? 0.85 : 0.6, 2);
    }
    const probe = Math.floor(g.t / 1.6) % 40;
    const pos = [0, 1, 2].map((h) => Math.floor(hash32(`absent${probe}:${h}`) * m));
    const q = (g.t % 1.6) / 1.6;
    pos.forEach((i, h) => {
      const x = 48 + (i % cols) * cell + cell / 2 - 1;
      const y = 28 + Math.floor(i / cols) * cell + cell / 2 - 1;
      const show = q > 0.2 + h * 0.2;
      if (show) {
        g.ring(x, y, cell * 0.8, bits[i] ? pal.ok : pal.bad, 1, 1.6);
        g.glow(x, y, cell * 1.6, bits[i] ? pal.ok : pal.bad, 0.3);
      }
    });
    const allSet = pos.every((i) => bits[i]);
    g.text(`checking an item that was never added`, 240, 28 + Math.ceil(m / cols) * cell + 20, { size: 11, color: pal.paper });
    g.text(q > 0.8 ? (allSet ? "all 3 bits set: FALSE POSITIVE" : "a bit is 0: definitely absent") : "probing its 3 bits...", 240, 28 + Math.ceil(m / cols) * cell + 40, { size: 12, color: q > 0.8 ? (allSet ? pal.bad : pal.ok) : pal.muted });
    g.text(`${filled}/${m} bits set`, 130, 232, { size: 12, color: pal.paper });
    g.text(`measured false positives: ${((fp / probes) * 100).toFixed(1)}%`, 350, 232, { size: 12, color: fp / probes > 0.1 ? pal.bad : pal.ok, bold: true });
    g.text(`memory: ${fmt((m / 8))} bytes for ${n} items`, 240, 262, { size: 11 });
  },
};

const lambda: Scene = {
  title: "Lambda architecture: fast and right",
  caption: "Events feed a speed layer that answers instantly but approximately, and a batch layer that periodically recomputes the exact answer. Each batch run corrects the fast number.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const T = 7;
    const t = g.t % T;
    const k = Math.floor(g.t / T);
    const exact = 1000 + k * 700;
    const sinceBatch = t;
    const drift = 1 + 0.03 * Math.sin(g.t * 1.3);
    const speed = Math.round((exact + sinceBatch * 120) * (t < 0.6 ? 1 : drift));
    const batchStale = exact;
    server(g, 56, 130, "events", { size: 36 });
    for (let i = 0; i < 6; i++) {
      const p = (g.t * 0.7 + i / 6) % 1;
      g.packet(80, 130, 190, 78, p, pal.accent, 2.2);
      g.packet(80, 130, 190, 188, p, pal.accent, 2.2);
    }
    g.rect(190, 52, 120, 52, pal.panel, 1, 8);
    g.frame(190, 52, 120, 52, pal.blue, 1, 8);
    g.text("speed layer", 250, 66, { size: 11, color: pal.blue });
    g.text(`${fmt(speed)}`, 250, 88, { size: 18, color: pal.paper, bold: true });
    g.rect(190, 162, 120, 52, pal.panel, 1, 8);
    g.frame(190, 162, 120, 52, pal.violet, 1, 8);
    g.text("batch layer", 250, 176, { size: 11, color: pal.violet });
    g.text(t < 5.2 ? "waiting for next run" : "recomputing all data...", 250, 198, { size: 10 });
    arcStroke(g, 340, 188, 16, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, t / 5.2), pal.violet, 3, 0.9);
    g.text("fresh, approximate", 380, 78, { size: 10, align: "left" });
    g.text("exact, hours old", 330, 222, { size: 10, align: "left" });
    if (t > 5.2) {
      g.packet(250, 162, 250, 104, g.clamp((t - 5.2) / 0.9), pal.ok, 3.4);
      g.glow(250, 78, 50, pal.ok, 0.4 * Math.sin(g.clamp((t - 5.2) / 1.4) * Math.PI));
      g.text("corrected to the exact value", 380, 100, { size: 10, align: "left", color: pal.ok });
    }
    g.text(`dashboard: ${fmt(t > 6 ? batchStale + 840 : speed)}`, 240, 262, { size: 14, color: pal.accent, bold: true });
  },
};

const tdigest: Scene = {
  title: "A t-digest keeps the tails sharp",
  caption: "Latency values stream in. The digest merges them into centroids that are fat in the middle and tiny in the tails, so p50 and p99.9 stay accurate in a few kilobytes while raw storage grows forever.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const total = 700;
    const n = Math.min(total, 40 + Math.floor((g.t % 14) * 55));
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(Math.exp(2.2 + 0.8 * (g.rnd(i * 2.1) + g.rnd(i * 5.3) + g.rnd(i * 7.9) - 1.5) * 1.6 + (g.rnd(i * 1.3) > 0.97 ? 1.6 : 0)));
    vals.sort((a, b) => a - b);
    const delta = 12;
    const cents: { x: number; c: number }[] = [];
    let i0 = 0;
    while (i0 < n) {
      const q = i0 / n;
      const size = Math.max(1, Math.floor((4 * n * q * (1 - q)) / delta));
      const slice = vals.slice(i0, i0 + size);
      cents.push({ x: slice.reduce((a, b) => a + b, 0) / slice.length, c: slice.length });
      i0 += size;
    }
    const lo = Math.log(vals[0]);
    const hi = Math.log(vals[n - 1]);
    const X = (v: number) => 30 + ((Math.log(v) - lo) / (hi - lo || 1)) * 420;
    g.line(30, 150, 450, 150, pal.line);
    vals.forEach((v, k) => g.dot(X(v), 150 - 6 - (k % 5) * 4, 1.4, pal.muted, 0.5));
    cents.forEach((c) => {
      g.dot(X(c.x), 108, 3 + Math.sqrt(c.c) * 1.5, pal.accent, 0.8);
      g.line(X(c.x), 150, X(c.x), 108 + 3 + Math.sqrt(c.c) * 1.5, pal.accent, 0.25);
    });
    const exact = (q: number) => vals[Math.min(n - 1, Math.floor(q * n))];
    const digest = (q: number) => {
      let run = 0;
      for (const c of cents) {
        run += c.c;
        if (run / n >= q) return c.x;
      }
      return cents[cents.length - 1].x;
    };
    [0.5, 0.99].forEach((q, k) => {
      const e = exact(q);
      const d = digest(q);
      g.line(X(e), 156, X(e), 176, pal.ok, 1, 1.6);
      g.line(X(d), 156, X(d), 176, pal.blue, 1, 1.6);
      g.text(k === 0 ? "p50" : "p99", X(d), 188, { size: 10, color: pal.blue });
    });
    g.text(`${n} values seen`, 100, 36, { size: 12, color: pal.paper });
    g.text(`${cents.length} centroids kept`, 100, 56, { size: 12, color: pal.accent, bold: true });
    g.text(`raw: ${fmt(n * 8)} B`, 380, 36, { size: 11, color: pal.bad });
    g.text(`digest: ${fmt(cents.length * 16)} B`, 380, 56, { size: 11, color: pal.ok });
    g.text("blue = digest estimate, green = exact", 240, 230, { size: 10 });
    g.text("centroids are tiny at the tails, so tail percentiles stay accurate", 240, 262, { size: 11, color: pal.paper });
  },
};

const bloomCms: Scene = {
  title: "Bloom filter and Count-Min sketch",
  caption: "Both hash a key to several positions. A Bloom filter sets bits to answer 'maybe seen'. A Count-Min sketch increments counters and answers with the smallest one, which can only over-count.",
  aspect: 0.68,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2.4, 2.4, 2.4, 2.8]);
    const ops = [
      { key: "cat", add: true },
      { key: "dog", add: true },
      { key: "cat", add: true },
      { key: "cow", add: false },
    ];
    const op = ops[i];
    const bm = 16;
    const rows = 3;
    const cm = 10;
    const bloom = new Array(bm).fill(false);
    const cms = Array.from({ length: rows }, () => new Array(cm).fill(0));
    for (let s = 0; s < (i < 4 ? i + (p > 0.6 ? 1 : 0) : 4); s++) {
      if (!ops[s].add) continue;
      for (let h = 0; h < 3; h++) bloom[Math.floor(hash32(`${ops[s].key}b${h}`) * bm)] = true;
      for (let r = 0; r < rows; r++) cms[r][Math.floor(hash32(`${ops[s].key}c${r}`) * cm)]++;
    }
    g.text("Bloom filter (set membership)", 120, 22, { size: 11, color: pal.blue });
    for (let b = 0; b < bm; b++) {
      g.rect(24 + (b % 8) * 26, 38 + Math.floor(b / 8) * 26, 22, 22, bloom[b] ? pal.blue : pal.ink, bloom[b] ? 0.85 : 0.5, 3);
      g.frame(24 + (b % 8) * 26, 38 + Math.floor(b / 8) * 26, 22, 22, pal.line, 1, 3);
    }
    g.text("Count-Min sketch (frequencies)", 360, 22, { size: 11, color: pal.violet });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cm; c++) {
        const x = 252 + c * 22;
        const y = 38 + r * 26;
        g.rect(x, y, 20, 22, cms[r][c] ? pal.violet : pal.ink, cms[r][c] ? 0.25 + Math.min(0.6, cms[r][c] * 0.25) : 0.5, 3);
        g.frame(x, y, 20, 22, pal.line, 1, 3);
        if (cms[r][c]) g.text(String(cms[r][c]), x + 10, y + 11, { size: 10, color: pal.paper });
      }
    }
    const bpos = [0, 1, 2].map((h) => Math.floor(hash32(`${op.key}b${h}`) * bm));
    const cpos = [0, 1, 2].map((r) => Math.floor(hash32(`${op.key}c${r}`) * cm));
    if (p > 0.15 && p < 0.9) {
      bpos.forEach((b) => g.ring(24 + (b % 8) * 26 + 11, 38 + Math.floor(b / 8) * 26 + 11, 15, op.add ? pal.accent : bloom[b] ? pal.ok : pal.bad, 1, 1.8));
      cpos.forEach((c, r) => g.ring(252 + c * 22 + 10, 38 + r * 26 + 11, 15, pal.accent, 1, 1.8));
    }
    chip(g, 240, 150, op.add ? `add "${op.key}"` : `query "${op.key}" (never added)`, pal.accent, 12);
    if (!op.add) {
      const anyZero = bpos.some((b) => !bloom[b]);
      g.text(anyZero ? "a bit is 0: definitely not present" : "all bits set: maybe present (false positive)", 120, 214, { size: 11, color: anyZero ? pal.ok : pal.bad });
      const counts = cpos.map((c, r) => cms[r][c]);
      g.text(`counters ${counts.join(", ")} → estimate ${Math.min(...counts)}`, 360, 214, { size: 11, color: pal.paper });
    } else if (op.key === "cat" && i === 2) {
      const counts = cpos.map((c, r) => cms[r][c]);
      g.text(`"cat" counters ${counts.join(", ")}: count is the minimum, ${Math.min(...counts)}`, 240, 214, { size: 11, color: pal.paper });
    } else g.text("each key touches 3 positions", 240, 214, { size: 11 });
    g.text("neither stores the keys themselves", 240, 262, { size: 11 });
  },
};

const star: Scene = {
  title: "A star schema query and a materialized view",
  caption: "An analytic query joins a huge fact table to small dimension tables and aggregates. A materialized view stores the finished aggregate, so the scan over the fact table disappears.",
  controls: [{ id: "mv", kind: "toggle", label: "Materialized view", initial: false }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const mv = g.v.mv === 1;
    const T = 6;
    const t = g.t % T;
    const F = [240, 126];
    const dims = [
      { x: 90, y: 56, n: "region" },
      { x: 390, y: 56, n: "date" },
      { x: 90, y: 196, n: "product" },
      { x: 390, y: 196, n: "customer" },
    ];
    for (let k = 0; k < 90; k++) {
      const a = g.rnd(k * 3.3) * TAU;
      const r = Math.sqrt(g.rnd(k * 7.1)) * 44;
      const swept = !mv && t < 3 && ((a / TAU + 1) % 1) < t / 3;
      g.dot(F[0] + Math.cos(a) * r, F[1] + Math.sin(a) * r, 1.8, swept ? pal.accent : pal.muted, swept ? 1 : 0.55);
    }
    g.ring(F[0], F[1], 50, pal.line, 1, 1.4);
    g.text("fact table", F[0], F[1] + 66, { size: 10 });
    g.text("billions of rows", F[0], F[1] + 80, { size: 9 });
    dims.forEach((d) => {
      g.rect(d.x - 32, d.y - 14, 64, 28, pal.panel, 1, 6);
      g.frame(d.x - 32, d.y - 14, 64, 28, pal.blue, 1, 6);
      g.text(d.n, d.x, d.y, { size: 10, color: pal.paper });
      g.line(F[0], F[1], d.x, d.y, pal.blue, 0.3);
      if (!mv && t > 1 && t < 4) g.packet(F[0], F[1], d.x, d.y, ((t - 1) / 3 + dims.indexOf(d) * 0.1) % 1, pal.blue, 2.2);
    });
    const done = mv || t > 4;
    g.text("revenue by region and month", 240, 244, { size: 11, color: pal.paper });
    for (let b = 0; b < 6; b++) {
      const h = (10 + g.rnd(b * 4.4) * 30) * (done ? 1 : 0);
      g.rect(176 + b * 24, 270 - h, 18, h, pal.accent, 0.9, 3);
    }
    g.text(mv ? "answered instantly from the stored aggregate" : t < 4 ? "scanning the fact table and joining..." : "result after the full scan", 240, 286, { size: 11, color: mv ? pal.ok : pal.paper });
  },
};

const fanout: Scene = {
  title: "Fanout on write vs fanout on read",
  caption: "Pushing a post into every follower's timeline makes reads instant but one post costs as many writes as followers. Pulling at read time keeps writes cheap and makes each feed load gather from many authors.",
  controls: [
    { id: "m", kind: "choice", label: "Strategy", options: ["on write", "on read"], initial: 0 },
    { id: "f", kind: "range", label: "Followers", min: 10, max: 400, step: 10, initial: 120 },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const push = g.v.m === 0;
    const F = g.v.f;
    const T = 6;
    const t = g.t % T;
    const shown = Math.min(60, Math.round(F / 7));
    if (push) {
      server(g, 56, 130, "author", { size: 40 });
      for (let k = 0; k < shown; k++) {
        const col = k % 10;
        const row = Math.floor(k / 10);
        const x = 190 + col * 26;
        const y = 56 + row * 28;
        const reached = t > 0.6 && t > 0.6 + (k / shown) * 2.4;
        g.dot(x, y, 5, reached ? pal.ok : pal.muted, reached ? 1 : 0.5);
        if (t > 0.6 && t < 3.2) g.packet(84, 130, x, y, g.clamp((t - 0.6 - (k / shown) * 1.6) / 0.8), pal.accent, 1.6);
      }
      g.text(`one post = ${F} timeline writes`, 240, 238, { size: 14, color: F > 200 ? pal.bad : pal.accent, bold: true });
      g.text("reading a feed afterwards is a single lookup", 240, 262, { size: 11, color: pal.paper });
    } else {
      const authors = 14;
      for (let a = 0; a < authors; a++) {
        const y = 36 + a * 15;
        g.dot(60, y, 3.4, pal.muted, 0.8);
        if (t > 1 && t < 4) g.packet(60, y, 330, 130, g.clamp((t - 1 - a * 0.1) / 0.9), pal.blue, 1.8);
      }
      g.text("accounts you follow", 60, 22, { size: 10 });
      server(g, 380, 130, "your feed", { size: 44 });
      g.text("one post = 1 write", 240, 238, { size: 14, color: pal.ok, bold: true });
      g.text(`opening a feed gathers from ${authors}+ authors, every time`, 240, 262, { size: 11, color: pal.paper });
    }
  },
};

const realtime: Scene = {
  title: "Long polling, SSE and WebSocket",
  caption: "Long polling holds a request open and must reconnect after every message. Server-sent events stream one way over one connection. A WebSocket stays open and lets both sides talk freely.",
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const lanes = [
      { y: 56, n: "long polling" },
      { y: 138, n: "server-sent events" },
      { y: 220, n: "WebSocket" },
    ];
    lanes.forEach((l) => {
      g.dot(50, l.y, 7, pal.paper);
      server(g, 420, l.y, "", { size: 30 });
      g.text(l.n, 24, l.y - 26, { size: 11, color: pal.paper, align: "left", bold: true });
    });
    const t = g.t % 8;
    const cyc = (t % 2) / 2;
    g.line(60, lanes[0].y, 392, lanes[0].y, pal.line, 0.4);
    if (cyc < 0.8) {
      g.c.setLineDash([3, 5]);
      g.line(60, lanes[0].y, g.mix(60, 392, cyc / 0.8), lanes[0].y, pal.accent, 0.7, 1.4);
      g.c.setLineDash([]);
      g.text("request held open...", 220, lanes[0].y - 10, { size: 9 });
    } else {
      g.packet(392, lanes[0].y, 60, lanes[0].y, (cyc - 0.8) / 0.2, pal.ok, 3);
      g.text("response, then a new request", 220, lanes[0].y - 10, { size: 9, color: pal.ok });
    }
    g.line(60, lanes[1].y, 392, lanes[1].y, pal.accent, 0.5, 1.6);
    for (let k = 0; k < 4; k++) g.packet(392, lanes[1].y, 60, lanes[1].y, (g.t * 0.4 + k * 0.25) % 1, pal.ok, 2.6);
    g.text("one connection, events flow one way", 220, lanes[1].y - 10, { size: 9 });
    g.line(60, lanes[2].y, 392, lanes[2].y, pal.accent, 0.5, 1.6);
    for (let k = 0; k < 3; k++) g.packet(392, lanes[2].y - 4, 60, lanes[2].y - 4, (g.t * 0.4 + k * 0.33) % 1, pal.ok, 2.6);
    for (let k = 0; k < 3; k++) g.packet(60, lanes[2].y + 4, 392, lanes[2].y + 4, (g.t * 0.5 + k * 0.33 + 0.15) % 1, pal.blue, 2.6);
    g.text("one connection, both directions", 220, lanes[2].y - 14, { size: 9 });
    g.text(`reconnects so far: ${Math.floor(g.t / 2)}`, 440, 22, { size: 9, align: "right", color: pal.bad });
  },
};

const rankFeed: Scene = {
  title: "From candidates to a ranked feed",
  caption: "Hundreds of candidate posts are scored for this user and the best go on top. A diversity rule then breaks up runs from the same author so one account cannot take over the feed.",
  controls: [{ id: "div", kind: "toggle", label: "Diversity rule", initial: true }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const div = g.v.div === 1;
    const cols = [pal.accent, pal.blue, pal.ok, pal.violet];
    const cands = Array.from({ length: 24 }, (_, k) => ({ a: k % 4 === 0 ? 0 : Math.floor(g.rnd(k * 2.3) * 4), s: g.rnd(k * 6.7) }));
    const t = g.t % 8;
    cands.forEach((c, k) => {
      const x = 28 + (k % 6) * 22;
      const y = 40 + Math.floor(k / 6) * 24;
      const scored = t > 1.5;
      g.dot(x, y, 4 + (scored ? c.s * 4 : 0), cols[c.a], scored ? 0.4 + c.s * 0.6 : 0.7);
    });
    g.text("candidates", 90, 24, { size: 10 });
    g.text("scored by predicted engagement", 90, 150, { size: 9 });
    const sorted = [...cands].sort((a, b) => b.s - a.s);
    const feed: typeof cands = [];
    const pool = [...sorted];
    while (feed.length < 6 && pool.length) {
      let pick = 0;
      if (div && feed.length > 0) {
        const idx = pool.findIndex((c) => c.a !== feed[feed.length - 1].a);
        pick = idx >= 0 ? idx : 0;
      }
      feed.push(pool.splice(pick, 1)[0]);
    }
    g.text("your feed", 330, 24, { size: 10 });
    feed.forEach((c, k) => {
      const y = 46 + k * 30;
      const show = t > 3 + k * 0.4;
      if (!show) return;
      g.rect(250, y - 10, 170, 22, pal.panel, 1, 5);
      g.frame(250, y - 10, 170, 22, cols[c.a], 1, 5);
      g.text(`author ${["A", "B", "C", "D"][c.a]}`, 262, y + 1, { size: 10, color: cols[c.a], align: "left" });
      bar(g, 330, y - 2, 80, 5, c.s, cols[c.a]);
      if (t > 3 + k * 0.4 && t < 3.6 + k * 0.4) g.packet(120, 90, 250, y, (t - 3 - k * 0.4) / 0.6, cols[c.a], 2.4);
    });
    let runs = 0;
    for (let k = 1; k < feed.length; k++) if (feed[k].a === feed[k - 1].a) runs++;
    g.text(runs > 0 ? `${runs} back-to-back post${runs > 1 ? "s" : ""} from the same author` : "no author appears twice in a row", 240, 262, { size: 12, color: runs > 0 ? pal.bad : pal.ok });
  },
};

const presence: Scene = {
  title: "Presence from heartbeats",
  caption: "Each online user refreshes a short timer with a heartbeat. If the app is killed there is no goodbye, the heartbeats just stop, and the timer runs out. Press the button to kill one app.",
  controls: [
    { id: "kill", kind: "button", label: "Kill an app" },
    { id: "ttl", kind: "range", label: "Timeout", min: 2, max: 8, step: 1, initial: 5, unit: " s" },
  ],
  aspect: 0.66,
  make: () => {
    const last = [0, 0, 0, 0, 0];
    const dead = [false, false, false, false, false];
    let revive = -1;
    let nextKill = 0;
    return (g) => {
      const { pal } = g;
      if (g.pressed("kill")) {
        const k = nextKill % 5;
        nextKill++;
        dead[k] = true;
        revive = g.t + 11;
      }
      if (revive > 0 && g.t > revive) {
        dead.fill(false);
        revive = -1;
      }
      const C = [240, 135];
      server(g, C[0], C[1], "presence service", { size: 46, state: "connecting" });
      const ttl = g.v.ttl;
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 5) * TAU;
        const x = C[0] + Math.cos(a) * 110;
        const y = C[1] + Math.sin(a) * 88;
        const beat = Math.floor((g.t + k * 0.4) / 2);
        if (!dead[k]) {
          last[k] = beat * 2 - k * 0.4;
          const q = ((g.t + k * 0.4) % 2) / 2;
          if (q < 0.4) g.packet(x, y, C[0], C[1], q / 0.4, pal.ok, 2.2);
        }
        const age = Math.max(0, g.t - Math.min(g.t, last[k]));
        const left = dead[k] ? Math.max(0, 1 - age / ttl) : 1;
        const online = left > 0;
        server(g, x, y, `user ${k + 1}`, { size: 32, color: online ? pal.paper : pal.bad, ring: online ? pal.ok : pal.bad });
        arcStroke(g, x, y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, Math.max(0.001, left)), online ? pal.ok : pal.bad, 3, 0.9);
        g.text(online ? (dead[k] ? "silent..." : "online") : "offline", x, y + 44, { size: 10, color: online ? (dead[k] ? pal.accent : pal.ok) : pal.bad });
      }
      g.text("heartbeat every 2 s refills the timer ring", 240, 280, { size: 11, color: pal.paper });
    };
  },
};

const notify: Scene = {
  title: "From event to notification",
  caption: "An event passes a preference check and a dedupe step before it is fanned out to push, email or SMS. Repeats are collapsed and opted-out channels are skipped.",
  controls: [{ id: "dd", kind: "toggle", label: "Dedupe", initial: true }],
  aspect: 0.64,
  make: () => {
    type E = { born: number; id: number; dup: boolean; ch: number };
    const evs: E[] = [];
    let acc = 0;
    let n = 0;
    return (g) => {
      const { pal } = g;
      const dd = g.v.dd === 1;
      acc += g.dt * 2.6;
      while (acc >= 1) {
        acc -= 1;
        n++;
        const dup = g.rnd(n * 3.7) < 0.35;
        evs.push({ born: g.t, id: n, dup, ch: Math.floor(g.rnd(n * 8.1) * 3) });
      }
      while (evs.length && g.t - evs[0].born > 3.4) evs.shift();
      g.text("events", 34, 26, { size: 10 });
      g.rect(140, 40, 56, 190, pal.panel, 1, 8);
      g.text("prefs", 168, 32, { size: 10 });
      g.rect(210, 40, 56, 190, pal.panel, 1, 8);
      g.text("dedupe", 238, 32, { size: 10, color: dd ? pal.ok : pal.muted });
      const chans = ["push", "email", "SMS"];
      chans.forEach((c, k) => {
        g.rect(380, 52 + k * 62, 70, 40, pal.panel, 1, 6);
        g.frame(380, 52 + k * 62, 70, 40, [pal.accent, pal.blue, pal.violet][k], 1, 6);
        g.text(c, 415, 72 + k * 62, { size: 11, color: pal.paper });
      });
      let sent = 0;
      evs.forEach((e) => {
        const age = g.t - e.born;
        const y0 = 60 + g.rnd(e.id * 1.9) * 150;
        const blocked = e.id % 7 === 0;
        const dropped = dd && e.dup;
        if (age < 0.8) g.packet(40, y0, 140, y0, age / 0.8, pal.accent, 2.4);
        else if (blocked) {
          g.glow(168, y0, 16, pal.bad, 0.5 * (1 - Math.min(1, (age - 0.8) * 2)));
          if (age < 1.6) g.text("opted out", 168, y0 + 14, { size: 8, color: pal.bad });
        } else if (age < 1.7) g.packet(196, y0, 210, y0, g.clamp((age - 0.8) / 0.9), pal.accent, 2.4);
        else if (dropped) {
          g.glow(238, y0, 16, pal.muted, 0.5 * (1 - Math.min(1, (age - 1.7) * 2)));
          if (age < 2.5) g.text("duplicate", 238, y0 + 14, { size: 8, color: pal.muted });
        } else {
          sent++;
          g.packet(266, y0, 380, 72 + e.ch * 62, g.clamp((age - 1.7) / 1.2), [pal.accent, pal.blue, pal.violet][e.ch], 2.6);
        }
      });
      g.text(dd ? "repeats are collapsed before sending" : "no dedupe: a duplicate event notifies twice", 240, 268, { size: 11, color: dd ? pal.ok : pal.bad });
      void sent;
    };
  },
};

const geo: Scene = {
  title: "Finding nearby drivers",
  caption: "Scanning every driver is hopeless at city scale. A grid index buckets drivers by cell, so a search only looks in the cells that overlap the search circle.",
  controls: [
    { id: "m", kind: "choice", label: "Lookup", options: ["scan everyone", "grid index"], initial: 1 },
    { id: "r", kind: "range", label: "Radius", min: 20, max: 110, step: 10, initial: 60 },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const grid = g.v.m === 1;
    const R = g.v.r;
    const cell = 40;
    const ox = 40;
    const oy = 20;
    const w = 400;
    const h = 240;
    const rx = 240 + Math.cos(g.t * 0.4) * 60;
    const ry = 130 + Math.sin(g.t * 0.5) * 30;
    for (let x = 0; x <= w; x += cell) g.line(ox + x, oy, ox + x, oy + h, pal.line, 0.35);
    for (let y = 0; y <= h; y += cell) g.line(ox, oy + y, ox + w, oy + y, pal.line, 0.35);
    let checked = 0;
    let found = 0;
    for (let k = 0; k < 90; k++) {
      const x = ox + g.rnd(k * 3.7) * w + Math.sin(g.t * 0.5 + k) * 4;
      const y = oy + g.rnd(k * 9.1) * h + Math.cos(g.t * 0.4 + k) * 4;
      const d = Math.hypot(x - rx, y - ry);
      const cx0 = Math.floor((x - ox) / cell);
      const cy0 = Math.floor((y - oy) / cell);
      const cellNear = Math.hypot(ox + (cx0 + 0.5) * cell - rx, oy + (cy0 + 0.5) * cell - ry) < R + cell * 0.72;
      const looked = grid ? cellNear : true;
      if (looked) checked++;
      const inside = d < R;
      if (inside) found++;
      g.dot(x, y, 2.6, inside ? pal.ok : looked ? pal.accent : pal.muted, inside ? 1 : looked ? 0.9 : 0.4);
    }
    if (grid) {
      for (let cx0 = 0; cx0 < w / cell; cx0++) {
        for (let cy0 = 0; cy0 < h / cell; cy0++) {
          if (Math.hypot(ox + (cx0 + 0.5) * cell - rx, oy + (cy0 + 0.5) * cell - ry) < R + cell * 0.72) g.rect(ox + cx0 * cell + 1, oy + cy0 * cell + 1, cell - 2, cell - 2, pal.accent, 0.12, 2);
        }
      }
    }
    g.ring(rx, ry, R, pal.ok, 0.9, 1.6);
    g.dot(rx, ry, 5, pal.paper);
    g.text(`drivers examined: ${checked} of 90`, 150, 276, { size: 12, color: grid ? pal.ok : pal.bad });
    g.text(`inside the circle: ${found}`, 360, 276, { size: 12, color: pal.paper });
  },
};

const recsys: Scene = {
  title: "Collaborative filtering and the cold start",
  caption: "Users who liked the same things are neighbors, and what the neighbors liked is recommended. A brand-new user has no neighbors, so the system falls back to what is popular.",
  controls: [{ id: "m", kind: "choice", label: "Target user", options: ["has history", "new user"], initial: 0 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const newUser = g.v.m === 1;
    const users = [
      { y: 44, likes: [0, 1, 2] },
      { y: 100, likes: [0, 1, 3] },
      { y: 156, likes: [1, 2, 3] },
      { y: 212, likes: newUser ? [] : [0, 1] },
    ];
    const items = [60, 112, 164, 216].map((y) => ({ y }));
    const names = ["film A", "film B", "film C", "film D"];
    users.forEach((u, k) => {
      g.dot(90, u.y, 8, k === 3 ? pal.accent : pal.paper);
      g.text(k === 3 ? "you" : `user ${k + 1}`, 52, u.y, { size: 10, color: k === 3 ? pal.accent : pal.muted });
      u.likes.forEach((it) => g.line(90, u.y, 330, items[it].y, k === 3 ? pal.accent : pal.line, k === 3 ? 0.8 : 0.45, k === 3 ? 1.6 : 1));
    });
    items.forEach((it, k) => {
      g.rect(330, it.y - 12, 70, 24, pal.panel, 1, 5);
      g.frame(330, it.y - 12, 70, 24, pal.line, 1, 5);
      g.text(names[k], 365, it.y, { size: 10, color: pal.paper });
    });
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 3);
    if (!newUser) {
      g.line(90, 212, 90, 156, pal.ok, 0.6, 1.6);
      g.line(90, 212, 90, 100, pal.ok, 0.5, 1.2);
      g.text("neighbors", 128, 184, { size: 9, color: pal.ok });
      g.frame(326, items[2].y - 16, 78, 32, pal.ok, 0.5 + pulse * 0.5, 7, 2);
      g.glow(365, items[2].y, 40, pal.ok, 0.25 * pulse);
      g.text("recommended: film C (neighbors liked it)", 240, 258, { size: 12, color: pal.ok });
    } else {
      items.forEach((it, k) => bar(g, 410, it.y - 3, 50 * [0.9, 0.8, 0.5, 0.4][k], 6, 1, pal.accent));
      g.text("no history: recommend what is popular", 240, 258, { size: 12, color: pal.accent });
    }
  },
};

const matching: Scene = {
  title: "Greedy vs batch matching",
  caption: "Riders arrive one by one. Greedy gives each the nearest free driver on the spot. Batch waits a few seconds and picks the assignment with the least total pickup distance, even if one rider waits a little longer.",
  controls: [{ id: "m", kind: "choice", label: "Matcher", options: ["greedy", "batch"], initial: 0 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const batch = g.v.m === 1;
    const riders = [
      [90, 80],
      [170, 110],
      [300, 90],
      [380, 150],
    ];
    const drivers = [
      [130, 130],
      [210, 70],
      [330, 130],
      [400, 90],
    ];
    const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let assign: number[] = [];
    if (!batch) {
      const used = new Set<number>();
      riders.forEach((r) => {
        let best = -1;
        drivers.forEach((d, j) => {
          if (!used.has(j) && (best < 0 || dist(r, d) < dist(r, drivers[best]))) best = j;
        });
        used.add(best);
        assign.push(best);
      });
    } else {
      const perms: number[][] = [];
      const rec = (cur: number[], rest: number[]) => {
        if (!rest.length) perms.push(cur);
        rest.forEach((x, i) => rec([...cur, x], rest.filter((_, k) => k !== i)));
      };
      rec([], [0, 1, 2, 3]);
      let bestSum = Infinity;
      perms.forEach((pm) => {
        const s = pm.reduce((a, d, i) => a + dist(riders[i], drivers[d]), 0);
        if (s < bestSum) {
          bestSum = s;
          assign = pm;
        }
      });
    }
    const T = 8;
    const t = g.t % T;
    drivers.forEach((d) => g.dot(d[0], d[1] + 40, 8, pal.accent));
    riders.forEach((r) => g.dot(r[0], r[1] + 40, 7, pal.blue));
    g.text("drivers", 448, 160, { size: 9, color: pal.accent });
    g.text("riders", 448, 130, { size: 9, color: pal.blue });
    let total = 0;
    riders.forEach((r, i) => {
      const d = drivers[assign[i]];
      total += dist(r, d);
      const start = batch ? 3 : 0.8 + i * 1.3;
      const q = g.clamp((t - start) / 1.0);
      if (t >= start) {
        g.line(r[0], r[1] + 40, g.mix(r[0], d[0], q), g.mix(r[1] + 40, d[1] + 40, q), dist(r, d) > 90 ? pal.bad : pal.ok, 0.9, 1.8);
      }
    });
    const shownTotal = riders.reduce((a, r, i) => (t >= (batch ? 3 : 0.8 + i * 1.3) ? a + dist(r, drivers[assign[i]]) : a), 0);
    g.text(`total pickup distance: ${shownTotal.toFixed(0)}`, 240, 232, { size: 14, color: t > 5.5 ? (total > 240 ? pal.bad : pal.ok) : pal.paper, bold: true });
    g.text(batch ? "collected requests for a few seconds, then solved them together" : "each rider took the nearest free driver, one at a time", 240, 258, { size: 11 });
  },
};

const cdn: Scene = {
  title: "A CDN edge shortens the trip",
  caption: "The first request from a region misses the edge and travels to the far-away origin, then fills the edge. Everyone after that is served from the nearby edge in a fraction of the time.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const O = [60, 130];
    const E = [320, 130];
    const T = 10;
    const t = g.t % T;
    server(g, O[0], O[1], "origin", { size: 46, ring: pal.accent });
    server(g, E[0], E[1], "edge", { size: 42, ring: t > 3.4 ? pal.ok : undefined });
    g.line(O[0] + 28, O[1], E[0] - 26, E[1], pal.line, 0.5);
    g.c.setLineDash([3, 5]);
    g.text("~170 ms away", 190, 112, { size: 10 });
    g.c.setLineDash([]);
    const U = [
      [420, 60],
      [440, 130],
      [420, 200],
    ];
    U.forEach(([x, y]) => g.dot(x, y, 6, pal.paper));
    if (t > 3.4) chip(g, E[0], E[1] + 52, "cached /video.mp4", pal.ok, 10);
    if (t < 1.2) g.packet(U[0][0] - 8, U[0][1], E[0] + 20, E[1] - 12, t / 1.2, pal.accent);
    else if (t < 1.8) g.text("miss", E[0], E[1] - 40, { size: 12, color: pal.bad, bold: true });
    else if (t < 3.4) {
      if (t < 2.6) g.packet(E[0] - 26, E[1], O[0] + 28, O[1], (t - 1.8) / 0.8, pal.accent);
      else g.packet(O[0] + 28, O[1], E[0] - 26, E[1], (t - 2.6) / 0.8, pal.ok, 3.4);
    } else if (t < 4.4) g.packet(E[0] + 20, E[1] - 12, U[0][0] - 8, U[0][1], t - 3.4, pal.ok);
    if (t > 5) {
      const k = Math.floor((t - 5) / 1.6);
      const q = ((t - 5) % 1.6) / 1.6;
      const u = U[1 + (k % 2)];
      if (q < 0.4) g.packet(u[0] - 8, u[1], E[0] + 20, E[1], q / 0.4, pal.accent);
      else if (q < 0.8) g.packet(E[0] + 20, E[1], u[0] - 8, u[1], (q - 0.4) / 0.4, pal.ok);
    }
    g.text(t < 4.4 ? "first request: ~190 ms" : "every later request: ~20 ms, no origin traffic", 240, 262, { size: 12, color: t < 4.4 ? pal.bad : pal.ok });
  },
};

const multipart: Scene = {
  title: "Multipart upload of a large file",
  caption: "The file is cut into parts that upload in parallel. One part fails mid-way and only that part is retried. When every part is stored, the service stitches them into a single object.",
  controls: [{ id: "par", kind: "toggle", label: "Parallel parts", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const par = g.v.par === 1;
    const T = 12;
    const t = g.t % T;
    const parts = 6;
    for (let k = 0; k < parts; k++) {
      g.rect(30 + k * 38, 28, 34, 22, pal.blue, 0.85, 4);
      g.text(String(k + 1), 47 + k * 38, 39, { size: 10, color: pal.ink, bold: true });
    }
    g.text("large file", 130, 18, { size: 10 });
    g.rect(330, 80, 120, 110, pal.panel, 1, 8);
    g.frame(330, 80, 120, 110, pal.ok, 1, 8);
    g.text("object store", 390, 72, { size: 10, color: pal.ok });
    let stored = 0;
    for (let k = 0; k < parts; k++) {
      const start = par ? 0.8 + (k % 3) * 0.3 : 0.8 + k * 1.2;
      const dur = par ? 2.2 : 1.1;
      const y = 74 + (par ? k * 20 : 60);
      const fail = k === 2;
      const q = (t - start) / dur;
      const retry = fail && q >= 0.55;
      if (q >= 0 && q < 1.0) {
        const prog = fail && q > 0.5 && q < 0.75 ? 0.5 : fail && q >= 0.75 ? (q - 0.75) * 2 + 0.5 : q;
        const x = g.mix(60 + k * 38, 330, g.clamp(prog));
        g.packet(60 + k * 38, 54, 330, y, g.clamp(prog), fail && q > 0.5 && q < 0.75 ? pal.bad : pal.accent, 3);
        if (fail && q > 0.5 && q < 0.75) {
          g.text("✕ part 3 failed", 190, y - 10 + 40, { size: 10, color: pal.bad });
        }
        void x;
        void retry;
      }
      const done = q >= 1;
      if (done) stored++;
      if (done) g.rect(340 + (k % 3) * 36, 96 + Math.floor(k / 3) * 34, 30, 26, pal.blue, 0.85, 4);
    }
    const complete = t > (par ? 4.4 : 8.6);
    if (complete) {
      g.glow(390, 135, 60, pal.ok, 0.25);
      g.text("assembled into one object", 390, 212, { size: 11, color: pal.ok });
    }
    g.text(`${stored}/${parts} parts stored`, 240, 252, { size: 13, color: pal.paper });
    g.text(par ? "parts upload side by side; a failed part retries alone" : "one part at a time: slower, same retry-only-the-failure rule", 240, 276, { size: 11 });
  },
};

const images: Scene = {
  title: "Serving the right image variant",
  caption: "The browser picks the smallest variant that still looks sharp for its screen width, and a modern format shrinks the bytes further. Sending the big original to a phone wastes most of it.",
  controls: [
    { id: "w", kind: "range", label: "Screen width", min: 320, max: 1600, step: 80, initial: 640, unit: "px" },
    { id: "f", kind: "choice", label: "Format", options: ["JPEG", "WebP", "AVIF"], initial: 0 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const W = g.v.w;
    const variants = [480, 960, 1920];
    const chosen = variants.find((v) => v >= W) ?? 1920;
    const fmtK = [1, 0.62, 0.45][g.v.f];
    const kb = (v: number) => Math.round(((v * v) / 1920 / 1920) * 900 * fmtK);
    variants.forEach((v, k) => {
      const w = 40 + (v / 1920) * 90;
      const h = w * 0.66;
      const x = 28 + k * 150;
      const on = v === chosen;
      g.rect(x, 130 - h / 2, w, h, on ? pal.accent : pal.panel, on ? 0.3 : 1, 5);
      g.frame(x, 130 - h / 2, w, h, on ? pal.accent : pal.line, 1, 5, on ? 2 : 1);
      g.text(`${v}w`, x + w / 2, 130, { size: 11, color: on ? pal.accent : pal.muted, bold: on });
      g.text(`${kb(v)} KB`, x + w / 2, 130 + h / 2 + 14, { size: 10, color: on ? pal.paper : pal.muted });
    });
    const screenW = 20 + (W / 1600) * 60;
    g.rect(458 - screenW, 190, screenW, 40, pal.ink, 1, 4);
    g.frame(458 - screenW, 190, screenW, 40, pal.paper, 0.8, 4);
    g.text(`${W}px screen`, 428, 244, { size: 10 });
    g.packet(150, 130, 430 - screenW / 2, 190, g.loop(2), pal.accent, 3);
    const saved = kb(1920) - kb(chosen);
    g.text(`picked ${chosen}w: ${kb(chosen)} KB`, 150, 252, { size: 13, color: pal.ok, bold: true });
    g.text(saved > 0 ? `saves ${saved} KB against always sending the original` : "this screen needs the full size", 240, 276, { size: 11 });
    arcStroke(g, 240, 40, 0, 0, 0.0001, pal.line, 1, 0);
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/analytics-and-sketches/probabilistic-data-structures`]: bloomMemory,
  [`${P}/analytics-and-sketches/real-time-analytics-pipelines`]: lambda,
  [`${P}/analytics-and-sketches/t-digest-and-percentile-estimation`]: tdigest,
  [`${P}/analytics-and-sketches/bloom-filters-and-count-min-sketch`]: bloomCms,
  [`${P}/analytics-and-sketches/olap-vs-oltp-and-columnar-engines`]: star,
  [`${P}/realtime-social-and-feeds/fanout-strategies-for-news-feeds`]: fanout,
  [`${P}/realtime-social-and-feeds/websockets-long-polling-and-sse`]: realtime,
  [`${P}/realtime-social-and-feeds/ranking-feeds-beyond-chronological`]: rankFeed,
  [`${P}/realtime-social-and-feeds/presence-systems`]: presence,
  [`${P}/realtime-social-and-feeds/notification-delivery-at-scale`]: notify,
  [`${P}/geo-matching-and-recs/geospatial-indexing`]: geo,
  [`${P}/geo-matching-and-recs/recommendation-systems-and-collaborative-filtering`]: recsys,
  [`${P}/geo-matching-and-recs/two-sided-marketplace-matching`]: matching,
  [`${P}/media-files-and-cdn/cdns-and-content-delivery`]: cdn,
  [`${P}/media-files-and-cdn/object-storage-and-large-file-handling`]: multipart,
  [`${P}/media-files-and-cdn/image-optimization-and-responsive-delivery`]: images,
};
