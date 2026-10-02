import type { Scene } from "../scene/types";
import { arcStroke, bar, chip, db, fmt, hash32, ptOnCircle, server } from "./kit";

const P = "system-design";
const TAU = Math.PI * 2;

const balancer: Scene = {
  title: "A load balancer with health checks",
  caption: "Requests of different lengths arrive at the balancer. Round robin hands them out in turn, least connections favors the quietest server. Fail a server and its health check stops traffic reaching it.",
  controls: [
    { id: "alg", kind: "choice", label: "Algorithm", options: ["round robin", "least connections"], initial: 0 },
    { id: "fail", kind: "button", label: "Fail / heal a server" },
  ],
  aspect: 0.66,
  make: () => {
    type R = { server: number; born: number; dur: number };
    const reqs: R[] = [];
    const alive = [true, true, true, true];
    let rr = 0;
    let acc = 0;
    let n = 0;
    let victim = 0;
    return (g) => {
      const { pal } = g;
      if (g.pressed("fail")) {
        alive[victim] = !alive[victim];
        if (alive[victim]) victim = (victim + 1) % 4;
      }
      const lb = [150, 130];
      acc += g.dt * 4.5;
      while (acc >= 1) {
        acc -= 1;
        n++;
        const ups = [0, 1, 2, 3].filter((s) => alive[s]);
        if (!ups.length) continue;
        let pick = ups[0];
        if (g.v.alg === 0) {
          while (!alive[rr % 4]) rr++;
          pick = rr % 4;
          rr++;
        } else {
          const load = (s: number) => reqs.filter((r) => r.server === s && g.t - r.born < r.dur + 0.5).length;
          pick = ups.reduce((b, s) => (load(s) < load(b) ? s : b), ups[0]);
        }
        reqs.push({ server: pick, born: g.t, dur: 0.6 + (g.rnd(n * 4.4) > 0.8 ? 4 : g.rnd(n * 2.1) * 1.4) });
      }
      while (reqs.length && g.t - reqs[0].born > 6) reqs.shift();
      g.dot(30, 130, 8, pal.paper);
      g.line(40, 130, lb[0] - 26, lb[1], pal.line, 0.5);
      server(g, lb[0], lb[1], "load balancer", { size: 44, state: "connecting" });
      for (let s = 0; s < 4; s++) {
        const y = 40 + s * 62;
        const load = reqs.filter((r) => r.server === s && g.t - r.born > 0.5 && g.t - r.born < r.dur + 0.5).length;
        g.line(lb[0] + 26, lb[1], 340, y, alive[s] ? pal.line : pal.bad, 0.4);
        server(g, 360, y, "", { size: 34, color: alive[s] ? pal.paper : pal.bad, ring: alive[s] ? undefined : pal.bad });
        g.text(alive[s] ? `server ${s + 1}` : "down", 406, y - 8, { size: 10, align: "left", color: alive[s] ? pal.muted : pal.bad });
        bar(g, 400, y + 2, 58, 6, Math.min(1, load / 6), load > 4 ? pal.bad : pal.accent);
        g.text(`${load} active`, 406, y + 18, { size: 9, align: "left" });
        if (!alive[s]) {
          const q = (g.t % 1.2) / 1.2;
          g.packet(lb[0] + 26, lb[1], 342, y, q, pal.bad, 2);
          g.text("health check fails", 270, y - 12 + (y - 130) * 0.1, { size: 8, color: pal.bad });
        }
      }
      for (const r of reqs) {
        const age = g.t - r.born;
        if (age < 0.5) g.packet(40, 130, lb[0] - 26, lb[1], age / 0.5, pal.accent, 2.2);
        else if (age < 1.1) g.packet(lb[0] + 26, lb[1], 340, 40 + r.server * 62, g.clamp((age - 0.5) / 0.6), pal.accent, 2.2);
      }
      g.text("long requests pile up on one server under round robin", 240, 288, { size: 10 });
    };
  },
};

const breaker: Scene = {
  title: "A circuit breaker protecting a dependency",
  caption: "While calls succeed the breaker is closed. Enough failures open it and calls fail fast with a fallback. After a cooldown it lets one probe through, and a success closes it again.",
  controls: [{ id: "ok", kind: "toggle", label: "Dependency healthy", initial: false }],
  aspect: 0.66,
  make: () => {
    let state = 0;
    let fails = 0;
    let openAt = 0;
    let acc = 0;
    let n = 0;
    const log: { born: number; kind: string }[] = [];
    return (g) => {
      const { pal } = g;
      const healthy = g.v.ok === 1;
      acc += g.dt * 3;
      while (acc >= 1) {
        acc -= 1;
        n++;
        if (state === 0) {
          const fail = !healthy;
          if (fail) fails++;
          else fails = Math.max(0, fails - 1);
          log.push({ born: g.t, kind: fail ? "fail" : "ok" });
          if (fails >= 4) {
            state = 1;
            openAt = g.t;
          }
        } else if (state === 1) {
          log.push({ born: g.t, kind: "fast" });
          if (g.t - openAt > 4) state = 2;
        } else if (state === 2) {
          const succeeded = healthy;
          log.push({ born: g.t, kind: succeeded ? "ok" : "fail" });
          if (succeeded) {
            state = 0;
            fails = 0;
          } else {
            state = 1;
            openAt = g.t;
          }
        }
      }
      while (log.length && g.t - log[0].born > 1.4) log.shift();
      const nodes = [
        { x: 110, y: 70, n: "closed", c: pal.ok },
        { x: 370, y: 70, n: "open", c: pal.bad },
        { x: 240, y: 190, n: "half-open", c: pal.accent },
      ];
      g.arrow(146, 70, 330, 70, pal.line, 0.8);
      g.arrow(350, 100, 268, 168, pal.line, 0.8);
      g.arrow(212, 168, 130, 100, pal.line, 0.8);
      g.text("too many failures", 240, 56, { size: 9 });
      g.text("cooldown over", 340, 144, { size: 9 });
      g.text("probe succeeds", 148, 144, { size: 9 });
      nodes.forEach((nd, k) => {
        const on = state === k;
        g.glow(nd.x, nd.y, 46, nd.c, on ? 0.3 : 0.05);
        g.ring(nd.x, nd.y, 28, nd.c, on ? 1 : 0.35, on ? 2.4 : 1.2);
        g.text(nd.n, nd.x, nd.y, { size: 11, color: on ? pal.paper : pal.muted, bold: on });
      });
      g.text("service", 30, 250, { size: 10 });
      g.dot(60, 232, 6, pal.paper);
      db(g, 430, 238, 30, 34, healthy ? pal.ok : pal.bad);
      g.text(healthy ? "dependency up" : "dependency failing", 430, 270, { size: 9, color: healthy ? pal.ok : pal.bad });
      log.forEach((e) => {
        const q = (g.t - e.born) / 1.4;
        if (e.kind === "fast") {
          g.packet(60, 232, 200, 232, Math.min(1, q * 2), pal.accent, 2.2);
          if (q > 0.5) g.packet(200, 232, 60, 232, Math.min(1, (q - 0.5) * 2), pal.violet, 2.2);
        } else {
          g.packet(60, 232, 410, 238, g.clamp(q), e.kind === "ok" ? pal.ok : pal.bad, 2.2);
        }
      });
      g.text(state === 1 ? "calls fail fast, fallback served" : state === 2 ? "one probe call allowed" : `failures: ${fails}/4`, 240, 290, { size: 11, color: state === 1 ? pal.bad : pal.paper });
    };
  },
};

