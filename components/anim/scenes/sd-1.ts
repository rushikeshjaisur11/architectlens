import type { Scene } from "../scene/types";
import { bar, chip, fmt, server } from "./kit";

const P = "system-design";

const cap: Scene = {
  title: "CAP: a partition forces a choice",
  caption: "Cut the link between the nodes and pick what to give up. A CP system refuses the write and stays consistent. An AP system accepts it and lets the nodes disagree.",
  controls: [
    { id: "part", kind: "choice", label: "Network", options: ["healthy", "partitioned"], initial: 0 },
    { id: "mode", kind: "choice", label: "On partition", options: ["CP", "AP"], initial: 0 },
  ],
  make: () => (g) => {
    const { pal } = g;
    const A = [100, 100];
    const B = [380, 100];
    const C = [240, 238];
    const part = g.v.part === 1;
    const ap = g.v.mode === 1;
    const { i, p } = g.stage([2.4, 2.6, 2.4]);
    const mid = (A[0] + B[0]) / 2;
    const aNew = (!part || ap) && (i >= 1 || (i === 0 && p > 0.85));
    const bNew = !part && (i === 2 || (i === 1 && p > 0.85));

    g.line(C[0], C[1] - 12, A[0] + 10, A[1] + 34, pal.line, 0.5);
    g.line(C[0], C[1] - 12, B[0] - 10, B[1] + 34, pal.line, 0.5);
    g.c.setLineDash(part ? [4, 5] : []);
    g.line(A[0] + 32, A[1], B[0] - 32, B[1], part ? pal.bad : pal.line, part ? 0.7 : 1, 1.4);
    g.c.setLineDash([]);
    if (part) g.text("✕", mid, A[1], { size: 20, color: pal.bad, bold: true });

    server(g, A[0], A[1], "node A", { color: aNew ? pal.blue : pal.paper, ring: aNew ? pal.blue : undefined, state: i === 0 && p < 0.85 ? "listening" : "breathing" });
    server(g, B[0], B[1], "node B", { color: bNew ? pal.blue : pal.paper, ring: bNew ? pal.blue : undefined });
    chip(g, A[0], A[1] + 62, aNew ? "x = 2" : "x = 1", aNew ? pal.blue : pal.accent);
    chip(g, B[0], B[1] + 62, bNew ? "x = 2" : "x = 1", bNew ? pal.blue : pal.accent);
    g.dot(C[0], C[1], 6, pal.paper);
    g.text("client", C[0], C[1] + 20, { size: 11 });

    let msg = "";
    if (i === 0) {
      g.packet(C[0], C[1] - 12, A[0] + 8, A[1] + 36, g.ease(p), pal.accent);
      msg = "client writes x = 2 to node A";
    } else if (i === 1) {
      if (!part) {
        g.packet(A[0] + 34, A[1], B[0] - 34, B[1], g.ease(p), pal.blue);
        msg = "A replicates to B before answering";
      } else {
        if (p < 0.55) g.packet(A[0] + 34, A[1], mid, A[1], p / 0.55, pal.blue);
        else g.glow(mid, A[1], 26 * (1 - (p - 0.55)), pal.bad, 0.5 * (1 - (p - 0.55)));
        if (p > 0.5) g.packet(A[0] + 8, A[1] + 36, C[0], C[1] - 12, (p - 0.5) / 0.5, ap ? pal.ok : pal.bad);
        msg = ap ? "replication blocked, A answers ok anyway" : "replication blocked, A refuses the write";
      }
    } else {
      const to = p < 0.5;
      const stale = part && ap;
      if (to) g.packet(C[0], C[1] - 12, B[0] - 8, B[1] + 36, p / 0.5, pal.accent);
      else g.packet(B[0] - 8, B[1] + 36, C[0], C[1] - 12, (p - 0.5) / 0.5, stale ? pal.bad : bNew ? pal.blue : pal.accent);
      msg = stale ? "read from B returns x = 1: stale" : part ? "read from B returns x = 1: consistent, write was refused" : "read from B returns x = 2: everyone agrees";
    }
    g.text(msg, 240, 282, { size: 12, color: part && ap && i === 2 ? pal.bad : pal.paper });
  },
};

