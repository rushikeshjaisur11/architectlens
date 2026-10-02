import type { Scene } from "../scene/types";
import { arcStroke, bar, chip, db, fmt, hash32, server } from "./kit";

const P = "system-design";
const TAU = Math.PI * 2;

const nosqlModels: Scene = {
  title: "Three NoSQL models, three access patterns",
  caption: "Each model is built for one kind of question. A document returns a whole entity in one read, a wide-column store jumps to a partition by key, and a graph follows edges hop by hop.",
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([3.2, 3.2, 3.6]);
    const names = ["document", "wide column", "graph"];
    const notes = ["get the whole profile: 1 read", "get one partition by key: 1 lookup", "friends of friends: 2 hops, no joins"];
    names.forEach((n, k) => {
      const x = 14 + k * 156;
      const on = k === i;
      g.rect(x, 26, 140, 190, pal.panel, 1, 8);
      g.frame(x, 26, 140, 190, on ? pal.accent : pal.line, 1, 8, on ? 2 : 1);
      g.text(n, x + 70, 42, { size: 12, color: on ? pal.accent : pal.paper, bold: true });
      if (on) g.glow(x + 70, 120, 90, pal.accent, 0.08);
    });
    const a = g.ease(p < 0.5 ? p / 0.5 : 1);
    {
      const x = 24;
      g.frame(x + 8, 58, 100, 138, i === 0 ? pal.accent : pal.line, 1, 6);
      ["name: Ada", "settings { ... }", "posts [ 3 ]", "friends [ 5 ]"].forEach((s, r) => {
        const lit = i === 0 && a > r / 5;
        g.rect(x + 16, 68 + r * 30, 84, 22, lit ? pal.accent : pal.ink, lit ? 0.25 : 0.7, 4);
        g.text(s, x + 58, 79 + r * 30, { size: 9, color: pal.paper });
      });
    }
    {
      const x = 180;
      for (let r = 0; r < 5; r++) {
        const y = 66 + r * 27;
        const lit = i === 1 && r === 2;
        g.text(`u${14 + r}`, x + 12, y, { size: 9, color: lit ? pal.accent : pal.muted });
        for (let c = 0; c < 3; c++) g.rect(x + 28 + c * 36, y - 9, 32, 18, lit ? pal.accent : pal.ink, lit ? 0.3 + 0.3 * Math.sin(g.t * 6) : 0.7, 3);
      }
    }
    {
      const nodes: [number, number][] = [[400, 78], [352, 128], [452, 128], [334, 186], [380, 186], [470, 186]];
      const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5]];
      const hop = i === 2 ? (p < 0.5 ? 0 : p < 0.75 ? 1 : 2) : -1;
      edges.forEach(([u, v], k) => {
        const lit = (hop >= 0 && k === 0 && hop >= 0) || (hop >= 1 && k === 2);
        g.line(nodes[u][0], nodes[u][1], nodes[v][0], nodes[v][1], lit ? pal.accent : pal.line, 1, lit ? 2 : 1);
      });
      nodes.forEach(([nx, ny], k) => g.dot(nx, ny, 6, (hop >= 0 && k === 0) || (hop >= 1 && k === 1) || (hop >= 2 && (k === 3 || k === 4)) ? pal.accent : pal.muted, 1));
      if (hop === 0) g.packet(nodes[0][0], nodes[0][1], nodes[1][0], nodes[1][1], (p / 0.5) % 1, pal.accent);
      if (hop === 1) g.packet(nodes[1][0], nodes[1][1], nodes[3][0], nodes[3][1], ((p - 0.5) / 0.25) % 1, pal.accent);
    }
    g.text(notes[i], 240, 250, { size: 13, color: pal.paper });
  },
};

const eventual: Scene = {
  title: "How replicas catch up",
  caption: "A write lands on one replica. A read that notices a mismatch repairs the stale copy on the spot, and a background anti-entropy pass compares hash trees to heal anything reads never touched.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2.4, 3.2, 3.6]);
    const A = [240, 56];
    const B = [100, 188];
    const C = [380, 188];
    const aNew = i > 0 || p > 0.55;
    const bNew = i >= 2 || (i === 1 && p > 0.72);
    const cNew = i === 2 && p > 0.8;
    const rep = [
      { pt: A, n: "replica A", on: aNew },
      { pt: B, n: "replica B", on: bNew },
      { pt: C, n: "replica C", on: cNew },
    ];
    rep.forEach((r) => {
      server(g, r.pt[0], r.pt[1], r.n, { color: r.on ? pal.blue : pal.paper, ring: r.on ? pal.blue : undefined });
      chip(g, r.pt[0] + 64, r.pt[1], r.on ? "v2" : "v1", r.on ? pal.blue : pal.accent);
    });
    g.dot(30, 120, 6, pal.paper);
    g.text("client", 30, 138, { size: 10 });
    if (i === 0) {
      g.packet(36, 116, A[0] - 26, A[1], g.ease(p), pal.blue);
      g.text("write reaches replica A only", 240, 262, { size: 12, color: pal.paper });
    } else if (i === 1) {
      g.text("read repair", 240, 112, { size: 12, color: pal.accent, bold: true });
      if (p < 0.4) {
        g.packet(36, 120, A[0] - 22, A[1] + 14, p / 0.4, pal.paper);
        g.packet(36, 124, B[0] + 6, B[1] - 26, p / 0.4, pal.paper);
      } else if (p < 0.65) {
        g.glow(120, 128, 40, pal.bad, 0.5 * Math.sin(((p - 0.4) / 0.25) * Math.PI));
        g.text("v2 ≠ v1: mismatch", 130, 120, { size: 11, color: pal.bad });
      } else g.packet(36, 120, B[0] + 6, B[1] - 26, (p - 0.65) / 0.35, pal.blue);
      g.text("the read notices the stale copy and writes v2 back", 240, 262, { size: 12, color: pal.paper });
    } else {
      g.text("anti-entropy", 240, 120, { size: 12, color: pal.accent, bold: true });
      const hx = [A, C];
      hx.forEach((pt, k) => {
        const mx = pt[0] + (k === 0 ? 0 : 0);
        const my = pt[1] + (k === 0 ? 64 : -64);
        const same = cNew;
        g.dot(mx - 24, my, 3, pal.muted);
        g.dot(mx + 24, my, 3, pal.muted);
        g.dot(mx, my - 12 * (k === 0 ? 1 : -1), 4, k === 1 && !same ? pal.bad : pal.ok);
        g.line(mx, my - 12 * (k === 0 ? 1 : -1), mx - 24, my, pal.line);
        g.line(mx, my - 12 * (k === 0 ? 1 : -1), mx + 24, my, pal.line);
      });
      if (p < 0.5) g.packet(A[0] + 20, A[1] + 70, C[0] - 20, C[1] - 70, p / 0.5, pal.paper, 2.4);
      else if (p < 0.85) g.packet(A[0] + 26, A[1] + 12, C[0] - 26, C[1] - 12, (p - 0.5) / 0.35, pal.blue);
      g.text(p < 0.5 ? "compare hash trees: roots differ" : "descend to the stale range and copy it", 240, 262, { size: 12, color: pal.paper });
    }
  },
};