const disaster: Scene = {
  title: "Failover, RTO and RPO",
  caption: "The standby region trails the primary by a few records. When the primary fails, traffic moves after the recovery time, and whatever had not replicated yet is the data loss. Both are design targets.",
  controls: [
    { id: "lag", kind: "range", label: "Replication lag", min: 0, max: 5, step: 1, initial: 2, unit: " records" },
    { id: "fail", kind: "button", label: "Fail the primary" },
  ],
  aspect: 0.66,
  make: () => {
    let failAt = -100;
    return (g) => {
      const { pal } = g;
      if (g.pressed("fail")) failAt = g.t;
      const since = g.t - failAt;
      const failed = since >= 0 && since < 14;
      const rto = 5;
      const serving = failed ? (since > rto ? 1 : -1) : 0;
      const A = [110, 120];
      const B = [370, 120];
      g.rect(30, 50, 160, 150, pal.panel, 1, 10);
      g.frame(30, 50, 160, 150, failed ? pal.bad : pal.accent, 1, 10, 1.6);
      g.rect(290, 50, 160, 150, pal.panel, 1, 10);
      g.frame(290, 50, 160, 150, serving === 1 ? pal.ok : pal.line, 1, 10, serving === 1 ? 2 : 1);
      server(g, A[0], A[1], "primary region", { size: 44, color: failed ? pal.bad : pal.paper, ring: failed ? pal.bad : undefined });
      server(g, B[0] + 0, B[1], "standby region", { size: 44, color: serving === 1 ? pal.ok : pal.paper });
      if (failed) g.text("✕", A[0], A[1], { size: 24, color: pal.bad, bold: true });
      const total = 10;
      const lag = g.v.lag;
      const written = failed ? 10 : 10 + (Math.floor(g.t) % 3);
      for (let i = 0; i < total; i++) {
        const onB = i < total - lag;
        g.rect(46 + i * 14, 176, 10, 12, failed ? pal.line : pal.accent, 0.9, 2);
        g.rect(306 + i * 14, 176, 10, 12, onB ? pal.blue : pal.bad, onB ? 0.9 : 0.4, 2);
      }
      void written;
      g.text("log", 24, 182, { size: 8 });
      g.text("replica of the log", 372, 166, { size: 8 });
      g.dot(240, 250, 6, pal.paper);
      const target = serving === 1 ? B : A;
      if (serving !== -1) g.packet(240, 250, target[0], target[1] + 28, g.loop(1.1), serving === 1 ? pal.ok : pal.accent, 2.6);
      if (serving === -1) {
        arcStroke(g, 240, 250, 16, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, since / rto), pal.accent, 3, 0.9);
        g.text("failing over...", 240, 224, { size: 11, color: pal.accent });
      }
      g.text(failed ? (serving === 1 ? `RTO ${rto} s met. RPO: ${lag} record${lag === 1 ? "" : "s"} lost` : "traffic is stalled until failover completes") : "primary serving, standby following", 240, 288, { size: 12, color: failed ? (serving === 1 && lag > 0 ? pal.bad : pal.paper) : pal.paper });
    };
  },
};

