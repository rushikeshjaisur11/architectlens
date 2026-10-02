import type { Scene } from "../scene/types";
import { bar, chip, db, fmt, server } from "./kit";

const P = "system-design";

const apis: Scene = {
  title: "One screen, three API styles",
  caption: "The same screen needs a user, their posts and the comments. REST makes a trip per resource, GraphQL asks once for exactly those fields, and gRPC sends one compact binary call.",
  make: () => (g) => {
    const { pal } = g;
    const rows = [
      { y: 66, name: "REST", note: "3 round trips" },
      { y: 154, name: "GraphQL", note: "1 round trip, only asked fields" },
      { y: 242, name: "gRPC", note: "1 round trip, binary" },
    ];
    const res = [pal.blue, pal.violet, pal.teal];
    const cx = 60;
    const sx = 420;
    rows.forEach((r) => {
      g.text(r.name, 24, r.y - 34, { size: 12, color: pal.paper, align: "left", bold: true });
      g.text(r.note, 456, r.y - 34, { size: 10, align: "right" });
      g.line(cx + 12, r.y, sx - 26, r.y, pal.line, 0.5);
      g.dot(cx, r.y, 7, pal.paper);
      server(g, sx, r.y, "", { size: 32 });
      for (let i = 0; i < 3; i++) g.ring(cx - 14 + i * 14, r.y + 20, 4, pal.line, 0.8);
    });
    const p = g.loop(9);
    const k = Math.min(2, Math.floor(p * 3));
    const q = p * 3 - k;
    for (let i = 0; i < 3; i++) {
      if (i < k || (i === k && q > 0.95)) g.dot(46 + i * 14, rows[0].y + 20, 4, res[i]);
    }
    if (q < 0.5) g.packet(cx + 12, rows[0].y, sx - 26, rows[0].y, q / 0.5, pal.accent);
    else g.packet(sx - 26, rows[0].y, cx + 12, rows[0].y, (q - 0.5) / 0.5, res[k]);

    const pg = (g.loop(5) * 2) % 2;
    const back = pg >= 1;
    const pgq = pg % 1;
    if (!back) g.packet(cx + 12, rows[1].y, sx - 26, rows[1].y, pgq, pal.accent, 4);
    else for (let i = 0; i < 3; i++) g.packet(sx - 26, rows[1].y, cx + 12, rows[1].y, Math.max(0, pgq - i * 0.07), res[i], 2.6);
    if (g.loop(5) > 0.5) for (let i = 0; i < 3; i++) g.dot(46 + i * 14, rows[1].y + 20, 4, res[i]);

    const pr = (g.loop(3) * 2) % 2;
    const bq = pr % 1;
    const sq = (x: number, y: number) => g.rect(x - 3.5, y - 3.5, 7, 7, pal.accent, 1, 1.5);
    if (pr < 1) sq(g.mix(cx + 12, sx - 26, bq), rows[2].y);
    else sq(g.mix(sx - 26, cx + 12, bq), rows[2].y);
    if (g.loop(3) > 0.5) for (let i = 0; i < 3; i++) g.dot(46 + i * 14, rows[2].y + 20, 4, res[i]);
  },
};