const snowflake: Scene = {
  title: "Snowflake IDs: no coordination needed",
  caption: "A 64-bit ID packs a timestamp, a machine number and a per-millisecond counter. Two machines can mint IDs in the same millisecond without ever talking, and IDs still sort by time.",
  aspect: 0.62,
  make: () => {
    type Id = { born: number; w: number; ts: number; seq: number };
    const ids: Id[] = [];
    let tick = -1;
    return (g) => {
      const { pal } = g;
      const segs = [
        { n: 1, c: pal.muted, l: "" },
        { n: 41, c: pal.blue, l: "timestamp (41)" },
        { n: 10, c: pal.violet, l: "machine (10)" },
        { n: 12, c: pal.teal, l: "sequence (12)" },
      ];
      let x = 40;
      segs.forEach((s) => {
        const w = (s.n / 64) * 400;
        g.rect(x, 28, w - 1, 22, s.c, 0.85, 3);
        if (s.l) g.text(s.l, x + w / 2, 64, { size: 9, color: s.c });
        x += w;
      });
      g.text("one 64-bit integer", 240, 14, { size: 11, color: pal.paper });
      const now = Math.floor(g.t / 0.9);
      if (now !== tick) {
        tick = now;
        const ts = 4200 + now * 3;
        ids.push({ born: g.t, w: 3, ts, seq: 0 }, { born: g.t, w: 3, ts, seq: 1 }, { born: g.t + 0.15, w: 7, ts, seq: 0 });
        while (ids.length > 9) ids.shift();
      }
      server(g, 52, 150, "machine 3", { size: 38, color: pal.violet });
      server(g, 52, 232, "machine 7", { size: 38, color: pal.blue });
      ids.forEach((id, k) => {
        const row = ids.length - 1 - k;
        const y = 98 + row * 20;
        const age = g.t - id.born;
        if (age < 0) return;
        const a = g.clamp(1 - row * 0.1);
        let bx = 130;
        segs.forEach((s) => {
          const w = (s.n / 64) * 200;
          g.rect(bx, y - 6, w - 1, 12, id.w === 7 && s.l.startsWith("machine") ? pal.blue : s.c, 0.8 * a, 2);
          bx += w;
        });
        g.text(`t+${id.ts}  m${id.w}  #${id.seq}`, 345, y, { size: 10, color: pal.paper, a, align: "left" });
        if (age < 0.4) g.packet(id.w === 3 ? 80 : 80, id.w === 3 ? 150 : 232, 130, y, g.clamp(age / 0.4), id.w === 3 ? pal.violet : pal.blue, 2);
      });
      g.text("same millisecond: the machine bits keep every ID unique", 240, 284, { size: 11, color: pal.paper });
    };
  },
};

const ringDeep: Scene = {
  title: "The ring with virtual nodes and replicas",
  caption: "Each key belongs to the first node clockwise and is also copied to the next two distinct nodes. Fail a node and only its arcs move, each handed to a different neighbor.",
  controls: [
    { id: "v", kind: "toggle", label: "Virtual nodes", initial: true },
    { id: "fail", kind: "button", label: "Fail next node" },
  ],
  aspect: 0.64,
  make: () => {
    const alive = [true, true, true, true];
    let next = 0;
    return (g) => {
      const { pal } = g;
      if (g.pressed("fail")) {
        const living = alive.filter(Boolean).length;
        if (living > 2) {
          alive[next % 4] = false;
          next++;
        } else {
          alive.fill(true);
          next = 0;
        }
      }
      const names = ["A", "B", "C", "D"];
      const cols = [pal.accent, pal.blue, pal.ok, pal.violet];
      const vn = g.v.v === 1 ? 5 : 1;
      const toks: { pos: number; n: number }[] = [];
      names.forEach((nm, n) => {
        if (!alive[n]) return;
        for (let k = 0; k < vn; k++) toks.push({ pos: hash32(vn > 1 ? `${nm}#${k}` : `node-${nm}`), n });
      });
      toks.sort((a, b) => a.pos - b.pos);
      const cx = 160;
      const cy = 142;
      const R = 100;
      const ang = (pos: number) => pos * TAU - Math.PI / 2;
      for (let k = 0; k < toks.length; k++) {
        const prev = toks[(k - 1 + toks.length) % toks.length];
        const cur = toks[k];
        let a0 = ang(prev.pos);
        let a1 = ang(cur.pos);
        if (a1 <= a0) a1 += TAU;
        const inset = Math.min(0.02, (a1 - a0) / 4);
        arcStroke(g, cx, cy, R, a0 + inset, a1 - inset, cols[cur.n], 7, 0.9);
      }
      toks.forEach((t) => g.dot(cx + R * Math.cos(ang(t.pos)), cy + R * Math.sin(ang(t.pos)), 4, cols[t.n]));
      const owner = (pos: number) => (toks.find((t) => t.pos >= pos) ?? toks[0]).n;
      const counts = [0, 0, 0, 0];
      for (let k = 0; k < 40; k++) counts[owner(hash32(`key-${k}`))]++;
      for (let k = 0; k < 40; k++) {
        const pos = hash32(`key-${k}`);
        g.dot(cx + 80 * Math.cos(ang(pos)), cy + 80 * Math.sin(ang(pos)), 2, cols[owner(pos)], 0.9);
      }
      const hk = Math.floor(g.t / 2.5) % 40;
      const hp = hash32(`key-${hk}`);
      const hx = cx + 80 * Math.cos(ang(hp));
      const hy = cy + 80 * Math.sin(ang(hp));
      g.ring(hx, hy, 6, pal.paper, 1, 1.5);
      const seen: number[] = [];
      let idx = toks.findIndex((t) => t.pos >= hp);
      if (idx < 0) idx = 0;
      for (let k = 0; k < toks.length && seen.length < 3; k++) {
        const tk = toks[(idx + k) % toks.length];
        if (!seen.includes(tk.n)) {
          seen.push(tk.n);
          g.line(hx, hy, cx + R * Math.cos(ang(tk.pos)), cy + R * Math.sin(ang(tk.pos)), cols[tk.n], 0.8, seen.length === 1 ? 2 : 1);
        }
      }
      g.text(`key-${hk}`, 340, 40, { size: 11, color: pal.paper });
      g.text(`primary: node ${names[seen[0]]}`, 340, 62, { size: 11, color: cols[seen[0]] });
      g.text(`replicas: ${seen.slice(1).map((n) => names[n]).join(", ") || "none"}`, 340, 82, { size: 11, color: pal.muted });
      names.forEach((nm, n) => {
        const y = 120 + n * 28;
        g.dot(300, y, 5, alive[n] ? cols[n] : pal.line);
        g.text(alive[n] ? `${nm}: ${counts[n]} keys` : `${nm}: down`, 316, y, { size: 11, color: alive[n] ? pal.paper : pal.bad, align: "left" });
      });
    };
  },
};