const quorum: Scene = {
  title: "Quorum reads and writes",
  caption: "A write is acknowledged once W of 3 replicas have it, and a read asks R replicas. If W + R is greater than 3 the two sets must overlap and the read sees the latest write. Otherwise it may be stale.",
  controls: [
    { id: "w", kind: "range", label: "W", min: 1, max: 3, step: 1, initial: 2 },
    { id: "r", kind: "range", label: "R", min: 1, max: 3, step: 1, initial: 1 },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const W = g.v.w;
    const R = g.v.r;
    const T = 9;
    const t = g.t % T;
    const co = [60, 135];
    const reps = [
      [260, 50],
      [260, 135],
      [260, 220],
    ];
    server(g, co[0], co[1], "coordinator", { size: 42, state: "connecting" });
    const wrote = (i: number) => i < W && t > 1.4 + i * 0.5;
    reps.forEach(([x, y], i) => {
      const has = wrote(i);
      server(g, x, y, `replica ${i + 1}`, { size: 36, color: has ? pal.blue : pal.paper, ring: has ? pal.blue : undefined });
      chip(g, x + 62, y, has ? "v2" : "v1", has ? pal.blue : pal.accent, 10);
      if (t < 1.4) g.packet(co[0] + 26, co[1], x - 22, y, t / 1.4, pal.accent, 2.2);
    });
    if (t > 2 && t < 3.4) for (let i = 0; i < W; i++) g.packet(reps[i][0] - 22, reps[i][1], co[0] + 26, co[1], g.clamp((t - 2 - i * 0.3) / 0.8), pal.ok, 2.2);
    const readSet = [2, 1, 0].slice(0, R);
    const stale = readSet.every((i) => i >= W);
    if (t > 4.6 && t < 6.6) {
      readSet.forEach((i) => {
        if (t < 5.6) g.packet(co[0] + 26, co[1], reps[i][0] - 22, reps[i][1], g.clamp((t - 4.6) / 1), pal.paper, 2.2);
        else g.packet(reps[i][0] - 22, reps[i][1], co[0] + 26, co[1], g.clamp((t - 5.6) / 1), i < W ? pal.blue : pal.accent, 2.2);
      });
    }
    g.text(`W + R = ${W + R}  ${W + R > 3 ? "> 3: sets overlap" : "≤ 3: sets may miss each other"}`, 140, 270, { size: 12, color: W + R > 3 ? pal.ok : pal.bad });
    if (t > 6) g.text(stale ? "read returned v1: STALE" : "read includes a replica with v2", 380, 270, { size: 12, color: stale ? pal.bad : pal.ok, bold: true });
    else g.text(t < 4.6 ? `write waits for ${W} ack${W > 1 ? "s" : ""}` : `read asks ${R} replica${R > 1 ? "s" : ""}`, 380, 270, { size: 11 });
  },
};

const monolith: Scene = {
  title: "Monolith vs microservices as teams grow",
  caption: "In one deployable, every team's change joins the same release queue and more teams means more waiting. Splitting into services frees each team to ship alone, but every request now crosses the network.",
  controls: [{ id: "teams", kind: "range", label: "Teams", min: 1, max: 8, step: 1, initial: 5 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const N = g.v.teams;
    const cols = [pal.accent, pal.blue, pal.ok, pal.violet, pal.teal, pal.bad, pal.paper, pal.muted];
    g.text("monolith", 120, 22, { size: 12, color: pal.paper, bold: true });
    g.text("microservices", 360, 22, { size: 12, color: pal.paper, bold: true });
    g.line(240, 12, 240, 250, pal.line, 0.4);
    g.rect(40, 40, 160, 110, pal.panel, 1, 8);
    g.frame(40, 40, 160, 110, pal.line, 1, 8);
    for (let k = 0; k < N; k++) g.rect(50 + (k % 4) * 36, 52 + Math.floor(k / 4) * 44, 30, 36, cols[k], 0.55, 4);
    const queue = N - 1;
    const q = g.loop(4);
    for (let k = 0; k < N; k++) {
      const wait = (k / N + q) % 1;
      g.dot(30 + (k % 8) * 0, 176 + k * 0, 0.1, pal.ink, 0);
      g.dot(52 + k * 16, 186, 5, cols[k], 0.9);
      g.text(String(k + 1), 52 + k * 16, 200, { size: 8 });
      if (k === Math.floor(q * N)) g.glow(52 + k * 16, 186, 14, pal.ok, 0.5);
      void wait;
    }
    g.text("one release train", 120, 168, { size: 10 });
    g.text(`teams waiting on others: ${queue}`, 120, 224, { size: 12, color: queue > 3 ? pal.bad : pal.paper });
    const pts: [number, number][] = [];
    for (let k = 0; k < N; k++) pts.push(ptOnCircle(k, N, 360, 100, 52));
    let calls = 0;
    for (let a = 0; a < N; a++) {
      const b = (a + 1) % N;
      if (N > 1) {
        g.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], pal.line, 0.5);
        calls++;
      }
      if (N > 2) {
        const c = (a + 2) % N;
        g.line(pts[a][0], pts[a][1], pts[c][0], pts[c][1], pal.line, 0.25);
      }
    }
    pts.forEach(([x, y], k) => {
      server(g, x, y, "", { size: 22, color: cols[k], ring: cols[k] });
      g.packet(x, y, pts[(k + 1) % N][0], pts[(k + 1) % N][1], (g.t * 0.5 + k * 0.17) % 1, cols[k], 1.8);
    });
    g.text("each team ships on its own", 360, 168, { size: 10 });
    g.text(`network hops per request: ~${Math.max(1, Math.round(N * 0.7))}`, 360, 224, { size: 12, color: N > 5 ? pal.accent : pal.paper });
    g.text("pick the split that matches how your teams work", 240, 270, { size: 11 });
    void calls;
  },
};