const estimation: Scene = {
  title: "Estimation: from users to servers",
  caption: "Drag the user count. Average requests per second, peak (3x) and servers needed all follow from one number, using 20 requests per user per day and 1,000 requests per second per server.",
  controls: [{ id: "e", kind: "range", label: "Daily users 10^", min: 3, max: 9, step: 0.5, initial: 7 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const dau = 10 ** g.v.e;
    const qps = (dau * 20) / 86400;
    const peak = qps * 3;
    const servers = Math.max(1, Math.ceil(peak / 1000));
    const stream = Math.round(Math.min(40, 3 + 4 * Math.log10(qps + 1)));
    const crowd = Math.round(Math.min(90, 12 + 9 * (g.v.e - 2)));

    for (let k = 0; k < crowd; k++) {
      const x = 28 + g.rnd(k * 3.1) * 70 + Math.sin(g.t * 0.6 + k) * 3;
      const y = 40 + g.rnd(k * 7.7) * 150 + Math.cos(g.t * 0.5 + k * 1.3) * 3;
      g.dot(x, y, 1.8, pal.paper, 0.75);
    }
    g.text(`${fmt(dau)} users/day`, 62, 212, { size: 12, color: pal.paper });

    for (let k = 0; k < stream; k++) {
      const y = 50 + g.rnd(k * 5.3) * 140;
      const speed = 0.35 + g.rnd(k * 2.9) * 0.3;
      g.packet(105, y, 300, 115 + (y - 115) * 0.25, (g.t * speed + g.rnd(k)) % 1, pal.accent, 2.2);
    }

    const shown = Math.min(servers, 24);
    for (let k = 0; k < shown; k++) {
      const col = k % 6;
      const row = Math.floor(k / 6);
      server(g, 322 + col * 25, 50 + row * 30, "", { size: 22 });
    }
    if (servers > shown) g.text(`+${fmt(servers - shown)} more`, 395, 178, { size: 12, color: pal.accent });
    g.text(`${servers} server${servers > 1 ? "s" : ""}`, 395, 200, { size: 12, color: pal.paper });

    const gb = (dau * 2000) / 1e9;
    g.text("storage / day", 62, 252, { size: 11 });
    bar(g, 112, 247, 250, 8, Math.log10(gb + 1) / 4, pal.blue);
    g.text(`${fmt(gb)} GB`, 410, 251, { size: 11, color: pal.paper });
    g.text(`${fmt(qps)} req/s average  ·  ${fmt(peak)} req/s at peak`, 240, 285, { size: 12, color: pal.paper });
  },
};

const nines: Scene = {
  title: "Availability: a thousand requests",
  caption: "Each dot is a request. Red ones hit downtime. Adding a nine makes failures ten times rarer, and putting five services in series multiplies the chances of a bad dot.",
  controls: [
    { id: "n", kind: "range", label: "Nines", min: 1, max: 5, step: 0.5, initial: 2 },
    { id: "chain", kind: "toggle", label: "5 services in series" },
  ],
  aspect: 0.7,
  make: () => (g) => {
    const { pal } = g;
    const a = 1 - 10 ** -g.v.n;
    const eff = g.v.chain === 1 ? a ** 5 : a;
    const fail = 1 - eff;
    const bucket = Math.floor(g.t * 1.2);
    let bad = 0;
    for (let k = 0; k < 1000; k++) {
      const col = k % 50;
      const row = Math.floor(k / 50);
      const x = 40 + col * 8.8;
      const y = 40 + row * 8.8;
      const failing = g.rnd(k * 13.7 + bucket * 91.3) < fail;
      if (failing) bad++;
      g.dot(x, y, failing ? 3 : 2, failing ? pal.bad : pal.paper, failing ? 1 : 0.55);
      if (failing) g.glow(x, y, 10, pal.bad, 0.35);
    }
    const secs = fail * 365 * 86400;
    const dur = secs >= 86400 ? `${(secs / 86400).toFixed(1)} days` : secs >= 3600 ? `${(secs / 3600).toFixed(1)} hours` : secs >= 60 ? `${(secs / 60).toFixed(1)} minutes` : `${secs.toFixed(1)} seconds`;
    g.text(`${(eff * 100).toFixed(eff > 0.999 ? 4 : 2)}% available`, 240, 255, { size: 20, color: pal.accent, bold: true });
    g.text(`${bad} of 1000 failed now  ·  about ${dur} down per year`, 240, 285, { size: 12, color: pal.paper });
  },
};

const latency: Scene = {
  title: "Latency numbers on a human clock",
  caption: "If one nanosecond lasted one second, a memory read would take under two minutes, but one cross-continent round trip would take almost five years. The cursor sweeps a log time axis.",
  aspect: 0.58,
  make: () => (g) => {
    const { pal } = g;
    const ops = [
      { name: "L1 cache", ns: 0.5 },
      { name: "RAM read", ns: 100 },
      { name: "SSD read", ns: 100000 },
      { name: "same-DC round trip", ns: 500000 },
      { name: "cross-continent", ns: 150e6 },
    ];
    const lo = -0.5;
    const hi = 8.5;
    const X = (ns: number) => 36 + ((Math.log10(ns) - lo) / (hi - lo)) * 408;
    const human = (s: number) => (s < 90 ? `${s.toFixed(s < 10 ? 1 : 0)} s` : s < 5400 ? `${(s / 60).toFixed(0)} min` : s < 172800 ? `${(s / 3600).toFixed(0)} hours` : s < 86400 * 400 ? `${(s / 86400).toFixed(0)} days` : `${(s / 86400 / 365).toFixed(1)} years`);
    const cur = 36 + g.loop(9) * 408;
    g.line(36, 250, 444, 250, pal.line);
    for (let d = 0; d <= 8; d += 2) {
      const x = X(10 ** d);
      g.line(x, 246, x, 254, pal.line);
      g.text(d === 0 ? "1 ns" : d === 3 ? "1 µs" : d === 6 ? "1 ms" : `10^${d}`, x, 266, { size: 10 });
    }
    ops.forEach((o, k) => {
      const y = 40 + k * 38;
      const x = X(o.ns);
      const lit = cur >= x;
      g.line(36, y, 444, y, pal.line, 0.25);
      g.line(36, y, Math.min(cur, x), y, pal.accent, lit ? 0.9 : 0.4, 1.6);
      g.dot(x, y, lit ? 5 : 3, lit ? pal.accent : pal.muted, lit ? 1 : 0.6);
      if (lit) g.glow(x, y, 20, pal.accent, 0.35);
      const right = x < 280;
      g.text(`${o.name}`, right ? x + 12 : x - 12, y - 8, { size: 11, color: lit ? pal.paper : pal.muted, align: right ? "left" : "right" });
      g.text(lit ? human(o.ns) : "", right ? x + 12 : x - 12, y + 9, { size: 12, color: pal.accent, align: right ? "left" : "right", bold: true });
    });
    g.line(cur, 28, cur, 250, pal.paper, 0.5, 1);
  },
};

const consistency: Scene = {
  title: "Strong vs eventual consistency",
  caption: "A write reaches replica 1 first and replica 2 later. A strong system waits for both before it acknowledges. An eventual one answers early, so a read after the ack can still return the old value.",
  controls: [{ id: "m", kind: "choice", label: "Model", options: ["strong", "eventual"], initial: 1 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const strong = g.v.m === 0;
    const T = 7;
    const t = g.t % T;
    const W = [48, 125];
    const R1 = [190, 64];
    const R2 = [190, 190];
    const Rd = [432, 190];
    const r1At = 0.7;
    const r2At = 2.9;
    const ackAt = strong ? r2At + 0.5 : r1At + 0.2;
    const r1New = t >= r1At;
    const r2New = t >= r2At;

    g.line(R1[0], R1[1] + 30, R2[0], R2[1] - 30, pal.line, 0.6);
    server(g, W[0], W[1], "writer", { state: t < ackAt ? "working" : "breathing", size: 38 });
    server(g, R1[0], R1[1], "replica 1", { color: r1New ? pal.blue : pal.paper, ring: r1New ? pal.blue : undefined });
    server(g, R2[0], R2[1], "replica 2", { color: r2New ? pal.blue : pal.paper, ring: r2New ? pal.blue : undefined });
    server(g, Rd[0], Rd[1], "reader", { size: 38 });
    chip(g, R1[0] + 62, R1[1], r1New ? "v2" : "v1", r1New ? pal.blue : pal.accent);
    chip(g, R2[0] + 62, R2[1], r2New ? "v2" : "v1", r2New ? pal.blue : pal.accent);

    if (t < r1At) g.packet(W[0] + 24, W[1] - 10, R1[0] - 24, R1[1] + 6, t / r1At, pal.accent);
    if (t >= r1At && t < r2At) g.packet(R1[0], R1[1] + 30, R2[0], R2[1] - 30, (t - r1At) / (r2At - r1At), pal.blue);
    if (t >= ackAt && t < ackAt + 0.7) g.packet(R1[0] - 24, R1[1] + 8, W[0] + 24, W[1] - 8, (t - ackAt) / 0.7, pal.ok);
    g.text(t >= ackAt ? "ack received" : "waiting for ack", W[0], W[1] + 56, { size: 10, color: t >= ackAt ? pal.ok : pal.muted });

    const readAt = 1.9;
    if (t >= readAt && t < readAt + 1.1) {
      const q = (t - readAt) / 1.1;
      if (q < 0.5) g.packet(Rd[0] - 22, Rd[1], R2[0] + 24, R2[1], q / 0.5, pal.paper);
      else g.packet(R2[0] + 24, R2[1], Rd[0] - 22, Rd[1], (q - 0.5) / 0.5, pal.accent);
    }
    const readAt2 = 4.4;
    if (t >= readAt2 && t < readAt2 + 1.1) {
      const q = (t - readAt2) / 1.1;
      if (q < 0.5) g.packet(Rd[0] - 22, Rd[1], R2[0] + 24, R2[1], q / 0.5, pal.paper);
      else g.packet(R2[0] + 24, R2[1], Rd[0] - 22, Rd[1], (q - 0.5) / 0.5, pal.blue);
    }
    let note = "";
    if (t >= readAt + 0.6 && t < readAt + 1.8) note = strong ? "read before the ack: v1 is allowed" : "read after the ack returns v1: stale";
    else if (t >= readAt2 + 0.6) note = "read returns v2";
    else if (t >= r1At && t < r2At) note = strong ? "write held until replica 2 has it" : "ack sent early, replica 2 still copying";
    g.text(note, 300, 276, { size: 12, color: note.includes("stale") ? pal.bad : pal.paper });
  },
};

const scaling: Scene = {
  title: "Scale up or scale out",
  caption: "One bigger machine is simple until it hits a ceiling and the excess load queues. Many small machines keep growing but need coordination between them, drawn here as links.",
  controls: [{ id: "load", kind: "range", label: "Load", min: 1, max: 64, step: 1, initial: 20, unit: "x" }],
  aspect: 0.58,
  make: () => (g) => {
    const { pal } = g;
    const load = g.v.load;
    const ceiling = 16;
    const over = Math.max(0, load - ceiling);
    const cx = 120;
    const cy = 112;
    const size = 34 + 50 * Math.min(1, load / ceiling);
    const hot = over > 0;
    g.ring(cx, cy, 56, pal.line, 0.8, 4);
    g.c.strokeStyle = hot ? pal.bad : pal.accent;
    g.c.lineWidth = 4;
    g.c.lineCap = "round";
    g.c.beginPath();
    g.c.arc(cx, cy, 56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(0.9999, load / ceiling));
    g.c.stroke();
    g.c.lineCap = "butt";
    g.glow(cx, cy, 70, hot ? pal.bad : pal.accent, 0.18);
    g.orb(hot ? "working" : "breathing", cx, cy, size, hot ? pal.bad : pal.paper, 1 + load / 30);
    g.text("one big machine", cx, 188, { size: 12, color: pal.paper });
    for (let k = 0; k < Math.min(60, over); k++) {
      const a = (k / 60) * Math.PI * 2 + g.t * 0.5;
      const r = 68 + (k % 3) * 6;
      g.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, pal.bad, 0.85);
    }
    g.text(hot ? `ceiling hit: ${over}x of load is queuing` : `${Math.round((load / ceiling) * 100)}% of the hardware ceiling`, cx, 210, { size: 11, color: hot ? pal.bad : pal.muted });

    const n = Math.min(16, Math.max(1, Math.ceil(load / 4)));
    const cols = Math.min(4, n);
    const rows = Math.ceil(n / cols);
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) pts.push([312 + (k % cols) * 44 - ((cols - 1) * 44) / 2 + 66, 112 + Math.floor(k / cols) * 44 - ((rows - 1) * 44) / 2]);
    let links = 0;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]) < 70) {
          g.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], pal.accent, 0.3);
          links++;
        }
      }
    }
    pts.forEach(([x, y], k) => server(g, x, y, "", { size: 28, ring: k === 0 ? pal.ok : undefined }));
    g.text(`${n} small machines`, 378, 188, { size: 12, color: pal.paper });
    g.text(`${links} coordination links`, 378, 210, { size: 11, color: pal.accent });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/foundations/cap-theorem`]: cap,
  [`${P}/foundations/back-of-envelope-estimation`]: estimation,
  [`${P}/foundations/availability-and-the-nines`]: nines,
  [`${P}/foundations/latency-numbers-every-engineer-should-know`]: latency,
  [`${P}/foundations/consistency-models-overview`]: consistency,
  [`${P}/foundations/vertical-vs-horizontal-scaling-tradeoffs`]: scaling,
};