const hotPartition: Scene = {
  title: "A hot key and key salting",
  caption: "Traffic rains onto eight partitions. When one key is hot, one partition takes the load and overheats. Salting the key spreads it across all eight, at the cost of reading from all eight.",
  controls: [
    { id: "salt", kind: "toggle", label: "Salt the hot key", initial: false },
    { id: "hot", kind: "range", label: "Hot share", min: 10, max: 90, step: 5, initial: 55, unit: "%" },
  ],
  aspect: 0.64,
  make: () => {
    const load = new Array(8).fill(0);
    type D = { x: number; y: number; target: number; hot: boolean };
    const drops: D[] = [];
    let acc = 0;
    let n = 0;
    return (g) => {
      const { pal } = g;
      const salted = g.v.salt === 1;
      acc += g.dt * 30;
      while (acc >= 1) {
        acc -= 1;
        n++;
        const hot = g.rnd(n * 1.7) < g.v.hot / 100;
        const target = hot ? (salted ? Math.floor(g.rnd(n * 8.3) * 8) : 3) : Math.floor(g.rnd(n * 6.1) * 8);
        drops.push({ x: 40 + target * 55 + 24 + (g.rnd(n * 3.3) - 0.5) * 20, y: 20, target, hot });
      }
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k];
        d.y += g.dt * 240;
        if (d.y >= 188) {
          load[d.target] += 1;
          drops.splice(k, 1);
        } else g.dot(d.x, d.y, 2, d.hot ? pal.accent : pal.paper, d.hot ? 1 : 0.5);
      }
      for (let k = 0; k < 8; k++) load[k] *= 1 - g.dt * 0.9;
      const total = load.reduce((a, b) => a + b, 0) || 1;
      const mean = total / 8;
      let busiest = 0;
      for (let k = 0; k < 8; k++) {
        const h = Math.min(120, (load[k] / 22) * 120);
        const hotCol = load[k] > mean * 2;
        const x = 40 + k * 55;
        g.rect(x, 196, 48, 6, pal.line, 0.8, 2);
        g.rect(x, 196 - h, 48, h, hotCol ? pal.bad : pal.blue, 0.85, 3);
        g.text(`P${k + 1}`, x + 24, 214, { size: 10 });
        busiest = Math.max(busiest, load[k] / total);
      }
      g.text(`busiest partition: ${(busiest * 100).toFixed(0)}% of traffic  (fair share 12.5%)`, 240, 250, { size: 12, color: busiest > 0.3 ? pal.bad : pal.ok });
      g.text(salted ? "one key written as 8 sub-keys: reads must fan out" : "one key, one partition", 240, 272, { size: 11 });
    };
  },
};

const cacheAside: Scene = {
  title: "Cache-aside: miss, hit, invalidate, expire",
  caption: "The first read misses and fills the cache. The next is a hit. A write updates the database and deletes the cached copy, and a TTL expires anything no write ever invalidated.",
  aspect: 0.58,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([3.4, 2, 2.8, 3]);
    const C = [50, 120];
    const K = [200, 120];
    const D = [390, 120];
    const cached = i === 0 ? p > 0.62 : i === 1 ? true : i === 2 ? p < 0.7 : p < 0.9;
    g.dot(C[0], C[1], 8, pal.paper);
    g.text("client", C[0], C[1] + 20, { size: 11 });
    server(g, K[0], K[1], "cache", { size: 42, ring: cached ? pal.ok : undefined });
    db(g, D[0], D[1], 40, 48, pal.paper);
    g.text("database", D[0], D[1] + 40, { size: 11 });
    g.line(C[0] + 12, C[1], K[0] - 30, K[1], pal.line, 0.5);
    g.line(K[0] + 30, K[1], D[0] - 28, D[1], pal.line, 0.5);
    let ttl = 1;
    if (i === 3) ttl = 1 - p;
    if (cached) {
      chip(g, K[0], K[1] - 44, "user:7", pal.ok, 11);
      arcStroke(g, K[0], K[1], 32, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, Math.max(0.01, ttl)), pal.ok, 3, 0.9);
    }
    let msg = "";
    let ms = "";
    if (i === 0) {
      if (p < 0.2) g.packet(C[0] + 12, C[1], K[0] - 30, K[1], p / 0.2, pal.accent);
      else if (p < 0.3) {
        g.text("miss", K[0], K[1] - 44, { size: 12, color: pal.bad, bold: true });
        g.glow(K[0], K[1], 40, pal.bad, 0.3);
      } else if (p < 0.6) g.packet(K[0] + 30, K[1], D[0] - 28, D[1], (p - 0.3) / 0.3, pal.accent);
      else if (p < 0.8) g.packet(D[0] - 28, D[1], K[0] + 30, K[1], (p - 0.6) / 0.2, pal.ok);
      else g.packet(K[0] - 30, K[1], C[0] + 12, C[1], (p - 0.8) / 0.2, pal.ok);
      msg = "1  miss: read the database, then fill the cache";
      ms = "42 ms";
    } else if (i === 1) {
      if (p < 0.5) g.packet(C[0] + 12, C[1], K[0] - 30, K[1], p / 0.5, pal.accent);
      else g.packet(K[0] - 30, K[1], C[0] + 12, C[1], (p - 0.5) / 0.5, pal.ok);
      msg = "2  hit: answered from memory, database untouched";
      ms = "1 ms";
    } else if (i === 2) {
      if (p < 0.4) g.packet(C[0] + 12, C[1] + 6, D[0] - 28, D[1] + 6, p / 0.4, pal.blue);
      else if (p < 0.7) g.packet(C[0] + 12, C[1] - 6, K[0] - 30, K[1] - 6, (p - 0.4) / 0.3, pal.bad);
      else g.glow(K[0], K[1], 50, pal.bad, 0.4 * (1 - (p - 0.7) / 0.3));
      msg = "3  write: update the database, delete the cached copy";
    } else {
      msg = "4  TTL: the ring runs out and the item expires on its own";
      if (p > 0.9) g.glow(K[0], K[1], 50, pal.muted, 0.3);
    }
    g.text(msg, 240, 232, { size: 12, color: pal.paper });
    if (ms) g.text(ms, 240, 78, { size: 18, color: i === 0 ? pal.bad : pal.ok, bold: true });
  },
};