const shortener: Scene = {
  title: "A URL shortener: create and redirect",
  caption: "Creating a link turns an auto-incrementing number into a short base-62 code. Redirects hit the cache first, and only a miss reads the database and refills the cache.",
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([3.4, 2.4, 3.2]);
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const id = 125000 + Math.floor(g.t / 8.9) * 17;
    const enc = (n: number) => {
      let s = "";
      let x = n;
      do {
        s = alphabet[x % 62] + s;
        x = Math.floor(x / 62);
      } while (x > 0);
      return s;
    };
    const code = enc(id);
    const C = [50, 150];
    const A = [180, 150];
    const K = [310, 90];
    const D = [310, 210];
    g.dot(C[0], C[1], 8, pal.paper);
    g.text("client", C[0], C[1] + 20, { size: 10 });
    server(g, A[0], A[1], "API", { size: 40 });
    server(g, K[0], K[1], "cache", { size: 34, ring: pal.ok });
    db(g, D[0], D[1], 34, 40, pal.paper);
    g.line(C[0] + 12, C[1], A[0] - 24, A[1], pal.line, 0.5);
    g.line(A[0] + 22, A[1] - 8, K[0] - 20, K[1], pal.line, 0.5);
    g.line(A[0] + 22, A[1] + 8, D[0] - 20, D[1] - 10, pal.line, 0.5);
    if (i === 0) {
      g.packet(C[0] + 12, C[1], A[0] - 24, A[1], g.clamp(p * 2), pal.accent);
      g.text("1  create: next id", 410, 40, { size: 11, color: pal.paper });
      chip(g, 400, 80, String(id), pal.accent, 12);
      g.text("↓ base 62", 400, 104, { size: 10 });
      const shown = Math.floor(p * (code.length + 1));
      for (let k = 0; k < code.length; k++) chip(g, 372 + k * 22, 130, k < shown ? code[k] : "·", k < shown ? pal.ok : pal.muted, 12);
      g.packet(A[0] + 22, A[1] + 8, D[0] - 20, D[1] - 10, g.clamp((p - 0.5) * 2), pal.accent, 2.4);
      g.text(`short.ly/${code}`, 240, 270, { size: 14, color: pal.ok, bold: true });
    } else if (i === 1) {
      g.text("2  redirect: cache hit", 410, 40, { size: 11, color: pal.paper });
      const q = p;
      if (q < 0.3) g.packet(C[0] + 12, C[1], A[0] - 24, A[1], q / 0.3, pal.accent);
      else if (q < 0.55) g.packet(A[0] + 22, A[1] - 8, K[0] - 20, K[1], (q - 0.3) / 0.25, pal.accent);
      else if (q < 0.8) g.packet(K[0] - 20, K[1], A[0] + 22, A[1] - 8, (q - 0.55) / 0.25, pal.ok);
      else g.packet(A[0] - 24, A[1], C[0] + 12, C[1], (q - 0.8) / 0.2, pal.ok);
      g.text("301 redirect in about 1 ms", 240, 270, { size: 13, color: pal.ok });
    } else {
      g.text("3  redirect: cache miss", 410, 40, { size: 11, color: pal.paper });
      const q = p;
      if (q < 0.2) g.packet(C[0] + 12, C[1], A[0] - 24, A[1], q / 0.2, pal.accent);
      else if (q < 0.35) {
        g.packet(A[0] + 22, A[1] - 8, K[0] - 20, K[1], (q - 0.2) / 0.15, pal.accent);
        g.text("miss", K[0], K[1] - 28, { size: 10, color: pal.bad });
      } else if (q < 0.6) g.packet(A[0] + 22, A[1] + 8, D[0] - 20, D[1] - 10, (q - 0.35) / 0.25, pal.accent);
      else if (q < 0.8) {
        g.packet(D[0] - 20, D[1] - 10, A[0] + 22, A[1] + 8, (q - 0.6) / 0.2, pal.ok);
        g.packet(A[0] + 22, A[1] - 8, K[0] - 20, K[1], (q - 0.6) / 0.2, pal.ok);
      } else g.packet(A[0] - 24, A[1], C[0] + 12, C[1], (q - 0.8) / 0.2, pal.ok);
      g.text("read the database, fill the cache, redirect", 240, 270, { size: 12, color: pal.paper });
    }
  },
};

const chat: Scene = {
  title: "A chat message end to end",
  caption: "Alice's message is stored with a sequence number, the registry tells the server where Bob is connected, and it is pushed over his WebSocket. If Bob is offline it waits in storage until he reconnects.",
  controls: [{ id: "on", kind: "toggle", label: "Bob online", initial: true }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.on === 1;
    const T = 10;
    const t = g.t % T;
    const A = [50, 80];
    const S1 = [170, 80];
    const R = [260, 160];
    const S2 = [330, 80];
    const B = [440, 80];
    server(g, A[0], A[1], "Alice", { size: 34 });
    server(g, S1[0], S1[1], "server 1", { size: 36 });
    server(g, S2[0], S2[1], "server 2", { size: 36 });
    server(g, B[0], B[1], "Bob", { size: 34, color: on ? pal.paper : pal.muted, ring: on ? pal.ok : pal.line });
    db(g, R[0], R[1] + 10, 34, 40, pal.paper);
    g.text("registry + message store", R[0], R[1] + 44, { size: 9 });
    g.line(A[0] + 20, A[1], S1[0] - 22, S1[1], pal.line, 0.5);
    g.line(S2[0] + 22, S2[1], B[0] - 20, B[1], pal.line, on ? 0.7 : 0.25);
    g.line(S1[0] + 22, S1[1], S2[0] - 22, S2[1], pal.line, 0.4);
    let msg = "";
    if (t < 1.4) {
      g.packet(A[0] + 20, A[1], S1[0] - 22, S1[1], t / 1.4, pal.accent);
      msg = "Alice sends: hi";
    } else if (t < 2.8) {
      g.packet(S1[0], S1[1] + 22, R[0] - 8, R[1] - 12, (t - 1.4) / 1.4, pal.accent);
      msg = "stored with sequence #41, then ask: where is Bob?";
    } else if (t < 4.2) {
      g.packet(R[0] + 8, R[1] - 12, S1[0] + 8, S1[1] + 22, (t - 2.8) / 1.4, pal.blue);
      msg = on ? "Bob is connected to server 2" : "Bob is offline";
    } else if (on) {
      if (t < 5.6) g.packet(S1[0] + 22, S1[1], S2[0] - 22, S2[1], (t - 4.2) / 1.4, pal.accent);
      else if (t < 7) g.packet(S2[0] + 22, S2[1], B[0] - 20, B[1], (t - 5.6) / 1.4, pal.ok, 3.2);
      msg = t < 5.6 ? "server 1 forwards to server 2" : t < 7 ? "pushed over Bob's WebSocket" : "delivered ✓✓";
    } else {
      chip(g, R[0], R[1] - 34, "pending for Bob", pal.accent, 10);
      if (t > 7.5) g.packet(R[0] + 8, R[1] - 12, B[0] - 20, B[1], g.clamp((t - 7.5) / 2), pal.ok, 3);
      msg = t < 7.5 ? "no connection: message waits in storage" : "Bob reconnects: pending messages flush";
    }
    g.text(msg, 240, 250, { size: 12, color: pal.paper });
    const ticks = t > 7 && on ? "✓✓ delivered" : t > 3 ? "✓ sent" : "";
    g.text(ticks, A[0], A[1] + 40, { size: 10, color: pal.ok });
  },
};

