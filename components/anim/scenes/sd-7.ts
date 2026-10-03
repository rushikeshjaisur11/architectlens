import type { Scene } from "../scene/types";
import { arcStroke, bar, chip, hash32, server } from "./kit";

const P = "system-design";

const rtb: Scene = {
  title: "Real-time bidding: the auction against the clock",
  caption: "The exchange sends one bid request to five bidders at once. Each answers after its own delay, and anything slower than the timeout line is ignored. Tighten the timeout and the best bidder may be dropped, then pick who pays what.",
  controls: [
    { id: "to", kind: "range", label: "Timeout (ms)", min: 20, max: 120, step: 5, initial: 60 },
    { id: "a", kind: "choice", label: "Auction", options: ["first-price", "second-price"], initial: 1 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const lat = [25, 40, 55, 70, 95];
    const bid = [1.2, 2, 2.8, 1.9, 3.5];
    const T = g.v.to;
    const x0 = 100;
    const xOf = (ms: number) => x0 + (ms / 130) * 340;
    const cur = (g.t * 45) % 170;
    server(g, 40, 130, "exchange", { size: 38, state: "weaving" });
    const ok = lat.map((l) => l <= T);
    lat.forEach((l, k) => {
      const y = 44 + k * 38;
      g.text(`DSP ${"ABCDE"[k]}`, 70, y + 4, { size: 10, color: ok[k] ? pal.paper : pal.muted });
      g.rect(x0, y, 340, 8, pal.line, 0.15, 4);
      g.rect(x0, y, Math.max(0, xOf(Math.min(cur, l)) - x0), 8, ok[k] ? pal.blue : pal.bad, 0.8, 4);
      if (cur >= l) {
        g.dot(xOf(l), y + 4, 5, ok[k] ? pal.ok : pal.bad);
        g.text(ok[k] ? `$${bid[k].toFixed(1)}` : "late", xOf(l) + 22, y + 4, { size: 10, color: ok[k] ? pal.paper : pal.bad });
      }
    });
    g.c.setLineDash([4, 4]);
    g.line(xOf(T), 30, xOf(T), 232, pal.bad, 0.9, 1.4);
    g.c.setLineDash([]);
    g.text(`${T} ms`, xOf(T), 244, { size: 10, color: pal.bad });
    const live = bid.map((b, k) => (ok[k] ? b : -1));
    const win = live.indexOf(Math.max(...live));
    const sorted = live.filter((b) => b > 0).sort((a, b) => b - a);
    const pay = g.v.a === 1 ? (sorted[1] ?? 0.5) : sorted[0];
    g.text(win < 0 ? "no bid arrived in time: slot unsold" : `winner DSP ${"ABCDE"[win]} pays $${pay.toFixed(2)} CPM`, 240, 280, { size: 12, color: win < 0 ? pal.bad : pal.ok });
  },
};

const eta: Scene = {
  title: "ETA: the routing baseline and the correction",
  caption: "The router finds the path and a free-flow time per segment. Live speeds and time of day scale each segment, and the learned correction is the gap between the two bars. Congestion on two segments moves the ETA far more than their length suggests.",
  controls: [{ id: "m", kind: "choice", label: "Estimate", options: ["free-flow baseline", "with live traffic"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const pts: [number, number][] = [[36, 190], [120, 140], [200, 150], [280, 90], [360, 110], [446, 60]];
    const base = [2, 1.5, 2, 1.5, 1];
    const fac = [1.1, 1.4, 2.6, 2, 1.2];
    const live = g.v.m === 1;
    let tot = 0;
    let tb = 0;
    for (let k = 0; k < 5; k++) {
      const f = live ? fac[k] : 1;
      tot += base[k] * f;
      tb += base[k];
      const col = f > 2 ? pal.bad : f > 1.3 ? pal.accent : pal.ok;
      g.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], col, 1, 5);
      g.text(`${(base[k] * f).toFixed(1)}m`, (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2 - 14, { size: 10, color: pal.paper });
    }
    pts.forEach((p) => g.dot(p[0], p[1], 4, pal.paper));
    const u = (g.t * 0.18) % 1;
    const seg = Math.min(4, Math.floor(u * 5));
    const f = u * 5 - seg;
    g.orb("working", g.mix(pts[seg][0], pts[seg + 1][0], f), g.mix(pts[seg][1], pts[seg + 1][1], f), 24, pal.paper, 1);
    g.text("baseline", 50, 238, { size: 11, align: "left" });
    bar(g, 120, 233, 280, 8, tb / 14, pal.blue);
    g.text(`${tb.toFixed(1)} min`, 440, 238, { size: 11, color: pal.paper });
    g.text("ETA shown", 50, 262, { size: 11, align: "left" });
    bar(g, 120, 257, 280, 8, tot / 14, live ? pal.accent : pal.blue);
    g.text(`${tot.toFixed(1)} min`, 440, 262, { size: 11, color: pal.paper });
  },
};

const abr: Scene = {
  title: "Adaptive bitrate: following the bandwidth",
  caption: "The blue line is the viewer's bandwidth, dipping like a train entering a tunnel. A fixed 6 Mbps stream stalls whenever the line falls below it (red). The adaptive player steps down the ladder before that happens and climbs back afterwards.",
  controls: [{ id: "m", kind: "choice", label: "Player", options: ["fixed 1080p", "adaptive"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ladder = [0.4, 1.2, 3, 6];
    const bw = (t: number) => 5.5 + 1.6 * Math.sin(t * 0.5) - 5 * Math.exp(-(((t - 18) / 3) ** 2));
    const x0 = 36;
    const sx = 410 / 30;
    const y = (v: number) => 205 - v * 22;
    const cursor = (g.t * 3) % 30;
    let stall = 0;
    let pb: [number, number] | null = null;
    let pr: [number, number] | null = null;
    for (let t = 0; t <= cursor; t += 0.25) {
      const b = Math.max(0.2, bw(t));
      let r = 6;
      if (g.v.m === 1) {
        r = ladder[0];
        ladder.forEach((l) => {
          if (l <= b * 0.8) r = l;
        });
      }
      const x = x0 + t * sx;
      if (r > b) {
        stall += 0.25;
        g.rect(x, 40, sx * 0.25 + 0.5, 165, pal.bad, 0.18, 0);
      }
      if (pb && pr) {
        g.line(pb[0], pb[1], x, y(b), pal.blue, 1, 2);
        g.line(pr[0], pr[1], x, y(r), pal.accent, 1, 2);
      }
      pb = [x, y(b)];
      pr = [x, y(r)];
    }
    g.line(x0, 205, 446, 205, pal.line, 1, 1.2);
    g.text("bandwidth", 100, 38, { size: 10, color: pal.blue });
    g.text("chosen bitrate", 200, 38, { size: 10, color: pal.accent });
    g.orb(stall > 0.5 ? "searching" : "working", 450, 36, 24, pal.paper, 1);
    g.text(stall > 0.5 ? `stalled ${stall.toFixed(1)} s` : "no stalls so far", 240, 240, { size: 13, color: stall > 0.5 ? pal.bad : pal.ok });
    g.text("ladder: 0.4 / 1.2 / 3 / 6 Mbps, step down below 80% of bandwidth", 240, 268, { size: 10, color: pal.muted });
  },
};

const chunked: Scene = {
  title: "Chunked and resumable upload",
  caption: "A 16-part upload loses its connection after part 10. A resumable session remembers which parts arrived and sends only the missing six. Without it the client starts over and pays for the same ten parts twice.",
  controls: [{ id: "r", kind: "toggle", label: "Resumable session", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const res = g.v.r === 1;
    const t = g.t % 16;
    let done: number;
    let status = "uploading";
    if (t < 5) done = Math.min(10, Math.floor(t * 2.2));
    else if (t < 7) {
      done = res ? 10 : 10;
      status = "connection lost";
    } else if (res) done = Math.min(16, 10 + Math.floor((t - 7) * 2.2));
    else done = Math.min(16, Math.floor((t - 7) * 1.8));
    if (!res && t >= 7 && t < 7.4) done = 0;
    if (done >= 16) status = "complete";
    const sent = res ? Math.min(16, Math.max(done, 10)) : t < 7 ? done : 10 + done;
    g.orb("working", 44, 70, 34, pal.paper, 1);
    g.text("client", 44, 100, { size: 10, color: pal.muted });
    g.rect(396, 44, 70, 54, pal.teal, 0.14, 8);
    g.frame(396, 44, 70, 54, pal.teal, 1, 8, 1.2);
    g.text("object store", 431, 71, { size: 10, color: pal.paper });
    for (let k = 0; k < 16; k++) {
      const x = 90 + (k % 8) * 34;
      const y = 130 + Math.floor(k / 8) * 34;
      const have = k < done;
      g.rect(x, y, 30, 28, have ? pal.ok : pal.line, have ? 0.55 : 0.12, 5);
      g.text(String(k + 1), x + 15, y + 14, { size: 10, color: pal.paper });
    }
    if (status === "uploading") for (let k = 0; k < 3; k++) g.packet(80, 70, 390, 70, (g.t * 0.8 + k / 3) % 1, pal.accent, 2.4);
    if (status === "connection lost") g.text("✕", 240, 70, { size: 24, color: pal.bad });
    chip(g, 240, 36, status, status === "complete" ? pal.ok : status === "connection lost" ? pal.bad : pal.accent, 11);
    g.text(`parts sent over the wire: ${Math.max(sent, done)}`, 240, 232, { size: 12, color: sent > 16 ? pal.bad : pal.paper });
    g.text(res ? "server reports parts 1 to 10, client sends 11 to 16" : "no session state: client restarts at part 1", 240, 262, { size: 11, color: res ? pal.ok : pal.bad });
  },
};

const slo: Scene = {
  title: "Error budget: how much failure you can spend",
  caption: "The ring is the month's error budget for the chosen SLO. Add outage minutes and it drains. Each extra nine shrinks the allowance tenfold, so 99.99% leaves barely four minutes before launches should stop.",
  controls: [
    { id: "s", kind: "choice", label: "SLO", options: ["99%", "99.9%", "99.99%"], initial: 1 },
    { id: "o", kind: "range", label: "Outage minutes this month", min: 0, max: 120, step: 5, initial: 20 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const budget = [432, 43.2, 4.32][g.v.s];
    const used = g.v.o;
    const frac = Math.max(0, (budget - used) / budget);
    const cx = 240;
    const cy = 120;
    arcStroke(g, cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.9999, pal.line, 12, 0.4);
    const col = frac > 0.5 ? pal.ok : frac > 0 ? pal.accent : pal.bad;
    arcStroke(g, cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.0001, frac) * 0.9999, col, 12, 1);
    g.glow(cx, cy, 80, col, 0.06 + 0.03 * Math.sin(g.t * 3));
    g.text(frac > 0 ? `${(budget - used).toFixed(budget < 10 ? 1 : 0)} min` : `${(used - budget).toFixed(0)} min over`, cx, cy - 6, { size: 20, color: pal.paper, bold: true });
    g.text(frac > 0 ? "budget left" : "budget exhausted", cx, cy + 20, { size: 11, color: pal.muted });
    g.text(`allowed downtime per 30 days: ${budget < 10 ? budget.toFixed(1) : Math.round(budget)} min`, 240, 216, { size: 12, color: pal.paper });
    const msg = frac > 0.5 ? "healthy: keep shipping features" : frac > 0 ? "slow down: favour reliability work" : "freeze launches until it recovers";
    chip(g, 240, 252, msg, col, 12);
  },
};

const observability: Scene = {
  title: "Metrics, logs and traces on one incident",
  caption: "A request crosses four services. Metrics show that latency spiked, logs show what the failing component said, and the trace shows which hop ate the time. Switch views: each answers a different question about the same incident.",
  controls: [{ id: "v", kind: "choice", label: "Signal", options: ["metrics", "logs", "traces"], initial: 2 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const v = g.v.v;
    const names = ["edge", "cart", "inventory", "database"];
    names.forEach((nm, k) => {
      const x = 60 + k * 120;
      g.orb(k === 3 ? "searching" : "working", x, 44, 28, pal.paper, 1);
      g.text(nm, x, 72, { size: 9, color: k === 3 ? pal.bad : pal.muted });
      if (k < 3) g.packet(x + 16, 44, x + 104, 44, (g.t * 0.7 + k * 0.2) % 1, pal.accent, 2.2);
    });
    g.frame(24, 94, 432, 150, pal.line, 1, 8, 1.2);
    if (v === 0) {
      g.text("p99 latency", 40, 108, { size: 10, align: "left", color: pal.muted });
      let pv: [number, number] | null = null;
      for (let k = 0; k < 60; k++) {
        const T = Math.floor(g.t * 8) - 59 + k;
        const z = (((T % 240) + 240) % 240 - 150) / 25;
        const spike = Math.exp(-(z * z));
        const val = 0.2 + 0.05 * g.rnd(T * 1.7) + 0.7 * spike;
        const x = 40 + k * 6.8;
        const y = 232 - val * 120;
        if (pv) g.line(pv[0], pv[1], x, y, val > 0.5 ? pal.bad : pal.blue, 1, 1.8);
        pv = [x, y];
      }
      g.line(40, 232 - 0.5 * 120, 450, 232 - 0.5 * 120, pal.bad, 0.5, 1);
      g.text("tells you: something is slow, not why", 240, 262, { size: 11, color: pal.paper });
    } else if (v === 1) {
      const lines = [["INFO", "cart add item=981"], ["INFO", "inventory reserve sku=77"], ["WARN", "db pool 9 of 10 busy"], ["ERROR", "lock timeout table=stock trace=ab12"], ["INFO", "cart add item=410"], ["WARN", "retry 1 after 500ms"], ["INFO", "cart add item=355"]];
      const off = Math.floor(g.t * 1.5) % lines.length;
      for (let k = 0; k < 6; k++) {
        const [lv, msg] = lines[(k + off) % lines.length];
        const col = lv === "ERROR" ? pal.bad : lv === "WARN" ? pal.accent : pal.muted;
        g.text(`${lv.padEnd(5)} ${msg}`, 38, 114 + k * 22, { size: 10, align: "left", color: col });
      }
      g.text("tells you: what a component said, with detail", 240, 262, { size: 11, color: pal.paper });
    } else {
      const spans: [string, number, number][] = [["edge", 0, 100], ["cart", 8, 92], ["inventory", 14, 86], ["database", 20, 78]];
      const cur = (g.t * 40) % 130;
      spans.forEach(([nm, s, d], k) => {
        const y = 112 + k * 30;
        const bad = k === 3;
        g.text(nm, 38, y + 8, { size: 10, align: "left", color: bad ? pal.bad : pal.paper });
        g.rect(110 + s * 3.2, y, d * 3.2, 16, bad ? pal.bad : pal.blue, 0.2, 3);
        g.rect(110 + s * 3.2, y, Math.max(0, Math.min(d, cur - s)) * 3.2, 16, bad ? pal.bad : pal.blue, 0.8, 3);
      });
      g.text("tells you: which hop took the time", 240, 262, { size: 11, color: pal.paper });
    }
  },
};

const deploy: Scene = {
  title: "Deployment strategies side by side",
  caption: "Blue is the old version, orange the new. Rolling swaps instances one by one. Blue-green builds a full second fleet and flips the router once. A canary sends a growing slice of traffic to the new version while metrics stay healthy.",
  controls: [{ id: "m", kind: "choice", label: "Strategy", options: ["rolling", "blue-green", "canary"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const f = g.loop(9);
    if (m === 0) {
      const n = Math.floor(f * 9);
      for (let k = 0; k < 8; k++) {
        const x = 40 + k * 57;
        const nu = k < n;
        const cur = k === n;
        g.orb(cur ? "connecting" : "working", x, 120, 34, nu ? pal.accent : pal.paper, 1);
        g.ring(x, 120, 24, nu ? pal.accent : pal.blue, 1, 1.4);
        if (cur) g.text("updating", x, 160, { size: 9, color: pal.muted });
      }
      g.text(`${Math.min(8, n)} of 8 instances on the new version`, 240, 220, { size: 12, color: pal.paper });
      g.text("old and new run together, rollback is another rollout", 240, 250, { size: 10, color: pal.muted });
    } else if (m === 1) {
      const flip = f > 0.6;
      for (let k = 0; k < 6; k++) {
        const x = 150 + k * 52;
        g.orb("working", x, 70, 28, pal.paper, flip ? 0.4 : 1);
        g.ring(x, 70, 20, pal.blue, flip ? 0.4 : 1, 1.3);
        g.orb(f > 0.3 ? "working" : "breathing", x, 170, 28, pal.accent, f > 0.3 ? 1 : 0.4);
        g.ring(x, 170, 20, pal.accent, f > 0.3 ? 1 : 0.4, 1.3);
      }
      g.text("blue (live)", 70, 70, { size: 11, color: pal.blue });
      g.text("green (new)", 70, 170, { size: 11, color: pal.accent });
      chip(g, 60, 120, "router", pal.paper, 10);
      g.arrow(80, 124, 110, flip ? 160 : 82, flip ? pal.accent : pal.blue, 1);
      g.text(flip ? "all traffic flipped to green, blue kept for rollback" : f > 0.3 ? "green verified with test traffic" : "building the second fleet", 240, 240, { size: 12, color: pal.paper });
    } else {
      const stage = Math.min(3, Math.floor(f * 4));
      const share = [0.05, 0.25, 0.5, 1][stage];
      const nNew = [1, 2, 4, 8][stage];
      for (let k = 0; k < 8; k++) {
        const x = 40 + k * 57;
        const nu = k < nNew;
        g.orb("working", x, 110, 32, nu ? pal.accent : pal.paper, 1);
        g.ring(x, 110, 22, nu ? pal.accent : pal.blue, 1, 1.3);
      }
      for (let k = 0; k < 10; k++) g.packet(20, 175, 40 + (k % 8) * 57, 134, (g.t * 0.5 + k / 10) % 1, k / 10 < share ? pal.accent : pal.blue, 2);
      chip(g, 240, 36, "metrics vs old: healthy", pal.ok, 11);
      g.text(`${Math.round(share * 100)}% of traffic on the new version`, 240, 225, { size: 12, color: pal.paper });
      g.text("widen only while error rate and latency hold", 240, 252, { size: 10, color: pal.muted });
    }
  },
};

const taskSched: Scene = {
  title: "Task scheduler: leases and at-least-once delivery",
  caption: "A worker leases the task instead of deleting it. If the worker finishes, it acknowledges and the task is gone. If the worker dies, the lease runs out, the task goes back to the queue and another worker finishes it. The task may run twice, so it must be idempotent.",
  controls: [{ id: "c", kind: "toggle", label: "Worker 2 crashes" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const crash = g.v.c === 1;
    const t = g.t % 12;
    g.text("queue", 40, 34, { size: 10, color: pal.muted });
    const inQueue = t < 1 || (crash && t >= 5 && t < 6);
    for (let k = 0; k < 3; k++) g.rect(20, 46 + k * 22, 44, 16, pal.line, 0.3, 4);
    if (inQueue) g.rect(20, 46, 44, 16, pal.accent, 0.9, 4);
    server(g, 130, 130, "scheduler", { size: 36, state: "weaving" });
    const ws = [70, 130, 190];
    let owner = -1;
    let lease = 0;
    let state = "waiting in queue";
    let done = false;
    if (!crash && t >= 1) {
      owner = 1;
      lease = g.clamp((t - 1) / 4);
      state = t >= 4 ? "acknowledged, task removed" : "leased to worker 2";
      done = t >= 4;
      if (done) owner = -1;
    }
    if (crash) {
      if (t >= 1 && t < 5) {
        owner = 1;
        lease = (t - 1) / 4;
        state = t >= 2 ? "worker 2 died, lease still ticking" : "leased to worker 2";
      } else if (t >= 6 && t < 9) {
        owner = 2;
        lease = (t - 6) / 3;
        state = "leased to worker 3";
      } else if (t >= 9) state = "acknowledged by worker 3";
      else if (t >= 5) state = "lease expired, back in the queue";
    }
    ws.forEach((y, k) => {
      const dead = crash && k === 1 && t >= 2;
      g.orb(dead ? "breathing" : owner === k ? "working" : "breathing", 330, y, 36, dead ? pal.line : pal.paper, 1);
      g.text(`worker ${k + 1}${dead ? " ✕" : ""}`, 330, y + 30, { size: 9, color: dead ? pal.bad : pal.muted });
      if (owner === k) {
        g.rect(380, y - 6, 80, 8, pal.line, 0.3, 4);
        g.rect(380, y - 6, 80 * lease, 8, lease > 0.85 ? pal.bad : pal.accent, 0.9, 4);
        g.text("lease", 420, y + 12, { size: 9, color: pal.muted });
        g.packet(166, 130, 304, y, (g.t * 1.2) % 1, pal.accent, 3);
      }
    });
    chip(g, 240, 262, state, done || t >= 9 ? pal.ok : crash && t >= 2 && t < 6 ? pal.bad : pal.accent, 11);
  },
};

const payment: Scene = {
  title: "Payments: the retry that must not charge twice",
  caption: "The charge succeeds at the provider but the response is lost, so the client retries. Without an idempotency key the retry is a second charge and the ledger shows two debits. With a key the provider returns the first result and the ledger shows one.",
  controls: [{ id: "k", kind: "choice", label: "Retry sent", options: ["without idempotency key", "with idempotency key"], initial: 1 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const key = g.v.k === 1;
    const { i, p } = g.stage([1.8, 1.8, 1.8, 2.4]);
    g.orb("working", 40, 80, 32, pal.paper, 1);
    g.text("client", 40, 110, { size: 10, color: pal.muted });
    server(g, 190, 80, "your server", { size: 34, state: "solving" });
    server(g, 340, 80, "provider", { size: 34, state: "working", ring: pal.blue });
    if (i === 0) g.packet(60, 80, 168, 80, p, pal.accent, 3);
    if (i >= 1) g.packet(210, 80, 318, 80, i === 1 ? p : 1, pal.accent, 3);
    if (i === 1 && p > 0.6) g.text("✕ response lost", 265, 58, { size: 11, color: pal.bad });
    if (i === 2) {
      g.packet(60, 96, 168, 96, p, key ? pal.ok : pal.bad, 3);
      chip(g, 110, 128, key ? "key K-831" : "no key", key ? pal.ok : pal.bad, 10);
    }
    if (i === 3) g.packet(168, 96, 60, 96, p, key ? pal.ok : pal.accent, 3);
    g.text("ledger", 400, 150, { size: 10, color: pal.muted });
    g.frame(330, 160, 140, 80, pal.line, 1, 6, 1.2);
    const e1 = i >= 1;
    const e2 = i >= 2 && !key;
    if (e1) g.text("debit  49.99", 400, 182, { size: 11, color: pal.paper });
    if (e2 && (i > 2 || p > 0.6)) g.text("debit  49.99 ✕", 400, 206, { size: 11, color: pal.bad });
    if (i >= 2 && key && (i > 2 || p > 0.6)) g.text("replay: same result", 400, 206, { size: 10, color: pal.ok });
    g.text(["client submits the payment", "charge succeeds, reply never arrives", key ? "retry carries the same key" : "retry looks like a new payment", key ? "one charge, one ledger entry" : "customer charged twice"][i], 160, 262, { size: 12, color: i === 3 ? (key ? pal.ok : pal.bad) : pal.paper });
  },
};

const lock: Scene = {
  title: "Distributed lock: the paused holder and fencing tokens",
  caption: "Client A takes the lock, freezes, and its lease expires. Client B takes over and writes. When A wakes up it still thinks it holds the lock. Fencing tokens let the storage reject A's stale write, which a lock lease alone cannot do.",
  controls: [{ id: "f", kind: "toggle", label: "Fencing tokens", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const fence = g.v.f === 1;
    const { i, p } = g.stage([1.6, 1.8, 1.8, 1.8, 2.2]);
    const ay = 70;
    const by = 150;
    g.orb(i === 1 ? "breathing" : "working", 50, ay, 34, i === 1 ? pal.line : pal.paper, 1);
    g.text(i === 1 ? "A (frozen)" : "client A", 50, ay + 30, { size: 10, color: pal.muted });
    g.orb("working", 50, by, 34, i >= 2 ? pal.paper : pal.line, i >= 2 ? 1 : 0.4);
    g.text("client B", 50, by + 30, { size: 10, color: pal.muted });
    g.rect(380, 70, 90, 100, pal.teal, 0.12, 8);
    g.frame(380, 70, 90, 100, pal.teal, 1, 8, 1.3);
    g.text("storage", 425, 86, { size: 10, color: pal.muted });
    const last = i >= 2 ? 34 : i >= 0 ? 0 : 0;
    g.text(`last token: ${i >= 3 && !fence ? 33 : last || "-"}`, 425, 112, { size: 10, color: pal.paper });
    if (i >= 3 && !fence) g.text("data: A's", 425, 138, { size: 10, color: pal.bad });
    else if (i >= 2) g.text("data: B's", 425, 138, { size: 10, color: pal.ok });
    if (i === 0) chip(g, 180, ay, "lock + token 33", pal.accent, 11);
    if (i === 1) {
      g.rect(120, ay - 5, 160 * (1 - p), 10, pal.accent, 0.7, 4);
      g.text(p > 0.9 ? "lease expired" : "lease running", 200, ay + 20, { size: 10, color: p > 0.9 ? pal.bad : pal.muted });
    }
    if (i >= 2) chip(g, 180, by, "lock + token 34", pal.ok, 11);
    if (i === 2) g.packet(70, by, 378, 120, p, pal.ok, 3);
    if (i >= 3) g.packet(70, ay, 378, 100, i === 3 ? p : 1, pal.bad, 3);
    let msg = "A acquires the lock with token 33";
    let col = pal.paper;
    if (i === 1) msg = "A pauses, the lease runs out";
    if (i === 2) msg = "B acquires token 34 and writes";
    if (i === 3) msg = "A wakes up and writes with token 33";
    if (i === 4) {
      msg = fence ? "storage saw 34, rejects 33 ✓" : "no check: A overwrites B ✕";
      col = fence ? pal.ok : pal.bad;
    }
    g.text(msg, 240, 232, { size: 13, color: col });
  },
};

const ride: Scene = {
  title: "Ride sharing: finding drivers by cell",
  caption: "Drivers are indexed by map cell, so a request reads only the rider's cell and its neighbours instead of scanning every driver. Widen the radius and more candidates come back, at the cost of more cells read.",
  controls: [{ id: "r", kind: "range", label: "Search radius (cells)", min: 1, max: 3, step: 1, initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const R = g.v.r;
    const cw = 54;
    const ch = 46;
    const ox = 24;
    const oy = 24;
    const rc = 4;
    const rr = 2;
    for (let cy = 0; cy < 4; cy++)
      for (let cx = 0; cx < 8; cx++) {
        const near = Math.abs(cx - rc) <= R && Math.abs(cy - rr) <= R;
        g.rect(ox + cx * cw, oy + cy * ch, cw - 2, ch - 2, near ? pal.accent : pal.line, near ? 0.16 : 0.07, 4);
      }
    const rx = ox + (rc + 0.5) * cw;
    const ry = oy + (rr + 0.5) * ch;
    let cand = 0;
    let best = -1;
    let bd = 1e9;
    const drivers: [number, number][] = [];
    for (let k = 0; k < 28; k++) {
      const x = ox + g.rnd(k * 2.7 + 1) * 8 * cw + Math.sin(g.t * 0.4 + k) * 5;
      const y = oy + g.rnd(k * 4.1 + 2) * 4 * ch + Math.cos(g.t * 0.5 + k) * 4;
      drivers.push([x, y]);
      const cx = Math.floor((x - ox) / cw);
      const cy = Math.floor((y - oy) / ch);
      const near = Math.abs(cx - rc) <= R && Math.abs(cy - rr) <= R;
      if (near) {
        cand++;
        const d = Math.hypot(x - rx, y - ry);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      g.dot(x, y, 3.5, near ? pal.paper : pal.muted, near ? 1 : 0.5);
    }
    if (best >= 0) {
      g.packet(rx, ry, drivers[best][0], drivers[best][1], g.loop(1.4), pal.ok, 3);
      g.ring(drivers[best][0], drivers[best][1], 9, pal.ok, 1, 2);
    }
    g.dot(rx, ry, 5, pal.accent);
    g.glow(rx, ry, 18, pal.accent, 0.4);
    g.text("rider", rx, ry + 16, { size: 9, color: pal.accent });
    g.text(`${cand} candidates from ${(2 * R + 1) ** 2} cells, not all 28 drivers`, 240, 232, { size: 12, color: pal.paper });
    g.text(best >= 0 ? "offer sent to the best candidate, atomic claim on accept" : "no driver nearby: widen the radius", 240, 260, { size: 10, color: pal.muted });
  },
};

const inventory: Scene = {
  title: "Inventory: reserve, then commit or release",
  caption: "Five items in stock. Checkout reserves one for a few minutes, so nobody else can take it while payment runs. Success commits it as sold. Failure or abandonment releases it back. Pick the outcome and watch the stock move.",
  controls: [{ id: "o", kind: "choice", label: "Outcome", options: ["payment succeeds", "payment fails", "user walks away"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const o = g.v.o;
    const { i, p } = g.stage([1.8, 1.8, 2.4]);
    let avail = 5;
    let res = 0;
    let sold = 0;
    if (i >= 0 && !(i === 0 && p < 0.5)) {
      avail = 4;
      res = 1;
    }
    if (i === 2 && p > 0.5) {
      if (o === 0) {
        res = 0;
        sold = 1;
      } else {
        res = 0;
        avail = 5;
      }
    }
    const boxes: [string, number, number, string][] = [["available", 40, avail, pal.ok], ["reserved", 180, res, pal.accent], ["sold", 320, sold, pal.blue]];
    boxes.forEach(([nm, x, n, col]) => {
      g.rect(x, 60, 120, 90, col, 0.1, 8);
      g.frame(x, 60, 120, 90, col, 1, 8, 1.3);
      g.text(nm, x + 60, 76, { size: 11, color: col });
      for (let k = 0; k < n; k++) g.rect(x + 12 + k * 20, 100, 16, 30, col, 0.75, 3);
    });
    if (i === 0) g.packet(120, 105, 240, 105, p, pal.accent, 3);
    if (i === 2 && p > 0.5) {
      if (o === 0) g.packet(240, 105, 380, 105, (p - 0.5) * 2, pal.blue, 3);
      else g.packet(240, 105, 100, 105, (p - 0.5) * 2, pal.ok, 3);
    }
    g.orb(i === 1 ? "working" : "breathing", 240, 200, 34, pal.paper, 1);
    g.text(["checkout reserves one unit for 10 minutes", o === 0 ? "payment in progress" : o === 1 ? "payment is declined" : "no activity, hold counting down", o === 0 ? "committed: stock permanently down" : o === 1 ? "released: unit available again" : "hold expired, released by the sweeper"][i], 240, 262, { size: 12, color: pal.paper });
  },
};

const tickets: Scene = {
  title: "Ticket booking: two people, one seat",
  caption: "Both buyers click the highlighted seat in the same instant. If the server reads availability and then writes, both writes succeed and the seat is sold twice. One atomic conditional update lets the database pick a single winner.",
  controls: [{ id: "a", kind: "choice", label: "Seat claim", options: ["read, then write", "atomic conditional update"], initial: 1 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const atomic = g.v.a === 1;
    const { i, p } = g.stage([1.6, 1.6, 2.6]);
    const cw = 34;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 10; c++) {
        const k = r * 10 + c;
        const x = 70 + c * (cw + 3);
        const y = 56 + r * 30;
        const hot = r === 2 && c === 4;
        const v = g.rnd(k * 3.3 + 1);
        const col = hot ? pal.accent : v < 0.3 ? pal.blue : v < 0.38 ? pal.violet : pal.line;
        g.rect(x, y, cw, 24, col, hot ? 0.5 : v < 0.38 ? 0.5 : 0.18, 4);
        if (hot) g.frame(x, y, cw, 24, pal.accent, 1, 4, 2);
      }
    const sx = 70 + 4 * (cw + 3) + cw / 2;
    const sy = 56 + 2 * 30 + 12;
    g.orb("working", 24, 210, 28, pal.paper, 1);
    g.orb("working", 456, 210, 28, pal.paper, 1);
    g.text("buyer 1", 24, 236, { size: 9, color: pal.muted });
    g.text("buyer 2", 456, 236, { size: 9, color: pal.muted });
    if (i >= 0) {
      g.packet(30, 200, sx, sy, g.clamp(i === 0 ? p : 1), pal.accent, 3);
      g.packet(450, 200, sx, sy, g.clamp(i === 0 ? p : 1), pal.accent, 3);
    }
    let msg = "both see seat 14 as available";
    let col = pal.paper;
    if (i === 1) msg = atomic ? "both send: UPDATE … WHERE status = available" : "both read 'available', both write 'sold'";
    if (i === 2) {
      if (atomic) {
        g.ring(sx, sy, 16, pal.ok, 1, 2.4);
        chip(g, 120, 262, "buyer 1: held ✓", pal.ok, 10);
        chip(g, 360, 262, "buyer 2: just taken", pal.bad, 10);
        msg = "";
      } else {
        g.ring(sx, sy, 16, pal.bad, 1, 2.4);
        g.ring(sx, sy, 22, pal.bad, 0.6, 1.6);
        msg = "double booked ✕: two people hold one seat";
        col = pal.bad;
      }
    }
    if (msg) g.text(msg, 240, 262, { size: 12, color: col });
  },
};

const live: Scene = {
  title: "Live streaming: where the delay comes from",
  caption: "One stream is ingested, transcoded, packaged and pushed through a CDN. Classic HLS buffers several long segments, low-latency HLS uses partial segments, and WebRTC skips segment caching entirely. Lower delay costs cache efficiency.",
  controls: [{ id: "m", kind: "choice", label: "Delivery", options: ["classic HLS", "low-latency HLS", "WebRTC"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const delay = [25, 4, 0.5][m];
    const hit = [0.97, 0.9, 0.2][m];
    const names = ["camera", "ingest", "transcode", "CDN edge", "viewers"];
    names.forEach((nm, k) => {
      const x = 44 + k * 98;
      g.ring(x, 70, 20, k === 3 ? pal.teal : pal.line, 1, 1.4);
      g.orb(k === 2 ? "working" : "breathing", x, 70, 28, pal.paper, 1);
      g.text(nm, x, 108, { size: 9, color: pal.muted });
      if (k < 4) {
        const speed = [0.35, 0.8, 1.6][m];
        const f = (g.t * speed + k * 0.2) % 1;
        const len = m === 0 ? 14 : m === 1 ? 7 : 3;
        g.rect(x + 22 + f * 54 - len / 2, 66, len, 8, m === 2 ? pal.ok : pal.accent, 0.9, 2);
      }
    });
    g.text("glass-to-glass delay", 70, 160, { size: 11 });
    bar(g, 190, 155, 220, 8, Math.log10(delay + 1) / Math.log10(26), delay > 10 ? pal.bad : pal.ok);
    g.text(`${delay} s`, 440, 160, { size: 12, color: pal.paper });
    g.text("CDN cache hit", 70, 192, { size: 11 });
    bar(g, 190, 187, 220, 8, hit, hit > 0.7 ? pal.ok : pal.bad);
    g.text(`${Math.round(hit * 100)}%`, 440, 192, { size: 12, color: pal.paper });
    g.text(["6 s segments, player buffers three", "partial segments let playback start early", "per-viewer connections, costly at huge scale"][m], 240, 244, { size: 11, color: pal.muted });
  },
};

const autocomplete: Scene = {
  title: "Autocomplete: walk the prefix, read the top results",
  caption: "Each typed character moves one step down the trie. The node you land on already stores its best suggestions, so the lookup costs the length of the prefix no matter how many queries exist. Short prefixes are so hot they sit in an edge cache.",
  controls: [{ id: "n", kind: "range", label: "Characters typed", min: 1, max: 8, step: 1, initial: 5 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const typed = "new york";
    const n = g.v.n;
    const prefix = typed.slice(0, n);
    const data: [string, number][] = [["new york weather", 90], ["new york times", 70], ["new york pizza", 55], ["new balance shoes", 62], ["newegg", 40], ["netflix", 95], ["nest thermostat", 30]];
    const hits = data.filter(([q]) => q.startsWith(prefix)).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (let k = 0; k < 8; k++) {
      const x = 36 + k * 54;
      const on = k < n;
      g.ring(x, 60, 15, on ? pal.accent : pal.line, on ? 1 : 0.4, 1.4);
      g.text(typed[k] === " " ? "␣" : typed[k], x, 60, { size: 14, color: on ? pal.paper : pal.muted });
      if (k < 7) g.line(x + 15, 60, x + 39, 60, on && k < n - 1 ? pal.accent : pal.line, on && k < n - 1 ? 1 : 0.4, 1.4);
    }
    g.glow(36 + (n - 1) * 54, 60, 26, pal.accent, 0.3);
    g.packet(36, 60, 36 + (n - 1) * 54, 60, g.loop(1.4), pal.accent, 3);
    g.text(`walked ${n} node${n > 1 ? "s" : ""}`, 240, 96, { size: 11, color: pal.muted });
    g.frame(40, 114, 400, 100, pal.line, 1, 8, 1.2);
    g.text("top 3 stored at this node", 240, 128, { size: 10, color: pal.muted });
    if (hits.length === 0) g.text("no suggestions for this prefix", 240, 170, { size: 12, color: pal.muted });
    hits.forEach(([q, s], k) => {
      g.text(q, 60, 150 + k * 22, { size: 12, align: "left", color: pal.paper });
      bar(g, 300, 146 + k * 22, 110, 7, s / 100, pal.blue);
    });
    chip(g, 240, 244, n <= 3 ? "short prefix: served from edge cache" : "served from in-memory index", n <= 3 ? pal.ok : pal.blue, 11);
    g.text("client debounces keystrokes and cancels stale requests", 240, 276, { size: 10, color: pal.muted });
  },
};

const cron: Scene = {
  title: "Distributed cron: a leader that stalls",
  caption: "Three replicas, one leader fires the 02:00 job. The leader freezes, a standby takes over and fires it, then the old leader wakes and fires it too. Run IDs built from job and time make the second insert fail, so the job runs once.",
  controls: [{ id: "u", kind: "toggle", label: "Unique run IDs", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const uniq = g.v.u === 1;
    const { i, p } = g.stage([1.6, 1.8, 1.8, 2.4]);
    const ys = [60, 130, 200];
    const leader = i === 0 ? 0 : i === 1 ? (p > 0.5 ? 1 : 0) : i === 2 ? 1 : 1;
    ys.forEach((y, k) => {
      const frozen = k === 0 && i >= 1 && i < 3;
      g.orb(frozen ? "breathing" : "working", 60, y, 34, frozen ? pal.line : pal.paper, 1);
      g.ring(60, y, 24, leader === k ? pal.ok : pal.line, 1, leader === k ? 2.2 : 1.2);
      g.text(frozen ? "scheduler A (frozen)" : `scheduler ${"ABC"[k]}${leader === k ? " (leader)" : ""}`, 60, y + 32, { size: 9, color: leader === k ? pal.ok : pal.muted });
    });
    g.frame(230, 50, 230, 160, pal.line, 1, 8, 1.2);
    g.text("run records", 345, 66, { size: 10, color: pal.muted });
    const second = i >= 3;
    if (i >= 2) {
      chip(g, 345, 100, "run 02:00 (by B)", pal.ok, 10);
      g.packet(94, 130, 230, 100, i === 2 ? p : 1, pal.ok, 3);
    }
    if (second) {
      g.packet(94, 60, 230, 130, p, pal.accent, 3);
      if (uniq) chip(g, 345, 136, "duplicate id rejected", pal.ok, 10);
      else chip(g, 345, 136, "run 02:00 (by A) ✕", pal.bad, 10);
    }
    g.text(["02:00 is due, A is the leader", "A freezes, its lease lapses, B is elected", "B fires the 02:00 job", uniq ? "A wakes and fires: unique run ID blocks it ✓" : "A wakes and fires: job ran twice ✕"][i], 240, 240, { size: 12, color: i === 3 ? (uniq ? pal.ok : pal.bad) : pal.paper });
  },
};

const chaos: Scene = {
  title: "Chaos engineering: killing instances on purpose",
  caption: "A chaos tool kills a random service instance every few seconds. The line is a customer-facing metric, stream starts per second. Without timeouts and fallbacks each kill dents it. With them the metric barely moves, which is the hypothesis the experiment tests.",
  controls: [{ id: "r", kind: "choice", label: "Services built with", options: ["no fallbacks", "timeouts + fallbacks"], initial: 1 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const res = g.v.r === 1;
    const period = 3.2;
    const bucket = Math.floor(g.t / period);
    const since = g.t - bucket * period;
    const victim = Math.floor(g.rnd(bucket * 5.7 + 1) * 6);
    g.orb("searching", 440, 36, 26, pal.bad, 1);
    g.text("chaos tool", 440, 62, { size: 9, color: pal.bad });
    for (let k = 0; k < 6; k++) {
      const x = 60 + (k % 3) * 96;
      const y = 60 + Math.floor(k / 3) * 70;
      const dead = k === victim && since < 2;
      g.orb(dead ? "breathing" : "working", x, y, 32, dead ? pal.line : pal.paper, 1);
      g.ring(x, y, 22, dead ? pal.bad : pal.ok, 1, 1.4);
      if (dead) g.text("✕", x, y, { size: 18, color: pal.bad });
      if (dead && res) chip(g, x, y + 36, "fallback", pal.ok, 9);
    }
    g.packet(430, 60, 120 + (victim % 3) * 96 - 60, 60 + Math.floor(victim / 3) * 70, g.clamp(since / 0.6), pal.bad, 3);
    const val = (s: number) => {
      const tau = s - Math.floor(s / period) * period;
      return res ? 0.97 + 0.01 * Math.sin(s * 3) : 1 - 0.5 * Math.exp(-tau / 0.9) * (tau < 2 ? 1 : 0.2);
    };
    let pv: [number, number] | null = null;
    for (let k = 0; k <= 60; k++) {
      const s = g.t - 6 + (k / 60) * 6;
      const x = 24 + k * 7.1;
      const y = 245 - val(s) * 70;
      if (pv) g.line(pv[0], pv[1], x, y, val(s) < 0.8 ? pal.bad : pal.ok, 1, 2);
      pv = [x, y];
    }
    g.text("stream starts / s", 80, 188, { size: 10, color: pal.muted });
    g.text(res ? "steady state holds" : "each kill dents the customer metric", 240, 280, { size: 12, color: res ? pal.ok : pal.bad });
  },
};

const schemaless: Scene = {
  title: "Schemaless: append-only cells on sharded MySQL",
  caption: "The row key is hashed to pick a shard. A write appends a cell, an update appends a newer cell instead of overwriting, and a read returns the newest version per column. Secondary indexes trail the write by a moment.",
  controls: [{ id: "o", kind: "choice", label: "Operation", options: ["write", "update", "read"], initial: 1 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const o = g.v.o;
    const key = "trip-9f3";
    const shard = Math.floor(hash32(key) * 4);
    g.orb("working", 40, 40, 28, pal.paper, 1);
    g.text(`row key ${key}`, 120, 40, { size: 11, color: pal.paper });
    g.text(`hash → shard ${shard + 1}`, 270, 40, { size: 11, color: pal.accent });
    for (let k = 0; k < 4; k++) {
      const x = 24 + k * 112;
      const on = k === shard;
      g.rect(x, 80, 104, 130, on ? pal.blue : pal.line, on ? 0.14 : 0.06, 8);
      g.frame(x, 80, 104, 130, on ? pal.blue : pal.line, on ? 1 : 0.5, 8, on ? 1.6 : 1);
      g.text(`shard ${k + 1}`, x + 52, 94, { size: 10, color: on ? pal.blue : pal.muted });
    }
    const sx = 24 + shard * 112;
    const f = g.loop(4);
    const fresh = f > 0.35;
    g.packet(54, 52, sx + 52, 100, g.clamp(f * 3), pal.accent, 3);
    const cells: [string, string, boolean, boolean][] = [["BASE", "v1", o === 0 ? fresh : true, o === 0 && fresh]];
    if (o >= 1) cells.push(["STATUS", "v2", o === 1 ? fresh : true, o === 1 && fresh]);
    cells.forEach(([c, v, show, isNew], k) => {
      if (!show) return;
      const y = 112 + k * 40;
      g.rect(sx + 8, y, 88, 32, isNew ? pal.accent : pal.blue, isNew ? 0.4 : 0.22, 5);
      g.frame(sx + 8, y, 88, 32, o === 2 ? pal.ok : pal.line, 1, 5, o === 2 ? 2 : 1);
      g.text(`${c} ${v}`, sx + 52, y + 16, { size: 10, color: pal.paper });
    });
    g.text(o === 0 ? "append the first cell" : o === 1 ? "old cells stay, a newer one is appended" : "latest version of each column wins", 240, 236, { size: 12, color: pal.paper });
    if (o <= 1) chip(g, 240, 264, "index entry follows shortly after", pal.violet, 10);
    else chip(g, 240, 264, "read by key hits exactly one shard", pal.ok, 10);
  },
};

const kafka: Scene = {
  title: "Kafka: a partitioned log with independent readers",
  caption: "Producers append to the head of each partition. Each consumer group keeps its own offset, so the fast group and the slow group never disturb each other. Within a group a partition has one reader, so consumers beyond four sit idle.",
  controls: [{ id: "n", kind: "range", label: "Consumers in group A", min: 1, max: 6, step: 1, initial: 2 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    for (let k = 0; k < 4; k++) {
      const y = 44 + k * 42;
      const head = 8 + ((Math.floor(g.t * 1.6) + k * 3) % 7);
      g.text(`partition ${k}`, 20, y + 8, { size: 9, align: "left", color: pal.muted });
      for (let c = 0; c < 16; c++) {
        const x = 90 + c * 20;
        const filled = c < head;
        g.rect(x, y, 17, 16, filled ? pal.blue : pal.line, filled ? 0.5 : 0.1, 3);
      }
      g.packet(80, y - 10, 90 + head * 20 - 8, y + 8, (g.t * 1.6) % 1, pal.accent, 2.4);
      const pa = Math.max(0, head - 2);
      const pb = Math.max(0, head - 6);
      g.dot(90 + pa * 20 + 8, y + 24, 3.5, pal.ok);
      g.dot(90 + pb * 20 + 8, y + 24, 3.5, pal.violet);
      g.text(`A${(k % n) + 1}`, 430, y + 8, { size: 10, color: pal.ok });
    }
    g.text("group A", 405, 220, { size: 10, color: pal.ok });
    g.text("group B", 340, 220, { size: 10, color: pal.violet });
    g.dot(386, 217, 3.5, pal.ok);
    g.dot(320, 217, 3.5, pal.violet);
    const idle = Math.max(0, n - 4);
    g.text(idle > 0 ? `${idle} consumer${idle > 1 ? "s" : ""} idle: only 4 partitions` : `${n} consumer${n > 1 ? "s" : ""} share 4 partitions`, 240, 252, { size: 12, color: idle > 0 ? pal.bad : pal.paper });
    g.text("order is guaranteed only inside one partition", 240, 278, { size: 10, color: pal.muted });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/geo-matching-and-recs/real-time-bidding-and-auction-systems`]: rtb,
  [`${P}/geo-matching-and-recs/eta-prediction-and-routing-estimation`]: eta,
  [`${P}/media-files-and-cdn/video-streaming-protocols-hls-dash-and-adaptive-bitrate`]: abr,
  [`${P}/media-files-and-cdn/chunked-and-resumable-upload-for-large-files`]: chunked,
  [`${P}/reliability-and-operations/slis-slos-and-error-budgets`]: slo,
  [`${P}/reliability-and-operations/observability-metrics-logs-and-traces`]: observability,
  [`${P}/reliability-and-operations/deployment-strategies-blue-green-rolling-and-feature-flags`]: deploy,
  [`${P}/service-and-data-designs/designing-a-distributed-task-scheduler`]: taskSched,
  [`${P}/service-and-data-designs/designing-a-payment-and-billing-system`]: payment,
  [`${P}/service-and-data-designs/designing-a-distributed-lock-service`]: lock,
  [`${P}/product-designs/designing-a-ride-sharing-system`]: ride,
  [`${P}/product-designs/designing-an-e-commerce-inventory-and-checkout-system`]: inventory,
  [`${P}/product-designs/designing-a-ticket-booking-system`]: tickets,
  [`${P}/media-and-operations-designs/designing-a-live-streaming-platform`]: live,
  [`${P}/media-and-operations-designs/designing-a-search-autocomplete-service`]: autocomplete,
  [`${P}/media-and-operations-designs/designing-a-distributed-cron-and-job-scheduler`]: cron,
  [`${P}/engineering-case-studies/case-study-netflix-chaos-engineering-and-resilience`]: chaos,
  [`${P}/engineering-case-studies/case-study-uber-schemaless-and-dosa`]: schemaless,
  [`${P}/engineering-case-studies/case-study-kafka-at-linkedin`]: kafka,
};