const herd: Scene = {
  title: "Thundering herd on an expired key",
  caption: "A hot cache entry expires and every waiting request misses at once. Without coalescing they all stampede the database. With it, one request refills the cache and the rest wait a moment.",
  controls: [
    { id: "co", kind: "toggle", label: "Coalescing", initial: false },
    { id: "n", kind: "range", label: "Requests", min: 5, max: 60, step: 5, initial: 30 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const co = g.v.co === 1;
    const N = g.v.n;
    const T = 8;
    const t = g.t % T;
    const K = [240, 60];
    const D = [240, 220];
    const expired = t > 1;
    const refilled = co ? t > 3.6 : t > 5.6;
    db(g, D[0], D[1], 44, 48, !co && t > 2.4 && t < 6 ? pal.bad : pal.paper);
    g.text("database", D[0] + 60, D[1], { size: 10 });
    g.rect(K[0] - 36, K[1] - 14, 72, 28, pal.panel, 1, 6);
    g.frame(K[0] - 36, K[1] - 14, 72, 28, !expired ? pal.ok : refilled ? pal.ok : pal.bad, 1, 6, 1.6);
    g.text(!expired || refilled ? "hot key" : "EXPIRED", K[0], K[1], { size: 11, color: !expired || refilled ? pal.ok : pal.bad, bold: true });
    let queries = 0;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI + Math.PI;
      const sx = 240 + Math.cos(a) * 150;
      const sy = 140 + Math.sin(a) * 40 + 20;
      const go = 1.2 + g.rnd(k * 2.7) * 0.8;
      const leader = k === 0;
      if (t < go) g.dot(sx, sy, 2.4, pal.paper, 0.7);
      else if (!co || leader) {
        queries++;
        const q = g.clamp((t - go) / 1.4);
        if (t < go + 2.8) g.packet(sx, sy, D[0], D[1] - 28, q, pal.bad, 2);
        else g.dot(sx, sy, 2.4, pal.ok, 0.9);
      } else {
        const wobble = Math.sin(g.t * 6 + k) * 2;
        if (t < 3.6) g.dot(sx + wobble, sy, 2.4, pal.accent, 0.8);
        else {
          g.dot(sx, sy, 2.4, pal.ok, 0.9);
          g.packet(K[0], K[1] + 14, sx, sy, g.clamp((t - 3.6) / 0.8), pal.ok, 1.8);
        }
      }
    }
    if (co && t > 1.2 && t < 3.6) g.text("followers wait for the leader's refill", 240, 106, { size: 11, color: pal.accent });
    g.text(`${co ? Math.min(1, queries) : queries} database quer${(co ? 1 : queries) === 1 ? "y" : "ies"}`, 240, 262, { size: 14, color: co ? pal.ok : pal.bad, bold: true });
  },
};

const multiLevel: Scene = {
  title: "Each cache layer absorbs a share of traffic",
  caption: "Requests travel left to right until some layer already has the answer. A warm browser, edge and shield leave the origin almost untouched. Cool the caches and the origin feels it.",
  controls: [{ id: "warm", kind: "range", label: "Cache warmth", min: 0, max: 100, step: 10, initial: 80, unit: "%" }],
  aspect: 0.58,
  make: () => {
    type R = { born: number; serve: number };
    const reqs: R[] = [];
    const served = [0, 0, 0, 0];
    let acc = 0;
    let n = 0;
    return (g) => {
      const { pal } = g;
      const w = g.v.warm / 100;
      acc += g.dt * 6;
      while (acc >= 1) {
        acc -= 1;
        n++;
        const u = g.rnd(n * 2.3);
        const serve = u < 0.55 * w ? 0 : u < 0.55 * w + 0.45 * 0.6 * w ? 1 : u < 0.55 * w + 0.45 * 0.6 * w + 0.15 * w ? 2 : 3;
        reqs.push({ born: g.t, serve });
      }
      const xs = [70, 185, 300, 410];
      const names = ["browser", "CDN edge", "shield", "origin"];
      xs.forEach((x, k) => {
        server(g, x, 112, names[k], { size: 40, ring: k === 3 ? pal.accent : undefined });
      });
      for (let k = reqs.length - 1; k >= 0; k--) {
        const r = reqs[k];
        const age = g.t - r.born;
        const stop = xs[r.serve];
        const x = Math.min(stop, 20 + age * 160);
        const y = 112 + (g.rnd(r.born * 9) - 0.5) * 70;
        if (x >= stop) {
          served[r.serve]++;
          g.glow(stop, 112, 30, r.serve === 3 ? pal.accent : pal.ok, 0.3);
          reqs.splice(k, 1);
          continue;
        }
        g.dot(x, y + (112 - y) * g.clamp((x - 20) / (stop - 20)), 2.4, r.serve === 3 ? pal.accent : pal.paper, 0.8);
      }
      const total = served.reduce((a, b) => a + b, 0) || 1;
      served.forEach((s, k) => {
        bar(g, xs[k] - 30, 168, 60, 6, s / total, k === 3 ? pal.accent : pal.ok);
        g.text(`${((s / total) * 100).toFixed(0)}% served`, xs[k], 188, { size: 10, color: pal.paper });
      });
      if (n % 400 === 399) served.fill(0);
      g.text(`origin sees ${((served[3] / total) * 100).toFixed(0)}% of requests`, 240, 236, { size: 13, color: served[3] / total > 0.3 ? pal.bad : pal.ok });
    };
  },
};

const writeModes: Scene = {
  title: "Write-through vs write-behind",
  caption: "Write-through updates the database before answering: slower but safe. Write-behind answers from the cache and flushes later: fast, but a cache crash loses what has not been flushed yet.",
  controls: [
    { id: "m", kind: "choice", label: "Mode", options: ["write-through", "write-behind"], initial: 0 },
    { id: "crash", kind: "button", label: "Crash the cache" },
  ],
  aspect: 0.6,
  make: () => {
    let lostAt = -10;
    let lastLost = 0;
    return (g) => {
      const { pal } = g;
      const behind = g.v.m === 1;
      const A = [50, 125];
      const K = [210, 125];
      const D = [390, 125];
      if (g.pressed("crash")) lostAt = g.t;
      const crashed = g.t - lostAt < 1.6;
      const W = 1.6;
      const k = Math.floor(g.t / W);
      const q = (g.t % W) / W;
      const flushEvery = 3;
      const dirty = behind ? Math.max(0, (k % flushEvery) + (q > 0.35 ? 1 : 0) - (k % flushEvery === 0 && q < 0.35 ? 0 : 0)) : 0;
      const shown = crashed && behind ? 0 : dirty;
      if (crashed && behind && lostAt >= 0) lastLost = Math.max(lastLost, dirty);
      g.dot(A[0], A[1], 8, pal.paper);
      g.text("app", A[0], A[1] + 20, { size: 11 });
      server(g, K[0], K[1], "cache", { size: 42, ring: crashed ? pal.bad : undefined, color: crashed ? pal.bad : pal.paper });
      db(g, D[0], D[1], 40, 48, pal.paper);
      g.text("database", D[0], D[1] + 40, { size: 11 });
      g.line(A[0] + 12, A[1], K[0] - 30, K[1], pal.line, 0.5);
      g.line(K[0] + 30, K[1], D[0] - 28, D[1], pal.line, 0.5);
      if (!behind) {
        if (q < 0.25) g.packet(A[0] + 12, A[1], K[0] - 30, K[1], q / 0.25, pal.accent);
        else if (q < 0.55) g.packet(K[0] + 30, K[1], D[0] - 28, D[1], (q - 0.25) / 0.3, pal.accent);
        else if (q < 0.7) g.packet(D[0] - 28, D[1], K[0] + 30, K[1], (q - 0.55) / 0.15, pal.ok);
        else if (q < 0.9) g.packet(K[0] - 30, K[1], A[0] + 12, A[1], (q - 0.7) / 0.2, pal.ok);
        g.text("ack after the database: ~48 ms", 240, 215, { size: 13, color: pal.paper });
        g.text("a crash loses nothing: every write is already stored", 240, 245, { size: 11, color: pal.ok });
      } else {
        if (q < 0.2) g.packet(A[0] + 12, A[1], K[0] - 30, K[1], q / 0.2, pal.accent);
        else if (q < 0.35) g.packet(K[0] - 30, K[1], A[0] + 12, A[1], (q - 0.2) / 0.15, pal.ok);
        for (let d = 0; d < shown; d++) g.dot(K[0] - 24 + d * 12, K[1] + 44, 4, pal.accent);
        if (k % flushEvery === flushEvery - 1 && q > 0.6) g.packet(K[0] + 30, K[1], D[0] - 28, D[1], (q - 0.6) / 0.4, pal.blue, 4);
        g.text("ack from memory: ~2 ms", 240, 215, { size: 13, color: pal.paper });
        g.text(crashed ? `crash: ${Math.max(1, lastLost)} unflushed write${lastLost === 1 ? "" : "s"} lost` : `${shown} write${shown === 1 ? "" : "s"} waiting to be flushed`, 240, 245, { size: 11, color: crashed ? pal.bad : pal.accent });
      }
    };
  },
};