const idempotency: Scene = {
  title: "A retry that must not charge twice",
  caption: "The response to a charge is lost, so the client retries. With an idempotency key the server recognizes the repeat and replays the stored result. Switch it off to see the double charge.",
  controls: [{ id: "key", kind: "toggle", label: "Idempotency key", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const keyOn = g.v.key === 1;
    const C = [60, 130];
    const S = [220, 130];
    const Pm = [400, 130];
    const T = 11;
    const t = g.t % T;
    const charged = t > 2.2 ? (keyOn ? 1 : t > 8.0 ? 2 : 1) : 0;

    g.line(C[0] + 14, C[1], S[0] - 26, S[1], pal.line, 0.5);
    g.line(S[0] + 26, S[1], Pm[0] - 26, Pm[1], pal.line, 0.5);
    g.dot(C[0], C[1], 8, pal.paper);
    g.text("client", C[0], C[1] + 22, { size: 11 });
    server(g, S[0], S[1], "server", { state: t < 2.2 || (t > 6 && t < 8) ? "working" : "breathing" });
    server(g, Pm[0], Pm[1], "payment", { ring: charged > 1 ? pal.bad : undefined });
    chip(g, Pm[0], Pm[1] + 62, `charged $${charged * 50}`, charged > 1 ? pal.bad : charged === 1 ? pal.ok : pal.muted);
    if (keyOn) {
      g.frame(S[0] - 52, S[1] + 40, 104, 28, pal.line, 1, 5);
      g.text("keys seen", S[0], S[1] + 34, { size: 9 });
      if (t > 1.6) chip(g, S[0], S[1] + 54, "K1 → $50 ok", pal.accent, 10);
    }

    const label = keyOn ? "POST /charge  K1" : "POST /charge";
    if (t < 1.8) {
      g.packet(C[0] + 14, C[1], S[0] - 26, S[1], t / 1.8, pal.accent);
      g.text(label, 140, 98, { size: 10, color: pal.accent });
    } else if (t < 2.6) g.packet(S[0] + 26, S[1], Pm[0] - 26, Pm[1], (t - 1.8) / 0.8, pal.blue);
    else if (t < 4.6) {
      const q = (t - 2.6) / 2;
      g.packet(S[0] - 26, S[1], C[0] + 14, C[1], q, pal.ok);
      if (q > 0.55) {
        g.text("✕", g.mix(S[0] - 26, C[0] + 14, 0.55), S[1], { size: 20, color: pal.bad, bold: true });
        g.text("response lost", 140, 98, { size: 10, color: pal.bad });
      }
    } else if (t < 6.2) {
      g.text("client times out, retries", 140, 98, { size: 10, color: pal.muted });
      g.packet(C[0] + 14, C[1], S[0] - 26, S[1], (t - 4.6) / 1.6, pal.accent);
    } else if (t < 8) {
      if (keyOn) {
        g.text("K1 already seen: replay", 140, 98, { size: 10, color: pal.ok });
        g.glow(S[0], S[1], 40, pal.ok, 0.25);
        g.packet(S[0] - 26, S[1], C[0] + 14, C[1], (t - 6.2) / 1.8, pal.ok);
      } else g.packet(S[0] + 26, S[1], Pm[0] - 26, Pm[1], (t - 6.2) / 1.8, pal.bad);
    } else if (t < 9.6) {
      g.text(keyOn ? "customer charged once" : "customer charged twice", 240, 230, { size: 13, color: keyOn ? pal.ok : pal.bad });
    }
  },
};

const pagination: Scene = {
  title: "Offset vs cursor pagination",
  caption: "A new item lands at the top between page 1 and page 2. Offset paging counts positions, so item 4 appears twice. A cursor remembers the last item, so page 2 continues cleanly.",
  controls: [{ id: "m", kind: "choice", label: "Paging", options: ["offset", "cursor"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const cursor = g.v.m === 1;
    const { i, p } = g.stage([2.4, 2.4, 3.2]);
    const y0 = 36;
    const dy = 19.5;
    const inserted = i >= 1;
    const shift = i === 1 ? g.ease(p) : inserted ? 1 : 0;
    const ids = Array.from({ length: 11 }, (_, k) => k + 1);
    ids.forEach((id) => {
      const y = y0 + (id - 1 + shift) * dy;
      const dup = i === 2 && !cursor && id === 4;
      g.rect(150, y - 7, 90, 14, dup ? pal.bad : pal.panel, dup ? 0.35 : 1, 3);
      g.frame(150, y - 7, 90, 14, dup ? pal.bad : pal.line, 1, 3, 1);
      g.text(`item ${id}`, 195, y, { size: 10, color: dup ? pal.bad : pal.paper });
    });
    if (inserted) {
      const y = y0 + 0 * dy - (1 - shift) * dy;
      g.rect(150, y - 7, 90, 14, pal.ok, 0.3 * shift, 3);
      g.frame(150, y - 7, 90, 14, pal.ok, shift, 3, 1);
      g.text("new item", 195, y, { size: 10, color: pal.ok, a: shift });
    }
    const page = i === 2 ? 2 : 1;
    const topPos = page === 1 ? 0 : cursor ? 4 : 4;
    const wy = y0 + (topPos + (cursor && i === 2 ? 1 : 0) - 0.5 + (i === 2 && cursor ? 0 : 0)) * dy;
    const winY = i === 2 && cursor ? y0 + (4 + 1 - 0.5) * dy : y0 + (topPos - 0.5 + (i === 2 ? 0 : 0)) * dy;
    const w = i === 2 && cursor ? winY : wy;
    g.frame(142, w - 2, 106, dy * 4 + 4, pal.accent, 1, 6, 1.8);
    g.glow(195, w + dy * 2, 70, pal.accent, 0.1);
    g.text(`page ${page}`, 112, w + dy * 2, { size: 12, color: pal.accent, align: "right", bold: true });
    if (cursor && i >= 0) {
      const cy = y0 + (3 + shift) * dy;
      g.arrow(300, cy, 246, cy, pal.violet, 0.9);
      g.text("cursor → after item 4", 304, cy, { size: 10, color: pal.violet, align: "left" });
    }
    const msg = i === 0 ? "page 1: items 1 to 4" : i === 1 ? "a new item is inserted at the top" : cursor ? "page 2 continues after item 4: items 5 to 8" : "page 2 starts at position 5: item 4 shows again";
    g.text(msg, 240, 270, { size: 12, color: i === 2 && !cursor ? pal.bad : pal.paper });
  },
};

const gateway: Scene = {
  title: "An API gateway under load",
  caption: "Every request passes the gateway first. Bad tokens are turned away at authentication, and a token bucket decides how many of the rest reach the services. Lower the limit to watch 429s appear.",
  controls: [{ id: "limit", kind: "range", label: "Limit", min: 1, max: 10, step: 1, initial: 4, unit: "/s" }],
  aspect: 0.62,
  make: () => {
    type Req = { born: number; bad: boolean; target: number; verdict: "pass" | "auth" | "rate"; y: number };
    const reqs: Req[] = [];
    let tokens = 5;
    let acc = 0;
    let n = 0;
    return (g) => {
      const { pal } = g;
      const gx = 190;
      const rate = 7;
      acc += g.dt * rate;
      tokens = Math.min(5, tokens + g.dt * g.v.limit);
      while (acc >= 1) {
        acc -= 1;
        n++;
        const bad = g.rnd(n * 3.3) < 0.15;
        let verdict: Req["verdict"] = "pass";
        if (bad) verdict = "auth";
        else if (tokens >= 1) tokens -= 1;
        else verdict = "rate";
        reqs.push({ born: g.t, bad, target: Math.floor(g.rnd(n * 9.1) * 3), verdict, y: 60 + g.rnd(n * 5.7) * 150 });
      }
      while (reqs.length && g.t - reqs[0].born > 3) reqs.shift();

      g.text("clients", 36, 30, { size: 11 });
      g.frame(gx - 22, 40, 44, 190, pal.line, 1, 8);
      g.orb("connecting", gx, 135, 40, pal.paper, 0.8);
      g.text("gateway", gx, 244, { size: 11, color: pal.paper });
      for (let s = 0; s < 3; s++) server(g, 420, 70 + s * 70, `svc ${s + 1}`, { size: 34 });
      bar(g, gx - 18, 252, 36, 5, tokens / 5, pal.accent);

      for (const r of reqs) {
        const age = g.t - r.born;
        const ty = 70 + r.target * 70;
        if (age < 0.9) g.packet(40, r.y, gx - 22, 135, age / 0.9, r.verdict === "auth" ? pal.bad : pal.accent, 2.4);
        else if (r.verdict === "pass") g.packet(gx + 22, 135, 396, ty, Math.min(1, (age - 0.9) / 1.0), pal.ok, 2.4);
        else {
          const q = Math.min(1, (age - 0.9) / 1.0);
          g.packet(gx - 22, 135, 40, r.y, q, pal.bad, 2.2);
          if (q < 0.5) g.text(r.verdict === "auth" ? "401" : "429", gx - 34, 135 + (r.y - 135) * 0.1, { size: 10, color: pal.bad });
        }
      }
    };
  },
};

const oauth: Scene = {
  title: "OAuth2 authorization code flow",
  caption: "The user never gives the app a password. A one-time code is swapped for an access token, and the API checks the token's scopes: a read-only token is refused on a delete.",
  controls: [{ id: "scope", kind: "choice", label: "Token scope", options: ["read only", "read + write"], initial: 0 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const pts = [
      { x: 56, y: 70, name: "user" },
      { x: 190, y: 70, name: "app" },
      { x: 190, y: 200, name: "auth server" },
      { x: 400, y: 135, name: "API" },
    ];
    pts.forEach((s, k) => server(g, s.x, s.y, s.name, { size: 40, state: k === 3 ? "breathing" : "breathing" }));
    const [U, A, S, R] = pts.map((q) => [q.x, q.y]);
    const { i, p } = g.stage([1.6, 1.6, 1.8, 2.6]);
    const e = g.ease(p);
    if (i === 0) {
      g.packet(U[0] + 26, U[1], A[0] - 26, A[1], e, pal.accent);
      g.text("1  click Sign in", 120, 48, { size: 11, color: pal.paper });
      g.packet(A[0], A[1] + 26, S[0], S[1] - 28, g.clamp(p * 1.5 - 0.4), pal.accent);
    } else if (i === 1) {
      g.packet(U[0] + 10, U[1] + 26, S[0] - 28, S[1] - 6, e, pal.paper);
      g.text("2  login + consent", 90, 158, { size: 11, color: pal.paper });
      if (p > 0.6) g.packet(S[0], S[1] - 28, A[0], A[1] + 26, (p - 0.6) / 0.4, pal.violet);
    } else if (i === 2) {
      chip(g, 262, 150, "code", pal.violet);
      g.packet(A[0] + 12, A[1] + 26, S[0] + 12, S[1] - 28, e, pal.violet);
      g.text("3  code + secret", 280, 118, { size: 11, color: pal.paper, align: "left" });
      if (p > 0.55) g.packet(S[0] + 28, S[1] - 8, A[0] + 28, A[1] + 12, (p - 0.55) / 0.45, pal.ok);
    } else {
      const write = g.v.scope === 1;
      const half = p < 0.5;
      g.text(`4  API call with ${write ? "read+write" : "read-only"} token`, 240, 262, { size: 11, color: pal.paper });
      chip(g, 300, 94, write ? "token: read, write" : "token: read", pal.ok, 10);
      if (half) g.packet(A[0] + 28, A[1], R[0] - 26, R[1], p / 0.5, pal.ok);
      else {
        const allowed = true;
        g.packet(R[0] - 26, R[1], A[0] + 28, A[1], (p - 0.5) / 0.5, write || allowed ? pal.ok : pal.bad);
      }
      const q = p < 0.5 ? "GET /me → ok" : write ? "DELETE /me → 200" : "DELETE /me → 403 scope";
      g.text(q, R[0], R[1] + 44, { size: 11, color: p >= 0.5 && !write ? pal.bad : pal.ok });
    }
  },
};

const asyncOps: Scene = {
  title: "Waiting for a long job",
  caption: "The job runs for a few seconds. Polling asks again and again, wasting requests until it finishes. A webhook costs one callback when the work is done.",
  controls: [{ id: "m", kind: "choice", label: "Client", options: ["polling", "webhook"], initial: 0 }],
  aspect: 0.58,
  make: () => (g) => {
    const { pal } = g;
    const T = 9;
    const t = g.t % T;
    const hook = g.v.m === 1;
    const done = t > 6;
    const prog = g.clamp((t - 0.6) / 5.4);
    const C = [60, 120];
    const J = [380, 120];
    g.dot(C[0], C[1], 8, pal.paper);
    g.text("client", C[0], C[1] + 22, { size: 11 });
    g.line(C[0] + 14, C[1], J[0] - 36, J[1], pal.line, 0.5);
    g.ring(J[0], J[1], 28, pal.line, 0.8, 4);
    g.c.strokeStyle = done ? pal.ok : pal.accent;
    g.c.lineWidth = 4;
    g.c.lineCap = "round";
    g.c.beginPath();
    g.c.arc(J[0], J[1], 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(0.9999, prog));
    g.c.stroke();
    g.c.lineCap = "butt";
    g.orb(done ? "breathing" : "working", J[0], J[1], 38, done ? pal.ok : pal.paper);
    g.text(done ? "job done" : `job ${(prog * 100).toFixed(0)}%`, J[0], J[1] + 46, { size: 11, color: done ? pal.ok : pal.paper });
    g.packet(C[0] + 14, C[1], J[0] - 36, J[1], g.clamp(t / 0.6), pal.accent);
    let wasted = 0;
    if (!hook) {
      for (let k = 0; k < 6; k++) {
        const at = 1.0 + k * 1.0;
        const ready = at > 6;
        if (t > at) wasted += ready ? 0 : 1;
        const q = (t - at) / 0.9;
        if (q >= 0 && q <= 1) {
          g.packet(C[0] + 14, C[1] + 8, J[0] - 36, J[1] + 8, q < 0.5 ? q / 0.5 : 1, pal.muted, 2);
          if (q >= 0.5) g.packet(J[0] - 36, J[1] + 8, C[0] + 14, C[1] + 8, (q - 0.5) / 0.5, ready ? pal.ok : pal.bad, 2);
        }
      }
    } else if (t > 6 && t < 7.4) g.packet(J[0] - 36, J[1] - 8, C[0] + 14, C[1] - 8, (t - 6) / 1.4, pal.ok, 3);
    g.text(hook ? "requests spent waiting: 1 callback" : `requests spent waiting: ${wasted} of "not ready"`, 240, 232, { size: 12, color: hook ? pal.ok : pal.bad });
    g.text(done && t > 7.4 ? "client has the result" : "client is waiting", 240, 256, { size: 11 });
  },
};

const normalize: Scene = {
  title: "Updating an address",
  caption: "Normalized, the address lives in one row and every order sees the change. Denormalized, every order carries its own copy, so one change means many writes, and a missed row goes stale.",
  controls: [
    { id: "m", kind: "choice", label: "Schema", options: ["normalized", "denormalized"], initial: 0 },
    { id: "miss", kind: "toggle", label: "Miss one row", initial: false },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const denorm = g.v.m === 1;
    const T = 7;
    const t = g.t % T;
    const upd = g.clamp((t - 1.2) / 0.5);
    const cust = [70, 134];
    g.rect(24, 108, 92, 52, pal.panel, 1, 6);
    g.frame(24, 108, 92, 52, pal.line, 1, 6);
    g.text("customer", 70, 120, { size: 10 });
    if (!denorm) chip(g, 70, 142, upd > 0.5 ? "12 New St" : "9 Old Rd", upd > 0.5 ? pal.blue : pal.accent, 10);
    else g.text("(no address)", 70, 142, { size: 10 });
    for (let k = 0; k < 6; k++) {
      const y = 36 + k * 36;
      g.rect(250, y - 12, 210, 24, pal.panel, 1, 5);
      g.frame(250, y - 12, 210, 24, pal.line, 1, 5);
      g.text(`order ${k + 1}`, 288, y, { size: 10, color: pal.paper });
      if (!denorm) {
        g.line(cust[0] + 46, cust[1], 250, y, upd > 0.5 ? pal.blue : pal.line, 0.45);
        const pulse = upd > 0.5 ? g.clamp(1 - (t - 1.7) * 0.8) : 0;
        if (pulse > 0) g.glow(250, y, 18, pal.blue, 0.4 * pulse);
      } else {
        const when = 1.4 + k * 0.38;
        const missed = g.v.miss === 1 && k === 3;
        const fresh = t > when && !missed;
        chip(g, 398, y, fresh ? "12 New St" : "9 Old Rd", fresh ? pal.blue : missed && t > when ? pal.bad : pal.accent, 10);
        if (t > 1.2 && t < when) g.packet(cust[0] + 46, cust[1], 366, y, g.clamp((t - 1.2) / (when - 1.2)), pal.blue, 2.4);
      }
    }
    const rows = denorm ? 6 : 1;
    g.text(denorm ? (g.v.miss === 1 && t > 4.4 ? "6 writes, 1 missed: orders disagree" : "6 rows rewritten") : "1 row rewritten, all orders agree", 240, 262, { size: 12, color: denorm && g.v.miss === 1 && t > 4.4 ? pal.bad : pal.paper });
    void rows;
  },
};

const acid: Scene = {
  title: "The check-then-act race",
  caption: "Stock is 1 and two checkouts read it at the same moment. Without a lock both decrement and the stock goes negative. A row lock makes the second checkout wait, then see 0 and stop.",
  controls: [{ id: "lock", kind: "toggle", label: "Row lock", initial: false }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const lock = g.v.lock === 1;
    const T = 10;
    const t = g.t % T;
    const stock = lock ? (t > 4.6 ? 0 : 1) : t > 4.6 ? (t > 6.2 ? -1 : 0) : 1;
    const bad = stock < 0;
    const D = [240, 135];
    g.ring(D[0], D[1], 34, bad ? pal.bad : pal.line, 1, 1.6);
    g.glow(D[0], D[1], 50, bad ? pal.bad : pal.accent, 0.15);
    g.text(String(stock), D[0], D[1] - 2, { size: 28, color: bad ? pal.bad : pal.accent, bold: true });
    g.text("stock", D[0], D[1] + 22, { size: 10 });
    server(g, 70, 50, "checkout 1", { size: 34 });
    server(g, 70, 220, "checkout 2", { size: 34 });
    if (lock) {
      const held = t > 1 && t < 4.6;
      g.text(held ? "🔒 locked by checkout 1" : "unlocked", D[0], D[1] + 52, { size: 10, color: held ? pal.accent : pal.muted });
    }
    const send = (from: number[], p: number, color: string) => g.packet(from[0] + 22, from[1], D[0] - 34, D[1] + (from[1] < D[1] ? -12 : 12), g.clamp(p), color);
    const back = (from: number[], p: number, color: string) => g.packet(D[0] - 34, D[1] + (from[1] < D[1] ? -12 : 12), from[0] + 22, from[1], g.clamp(p), color);
    const c1 = [70, 50];
    const c2 = [70, 220];
    if (t < 1.4) {
      send(c1, t / 1.4, pal.accent);
      if (!lock) send(c2, t / 1.4, pal.accent);
    } else if (t < 2.8) {
      back(c1, (t - 1.4) / 1.4, pal.ok);
      if (!lock) back(c2, (t - 1.4) / 1.4, pal.ok);
      else if (t > 1.6) g.text("waiting for the lock...", 120, 238, { size: 10, color: pal.muted });
    } else if (t < 4.6) {
      send(c1, (t - 2.8) / 1.8, pal.blue);
      if (!lock) send(c2, (t - 2.8) / 1.8, pal.bad);
      g.text(lock ? "checkout 1 buys the last item" : "both write stock - 1", 240, 262, { size: 11, color: pal.paper });
    } else if (lock && t < 7.5) {
      send(c2, (t - 4.6) / 1.4, pal.accent);
      if (t > 6) back(c2, (t - 6) / 1.4, pal.bad);
      g.text(t > 6 ? "checkout 2 sees 0 and stops: sold out" : "checkout 2 finally reads stock", 240, 262, { size: 11, color: t > 6 ? pal.ok : pal.paper });
    } else if (!lock && t >= 4.6) g.text(bad ? "oversold: stock is -1" : "", 240, 262, { size: 12, color: pal.bad });
  },
};

const indexing: Scene = {
  title: "Finding one row",
  caption: "A full scan checks rows one by one until it finds the match. A B-tree index walks three levels straight to it, and stays three or four levels deep even for billions of rows.",
  controls: [{ id: "m", kind: "choice", label: "Lookup", options: ["full scan", "B-tree index"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const idx = g.v.m === 1;
    const T = 6;
    const t = g.t % T;
    const target = 71;
    const cols = 20;
    const GX = idx ? 290 : 156;
    const gridPos = (k: number): [number, number] => [GX + (k % cols) * 8.4, 32 + Math.floor(k / cols) * 8.4];
    const scanned = idx ? 0 : Math.min(target, Math.floor(t * 28));
    for (let k = 0; k < 100; k++) {
      const [x, y] = gridPos(k);
      const hit = !idx && k <= scanned;
      const isT = k === target;
      g.dot(x, y, isT ? 3.4 : 2.2, isT ? pal.ok : hit ? pal.accent : pal.muted, isT || hit ? 1 : 0.45);
    }
    g.text("rows on disk", GX + 80, 82, { size: 10 });
    if (!idx) {
      g.text(`${Math.min(scanned + 1, target + 1)} rows read`, 240, 150, { size: 20, color: pal.accent, bold: true });
      g.text(t > 2.7 ? "found it, after reading most of the table" : "checking every row in order", 240, 180, { size: 12, color: pal.paper });
      g.text("cost grows with the size of the table", 240, 206, { size: 11 });
    } else {
      const lvl = Math.min(3, Math.floor(t / 1.2));
      const root = [110, 40];
      const mids = [30, 110, 190].map((x) => [x, 100]);
      const leaves = [10, 50, 90, 130, 170, 210].map((x) => [x, 170]);
      g.rect(root[0] - 24, root[1] - 10, 48, 20, pal.panel, 1, 4);
      g.frame(root[0] - 24, root[1] - 10, 48, 20, lvl >= 1 ? pal.accent : pal.line, 1, 4);
      g.text("root", root[0], root[1], { size: 10, color: pal.paper });
      mids.forEach(([x, y], k) => {
        const on = lvl >= 2 && k === 2;
        g.line(root[0], root[1] + 10, x, y - 10, on ? pal.accent : pal.line, on ? 1 : 0.5, on ? 1.6 : 1);
        g.rect(x - 22, y - 10, 44, 20, pal.panel, 1, 4);
        g.frame(x - 22, y - 10, 44, 20, on ? pal.accent : pal.line, 1, 4);
        g.text("page", x, y, { size: 10, color: pal.paper });
      });
      leaves.forEach(([x, y], k) => {
        const on = lvl >= 3 && k === 5;
        g.line(mids[Math.floor(k / 2)][0], 110, x, y - 10, on ? pal.accent : pal.line, on ? 1 : 0.4, on ? 1.6 : 1);
        g.dot(x, y, on ? 6 : 4, on ? pal.ok : pal.muted, on ? 1 : 0.6);
      });
      g.line(leaves[5][0], 176, GX + gridPos(target)[0] - GX, gridPos(target)[1], pal.ok, lvl >= 3 ? 0.8 : 0, 1);
      g.text(`${lvl} page read${lvl === 1 ? "" : "s"}`, 110, 214, { size: 20, color: pal.accent, bold: true });
      g.text("walks straight down the tree", 110, 240, { size: 11, color: pal.paper });
    }
  },
};

const planner: Scene = {
  title: "The query planner chooses a plan",
  caption: "The planner costs each candidate plan from table statistics and runs the cheapest. With stale statistics it thinks a scan returns few rows and picks the plan that is actually the slowest.",
  controls: [{ id: "stale", kind: "toggle", label: "Stale statistics", initial: false }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const stale = g.v.stale === 1;
    const plans = [
      { name: "seq scan + hash", est: stale ? 20 : 90, real: 90 },
      { name: "index + nested loop", est: stale ? 55 : 30, real: 30 },
      { name: "merge join", est: 60, real: 60 },
    ];
    const { i, p } = g.stage([1.2, 1.2, 1.2, 2.6]);
    const best = plans.reduce((b, pl, k) => (pl.est < plans[b].est ? k : b), 0);
    plans.forEach((pl, k) => {
      const x = 28 + k * 150;
      const lit = i < 3 ? i === k : k === best;
      g.rect(x, 30, 128, 190, pal.panel, 1, 8);
      g.frame(x, 30, 128, 190, lit ? (i === 3 ? (pl.real > 70 ? pal.bad : pal.ok) : pal.accent) : pal.line, 1, 8, lit ? 2 : 1);
      g.text(pl.name, x + 64, 46, { size: 10, color: pal.paper });
      const nodes: [number, number][] = [[x + 64, 80], [x + 34, 125], [x + 94, 125], [x + 20, 170], [x + 48, 170]];
      [[0, 1], [0, 2], [1, 3], [1, 4]].forEach(([a, b]) => g.line(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1], pal.line));
      nodes.forEach(([nx, ny], n) => g.dot(nx, ny, n === 0 ? 6 : 4, lit ? pal.accent : pal.muted, lit ? 1 : 0.6));
      const costed = i > k || i === 3;
      bar(g, x + 12, 190, 104, 6, costed ? pl.est / 100 : 0, pal.blue);
      g.text(costed ? `estimated cost ${pl.est}` : "", x + 64, 208, { size: 9 });
    });
    if (i === 3) {
      const pl = plans[best];
      g.text(`chosen: ${pl.name}`, 240, 244, { size: 12, color: pal.paper });
      g.text(pl.real > 70 ? `actually slow: real cost ${pl.real}` : `real cost ${pl.real}: a good pick`, 240, 266, { size: 12, color: pl.real > 70 ? pal.bad : pal.ok });
    } else g.text("costing each candidate plan...", 240, 250, { size: 12 });
    void p;
  },
};

const pooling: Scene = {
  title: "A burst of requests and a connection pool",
  caption: "Each database connection is a costly resource. Without a pool every request opens its own and the database drowns. A pool shares a fixed set, and the extra requests wait in line.",
  controls: [
    { id: "pool", kind: "toggle", label: "Use pool", initial: true },
    { id: "size", kind: "range", label: "Pool size", min: 2, max: 10, step: 1, initial: 4 },
  ],
  aspect: 0.62,
  make: () => {
    type R = { born: number; y: number };
    const reqs: R[] = [];
    let acc = 0;
    let n = 0;
    return (g) => {
      const { pal } = g;
      const pooled = g.v.pool === 1;
      const size = g.v.size;
      const burst = 0.5 + 0.5 * Math.sin(g.t * 0.9);
      acc += g.dt * (4 + burst * 14);
      while (acc >= 1) {
        acc -= 1;
        n++;
        reqs.push({ born: g.t, y: 50 + g.rnd(n * 4.7) * 170 });
      }
      while (reqs.length && g.t - reqs[0].born > 2.2) reqs.shift();
      const live = reqs.filter((r) => g.t - r.born > 0.6).length;
      const conns = pooled ? Math.min(size, live) : live;
      const waiting = pooled ? Math.max(0, live - size) : 0;
      const overload = !pooled && live > 14;
      db(g, 420, 135, 44, 54, overload ? pal.bad : pal.paper);
      g.glow(420, 135, 60, overload ? pal.bad : pal.accent, overload ? 0.25 : 0.1);
      g.text(`${conns} connection${conns === 1 ? "" : "s"}`, 420, 188, { size: 11, color: overload ? pal.bad : pal.paper });
      g.text("database", 420, 204, { size: 10 });
      if (pooled) {
        g.frame(220, 70, 70, 130, pal.line, 1, 10);
        g.text("pool", 255, 62, { size: 10 });
        for (let k = 0; k < size; k++) g.dot(255, 84 + (k * 108) / Math.max(1, size - 1 || 1) * (size > 1 ? 1 : 0), 6, k < conns ? pal.accent : pal.line, k < conns ? 1 : 0.5);
        for (let k = 0; k < conns; k++) g.line(261, 84 + (k * 108) / Math.max(1, size - 1), 398, 135, pal.accent, 0.35);
      } else {
        for (let k = 0; k < Math.min(live, 24); k++) g.line(60, 50 + g.rnd(k * 3.9) * 170, 398, 135, overload ? pal.bad : pal.accent, 0.18);
      }
      let q = 0;
      for (const r of reqs) {
        const age = g.t - r.born;
        if (age < 0.6) g.packet(36, r.y, pooled ? 200 : 398, 135, g.clamp(age / 0.6), pal.paper, 2);
        else if (pooled && live - 1 - q >= size) {
          g.dot(206 - Math.floor(q / 7) * 9, 76 + (q % 7) * 18, 2.6, pal.accent, 0.8);
          q++;
        }
      }
      if (waiting > 0) g.text(`${waiting} waiting in line`, 150, 250, { size: 12, color: pal.accent });
      g.text(overload ? "database overloaded: too many connections" : pooled ? "pool reuses a fixed set of connections" : "one new connection per request", 240, 274, { size: 12, color: overload ? pal.bad : pal.paper });
    };
  },
};

const migration: Scene = {
  title: "Expand and contract migration",
  caption: "Add the new column next to the old one, write to both, backfill history, move reads over, and only then drop the old one. At every step the application keeps working.",
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2, 2.4, 2.6, 2.2, 2.2]);
    const rows = 10;
    const names = ["expand", "dual write", "backfill", "switch reads", "contract"];
    const oldX = 150;
    const newX = 330;
    const oldA = i === 4 ? 1 - g.ease(p) : 1;
    const newA = i === 0 ? g.ease(p) : 1;
    g.text("old column", oldX, 28, { size: 11, color: pal.paper, a: oldA });
    g.text("new column", newX, 28, { size: 11, color: pal.paper, a: newA });
    for (let r = 0; r < rows; r++) {
      const y = 46 + r * 17;
      g.dot(oldX, y, 4, pal.accent, 0.9 * oldA);
      const filled = i === 2 ? r < Math.floor(g.ease(p) * rows) || r >= 7 : i >= 3 || (i === 1 && r >= 7 && p > (r - 7) / 3 * 0.6 + 0.2) || (i === 1 && false);
      const dualNew = i === 1 && r >= 8 && p > 0.4 + (r - 8) * 0.25;
      const on = i >= 3 ? true : i === 2 ? r < Math.floor(g.ease(p) * rows) || r >= 8 : dualNew;
      g.dot(newX, y, 4, on ? pal.blue : pal.line, (on ? 0.95 : 0.5) * newA);
      void filled;
    }
    server(g, 240, 252, "app", { size: 30 });
    const wr = i >= 1;
    const rd = i >= 3 ? newX : oldX;
    g.arrow(228, 238, oldX + 8, 186, pal.accent, i === 4 ? oldA * 0.3 : wr || i === 0 ? 0.9 : 0.2);
    g.arrow(252, 238, newX - 8, 186, pal.blue, wr && i < 4 ? 0.9 : i === 4 ? 0.9 : 0.15);
    const rx = rd;
    g.packet(240, 228, rx, 60, g.loop(1.6), pal.ok, 2.6);
    g.text("reads", rx + (rd === oldX ? -26 : 26), 120, { size: 10, color: pal.ok });
    names.forEach((n, k) => g.text(n, 60 + k * 90, 286, { size: 10, color: k === i ? pal.accent : pal.muted, bold: k === i }));
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/apis-services-protocols/rest-vs-grpc-vs-graphql`]: apis,
  [`${P}/apis-services-protocols/idempotency-and-api-design`]: idempotency,
  [`${P}/apis-services-protocols/pagination-versioning-and-webhooks`]: pagination,
  [`${P}/apis-services-protocols/api-gateway-patterns-and-edge-rate-limiting`]: gateway,
  [`${P}/apis-services-protocols/authn-authz-patterns`]: oauth,
  [`${P}/apis-services-protocols/long-running-operations-and-async-api-design`]: asyncOps,
  [`${P}/data-modeling-and-sql/normalization-and-denormalization`]: normalize,
  [`${P}/data-modeling-and-sql/acid-transactions-and-isolation-levels`]: acid,
  [`${P}/data-modeling-and-sql/indexing-strategies`]: indexing,
  [`${P}/data-modeling-and-sql/query-optimization-and-execution-plans`]: planner,
  [`${P}/data-modeling-and-sql/connection-pooling-and-read-replicas`]: pooling,
  [`${P}/data-modeling-and-sql/schema-migration-strategies-at-scale`]: migration,
};

void fmt;