const crawler: Scene = {
  title: "A polite, deduplicating web crawler",
  caption: "Workers pull URLs from the frontier but each domain has a cooldown ring, so no site is hammered. Links are checked against a seen-set first. One domain generates endless new URLs: a crawler trap.",
  controls: [{ id: "trap", kind: "toggle", label: "Trap detection", initial: false }],
  aspect: 0.68,
  make: () => {
    const cool = [0, 0, 0];
    let frontier = 6;
    let fetched = 0;
    let skipped = 0;
    let last = -1;
    const flashes: { at: number; d: number; dup: boolean }[] = [];
    return (g) => {
      const { pal } = g;
      const doms = [
        { n: "news.com", y: 60, c: pal.accent },
        { n: "wiki.org", y: 130, c: pal.blue },
        { n: "cal.trap", y: 200, c: pal.bad },
      ];
      const tick = Math.floor(g.t / 0.35);
      if (tick !== last) {
        last = tick;
        const d = tick % 3;
        const trapOff = g.v.trap === 1 && d === 2 && fetched > 24;
        if (g.t - cool[d] > 1.0 && frontier > 0 && !trapOff) {
          cool[d] = g.t;
          frontier--;
          const dup = g.rnd(tick * 4.1) < 0.3;
          flashes.push({ at: g.t, d, dup });
          if (dup) skipped++;
          else {
            fetched++;
            frontier += d === 2 ? 3 : 2;
          }
        } else if (trapOff) skipped++;
        frontier = Math.min(frontier, 60);
      }
      while (flashes.length && g.t - flashes[0].at > 1.2) flashes.shift();
      doms.forEach((d, k) => {
        g.rect(30, d.y - 24, 110, 48, pal.panel, 1, 8);
        g.frame(30, d.y - 24, 110, 48, d.c, 0.8, 8);
        g.text(d.n, 85, d.y - 6, { size: 11, color: pal.paper });
        const left = Math.max(0, 1 - (g.t - cool[k]) / 1.0);
        arcStroke(g, 172, d.y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, Math.max(0.001, left)), left > 0 ? pal.accent : pal.ok, 3, 0.9);
        g.text(left > 0 ? "wait" : "ready", 172, d.y + 26, { size: 8, color: left > 0 ? pal.accent : pal.ok });
        g.line(190, d.y, 280, 130, pal.line, 0.3);
      });
      server(g, 300, 130, "fetchers", { size: 40, state: "searching" });
      flashes.forEach((f) => {
        const q = (g.t - f.at) / 1.2;
        const d = doms[f.d];
        if (q < 0.5) g.packet(190, d.y, 280, 130, q / 0.5, f.dup ? pal.muted : d.c, 2.4);
        else if (!f.dup) g.packet(320, 130, 420, 130, (q - 0.5) / 0.5, d.c, 2.4);
        else g.glow(300, 130, 30 * (1 - q), pal.muted, 0.5);
      });
      g.text("frontier", 430, 60, { size: 10 });
      for (let k = 0; k < Math.min(frontier, 40); k++) g.dot(400 + (k % 8) * 8, 76 + Math.floor(k / 8) * 8, 2.2, pal.accent, 0.8);
      g.text(`${frontier} queued`, 430, 128, { size: 10, color: frontier > 40 ? pal.bad : pal.paper });
      g.text(`fetched ${fetched}   skipped as seen ${skipped}`, 240, 262, { size: 12, color: pal.paper });
      g.text(g.v.trap === 1 ? "trap domain is capped after too many URLs" : "the trap domain keeps feeding the frontier", 240, 286, { size: 11, color: g.v.trap === 1 ? pal.ok : pal.bad });
      if (g.t < 0.1) {
        frontier = 6;
        fetched = 0;
        skipped = 0;
      }
    };
  },
};

const transcode: Scene = {
  title: "Upload, queue and parallel transcoding",
  caption: "The video uploads in chunks straight to object storage and the uploader is released. An event queues the job, and a pool of workers turns it into several renditions at once.",
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const T = 12;
    const t = g.t % T;
    const U = [40, 130];
    const S = [150, 130];
    const Q = [250, 130];
    server(g, U[0], U[1], "uploader", { size: 34 });
    g.rect(S[0] - 26, S[1] - 26, 52, 52, pal.panel, 1, 8);
    g.frame(S[0] - 26, S[1] - 26, 52, 52, pal.line, 1, 8);
    g.text("object store", S[0], S[1] + 40, { size: 9 });
    g.rect(Q[0] - 18, Q[1] - 30, 36, 60, pal.panel, 1, 6);
    g.frame(Q[0] - 18, Q[1] - 30, 36, 60, pal.line, 1, 6);
    g.text("queue", Q[0], Q[1] + 42, { size: 9 });
    const chunks = Math.min(6, Math.floor(t / 0.6));
    for (let k = 0; k < 6; k++) g.rect(S[0] - 20 + (k % 3) * 14, S[1] - 18 + Math.floor(k / 3) * 18, 12, 14, k < chunks ? pal.blue : pal.ink, k < chunks ? 0.85 : 0.4, 2);
    if (t < 3.6) g.packet(U[0] + 20, U[1], S[0] - 26, S[1], (t * 1.7) % 1, pal.accent, 2.4);
    if (t > 3.6 && t < 4.6) g.text("uploader released", U[0], U[1] + 36, { size: 9, color: pal.ok });
    if (t > 3.8) {
      if (t < 4.8) g.packet(S[0] + 26, S[1], Q[0] - 18, Q[1], t - 3.8, pal.violet, 3);
      g.dot(Q[0], Q[1] - 10, 4, pal.violet);
    }
    const res = ["240p", "480p", "720p", "1080p", "4K"];
    res.forEach((r, k) => {
      const y = 40 + k * 46;
      const start = 5 + k * 0.3;
      const dur = 2.2 + k * 0.9;
      const prog = g.clamp((t - start) / dur);
      server(g, 340, y, "", { size: 26, state: prog > 0 && prog < 1 ? "working" : "breathing", color: prog >= 1 ? pal.ok : pal.paper });
      g.text(r, 376, y - 8, { size: 10, align: "left", color: pal.paper });
      bar(g, 376, y + 2, 84, 6, prog, prog >= 1 ? pal.ok : pal.accent);
      if (t > 4.8 && t < start + 0.6) g.packet(Q[0] + 18, Q[1], 326, y, g.clamp((t - 4.8) / (start - 4.8 + 0.6)), pal.violet, 2);
    });
    g.text(t < 3.6 ? "1  chunked upload to object storage" : t < 5 ? "2  event queues a transcode job" : t < 10 ? "3  workers produce renditions in parallel" : "all renditions ready: publish to the CDN", 240, 268, { size: 12, color: t > 10 ? pal.ok : pal.paper });
  },
};