const slots: Scene = {
  title: "Redis Cluster hash slots",
  caption: "Keys hash into 16,384 slots, and each master owns a range. After a reshard the client's map is stale: it asks the old owner, gets MOVED, and goes to the new one.",
  controls: [{ id: "re", kind: "toggle", label: "Reshard a slot range to C", initial: false }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const re = g.v.re === 1;
    const cols = [pal.accent, pal.blue, pal.ok];
    const arcs = re
      ? [[0, 0.22, 0], [0.22, 0.333, 2], [0.333, 0.667, 1], [0.667, 1, 2]]
      : [[0, 0.333, 0], [0.333, 0.667, 1], [0.667, 1, 2]];
    const cx = 120;
    const cy = 142;
    const R = 78;
    const ang = (v: number) => v * TAU - Math.PI / 2;
    arcs.forEach(([a, b, o]) => arcStroke(g, cx, cy, R, ang(a) + 0.02, ang(b) - 0.02, cols[o], 9, 0.9));
    g.text("16,384", cx, cy - 6, { size: 14, color: pal.paper, bold: true });
    g.text("slots", cx, cy + 12, { size: 10 });
    const nodes = [
      [370, 52],
      [370, 142],
      [370, 232],
    ];
    ["A", "B", "C"].forEach((n, k) => server(g, nodes[k][0], nodes[k][1], `master ${n}`, { size: 38, color: cols[k], ring: cols[k] }));
    const cl = [250, 142];
    g.dot(cl[0], cl[1], 7, pal.paper);
    g.text("client", cl[0], cl[1] + 20, { size: 10 });
    const slotPos = [0.1, 0.5, 0.29, 0.8][Math.floor(g.t / 3) % 4];
    const real = (arcs.find(([a, b]) => slotPos >= a && slotPos < b) ?? arcs[0])[2];
    const stale = slotPos < 0.333 ? 0 : slotPos < 0.667 ? 1 : 2;
    const q = (g.t % 3) / 3;
    const sx = cx + R * Math.cos(ang(slotPos));
    const sy = cy + R * Math.sin(ang(slotPos));
    g.dot(sx, sy, 5, pal.paper);
    g.glow(sx, sy, 16, pal.paper, 0.4);
    g.text(`key → slot ${Math.round(slotPos * 16383)}`, 250, 38, { size: 11, color: pal.paper });
    const to = nodes[stale];
    if (re && stale !== real) {
      if (q < 0.3) g.packet(cl[0] + 8, cl[1], to[0] - 26, to[1], q / 0.3, pal.accent);
      else if (q < 0.5) {
        g.packet(to[0] - 26, to[1], cl[0] + 8, cl[1], (q - 0.3) / 0.2, pal.bad);
        g.text(`MOVED → ${["A", "B", "C"][real]}`, 306, to[1] - 24, { size: 11, color: pal.bad });
      } else if (q < 0.8) g.packet(cl[0] + 8, cl[1], nodes[real][0] - 26, nodes[real][1], (q - 0.5) / 0.3, pal.ok);
      g.text("stale map: asked the old owner, redirected", 240, 276, { size: 11, color: pal.paper });
    } else {
      if (q < 0.5) g.packet(cl[0] + 8, cl[1], to[0] - 26, to[1], q / 0.5, pal.accent);
      else if (q < 0.9) g.packet(to[0] - 26, to[1], cl[0] + 8, cl[1], (q - 0.5) / 0.4, pal.ok);
      g.text(`slot owned by master ${["A", "B", "C"][real]}: one hop`, 240, 276, { size: 11, color: pal.paper });
    }
  },
};

const raftElection: Scene = {
  title: "Raft leader election",
  caption: "Followers wait on randomized timers. If the leader goes silent, the first timer to expire makes its node a candidate, votes flow in, and a majority makes a new leader. Kill the leader to watch it.",
  controls: [{ id: "kill", kind: "button", label: "Kill the leader" }],
  aspect: 0.68,
  make: () => {
    type N = { alive: boolean; role: number; timer: number; to: number; voted: number };
    const nodes: N[] = Array.from({ length: 5 }, (_, i) => ({ alive: true, role: i === 0 ? 2 : 0, timer: 0, to: 1.8 + i * 0.35, voted: 0 }));
    type Pk = { from: number; to: number; born: number; kind: "vote" | "grant" | "hb" };
    const pk: Pk[] = [];
    let term = 1;
    let votes = 0;
    let cand = -1;
    let hbAt = 0;
    let revive: { at: number; i: number } | null = null;
    let seed = 1;
    return (g) => {
      const { pal } = g;
      const cx = 160;
      const cy = 140;
      const R = 90;
      const pos = (k: number): [number, number] => [cx + R * Math.cos(-Math.PI / 2 + (k / 5) * TAU), cy + R * Math.sin(-Math.PI / 2 + (k / 5) * TAU)];
      if (g.pressed("kill")) {
        const l = nodes.findIndex((n) => n.alive && n.role === 2);
        if (l >= 0) {
          nodes[l].alive = false;
          nodes[l].role = 0;
          revive = { at: g.t + 7, i: l };
        }
      }
      if (revive && g.t > revive.at) {
        nodes[revive.i].alive = true;
        nodes[revive.i].timer = 0;
        revive = null;
      }
      const leader = nodes.findIndex((n) => n.alive && n.role === 2);
      if (leader >= 0 && g.t - hbAt > 0.9) {
        hbAt = g.t;
        nodes.forEach((n, k) => {
          if (k !== leader && n.alive) {
            pk.push({ from: leader, to: k, born: g.t, kind: "hb" });
            n.timer = 0;
          }
        });
      }
      nodes.forEach((n, k) => {
        if (!n.alive || n.role === 2) return;
        if (n.role === 0) n.timer += g.dt;
        if (n.role === 0 && n.timer >= n.to) {
          n.role = 1;
          n.timer = 0;
          term++;
          votes = 1;
          cand = k;
          seed++;
          n.to = 1.8 + g.rnd(seed * 7.1 + k) * 1.4;
          nodes.forEach((m, j) => {
            if (j !== k && m.alive) pk.push({ from: k, to: j, born: g.t, kind: "vote" });
          });
        }
      });
      for (let k = pk.length - 1; k >= 0; k--) {
        const q = pk[k];
        const age = g.t - q.born;
        if (age > 0.6) {
          if (q.kind === "vote" && nodes[q.to].alive && nodes[q.to].role === 0 && cand >= 0 && nodes[cand].role === 1) {
            pk.push({ from: q.to, to: q.from, born: g.t, kind: "grant" });
            nodes[q.to].timer = 0;
          } else if (q.kind === "grant" && cand >= 0 && nodes[cand].role === 1) {
            votes++;
            if (votes >= 3) {
              nodes[cand].role = 2;
              hbAt = -10;
              nodes.forEach((m) => {
                if (m.role === 1) m.role = 0;
              });
            }
          }
          pk.splice(k, 1);
          continue;
        }
        const [ax, ay] = pos(q.from);
        const [bx, by] = pos(q.to);
        g.packet(ax, ay, bx, by, age / 0.6, q.kind === "hb" ? pal.accent : q.kind === "vote" ? pal.blue : pal.ok, 2.4);
      }
      nodes.forEach((n, k) => {
        const [x, y] = pos(k);
        const col = !n.alive ? pal.bad : n.role === 2 ? pal.accent : n.role === 1 ? pal.blue : pal.paper;
        g.glow(x, y, 34, col, n.role === 2 ? 0.25 : 0.1);
        g.ring(x, y, 22, n.alive ? col : pal.bad, n.alive ? 0.9 : 0.5, 1.4);
        if (n.alive) {
          g.orb(n.role === 2 ? "composing" : n.role === 1 ? "searching" : "breathing", x, y, 34, col);
          if (n.role === 0) arcStroke(g, x, y, 27, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, n.timer / n.to), pal.muted, 2, 0.8);
        } else g.text("✕", x, y, { size: 18, color: pal.bad, bold: true });
        g.text(String(k + 1), x, y + 36, { size: 10 });
      });
      g.text(`term ${term}`, 360, 60, { size: 14, color: pal.paper, bold: true });
      const roleName = (n: N) => (!n.alive ? "down" : n.role === 2 ? "leader" : n.role === 1 ? "candidate" : "follower");
      nodes.forEach((n, k) => g.text(`node ${k + 1}: ${roleName(n)}`, 320, 96 + k * 22, { size: 11, align: "left", color: !n.alive ? pal.bad : n.role === 2 ? pal.accent : n.role === 1 ? pal.blue : pal.muted }));
      const msg = leader >= 0 ? "heartbeats keep follower timers from firing" : cand >= 0 && nodes[cand].role === 1 ? `node ${cand + 1} asks for votes (${votes}/3)` : "no heartbeats: timers are running";
      g.text(msg, 240, 288, { size: 11, color: pal.paper });
    };
  },
};

const fencing: Scene = {
  title: "Fencing tokens vs a stalled lock holder",
  caption: "Client A takes the lock, then stalls. The lease expires and B takes over and writes. When A wakes up it still believes it holds the lock. Only a fencing token lets the storage refuse it.",
  controls: [{ id: "f", kind: "toggle", label: "Fencing tokens", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const fence = g.v.f === 1;
    const T = 13;
    const t = g.t % T;
    const A = [56, 68];
    const B = [56, 218];
    const L = [222, 143];
    const S = [404, 143];
    const lease = t < 1.4 ? 0 : t < 4.4 ? (t - 1.4) / 3 : 1;
    const aPaused = t > 1.6 && t < 7.2;
    server(g, A[0], A[1], "client A", { size: 36, state: aPaused ? "breathing" : "working", color: aPaused ? pal.bad : pal.paper });
    server(g, B[0], B[1], "client B", { size: 36 });
    server(g, L[0], L[1], "lock service", { size: 40 });
    db(g, S[0], S[1], 40, 48, pal.paper);
    g.text("storage", S[0], S[1] + 40, { size: 11 });
    arcStroke(g, L[0], L[1], 30, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, 1 - lease + 0.001), lease > 0.9 ? pal.bad : pal.accent, 3, 0.9);
    const bWrote = t > 6;
    const aWrote = !fence && t > 8.6;
    chip(g, S[0], S[1] - 44, aWrote ? "A's data (stale!)" : bWrote ? "B's data" : "empty", aWrote ? pal.bad : bWrote ? pal.ok : pal.muted, 10);
    if (t < 1.4) g.packet(A[0] + 20, A[1], L[0] - 28, L[1] - 10, t / 1.4, pal.accent);
    if (t > 0.9 && t < 2.4) chip(g, 128, 104, fence ? "token 33" : "lock granted", pal.accent, 10);
    if (aPaused) g.text("A stalls (long GC pause)", 128, 40, { size: 10, color: pal.bad });
    if (t > 4.4 && t < 5.4) g.packet(B[0] + 20, B[1], L[0] - 28, L[1] + 10, t - 4.4, pal.ok);
    if (t > 4.8 && t < 6) chip(g, 128, 190, fence ? "token 34" : "lock granted", pal.ok, 10);
    if (t > 5.4 && t < 6.4) g.packet(L[0] + 28, L[1], S[0] - 26, S[1], t - 5.4, pal.ok);
    if (t > 7.2 && t < 8.6) {
      g.text("A wakes, thinks it still holds the lock", 150, 262, { size: 10, color: pal.accent });
      g.packet(A[0] + 20, A[1] + 6, S[0] - 26, S[1] - 6, (t - 7.2) / 1.4, pal.bad);
    }
    if (t > 8.6 && t < 12) {
      if (fence) {
        g.text("storage: token 33 < 34, rejected", 240, 276, { size: 12, color: pal.ok, bold: true });
        g.glow(S[0] - 30, S[1], 24, pal.bad, 0.5);
      } else g.text("storage accepted it: B's data overwritten", 240, 276, { size: 12, color: pal.bad, bold: true });
    }
  },
};