const providers: Scene = {
  title: "Notifications with retries and a fallback provider",
  caption: "Urgent notifications jump ahead of bulk ones. When the primary provider fails, workers retry with growing delays and then fall back to a second provider instead of dropping the message.",
  controls: [{ id: "down", kind: "toggle", label: "Primary provider down", initial: false }],
  aspect: 0.66,
  make: () => {
    type M = { born: number; hi: boolean; y: number };
    const msgs: M[] = [];
    let acc = 0;
    let n = 0;
    return (g) => {
      const { pal } = g;
      const down = g.v.down === 1;
      acc += g.dt * 2.2;
      while (acc >= 1) {
        acc -= 1;
        n++;
        msgs.push({ born: g.t, hi: g.rnd(n * 3.1) < 0.3, y: 0 });
      }
      while (msgs.length && g.t - msgs[0].born > 4.6) msgs.shift();
      g.rect(24, 30, 90, 80, pal.panel, 1, 8);
      g.text("urgent", 69, 44, { size: 10, color: pal.accent });
      g.rect(24, 140, 90, 80, pal.panel, 1, 8);
      g.text("bulk", 69, 154, { size: 10, color: pal.muted });
      server(g, 190, 130, "workers", { size: 40, state: "working" });
      server(g, 400, 70, "provider A", { size: 36, color: down ? pal.bad : pal.paper, ring: down ? pal.bad : undefined });
      server(g, 400, 200, "provider B", { size: 36 });
      if (down) g.text("✕", 400, 70, { size: 20, color: pal.bad, bold: true });
      msgs.forEach((m) => {
        const age = g.t - m.born;
        const y0 = m.hi ? 70 : 180;
        const wait = m.hi ? 0 : 0.8;
        if (age < wait + 0.5) {
          g.dot(69 + (age * 8) % 30 - 15, y0, 3, m.hi ? pal.accent : pal.muted);
          return;
        }
        const a = age - wait - 0.5;
        g.packet(114, y0, 164, 130, g.clamp(a / 0.5), m.hi ? pal.accent : pal.muted, 2.4);
        if (a < 0.5) return;
        if (!down) g.packet(214, 130, 372, 70, g.clamp((a - 0.5) / 0.9), pal.ok, 2.4);
        else if (a < 1.4) g.packet(214, 130, 372, 70, g.clamp((a - 0.5) / 0.9), pal.bad, 2.4);
        else if (a < 2.4) {
          g.text(a < 2.0 ? "retry in 1 s" : "retry in 2 s", 290, 90, { size: 9, color: pal.accent });
          g.packet(214, 130, 250, 110, g.clamp((a - 1.4) / 0.4), pal.accent, 2);
        } else g.packet(214, 130, 372, 200, g.clamp((a - 2.4) / 0.9), pal.ok, 2.4);
      });
      g.text(down ? "failures back off, then fail over to provider B" : "provider A is healthy: sent directly", 240, 262, { size: 12, color: down ? pal.accent : pal.ok });
    };
  },
};