const gossip: Scene = {
  title: "Gossip: how news spreads",
  caption: "Each round every informed node tells one random peer. The informed set roughly doubles every round, so a 28-node cluster hears the news in about five rounds with no central coordinator.",
  controls: [{ id: "again", kind: "button", label: "Start again" }],
  aspect: 0.66,
  make: () => {
    const N = 28;
    let inf = new Set<number>([0]);
    let round = 0;
    let t0 = 0;
    const hist: number[] = [1];
    let pairs: [number, number][] = [];
    let full = 0;
    return (g) => {
      const { pal } = g;
      if (g.pressed("again")) {
        inf = new Set([Math.floor(g.rnd(g.t * 3) * N)]);
        round = 0;
        t0 = g.t;
        hist.length = 0;
        hist.push(1);
        pairs = [];
        full = 0;
      }
      const RT = 0.9;
      const r = Math.floor((g.t - t0) / RT);
      if (r > round) {
        for (const [, to] of pairs) inf.add(to);
        round = r;
        hist.push(inf.size);
        pairs = [];
        const cur = [...inf];
        cur.forEach((n, k) => {
          let to = Math.floor(g.rnd(r * 97 + n * 13 + k) * N);
          if (to === n) to = (to + 1) % N;
          pairs.push([n, to]);
        });
        if (inf.size >= N) full++;
        if (full > 2) {
          inf = new Set([Math.floor(g.rnd(r * 11) * N)]);
          round = 0;
          t0 = g.t;
          hist.length = 0;
          hist.push(1);
          pairs = [];
          full = 0;
        }
      } else if (pairs.length === 0 && inf.size < N) {
        const cur = [...inf];
        cur.forEach((n, k) => {
          let to = Math.floor(g.rnd(round * 97 + n * 13 + k) * N);
          if (to === n) to = (to + 1) % N;
          pairs.push([n, to]);
        });
      }
      const cx = 150;
      const cy = 142;
      const R = 100;
      const pos = (k: number): [number, number] => [cx + R * Math.cos((k / N) * TAU - Math.PI / 2), cy + R * Math.sin((k / N) * TAU - Math.PI / 2)];
      const q = ((g.t - t0) % RT) / RT;
      for (const [a, b] of pairs) {
        const [ax, ay] = pos(a);
        const [bx, by] = pos(b);
        g.line(ax, ay, bx, by, pal.accent, 0.12);
        g.packet(ax, ay, bx, by, g.clamp(q * 1.3), pal.accent, 2.2);
      }
      for (let k = 0; k < N; k++) {
        const [x, y] = pos(k);
        const on = inf.has(k);
        g.dot(x, y, on ? 5 : 3.5, on ? pal.accent : pal.muted, on ? 1 : 0.6);
        if (on) g.glow(x, y, 14, pal.accent, 0.3);
      }
      g.text(`${inf.size}/${N}`, cx, cy - 4, { size: 24, color: pal.accent, bold: true });
      g.text(`round ${round}`, cx, cy + 18, { size: 11 });
      hist.forEach((c, k) => {
        const h = (c / N) * 120;
        g.rect(310 + k * 22, 230 - h, 16, h, pal.blue, 0.85, 3);
        g.text(String(k), 318 + k * 22, 244, { size: 9 });
      });
      g.text("informed per round", 380, 78, { size: 10 });
    };
  },
};

const raftLog: Scene = {
  title: "Raft log replication",
  caption: "The leader appends an entry, sends it to followers, and commits once a majority has it. Take one follower down and the entry still commits with the other, while the dead one falls behind.",
  controls: [{ id: "down", kind: "toggle", label: "Follower 2 down", initial: false }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const down = g.v.down === 1;
    const E = 2.4;
    const total = 6;
    const tt = g.t % (E * total + 2);
    const n = Math.min(total, Math.floor(tt / E));
    const q = n < total ? (tt % E) / E : 1;
    const rows = [
      { y: 56, name: "leader" },
      { y: 138, name: "follower 1" },
      { y: 218, name: "follower 2" },
    ];
    rows.forEach((r, k) => {
      const dead = k === 2 && down;
      server(g, 46, r.y, r.name, { size: 34, color: dead ? pal.bad : pal.paper, ring: dead ? pal.bad : k === 0 ? pal.accent : undefined, state: dead ? "breathing" : "breathing" });
      for (let s = 0; s < total; s++) {
        const x = 120 + s * 56;
        let has = false;
        let committed = false;
        if (s < n) {
          has = k === 2 && down ? false : true;
          committed = true;
        } else if (s === n && n < total) {
          has = k === 0 ? q > 0.1 : k === 1 ? q > 0.55 : !down && q > 0.55;
          committed = has && q > 0.8 && (k === 0 || k === 1 || !down);
        }
        const dim = k === 2 && down;
        g.rect(x, r.y - 14, 46, 28, committed ? pal.ok : pal.ink, committed ? 0.85 : 0.6, 5);
        g.frame(x, r.y - 14, 46, 28, has ? (committed ? pal.ok : pal.accent) : pal.line, dim ? 0.4 : 1, 5, has ? 1.8 : 1);
        if (has) g.text(`e${s + 1}`, x + 23, r.y, { size: 11, color: committed ? pal.ink : pal.accent, bold: true });
      }
    }
    );
    if (n < total) {
      const x = 143 + n * 56;
      if (q > 0.2 && q < 0.55) {
        g.packet(x, 70, x, 124, (q - 0.2) / 0.35, pal.accent);
        if (!down) g.packet(x + 6, 70, x + 6, 204, (q - 0.2) / 0.35, pal.accent);
      }
      if (q > 0.6 && q < 0.8) g.packet(x, 124, x, 70, (q - 0.6) / 0.2, pal.ok);
    }
    const msg = n >= total ? "all entries committed" : q < 0.2 ? "leader appends the entry to its log" : q < 0.55 ? "sending to followers" : q < 0.8 ? "acks come back" : down ? "committed: 2 of 3 is a majority, follower 2 is lagging" : "committed: a majority has it";
    g.text(msg, 240, 272, { size: 12, color: pal.paper });
  },
};