const observability: Scene = {
  title: "Logs, metrics and traces during an incident",
  caption: "Metrics show that something is wrong, traces show where in the request path, and logs show the exact error. Press the button to start an incident and watch the alert fire.",
  controls: [{ id: "inc", kind: "button", label: "Start an incident" }],
  aspect: 0.7,
  make: () => {
    let incAt = -100;
    const hist: number[] = [];
    let last = -1;
    return (g) => {
      const { pal } = g;
      if (g.pressed("inc")) incAt = g.t;
      const since = g.t - incAt;
      const incident = since >= 0 && since < 9;
      const tick = Math.floor(g.t / 0.15);
      if (tick !== last) {
        last = tick;
        const base = 2 + g.rnd(tick * 1.7) * 1.4;
        hist.push(incident ? base + Math.min(14, since * 3) : base);
        if (hist.length > 70) hist.shift();
      }
      g.text("metrics: error rate", 120, 18, { size: 10, color: pal.blue });
      g.rect(24, 26, 210, 80, pal.panel, 1, 6);
      const thr = 8;
      g.line(24, 106 - thr * 4.2, 234, 106 - thr * 4.2, pal.bad, 0.5, 1);
      g.text("alert threshold", 200, 106 - thr * 4.2 - 6, { size: 8, color: pal.bad });
      for (let k = 1; k < hist.length; k++) g.line(24 + (k - 1) * 3, 106 - hist[k - 1] * 4.2, 24 + k * 3, 106 - hist[k] * 4.2, hist[k] > thr ? pal.bad : pal.blue, 1, 1.6);
      const firing = hist.length > 0 && hist[hist.length - 1] > thr;
      if (firing) {
        g.glow(120, 66, 110, pal.bad, 0.12 + 0.08 * Math.sin(g.t * 8));
        chip(g, 190, 124, "ALERT: error rate high", pal.bad, 10);
      }
      g.text("traces: one request", 360, 18, { size: 10, color: pal.violet });
      const spans = [
        { n: "gateway", x: 0, w: 1 },
        { n: "orders", x: 0.1, w: 0.8 },
        { n: "payments", x: 0.2, w: incident ? 0.7 : 0.25 },
        { n: "db", x: incident ? 0.3 : 0.25, w: incident ? 0.55 : 0.12 },
      ];
      spans.forEach((s, k) => {
        const slow = incident && k >= 2;
        g.rect(270 + s.x * 190, 30 + k * 22, s.w * 190, 16, slow ? pal.bad : pal.violet, slow ? 0.8 : 0.5, 3);
        g.text(s.n, 274 + s.x * 190, 38 + k * 22, { size: 8, align: "left", color: pal.paper });
      });
      g.text(incident ? "the db span is the slow one" : "all spans fast", 365, 124, { size: 9, color: incident ? pal.bad : pal.muted });
      g.text("logs", 36, 160, { size: 10, color: pal.accent, align: "left" });
      for (let k = 0; k < 6; k++) {
        const isErr = incident && since > 1 && (k + Math.floor(g.t * 2)) % 2 === 0;
        const msgs = isErr ? ["ERROR db timeout after 3000 ms", "ERROR connection pool exhausted", "WARN retrying payment"] : ["INFO order 8841 created", "INFO payment ok", "INFO cache hit user:7"];
        g.text(msgs[(k + Math.floor(g.t * 2)) % 3], 36, 178 + k * 15, { size: 9, align: "left", color: isErr ? pal.bad : pal.muted });
      }
      g.text(firing ? "metrics fired the alert, traces and logs explain it" : "all three signals look healthy", 240, 290, { size: 11, color: firing ? pal.bad : pal.ok });
      void bar;
      void fmt;
      void hash32;
    };
  },
};

const dynamo: Scene = {
  title: "Dynamo: sloppy quorum and hinted handoff",
  caption: "A key is stored on the next three nodes around the ring. If one of them is down, the write goes to a stand-in with a hint rather than failing, and the stand-in hands the data back when the node returns.",
  controls: [{ id: "down", kind: "toggle", label: "Node B down", initial: true }],
  aspect: 0.68,
  make: () => (g) => {
    const { pal } = g;
    const down = g.v.down === 1;
    const names = ["A", "B", "C", "D", "E"];
    const cx = 170;
    const cy = 140;
    const R = 92;
    const T = 10;
    const t = g.t % T;
    const pos = names.map((_, k) => ptOnCircle(k, 5, cx, cy, R));
    g.ring(cx, cy, R, pal.line, 0.5, 1);
    const pref = [0, 1, 2];
    names.forEach((n, k) => {
      const dead = down && k === 1 && t < 7;
      server(g, pos[k][0], pos[k][1], `node ${n}`, { size: 34, color: dead ? pal.bad : pal.paper, ring: pref.includes(k) ? pal.accent : undefined });
      if (dead) g.text("✕", pos[k][0], pos[k][1], { size: 18, color: pal.bad, bold: true });
    });
    g.dot(cx, cy, 5, pal.paper);
    g.text("write", cx, cy + 16, { size: 10 });
    const target = (k: number) => (down && k === 1 && t < 7 ? 3 : k);
    pref.forEach((k) => {
      const dst = target(k);
      if (t > 0.8 && t < 2.6) {
        g.packet(cx, cy, pos[dst][0], pos[dst][1], g.clamp((t - 0.8) / 1.4), dst === 3 ? pal.violet : pal.accent, 2.6);
      }
      if (t > 2.6 && dst === 3 && t < 7) chip(g, pos[3][0], pos[3][1] + 40, "hint: for B", pal.violet, 9);
    });
    if (down && t > 7 && t < 9) g.packet(pos[3][0], pos[3][1], pos[1][0], pos[1][1], (t - 7) / 2, pal.violet, 3);
    const msg = !down ? "all three replicas reachable" : t < 2.6 ? "write goes to A, B and C" : t < 7 ? "B is down: D takes its copy, tagged with a hint" : t < 9 ? "B is back: D hands the data over" : "B has caught up";
    g.text(msg, 240, 268, { size: 12, color: down && t < 7 && t > 2.6 ? pal.violet : pal.paper });
    g.text("writes keep succeeding: availability over strict consistency", 240, 288, { size: 10 });
  },
};