const twoPhase: Scene = {
  title: "Two-phase commit vs a saga",
  caption: "Two-phase commit holds locks on every participant until the coordinator decides, so a coordinator crash leaves them stuck. A saga commits step by step and undoes finished steps with compensations when one fails.",
  controls: [
    { id: "m", kind: "choice", label: "Pattern", options: ["two-phase commit", "saga"], initial: 0 },
    { id: "fail", kind: "toggle", label: "Inject failure", initial: true },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const saga = g.v.m === 1;
    const fail = g.v.fail === 1;
    const T = 11;
    const t = g.t % T;
    if (!saga) {
      const Co = [240, 48];
      const Ps = [
        [80, 196],
        [240, 196],
        [400, 196],
      ];
      const crashed = fail && t > 3.2;
      server(g, Co[0], Co[1], "coordinator", { size: 40, color: crashed ? pal.bad : pal.paper, ring: crashed ? pal.bad : undefined });
      if (crashed) g.text("✕", Co[0], Co[1], { size: 22, color: pal.bad, bold: true });
      Ps.forEach(([x, y], k) => {
        const locked = t > 2.2 && (fail || t < 5.4);
        const stuck = crashed;
        server(g, x, y, `participant ${k + 1}`, { size: 36, color: stuck ? pal.bad : pal.paper });
        if (locked) chip(g, x, y - 38, stuck ? "locks held, waiting" : "locked", stuck ? pal.bad : pal.accent, 10);
        if (t < 1.4) g.packet(Co[0], Co[1] + 24, x, y - 24, t / 1.4, pal.accent);
        else if (t < 2.6) g.packet(x, y - 24, Co[0], Co[1] + 24, (t - 1.4) / 1.2, pal.ok);
        else if (!crashed && t > 3.2 && t < 4.6) g.packet(Co[0], Co[1] + 24, x, y - 24, (t - 3.2) / 1.4, pal.ok);
      });
      g.text(t < 1.4 ? "phase 1: prepare?" : t < 2.6 ? "everyone votes yes and takes locks" : crashed ? "coordinator down: nobody knows the decision" : t < 4.6 ? "phase 2: commit" : "committed, locks released", 240, 268, { size: 12, color: crashed ? pal.bad : pal.paper });
    } else {
      const steps = ["reserve", "charge", "ship"];
      const xs = [90, 240, 390];
      xs.forEach((x, k) => {
        const done = t > 1.6 + k * 1.6 && !(k === 2 && fail);
        const failed = k === 2 && fail && t > 1.6 + k * 1.6;
        const undone = fail && ((k === 1 && t > 8.2) || (k === 0 && t > 9.6));
        server(g, x, 100, steps[k], { size: 40, color: failed ? pal.bad : undone ? pal.violet : done ? pal.ok : pal.paper, ring: failed ? pal.bad : undone ? pal.violet : done ? pal.ok : undefined });
        g.text(failed ? "failed" : undone ? "undone" : done ? "committed" : "", x, 148, { size: 10, color: failed ? pal.bad : undone ? pal.violet : pal.ok });
      });
      for (let k = 0; k < 2; k++) {
        const s = 1.2 + k * 1.6;
        if (t > s && t < s + 1.2) g.packet(xs[k] + 24, 100, xs[k + 1] - 24, 100, (t - s) / 1.2, pal.ok);
      }
      if (fail) {
        if (t > 6.2 && t < 7.4) g.glow(xs[2], 100, 50, pal.bad, 0.4);
        if (t > 7 && t < 8.2) g.packet(xs[2] - 24, 128, xs[1] + 24, 128, (t - 7) / 1.2, pal.violet);
        if (t > 8.4 && t < 9.6) g.packet(xs[1] - 24, 128, xs[0] + 24, 128, (t - 8.4) / 1.2, pal.violet);
      }
      g.text(fail ? (t < 6.2 ? "each step commits on its own" : t < 7 ? "ship fails" : "compensations undo the finished steps, last first") : "each step commits on its own", 240, 210, { size: 12, color: fail && t > 6.2 ? pal.violet : pal.paper });
      g.text("no locks are held between steps, but others may see partial state", 240, 240, { size: 11 });
    }
  },
};

const vectorClocks: Scene = {
  title: "Vector clocks expose concurrency",
  caption: "Each process counts its own events and merges the counters it hears about. Compare two vectors: if neither is greater in every position, the events were concurrent and may conflict.",
  aspect: 0.68,
  make: () => (g) => {
    const { pal } = g;
    const lanes = [66, 138, 210];
    const names = ["A", "B", "C"];
    const ev = [
      { l: 0, x: 90, v: "[1,0,0]" },
      { l: 0, x: 170, v: "[2,0,0]" },
      { l: 1, x: 235, v: "[2,1,0]" },
      { l: 1, x: 330, v: "[2,2,0]" },
      { l: 2, x: 150, v: "[0,0,1]" },
      { l: 2, x: 270, v: "[0,0,2]" },
      { l: 2, x: 400, v: "[2,2,3]" },
    ];
    const msgs = [
      [1, 2],
      [3, 6],
    ];
    const shown = Math.floor((g.t % 14) / 1.05);
    lanes.forEach((y, k) => {
      g.line(40, y, 450, y, pal.line, 0.6);
      g.text(names[k], 24, y, { size: 13, color: pal.paper, bold: true });
    });
    msgs.forEach(([a, b]) => {
      if (shown > Math.max(a, b)) {
        const p1 = ev[a];
        const p2 = ev[b];
        g.arrow(p1.x, lanes[p1.l], p2.x, lanes[p2.l], pal.accent, 0.8);
      }
    });
    ev.forEach((e, k) => {
      if (shown <= k) return;
      const y = lanes[e.l];
      const concurrent = shown >= 8 && (k === 3 || k === 5);
      g.dot(e.x, y, concurrent ? 6.5 : 5, concurrent ? pal.bad : pal.accent);
      if (concurrent) g.glow(e.x, y, 22, pal.bad, 0.4);
      g.text(e.v, e.x, y + (e.l === 2 ? 20 : -16), { size: 10, color: concurrent ? pal.bad : pal.paper });
    });
    if (shown >= 8) {
      g.line(330, lanes[1], 270, lanes[2], pal.bad, 0.7, 1.4);
      chip(g, 240, 262, "[2,2,0] vs [0,0,2]: neither dominates, so concurrent", pal.bad, 11);
    } else g.text("events and messages appear in order", 240, 262, { size: 11 });
    void db;
    void fmt;
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/nosql-partitioning-and-ids/nosql-data-models-document-vs-columnar-vs-graph`]: nosqlModels,
  [`${P}/nosql-partitioning-and-ids/eventual-consistency-in-practice`]: eventual,
  [`${P}/nosql-partitioning-and-ids/distributed-id-generation`]: snowflake,
  [`${P}/nosql-partitioning-and-ids/consistent-hashing-in-depth`]: ringDeep,
  [`${P}/nosql-partitioning-and-ids/hot-partition-mitigation-and-rebalancing`]: hotPartition,
  [`${P}/caching-and-fast-reads/caching-strategies-and-invalidation`]: cacheAside,
  [`${P}/caching-and-fast-reads/cache-eviction-and-thundering-herd`]: herd,
  [`${P}/caching-and-fast-reads/multi-level-caching-and-cdn-hierarchies`]: multiLevel,
  [`${P}/caching-and-fast-reads/cache-aside-write-through-write-behind`]: writeModes,
  [`${P}/caching-and-fast-reads/distributed-cache-coherence`]: slots,
  [`${P}/distributed-coordination/consensus-and-leader-election`]: raftElection,
  [`${P}/distributed-coordination/distributed-locks`]: fencing,
  [`${P}/distributed-coordination/gossip-protocols-and-failure-detection`]: gossip,
  [`${P}/distributed-coordination/raft-vs-paxos-walkthrough`]: raftLog,
  [`${P}/distributed-coordination/distributed-transactions-2pc-saga`]: twoPhase,
  [`${P}/distributed-coordination/clock-synchronization`]: vectorClocks,
};