const tao: Scene = {
  title: "TAO: reads from cache, writes to the master region",
  caption: "Reads are served from the cache tier next to the user and almost never reach MySQL. A write from another region is forwarded to the master region, and the caches are invalidated so readers refetch.",
  aspect: 0.68,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2.6, 3, 4]);
    g.rect(20, 30, 200, 200, pal.panel, 0.7, 10);
    g.rect(260, 30, 200, 200, pal.panel, 0.7, 10);
    g.text("remote region", 120, 22, { size: 10 });
    g.text("master region", 360, 22, { size: 10, color: pal.accent });
    const App = [70, 120];
    const C1 = [160, 120];
    const C2 = [310, 80];
    const M = [400, 170];
    g.dot(App[0], App[1], 8, pal.paper);
    g.text("app", App[0], App[1] + 20, { size: 9 });
    server(g, C1[0], C1[1], "cache", { size: 38, ring: pal.ok });
    server(g, C2[0], C2[1], "cache", { size: 38, ring: pal.ok });
    db(g, M[0], M[1], 36, 44, pal.paper);
    g.text("MySQL", M[0], M[1] + 40, { size: 9 });
    let msg = "";
    if (i === 0) {
      g.packet(App[0] + 10, App[1], C1[0] - 22, C1[1], g.clamp(p * 2), pal.accent);
      if (p > 0.5) g.packet(C1[0] - 22, C1[1] + 6, App[0] + 10, App[1] + 6, g.clamp((p - 0.5) * 2), pal.ok);
      msg = "read: answered by the nearby cache, MySQL untouched";
    } else if (i === 1) {
      g.packet(App[0] + 10, App[1], C1[0] - 22, C1[1], g.clamp(p * 4), pal.accent);
      g.text("miss", C1[0], C1[1] - 30, { size: 10, color: p > 0.2 ? pal.bad : pal.muted });
      if (p > 0.3) g.packet(C1[0] + 22, C1[1], C2[0] - 22, C2[1], g.clamp((p - 0.3) * 3), pal.accent);
      if (p > 0.6) g.packet(C2[0] + 18, C2[1] + 12, M[0] - 10, M[1] - 20, g.clamp((p - 0.6) * 3), pal.accent);
      msg = "read miss: ask the leader cache, then MySQL, and refill";
    } else {
      if (p < 0.25) g.packet(App[0] + 10, App[1], C1[0] - 22, C1[1], p / 0.25, pal.blue);
      else if (p < 0.5) g.packet(C1[0] + 22, C1[1], C2[0] - 22, C2[1], (p - 0.25) / 0.25, pal.blue);
      else if (p < 0.7) g.packet(C2[0] + 18, C2[1] + 12, M[0] - 10, M[1] - 20, (p - 0.5) / 0.2, pal.blue);
      else {
        g.packet(C2[0], C2[1] + 20, C1[0] + 10, C1[1] - 20, g.clamp((p - 0.7) / 0.3), pal.bad, 2.6);
        g.glow(C1[0], C1[1], 40, pal.bad, 0.4);
        g.glow(C2[0], C2[1], 40, pal.bad, 0.3);
      }
      msg = p < 0.7 ? "write: forwarded to the master region's database" : "caches are told to invalidate the stale copy";
    }
    g.text(msg, 240, 262, { size: 12, color: pal.paper });
  },
};

const spanner: Scene = {
  title: "TrueTime and commit wait",
  caption: "Spanner knows the time only within an uncertainty interval. A transaction takes the latest end of that interval as its commit time, then waits until that moment has surely passed everywhere before acknowledging.",
  controls: [{ id: "eps", kind: "range", label: "Clock uncertainty ±", min: 1, max: 20, step: 1, initial: 7, unit: " ms" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const eps = g.v.eps;
    const T = 9;
    const t = g.t % T;
    const x0 = 40;
    const scale = 8;
    const nowMs = 10 + t * 4;
    const X = (ms: number) => x0 + (ms / 60) * 400;
    g.line(x0, 150, 440, 150, pal.line);
    for (let m = 0; m <= 60; m += 10) {
      g.line(X(m), 146, X(m), 154, pal.line);
      g.text(`${m}`, X(m), 166, { size: 9 });
    }
    g.text("ms", 452, 150, { size: 9, align: "left" });
    const lo = nowMs - eps;
    const hi = nowMs + eps;
    g.rect(X(lo), 120, X(hi) - X(lo), 20, pal.blue, 0.3, 4);
    g.frame(X(lo), 120, X(hi) - X(lo), 20, pal.blue, 1, 4);
    g.dot(X(nowMs), 130, 3, pal.paper);
    g.text("TrueTime now: [earliest, latest]", X(nowMs), 108, { size: 10, color: pal.blue });
    const commitAt = 22;
    const stamp = commitAt + eps;
    const begin = commitAt;
    if (nowMs > begin) {
      g.line(X(stamp), 60, X(stamp), 150, pal.accent, 0.9, 1.6);
      g.text(`commit time s = ${stamp} ms (latest)`, X(stamp), 50, { size: 10, color: pal.accent });
      const waiting = lo < stamp;
      g.rect(X(begin), 176, Math.max(0, Math.min(X(lo), X(stamp)) - X(begin)), 12, waiting ? pal.accent : pal.ok, 0.8, 3);
      g.text(waiting ? `commit wait: until earliest > s` : "s is in the past everywhere: acknowledge", 240, 204, { size: 11, color: waiting ? pal.accent : pal.ok });
      if (!waiting) g.glow(X(stamp), 150, 30, pal.ok, 0.4);
    } else g.text("transaction is ready to commit", 240, 60, { size: 11 });
    g.text(`commit wait ≈ ${2 * eps} ms: tighter clocks mean faster commits`, 240, 250, { size: 12, color: pal.paper });
    g.text("a later transaction always gets a later timestamp", 240, 272, { size: 11 });
    void scale;
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/reliability-and-operations/load-balancing-and-health-checks`]: balancer,
  [`${P}/reliability-and-operations/graceful-degradation-and-circuit-breakers`]: breaker,
  [`${P}/reliability-and-operations/chaos-engineering-and-disaster-recovery`]: disaster,
  [`${P}/service-and-data-designs/designing-a-distributed-key-value-store`]: quorum,
  [`${P}/service-and-data-designs/microservices-vs-monolith-and-service-boundaries`]: monolith,
  [`${P}/product-designs/designing-a-url-shortener`]: shortener,
  [`${P}/product-designs/designing-a-chat-system`]: chat,
  [`${P}/product-designs/designing-a-web-crawler`]: crawler,
  [`${P}/media-and-operations-designs/designing-a-video-upload-and-transcoding-pipeline`]: transcode,
  [`${P}/media-and-operations-designs/designing-a-notification-system`]: providers,
  [`${P}/media-and-operations-designs/designing-a-distributed-logging-and-monitoring-system`]: observability,
  [`${P}/engineering-case-studies/amazon-dynamo-lessons`]: dynamo,
  [`${P}/engineering-case-studies/case-study-facebook-tao-graph-store`]: tao,
  [`${P}/engineering-case-studies/case-study-google-spanner`]: spanner,
};
