import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "system-design";

const geohashGrid: Scene = {
  title: "Geohash cells and the boundary problem",
  caption: "The map is cut into cells that share a prefix. A nearby search reads the query's cell, but a point just across a cell edge sits in a different cell, so the search must also read the neighbours. Coarser cells scan more points.",
  controls: [{ id: "p", kind: "range", label: "Precision (cell size)", min: 1, max: 3, step: 1, initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const n = [3, 6, 12][g.v.p - 1];
    const w = 432 / n;
    const h = 190 / Math.max(2, Math.round(n * 0.44));
    const rows = Math.round(190 / h);
    const q: [number, number] = [24 + 216 + Math.sin(g.t * 0.5) * 60, 30 + 95 + Math.cos(g.t * 0.4) * 30];
    const qc = Math.floor((q[0] - 24) / w);
    const qr = Math.floor((q[1] - 30) / h);
    let scanned = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < n; c++) {
        const near = Math.abs(c - qc) <= 1 && Math.abs(r - qr) <= 1;
        g.rect(24 + c * w, 30 + r * h, w - 1, h - 1, c === qc && r === qr ? pal.accent : near ? pal.blue : pal.line, c === qc && r === qr ? 0.3 : near ? 0.14 : 0.06, 2);
      }
    for (let k = 0; k < 70; k++) {
      const x = 24 + g.rnd(k * 2.1 + 1) * 432;
      const y = 30 + g.rnd(k * 3.7 + 2) * 190;
      const cx = Math.floor((x - 24) / w);
      const cy = Math.floor((y - 30) / h);
      const near = Math.abs(cx - qc) <= 1 && Math.abs(cy - qr) <= 1;
      if (near) scanned++;
      g.dot(x, y, 2.4, near ? pal.paper : pal.muted, near ? 1 : 0.5);
    }
    g.dot(q[0], q[1], 5, pal.accent);
    g.glow(q[0], q[1], 16, pal.accent, 0.4);
    g.text(`${scanned} of 70 points scanned (cell + 8 neighbours)`, 240, 252, { size: 12, color: pal.paper });
    g.text("smaller cells scan fewer points but need more lookups", 240, 276, { size: 10, color: pal.muted });
  },
};

const collabFilter: Scene = {
  title: "Collaborative filtering",
  caption: "You and another user rated the same items alike, so that user's other likes become your suggestions. Pick a user to see whose taste they share and which item is recommended.",
  controls: [{ id: "u", kind: "choice", label: "Recommend for", options: ["Ana", "Raj", "Mei"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const me = g.v.u;
    const users = ["Ana", "Raj", "Mei", "Lee"];
    const items = ["film A", "film B", "film C", "film D", "film E"];
    const M = [[1, 1, 0, 1, 0], [1, 1, 1, 0, 0], [0, 0, 1, 1, 1], [1, 0, 0, 1, 1]];
    const sim = users.map((_, k) => (k === me ? -1 : M[k].reduce((a, v, j) => a + (v && M[me][j] ? 1 : 0), 0)));
    const best = sim.indexOf(Math.max(...sim));
    const rec = M[best].findIndex((v, j) => v && !M[me][j]);
    items.forEach((it, j) => g.text(it, 150 + j * 62, 40, { size: 9, color: pal.muted }));
    users.forEach((u, k) => {
      const y = 70 + k * 36;
      g.text(u, 60, y, { size: 12, color: k === me ? pal.accent : k === best ? pal.ok : pal.paper });
      node(g, "user", 30, y, { size: 18, color: k === me ? pal.accent : k === best ? pal.ok : pal.muted });
      items.forEach((_, j) => {
        const liked = M[k][j] === 1;
        const isRec = k === me && j === rec;
        g.rect(128 + j * 62, y - 12, 44, 24, isRec ? pal.ok : liked ? (k === me ? pal.accent : pal.blue) : pal.line, isRec ? 0.5 : liked ? 0.5 : 0.1, 5);
        if (liked) g.text("♥", 150 + j * 62, y, { size: 11, color: pal.paper });
        if (isRec) g.text("?", 150 + j * 62, y, { size: 13, color: pal.paper });
      });
      if (k === best) g.frame(124, y - 15, 322, 30, pal.ok, 0.8, 6, 1.2);
    });
    g.text(rec >= 0 ? `${users[me]} resembles ${users[best]}, so recommend ${items[rec]}` : "no new item to recommend", 240, 238, { size: 12, color: pal.paper });
    g.text("green row shares the most likes", 240, 264, { size: 10, color: pal.muted });
  },
};

const greedyVsBatch: Scene = {
  title: "Greedy matching versus batching",
  caption: "Riders arrive one by one. Greedy gives each the nearest free driver the moment they arrive, which can leave a later rider far from the last driver. Batching waits a moment and assigns the whole group to minimise total distance.",
  controls: [{ id: "m", kind: "choice", label: "Matching", options: ["greedy, one at a time", "batch the group"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const batch = g.v.m === 1;
    const riders: [number, number][] = [[120, 60], [220, 110], [330, 60]];
    const drivers: [number, number][] = [[170, 90], [300, 170], [60, 150]];
    const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let assign: number[] = [];
    if (!batch) {
      const used = new Set<number>();
      assign = riders.map((r) => {
        let b = -1;
        drivers.forEach((dr, k) => {
          if (!used.has(k) && (b < 0 || d(r, dr) < d(r, drivers[b]))) b = k;
        });
        used.add(b);
        return b;
      });
    } else {
      const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      let bestC = 1e9;
      perms.forEach((p) => {
        const c = p.reduce((a, di, ri) => a + d(riders[ri], drivers[di]), 0);
        if (c < bestC) {
          bestC = c;
          assign = p;
        }
      });
    }
    const total = assign.reduce((a, di, ri) => a + d(riders[ri], drivers[di]), 0);
    assign.forEach((di, ri) => {
      g.line(riders[ri][0], riders[ri][1], drivers[di][0], drivers[di][1], pal.accent, 0.8, 1.8);
      g.packet(drivers[di][0], drivers[di][1], riders[ri][0], riders[ri][1], (g.t * 0.5 + ri * 0.2) % 1, pal.accent, 2.4);
    });
    riders.forEach((r) => node(g, "user", r[0], r[1], { size: 24, color: pal.blue }));
    drivers.forEach((dr) => node(g, "phone", dr[0], dr[1], { size: 24, color: pal.ok }));
    g.text(`total pickup distance ${Math.round(total)}`, 240, 238, { size: 13, color: batch ? pal.ok : pal.bad, bold: true });
    g.text(batch ? "the group is solved together" : "the last rider gets whoever is left", 240, 264, { size: 10, color: pal.muted });
  },
};

const pacing: Scene = {
  title: "Budget pacing across the day",
  caption: "A $1,000 daily budget should last until midnight. Without pacing the bidder wins every auction it can and is broke by mid-morning. Pacing throttles the bid rate so spend follows the target curve.",
  controls: [{ id: "p", kind: "toggle", label: "Pacing on", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pace = g.v.p === 1;
    const x0 = 40;
    const x1 = 450;
    const y = (v: number) => 210 - v * 140;
    g.line(x0, 210, x1, 210, pal.line, 1, 1.2);
    g.line(x0, y(1), x1, y(1), pal.accent, 0.5, 1);
    g.text("budget", x1, y(1) - 8, { size: 9, color: pal.accent, align: "right" });
    g.c.setLineDash([4, 4]);
    g.line(x0, 210, x1, y(1), pal.muted, 0.7, 1.2);
    g.c.setLineDash([]);
    const t = (g.t * 0.14) % 1.2;
    let pv: [number, number] | null = null;
    for (let k = 0; k <= 60; k++) {
      const u = (k / 60) * Math.min(1, t);
      const spend = pace ? u : Math.min(1, u * 3.2);
      const x = x0 + u * (x1 - x0);
      if (pv) g.line(pv[0], pv[1], x, y(spend), pace ? pal.ok : pal.bad, 1, 2.2);
      pv = [x, y(spend)];
    }
    const broke = !pace && t > 0.31;
    g.text("hours of the day →", 240, 232, { size: 10, color: pal.muted });
    g.text(broke ? "budget gone by 7am: misses the evening audience ✕" : pace ? "spend tracks the target curve ✓" : "spending fast…", 240, 262, { size: 12, color: broke ? pal.bad : pal.ok });
    node(g, "server", 44, 40, { size: 24, active: true });
  },
};

const searchFrontier: Scene = {
  title: "Dijkstra versus A* search",
  caption: "Both find the shortest path around the wall. Dijkstra explores in every direction until it reaches the goal. A* adds a heuristic that pulls the search toward the goal, so it visits far fewer cells.",
  controls: [{ id: "a", kind: "choice", label: "Algorithm", options: ["Dijkstra", "A*"], initial: 1 }],
  aspect: 0.64,
  make: () => {
    const W = 16;
    const H = 8;
    const wall = (x: number, y: number) => x === 8 && y >= 1 && y <= 6;
    const run = (astar: boolean) => {
      const start: [number, number] = [1, 4];
      const goal: [number, number] = [14, 4];
      const dist: Record<string, number> = { "1,4": 0 };
      const order: [number, number][] = [];
      const open: [number, number][] = [start];
      const closed = new Set<string>();
      const h = (x: number, y: number) => (astar ? Math.abs(x - goal[0]) + Math.abs(y - goal[1]) : 0);
      while (open.length) {
        open.sort((a, b) => dist[`${a[0]},${a[1]}`] + h(a[0], a[1]) - (dist[`${b[0]},${b[1]}`] + h(b[0], b[1])));
        const [x, y] = open.shift()!;
        const key = `${x},${y}`;
        if (closed.has(key)) continue;
        closed.add(key);
        order.push([x, y]);
        if (x === goal[0] && y === goal[1]) break;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || wall(nx, ny)) return;
          const nk = `${nx},${ny}`;
          const nd = dist[key] + 1;
          if (dist[nk] === undefined || nd < dist[nk]) {
            dist[nk] = nd;
            open.push([nx, ny]);
          }
        });
      }
      return order;
    };
    const dij = run(false);
    const ast = run(true);
    return (g) => {
      const { pal } = g;
      const order = g.v.a === 1 ? ast : dij;
      const shown = Math.floor(g.clamp((g.t % 7) / 5) * order.length);
      const cs = 27;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) g.rect(24 + x * cs, 30 + y * cs, cs - 2, cs - 2, wall(x, y) ? pal.paper : pal.line, wall(x, y) ? 0.5 : 0.07, 3);
      order.slice(0, shown).forEach(([x, y]) => g.rect(24 + x * cs, 30 + y * cs, cs - 2, cs - 2, g.v.a === 1 ? pal.ok : pal.blue, 0.4, 3));
      node(g, "phone", 24 + 1 * cs + 12, 30 + 4 * cs + 12, { size: 22, color: pal.accent });
      node(g, "user", 24 + 14 * cs + 12, 30 + 4 * cs + 12, { size: 22, color: pal.ok });
      g.text(`${shown} of ${order.length} cells explored`, 240, 262, { size: 13, color: pal.paper });
    };
  },
};

const pushPull: Scene = {
  title: "Push versus pull CDN",
  caption: "A pull CDN fetches from the origin the first time someone asks, so that first viewer waits. A push CDN has the content uploaded in advance, so even the first request is a hit, at the cost of storing files nobody may request.",
  controls: [{ id: "m", kind: "choice", label: "CDN model", options: ["pull (on demand)", "push (pre-loaded)"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const push = g.v.m === 1;
    const { i, p } = g.stage([2, 2, 2]);
    node(g, "user", 40, 120, { label: "viewer", size: 34 });
    node(g, "cdn", 210, 120, { label: "edge", size: 44, color: pal.teal });
    node(g, "db", 400, 120, { label: "origin", size: 44, color: pal.blue });
    const cached = push || i >= 1;
    if (cached) node(g, "doc", 210, 168, { size: 22, color: pal.ok });
    g.packet(62, 120, 184, 120, i === 0 || i === 2 ? p : 1, pal.accent, 3);
    const miss = !push && i === 0;
    if (miss) {
      g.packet(236, 120, 374, 120, p, pal.bad, 3);
      g.text("miss: fetch from origin", 305, 98, { size: 10, color: pal.bad });
    }
    if (push) {
      g.text("uploaded in advance", 305, 98, { size: 10, color: pal.violet });
      g.packet(374, 120, 236, 120, g.loop(2.4), pal.violet, 2.4);
    }
    const ms = miss ? 180 : 20;
    g.text(["first viewer", "later viewers", "any viewer"][i], 240, 218, { size: 11, color: pal.muted });
    g.text(`latency ~${ms} ms ${miss ? "(origin round trip)" : "(edge hit)"}`, 240, 244, { size: 13, color: miss ? pal.bad : pal.ok });
  },
};

const storageClasses: Scene = {
  title: "Storage classes over an object's life",
  caption: "New objects are read often and belong in the fast, expensive class. As they age a lifecycle rule moves them to cheaper classes with slower, costlier retrieval. Slide the age to see the trade between storage price and access cost.",
  controls: [{ id: "a", kind: "range", label: "Object age (days)", min: 0, max: 400, step: 10, initial: 120 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const age = g.v.a;
    const cls = age < 30 ? 0 : age < 90 ? 1 : age < 365 ? 2 : 3;
    const names = ["standard", "infrequent", "cold", "archive"];
    const price = [1, 0.55, 0.17, 0.05];
    const fetch = ["instant", "instant", "minutes", "hours"];
    names.forEach((nm, k) => {
      const x = 28 + k * 112;
      const on = k === cls;
      g.rect(x, 60, 104, 96, [pal.ok, pal.blue, pal.violet, pal.muted][k], on ? 0.3 : 0.07, 8);
      g.frame(x, 60, 104, 96, [pal.ok, pal.blue, pal.violet, pal.muted][k], on ? 1 : 0.4, 8, on ? 2 : 1);
      node(g, "db", x + 52, 96, { size: 34, color: [pal.ok, pal.blue, pal.violet, pal.muted][k], a: on ? 1 : 0.5 });
      g.text(nm, x + 52, 140, { size: 10, color: on ? pal.paper : pal.muted });
    });
    g.dot(28 + cls * 112 + 52, 168, 5, pal.accent);
    g.text("storage price", 90, 206, { size: 10 });
    bar(g, 160, 201, 220, 8, price[cls], pal.accent);
    g.text(`${Math.round(price[cls] * 100)}%`, 430, 206, { size: 11, color: pal.paper });
    g.text("time to first byte", 90, 232, { size: 10 });
    g.text(fetch[cls], 250, 232, { size: 12, color: cls === 3 ? pal.bad : pal.ok });
    g.text("lifecycle rule: 30 / 90 / 365 days", 240, 266, { size: 10, color: pal.muted });
  },
};

const responsiveImg: Scene = {
  title: "Responsive images and modern formats",
  caption: "The browser tells the server how wide its slot is and the server sends the smallest variant that looks sharp. A phone gets a small AVIF while a large retina screen gets a bigger one. Same picture, a fraction of the bytes.",
  controls: [
    { id: "d", kind: "choice", label: "Device", options: ["phone", "laptop", "retina desktop"], initial: 0 },
    { id: "f", kind: "choice", label: "Format", options: ["JPEG", "WebP", "AVIF"], initial: 2 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const d = g.v.d;
    const kind = (["phone", "client", "client"] as const)[d];
    const px = [400, 800, 1600][d];
    const fmtMul = [1, 0.7, 0.5][g.v.f];
    const kb = (px / 400) ** 1.7 * 28 * fmtMul;
    node(g, kind, 70, 110, { label: ["phone", "laptop", "retina"][d], size: 60 });
    node(g, "server", 410, 110, { label: "image service", size: 44, active: true });
    g.packet(100, 100, 380, 100, g.loop(1.4), pal.accent, 2.6);
    g.packet(380, 124, 100, 124, g.loop(1.4, 0.5), pal.ok, 3.2);
    g.text(`Accept: image/${["jpeg", "webp", "avif"][g.v.f]}, width ${px}`, 240, 80, { size: 10, color: pal.muted });
    g.text("bytes sent", 70, 206, { size: 11 });
    bar(g, 140, 201, 250, 8, kb / 520, kb > 150 ? pal.bad : pal.ok);
    g.text(`${Math.round(kb)} KB`, 430, 206, { size: 12, color: pal.paper });
    g.text(`vs ~520 KB for one full-size JPEG for everyone`, 240, 248, { size: 11, color: pal.muted });
  },
};

const segmentAlign: Scene = {
  title: "Aligned segments make switching seamless",
  caption: "Every rendition is cut at the same timestamps, so the player can leave one for another exactly at a segment boundary. If boundaries drift, the switch lands mid-picture and the viewer sees a glitch or a repeat.",
  controls: [{ id: "a", kind: "toggle", label: "Boundaries aligned", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const al = g.v.a === 1;
    const rows: [string, number, string][] = [["720p", 70, pal.blue], ["480p", 130, pal.violet]];
    rows.forEach(([nm, y, col], r) => {
      g.text(nm, 24, y + 14, { size: 11, align: "left", color: col });
      for (let k = 0; k < 6; k++) {
        const off = !al && r === 1 ? 14 : 0;
        g.rect(70 + k * 66 + off, y, 62, 28, col, 0.3, 5);
        g.frame(70 + k * 66 + off, y, 62, 28, col, 1, 5, 1.1);
      }
    });
    const t = (g.t * 0.6) % 6;
    const sw = 3;
    const on720 = t < sw;
    const x = 70 + t * 66;
    g.line(x, 56, x, 176, pal.accent, 0.9, 2);
    g.line(70 + sw * 66, 56, 70 + sw * 66, 176, pal.ok, 0.6, 1.2);
    g.text("player switches down here", 70 + sw * 66, 48, { size: 9, color: pal.ok });
    const glitch = !al && t > sw;
    g.text(on720 ? "playing 720p" : "playing 480p", 240, 214, { size: 13, color: pal.paper });
    g.text(glitch ? "misaligned: a frame is skipped or repeated at the join ✕" : "joins cleanly on a segment boundary ✓", 240, 244, { size: 12, color: glitch ? pal.bad : pal.ok });
  },
};

const parallelParts: Scene = {
  title: "Parallel parts and a bad checksum",
  caption: "Parts upload independently, so several lanes finish the file much sooner. If a part arrives corrupted its checksum fails and only that one part is sent again, not the whole file.",
  controls: [
    { id: "p", kind: "range", label: "Parallel uploads", min: 1, max: 4, step: 1, initial: 3 },
    { id: "c", kind: "toggle", label: "Corrupt part 5" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const lanes = g.v.p;
    const bad = g.v.c === 1;
    const parts = 12;
    const t = (g.t * 1.5) % 16;
    const dur = 1.5;
    const total = Math.ceil((parts + (bad ? 1 : 0)) / lanes) * dur;
    for (let k = 0; k < parts + (bad ? 1 : 0); k++) {
      const lane = k % lanes;
      const start = Math.floor(k / lanes) * dur;
      const isRetry = bad && k === parts;
      const pn = isRetry ? 5 : k + 1;
      const x = 40 + lane * 0 + (start / total) * 330;
      const y = 50 + lane * 36;
      const f = g.clamp((t - start) / dur);
      const fail = bad && pn === 5 && !isRetry;
      const col = fail && f >= 1 ? pal.bad : f >= 1 ? pal.ok : pal.blue;
      g.rect(x, y, (dur / total) * 330 - 3, 26, col, f > 0 ? 0.35 + 0.3 * f : 0.08, 4);
      if (f > 0) g.text(String(pn) + (fail && f >= 1 ? " ✕" : ""), x + (dur / total) * 165, y + 13, { size: 10, color: pal.paper });
    }
    for (let l = 0; l < lanes; l++) g.text(`lane ${l + 1}`, 24, 63 + l * 36, { size: 9, align: "left", color: pal.muted });
    node(g, "cloud", 430, 110, { label: "storage", size: 40 });
    g.text(`finishes in ~${total.toFixed(1)} s with ${lanes} lane${lanes > 1 ? "s" : ""}`, 240, 222, { size: 13, color: pal.paper });
    g.text(bad ? "part 5 failed its checksum: only part 5 is re-sent" : "every part verified against its checksum", 240, 252, { size: 11, color: bad ? pal.accent : pal.ok });
  },
};

const healthCheck: Scene = {
  title: "Health checks pull a sick server out",
  caption: "Server 3 starts failing at second four. Active health checks probe it every second and mark it unhealthy after two misses, and the balancer stops sending it traffic. Without checks it keeps receiving, and failing, a share of requests.",
  controls: [{ id: "h", kind: "toggle", label: "Active health checks", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hc = g.v.h === 1;
    const t = g.t % 14;
    const sick = t > 4;
    const removed = hc && t > 6;
    node(g, "lb", 70, 110, { label: "balancer", size: 44 });
    let failed = 0;
    for (let k = 0; k < 3; k++) {
      const y = 50 + k * 60;
      const bad = k === 2 && sick;
      node(g, "server", 380, y, { label: `server ${k + 1}`, size: 36, color: bad ? pal.bad : pal.paper, active: !bad });
      if (bad) g.text("✕", 380, y, { size: 16, color: pal.bad });
      const gets = !(k === 2 && removed);
      if (gets) g.packet(96, 106, 352, y, (g.t * 0.9 + k * 0.3) % 1, bad ? pal.bad : pal.accent, 2.4);
      if (bad && gets) failed++;
      if (hc && k === 2) g.packet(96, 112, 352, y + 4, (g.t * 2) % 1, pal.teal, 1.4);
    }
    g.text(removed ? "server 3 marked unhealthy: no traffic ✓" : sick && !hc ? "server 3 still gets a third of requests ✕" : sick ? "probes failing, about to be removed" : "all healthy", 240, 232, { size: 12, color: removed ? pal.ok : sick ? pal.bad : pal.paper });
    g.text(`failing requests: ${failed ? "~33%" : "0%"}`, 240, 262, { size: 11, color: failed ? pal.bad : pal.ok });
  },
};

const breakerStates: Scene = {
  title: "Circuit breaker states",
  caption: "Closed lets calls through while counting failures. Enough failures trip it open, and calls fail fast without touching the sick dependency. After a cool-down it goes half-open and lets one probe through: success closes it, failure reopens it.",
  controls: [{ id: "r", kind: "choice", label: "Probe result", options: ["succeeds", "fails"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const probeOk = g.v.r === 0;
    const { i, p } = g.stage([2, 2, 1.6, 2]);
    const pos: [number, number][] = [[90, 100], [240, 190], [390, 100]];
    const names = ["closed", "open", "half-open"];
    const cur = i === 0 ? 0 : i === 1 ? 1 : i === 2 ? 2 : probeOk ? 0 : 1;
    pos.forEach(([x, y], k) => {
      const on = k === cur;
      const col = [pal.ok, pal.bad, pal.accent][k];
      g.rect(x - 56, y - 22, 112, 44, col, on ? 0.3 : 0.08, 10);
      g.frame(x - 56, y - 22, 112, 44, col, on ? 1 : 0.4, 10, on ? 2 : 1);
      g.text(names[k], x, y, { size: 12, color: on ? pal.paper : pal.muted });
    });
    g.arrow(130, 126, 200, 168, pal.line, 0.8);
    g.arrow(280, 168, 352, 126, pal.line, 0.8);
    g.arrow(340, 90, 150, 90, pal.line, 0.6);
    g.text("5 failures", 140, 150, { size: 9, color: pal.muted });
    g.text("cool-down ends", 340, 150, { size: 9, color: pal.muted });
    g.text("probe ok", 240, 74, { size: 9, color: pal.muted });
    node(g, "server", 40, 200, { label: "caller", size: 28 });
    node(g, "db", 440, 200, { label: "dependency", size: 30, color: cur === 0 ? pal.paper : pal.bad });
    if (cur === 0) g.packet(60, 200, 420, 200, g.loop(1.2), pal.accent, 2.4);
    if (cur === 1) g.text("calls fail fast, nothing sent", 240, 230, { size: 11, color: pal.bad });
    if (cur === 2) g.packet(60, 200, 420, 200, g.clamp(p), pal.accent, 3);
    g.text(["failures counted, then it trips", "open: protecting the dependency", "half-open: one probe allowed", probeOk ? "probe succeeded: back to closed" : "probe failed: open again"][i], 240, 262, { size: 12, color: pal.paper });
  },
};

const drTiers: Scene = {
  title: "Disaster recovery strategies",
  caption: "Cheaper strategies take longer to recover and may lose recent data. Pick a strategy to see its recovery time (RTO), how much data you could lose (RPO) and the standing cost of keeping it ready.",
  controls: [{ id: "s", kind: "choice", label: "Strategy", options: ["backup & restore", "pilot light", "warm standby", "active-active"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const rto = [480, 60, 10, 0.5][s];
    const rpo = [1440, 15, 1, 0][s];
    const cost = [0.1, 0.25, 0.55, 1][s];
    node(g, "cloud", 110, 80, { label: "primary", size: 54, color: pal.ok });
    g.text("✕", 110, 80, { size: 20, color: pal.bad, a: 0.5 + 0.5 * Math.sin(g.t * 3) });
    node(g, "cloud", 370, 80, { label: "recovery site", size: 54, color: pal.blue, a: [0.25, 0.5, 0.8, 1][s] });
    g.packet(150, 80, 330, 80, g.loop(1.8), pal.accent, 3);
    [["RTO (time to recover)", rto, 480, "min"], ["RPO (data you may lose)", rpo, 1440, "min"], ["standing cost", cost, 1, ""]].forEach(([nm, v, mx, unit], k) => {
      const y = 148 + k * 34;
      g.text(nm as string, 20, y, { size: 10, align: "left" });
      bar(g, 190, y - 5, 200, 8, Math.max(0.02, (v as number) / (mx as number)), k === 2 ? pal.accent : pal.bad);
      g.text(k === 2 ? `${Math.round(cost * 100)}%` : `${fmt(v as number)} ${unit}`, 440, y, { size: 11, color: pal.paper });
    });
  },
};

const burnRate: Scene = {
  title: "Burn-rate alerts: fast and slow",
  caption: "A fast burn spends the whole budget in hours and must page someone now. A slow burn loses a little each day and only needs a ticket. Two windows catch both without alerting on every blip.",
  controls: [{ id: "e", kind: "range", label: "Error rate %", min: 0, max: 20, step: 1, initial: 5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const err = g.v.e;
    const slo = 0.1;
    const burn = err / slo;
    const page = burn >= 14.4;
    const ticket = !page && burn >= 1;
    g.text("burn rate = error rate ÷ allowed error rate", 240, 30, { size: 11, color: pal.muted });
    g.text(`${burn.toFixed(1)}x`, 240, 90, { size: 36, color: page ? pal.bad : ticket ? pal.accent : pal.ok, bold: true });
    g.text("1x spends exactly the monthly budget", 240, 122, { size: 10, color: pal.muted });
    const days = burn > 0 ? 30 / burn : 999;
    g.text(burn > 0 ? `budget gone in ${days < 1 ? `${(days * 24).toFixed(1)} hours` : `${days.toFixed(1)} days`}` : "no burn", 240, 150, { size: 13, color: pal.paper });
    node(g, "user", 60, 215, { size: 28, color: page ? pal.bad : pal.muted });
    chip(g, 240, 215, page ? "PAGE: fast burn, act now" : ticket ? "ticket: slow burn" : "no alert", page ? pal.bad : ticket ? pal.accent : pal.ok, 12);
    g.text("page above 14.4x over 1 hour, ticket above 1x over 3 days", 240, 262, { size: 10, color: pal.muted });
  },
};

const tracePropagation: Scene = {
  title: "Trace context across a queue",
  caption: "A trace id travels with each call so the spans can be stitched together. Across an async hop it must be copied into the message. If a service forgets, the trace breaks into two unrelated halves and you lose the end-to-end view.",
  controls: [{ id: "p", kind: "toggle", label: "Propagate trace id", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const prop = g.v.p === 1;
    node(g, "client", 36, 100, { label: "web", size: 34 });
    node(g, "server", 150, 100, { label: "API", size: 36, active: true });
    node(g, "queue", 270, 100, { label: "queue", size: 40 });
    node(g, "server", 390, 100, { label: "worker", size: 36, active: true });
    g.packet(60, 100, 126, 100, g.loop(1.6), pal.accent, 2.6);
    g.packet(176, 100, 244, 100, g.loop(1.6, 0.3), pal.accent, 2.6);
    g.packet(298, 100, 364, 100, g.loop(1.6, 0.6), prop ? pal.accent : pal.bad, 2.6);
    chip(g, 100, 62, "trace=ab12", pal.accent, 9);
    chip(g, 210, 62, "trace=ab12", pal.accent, 9);
    chip(g, 330, 62, prop ? "trace=ab12" : "(none)", prop ? pal.accent : pal.bad, 9);
    chip(g, 440, 62, prop ? "span joins ab12" : "new trace=f77e", prop ? pal.ok : pal.bad, 9);
    g.text(prop ? "one trace shows the whole journey ✓" : "two disconnected traces: root cause is invisible ✕", 240, 190, { size: 12, color: prop ? pal.ok : pal.bad });
    g.text("copy the context into message headers at every async hop", 240, 232, { size: 10, color: pal.muted });
  },
};

const flagRollout: Scene = {
  title: "Feature flag rollout and kill switch",
  caption: "The code is deployed but dark. The flag exposes it to a growing share of users. If the new path misbehaves, flipping the kill switch turns it off for everyone at once, with no redeploy.",
  controls: [
    { id: "p", kind: "range", label: "Exposed to %", min: 0, max: 100, step: 10, initial: 30 },
    { id: "k", kind: "toggle", label: "Kill switch" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pct = g.v.k === 1 ? 0 : g.v.p;
    for (let k = 0; k < 40; k++) {
      const x = 40 + (k % 10) * 42;
      const y = 50 + Math.floor(k / 10) * 36;
      const on = (k / 40) * 100 < pct;
      node(g, "user", x, y, { size: 20, color: on ? pal.accent : pal.muted, a: on ? 1 : 0.6 });
    }
    node(g, "shield", 460, 130, { label: "flag", size: 30, color: pct > 0 ? pal.accent : pal.muted });
    g.text(`${pct}% of users see the new path`, 240, 214, { size: 13, color: pct > 0 ? pal.accent : pal.paper });
    g.text(g.v.k === 1 ? "kill switch on: back to the old behaviour instantly" : "orange users run the new code", 240, 246, { size: 11, color: g.v.k === 1 ? pal.ok : pal.muted });
  },
};

const windowBoundary: Scene = {
  title: "Fixed window versus sliding window",
  caption: "A limit of five requests per ten seconds. A fixed window resets at the boundary, so five requests just before and five just after let ten through in a moment. A sliding window counts the last ten seconds, and refuses the extra ones.",
  controls: [{ id: "m", kind: "choice", label: "Window", options: ["fixed", "sliding"], initial: 0 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const slide = g.v.m === 1;
    const x0 = 30;
    const sc = 420 / 20;
    g.line(x0, 130, 450, 130, pal.line, 1, 1.4);
    if (!slide) {
      g.line(x0 + 10 * sc, 70, x0 + 10 * sc, 190, pal.accent, 0.8, 1.6);
      g.text("window resets", x0 + 10 * sc, 62, { size: 9, color: pal.accent });
    }
    const req = [5.4, 6.5, 7.6, 8.7, 9.6, 10.2, 10.5, 10.8, 11.1, 11.5];
    let allowed = 0;
    req.forEach((t, k) => {
      const inWin = slide ? req.slice(0, k).filter((o) => t - o < 10).length : req.slice(0, k).filter((o) => Math.floor(o / 10) === Math.floor(t / 10)).length;
      const ok = inWin < 5;
      if (ok) allowed++;
      g.dot(x0 + t * sc, 130, 5, ok ? pal.ok : pal.bad);
      g.text(ok ? "✓" : "✕", x0 + t * sc, 112, { size: 10, color: ok ? pal.ok : pal.bad });
    });
    node(g, "shield", 40, 215, { size: 26 });
    g.text(slide ? `${allowed} allowed: limit holds across the boundary ✓` : `${allowed} allowed in about 2 seconds: double the limit ✕`, 250, 220, { size: 12, color: slide ? pal.ok : pal.bad });
  },
};

const quorumRW: Scene = {
  title: "Tunable quorum: R + W > N",
  caption: "With three replicas, a write waits for W acknowledgements and a read asks R replicas. When R plus W exceeds N, the read set must overlap the write set, so a read sees the latest write. Otherwise it can be stale.",
  controls: [
    { id: "w", kind: "range", label: "W (write acks)", min: 1, max: 3, step: 1, initial: 2 },
    { id: "r", kind: "range", label: "R (read replicas)", min: 1, max: 3, step: 1, initial: 2 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const W = g.v.w;
    const R = g.v.r;
    const ok = R + W > 3;
    for (let k = 0; k < 3; k++) {
      const x = 90 + k * 150;
      const wrote = k < W;
      const read = k >= 3 - R;
      node(g, "db", x, 100, { label: `replica ${k + 1}`, size: 44, color: wrote ? pal.accent : pal.muted });
      g.text(wrote ? "new" : "old", x, 136, { size: 10, color: wrote ? pal.ok : pal.bad });
      if (wrote) g.ring(x, 100, 34, pal.accent, 0.7, 1.6);
      if (read) g.frame(x - 38, 64, 76, 100, pal.blue, 0.8, 8, 1.6);
    }
    g.text("orange ring: wrote   blue box: read from", 240, 188, { size: 10, color: pal.muted });
    g.text(`R + W = ${R + W} ${ok ? "> 3" : "≤ 3"}`, 240, 220, { size: 15, color: ok ? pal.ok : pal.bad, bold: true });
    g.text(ok ? "read set overlaps write set: always sees the latest" : "a read can miss every replica that has the write", 240, 252, { size: 11, color: ok ? pal.ok : pal.bad });
  },
};

const callChain: Scene = {
  title: "The cost of a call chain",
  caption: "Splitting into services turns function calls into network calls. Each hop adds latency and each service can fail. Add services to the chain and watch end-to-end availability fall and latency add up.",
  controls: [{ id: "n", kind: "range", label: "Services in the chain", min: 1, max: 8, step: 1, initial: 4 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const av = 0.999 ** n;
    const lat = 5 * n + 2 * n;
    const w = 400 / Math.max(1, n);
    for (let k = 0; k < n; k++) {
      const x = 40 + k * w + w / 2;
      node(g, "server", x, 100, { size: Math.min(36, w - 6), active: true });
      if (k < n - 1) g.packet(x + 16, 100, x + w - 16, 100, (g.t * 1.4 + k * 0.1) % 1, pal.accent, 2);
    }
    g.text("availability", 70, 190, { size: 11 });
    bar(g, 150, 185, 230, 8, av, av > 0.995 ? pal.ok : pal.bad);
    g.text(`${(av * 100).toFixed(2)}%`, 430, 190, { size: 12, color: pal.paper });
    g.text("added latency", 70, 218, { size: 11 });
    bar(g, 150, 213, 230, 8, lat / 60, lat > 30 ? pal.bad : pal.ok);
    g.text(`${lat} ms`, 430, 218, { size: 12, color: pal.paper });
    g.text("each service is 99.9% available and adds ~7 ms", 240, 258, { size: 10, color: pal.muted });
  },
};

const jitter: Scene = {
  title: "Retry backoff with jitter",
  caption: "A hundred clients fail at once and all retry after the same delay, so the dependency is hit by a synchronized wave each round. Random jitter spreads the retries across the interval and the load flattens.",
  controls: [{ id: "j", kind: "toggle", label: "Add jitter", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const jit = g.v.j === 1;
    const bins = 24;
    const hist = new Array(bins).fill(0);
    for (let k = 0; k < 100; k++) {
      [1, 2, 4].forEach((d) => {
        const t = d * 4 + (jit ? g.rnd(k * 7.3 + d) * d * 3.5 : 0);
        const b = Math.min(bins - 1, Math.floor(t * 1.5));
        hist[b]++;
      });
    }
    const mx = Math.max(...hist);
    hist.forEach((h, b) => g.rect(30 + b * 18, 190 - (h / 100) * 120, 15, Math.max(1, (h / 100) * 120), h > 40 ? pal.bad : pal.blue, 0.75, 2));
    g.text("retry arrivals over time →", 240, 212, { size: 10, color: pal.muted });
    node(g, "db", 450, 60, { size: 30, color: mx > 40 ? pal.bad : pal.blue });
    g.text(`peak ${mx} retries in one slot`, 240, 240, { size: 13, color: mx > 40 ? pal.bad : pal.ok });
    g.text(jit ? "the herd is spread out" : "synchronized waves at 4 s, 8 s and 16 s", 240, 266, { size: 10, color: pal.muted });
  },
};

const ledger: Scene = {
  title: "Double-entry ledger",
  caption: "Every movement of money is two immutable entries, a debit in one account and an equal credit in another, written in one transaction. The sum of all entries is always zero, and a mistake is fixed with a reversing entry, never an edit.",
  controls: [{ id: "e", kind: "choice", label: "Event", options: ["customer pays $50", "refund $20"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const refund = g.v.e === 1;
    const amt = refund ? 20 : 50;
    const f = g.loop(4);
    node(g, "db", 80, 70, { label: refund ? "revenue" : "customer", size: 40, color: pal.blue });
    node(g, "db", 400, 70, { label: refund ? "customer" : "revenue", size: 40, color: pal.ok });
    g.packet(104, 70, 376, 70, g.clamp(f * 1.6), pal.accent, 3.4);
    g.text(`$${amt}`, 240, 52, { size: 13, color: pal.accent, bold: true });
    g.rect(110, 130, 260, 80, pal.line, 0.12, 8);
    g.frame(110, 130, 260, 80, pal.line, 1, 8, 1.2);
    g.text("ledger entries", 240, 144, { size: 9, color: pal.muted });
    if (f > 0.3) g.text(`debit   ${refund ? "revenue" : "customer"}   -${amt}`, 130, 168, { size: 11, align: "left", color: pal.bad });
    if (f > 0.4) g.text(`credit  ${refund ? "customer" : "revenue"}   +${amt}`, 130, 190, { size: 11, align: "left", color: pal.ok });
    g.text("sum of entries = 0", 240, 238, { size: 13, color: pal.ok });
    g.text("never edit history: append a reversing entry", 240, 264, { size: 10, color: pal.muted });
  },
};

const lockQueue: Scene = {
  title: "Waiting for a lock without a stampede",
  caption: "Five clients want the lock. If they all watch the lock key, every release wakes all of them and four lose again. Chaining each waiter to watch only the one ahead of it wakes exactly one client per release.",
  controls: [{ id: "m", kind: "choice", label: "Waiting", options: ["everyone watches the lock", "watch your predecessor"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const chain = g.v.m === 1;
    const rel = (g.t % 4) > 2;
    node(g, "lock", 60, 100, { label: "lock holder", size: 40, color: pal.ok });
    let woken = 0;
    for (let k = 0; k < 5; k++) {
      const x = 150 + k * 66;
      const wake = rel && (!chain || k === 0);
      if (wake) woken++;
      node(g, "user", x, 100, { size: 26, color: wake ? pal.accent : pal.muted });
      g.text(`#${k + 1}`, x, 130, { size: 9, color: pal.muted });
      if (chain) g.arrow(x - 18, 100, x - 44, 100, pal.line, 0.6);
      else g.line(x, 84, 60, 78, wake ? pal.accent : pal.line, wake ? 0.8 : 0.3, 1);
      if (wake) g.glow(x, 100, 26, pal.accent, 0.35);
    }
    g.text(rel ? `holder releases: ${woken} client${woken > 1 ? "s" : ""} woken` : "waiting…", 240, 190, { size: 13, color: rel && woken > 1 ? pal.bad : pal.paper });
    g.text(chain ? "one wake-up per release" : "a thundering herd on every release", 240, 232, { size: 11, color: chain ? pal.ok : pal.bad });
  },
};

const base62: Scene = {
  title: "Counter to short code",
  caption: "A unique number from a counter is written in base 62 using letters and digits. Seven characters cover over three trillion ids, so codes stay short, never collide, and need no hashing or retry logic.",
  controls: [{ id: "n", kind: "range", label: "Counter value 10^", min: 3, max: 12, step: 1, initial: 9 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const A = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const n = 10 ** g.v.n + Math.floor(g.t * 3);
    const digs: number[] = [];
    let v = n;
    while (v > 0) {
      digs.unshift(v % 62);
      v = Math.floor(v / 62);
    }
    g.text(`counter = ${n.toLocaleString("en-US")}`, 240, 40, { size: 14, color: pal.paper });
    g.text("÷ 62 repeatedly, remainders are the digits", 240, 66, { size: 10, color: pal.muted });
    const w = 50;
    const x0 = 240 - (digs.length * w) / 2;
    digs.forEach((d, k) => {
      g.rect(x0 + k * w, 96, w - 6, 50, pal.accent, 0.25, 6);
      g.text(A[d], x0 + k * w + (w - 6) / 2, 114, { size: 20, color: pal.paper, bold: true });
      g.text(String(d), x0 + k * w + (w - 6) / 2, 136, { size: 9, color: pal.muted });
    });
    node(g, "cloud", 60, 210, { size: 28 });
    g.text(`short.link/${digs.map((d) => A[d]).join("")}`, 250, 214, { size: 14, color: pal.ok });
    g.text(`${digs.length} characters, 62^7 ≈ 3.5 trillion ids`, 240, 262, { size: 10, color: pal.muted });
  },
};

const chatRouting: Scene = {
  title: "Routing a chat message between servers",
  caption: "Sender and recipient are connected to different servers. The sender's server looks up where the recipient lives and forwards the message over a pub/sub channel. If the recipient is offline, it is stored and delivered as a push.",
  controls: [{ id: "o", kind: "toggle", label: "Recipient offline" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const off = g.v.o === 1;
    node(g, "phone", 36, 110, { label: "Ana", size: 38 });
    node(g, "server", 140, 110, { label: "chat server 1", size: 38, active: true });
    node(g, "queue", 250, 110, { label: "pub/sub", size: 40 });
    node(g, "server", 360, 110, { label: "chat server 2", size: 38, active: !off });
    node(g, "phone", 450, 110, { label: "Raj", size: 38, color: off ? pal.muted : pal.paper, a: off ? 0.5 : 1 });
    g.packet(58, 110, 116, 110, g.loop(2), pal.accent, 2.8);
    g.packet(164, 110, 224, 110, g.loop(2, 0.2), pal.accent, 2.8);
    if (!off) {
      g.packet(276, 110, 336, 110, g.loop(2, 0.4), pal.accent, 2.8);
      g.packet(382, 110, 428, 110, g.loop(2, 0.6), pal.ok, 2.8);
      g.text("delivered live", 240, 198, { size: 12, color: pal.ok });
    } else {
      node(g, "db", 250, 190, { label: "inbox store", size: 34, color: pal.blue });
      g.packet(250, 134, 250, 170, g.loop(2, 0.4), pal.accent, 2.4);
      g.text("saved, push notification sent, delivered on reconnect", 240, 248, { size: 11, color: pal.accent });
    }
    g.text("lookup: which server holds Raj's connection?", 240, 40, { size: 10, color: pal.muted });
  },
};

const politeness: Scene = {
  title: "Crawler politeness per domain",
  caption: "A crawler could hammer one site with every worker at once. A politeness rule keeps a queue per domain and enforces a delay between fetches to that host, while the workers rotate across domains to stay busy.",
  controls: [{ id: "p", kind: "toggle", label: "Per-domain delay", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pol = g.v.p === 1;
    const doms = ["news.example", "shop.example", "blog.example"];
    doms.forEach((d, k) => {
      const y = 50 + k * 56;
      node(g, "server", 400, y, { label: "", size: 28 });
      g.text(d, 400, y + 24, { size: 9, color: pal.muted });
      const rate = pol ? 1 : k === 0 ? 8 : 1;
      for (let j = 0; j < rate; j++) g.packet(150, y, 372, y, (g.t * (pol ? 0.9 : 1.6) + j / rate + k * 0.13) % 1, rate > 3 ? pal.bad : pal.accent, 2);
      g.rect(20, y - 14, 110, 28, pal.blue, 0.15, 6);
      for (let j = 0; j < 5; j++) g.rect(26 + j * 20, y - 8, 15, 16, pal.blue, 0.4, 3);
      g.text(`${rate}/s`, 270, y - 12, { size: 10, color: rate > 3 ? pal.bad : pal.muted });
    });
    g.text(pol ? "one request per second per host, workers rotate ✓" : "news.example is flooded with 8 requests per second ✕", 240, 236, { size: 12, color: pol ? pal.ok : pal.bad });
    g.text("per-domain queues, not one global queue", 240, 262, { size: 10, color: pal.muted });
  },
};

const surge: Scene = {
  title: "Surge pricing from supply and demand",
  caption: "Each cell compares waiting riders with free drivers. Where demand outruns supply the price multiplier rises, which draws drivers toward the area and eases demand. Drag the demand and the hot cells spread.",
  controls: [{ id: "d", kind: "range", label: "Rider demand", min: 1, max: 10, step: 1, initial: 5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const dem = g.v.d;
    let maxm = 1;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++) {
        const hot = Math.exp(-(((c - 4) / 2.2) ** 2 + ((r - 1.5) / 1.5) ** 2));
        const supply = 3 + g.rnd(r * 8 + c) * 2;
        const demand = dem * (0.3 + hot) * (0.6 + 0.4 * Math.sin(g.t + c));
        const m = Math.max(1, Math.min(3, demand / supply));
        maxm = Math.max(maxm, m);
        g.rect(24 + c * 54, 40 + r * 44, 52, 42, m > 1.8 ? pal.bad : m > 1.2 ? pal.accent : pal.ok, 0.18 + (m - 1) * 0.25, 4);
        g.text(`${m.toFixed(1)}x`, 24 + c * 54 + 26, 40 + r * 44 + 21, { size: 10, color: pal.paper });
      }
    g.text("price multiplier per cell", 240, 28, { size: 10, color: pal.muted });
    g.text(`peak multiplier ${maxm.toFixed(1)}x`, 240, 238, { size: 13, color: maxm > 1.8 ? pal.bad : pal.paper });
    g.text("higher price pulls drivers in and pushes marginal demand out", 240, 264, { size: 10, color: pal.muted });
  },
};

const waitingRoom: Scene = {
  title: "The waiting room for a flash sale",
  caption: "Fifty thousand buyers hit the page at once but the checkout can serve only a few hundred a minute. The waiting room queues arrivals and admits them at a steady rate, so checkout stays healthy and stock sells out in an orderly way.",
  controls: [{ id: "r", kind: "range", label: "Admit per second", min: 1, max: 10, step: 1, initial: 4 }],
  aspect: 0.62,
  make: () => {
    let stock = 40;
    let waiting = 60;
    let last = -1;
    return (g) => {
      const { pal } = g;
      if (g.t < last) {
        stock = 40;
        waiting = 60;
      }
      last = g.t;
      const dt = Math.min(g.dt, 0.1);
      const rate = g.v.r;
      const adm = Math.min(waiting, rate * dt);
      waiting -= adm;
      stock = Math.max(0, stock - adm * 0.8);
      for (let k = 0; k < Math.min(30, Math.round(waiting / 2)); k++) node(g, "user", 24 + (k % 15) * 12, 50 + Math.floor(k / 15) * 20, { size: 11, color: pal.muted });
      g.text(`${Math.round(waiting)} waiting`, 110, 100, { size: 11, color: pal.muted });
      node(g, "shield", 260, 70, { label: "waiting room", size: 40, color: pal.accent });
      for (let k = 0; k < rate; k++) g.packet(284, 70, 360, 70, (g.t * 1.2 + k / rate) % 1, pal.ok, 2);
      node(g, "server", 400, 70, { label: "checkout", size: 38, active: stock > 0 });
      g.text("stock left", 70, 180, { size: 11 });
      bar(g, 140, 175, 240, 8, stock / 40, stock > 0 ? pal.ok : pal.bad);
      g.text(stock > 0 ? `${Math.round(stock)}` : "sold out", 430, 180, { size: 12, color: pal.paper });
      g.text("checkout never sees more than it can serve", 240, 236, { size: 11, color: pal.muted });
    };
  },
};

const holdTimers: Scene = {
  title: "Seat holds and the sweeper",
  caption: "Each held seat has an expiry. When the timer runs out the seat goes back on sale, either on the next conditional update that treats an expired hold as free, or when the background sweeper resets it.",
  controls: [{ id: "h", kind: "range", label: "Hold (minutes)", min: 2, max: 10, step: 2, initial: 6 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const hold = g.v.h;
    const t = (g.t * 1.2) % 14;
    [0, 1, 2].forEach((k) => {
      const start = k * 1.2;
      const left = Math.max(0, hold - (t - start) * 1.0);
      const state = t < start ? "free" : left > 0 ? "held" : t - start - hold < 0.8 ? "expired" : "free";
      const x = 80 + k * 150;
      g.rect(x - 36, 60, 72, 56, state === "held" ? pal.accent : state === "expired" ? pal.bad : pal.ok, 0.25, 8);
      g.frame(x - 36, 60, 72, 56, state === "held" ? pal.accent : state === "expired" ? pal.bad : pal.ok, 1, 8, 1.4);
      g.text(`seat ${k + 14}`, x, 80, { size: 11, color: pal.paper });
      g.text(state, x, 100, { size: 10, color: pal.muted });
      if (state === "held") {
        g.ring(x, 150, 16, pal.line, 1, 3);
        arcRing(g, x, 150, 16, left / hold, pal.accent);
        g.text(`${left.toFixed(0)}m`, x, 150, { size: 10, color: pal.paper });
      }
    });
    g.text("expired holds return to the pool", 240, 218, { size: 12, color: pal.paper });
    g.text(`${hold}-minute hold: long enough to pay, short enough to recycle`, 240, 248, { size: 10, color: pal.muted });
  },
};

function arcRing(g: import("../scene/types").G, x: number, y: number, r: number, frac: number, col: string): void {
  if (frac <= 0) return;
  const c = g.c;
  c.beginPath();
  c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(0.9999, frac));
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.lineCap = "round";
  c.stroke();
  c.lineCap = "butt";
}

const transcodeFan: Scene = {
  title: "Transcoding fan-out",
  caption: "The uploaded file is split into chunks that are transcoded in parallel by a pool of workers into every rendition, then stitched and packaged. If one worker dies, only its chunk is retried.",
  controls: [{ id: "f", kind: "toggle", label: "A worker fails" }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const fail = g.v.f === 1;
    node(g, "doc", 40, 110, { label: "upload", size: 40, color: pal.blue });
    node(g, "lb", 120, 110, { label: "splitter", size: 32 });
    for (let k = 0; k < 4; k++) {
      const y = 40 + k * 56;
      const dead = fail && k === 2;
      node(g, "gpu", 250, y, { size: 32, color: dead ? pal.bad : pal.paper, active: !dead });
      if (dead) g.text("✕", 250, y, { size: 16, color: pal.bad });
      g.packet(140, 110, 230, y, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2.2);
      g.packet(272, y, 350, 110, dead ? 0 : (g.t * 0.8 + k * 0.2 + 0.4) % 1, pal.ok, 2.2);
    }
    node(g, "doc", 380, 110, { label: "renditions", size: 40, color: pal.ok });
    node(g, "cdn", 450, 110, { size: 30 });
    g.text(fail ? "chunk 3 re-queued to another worker, the rest continue" : "chunks encode in parallel, then are packaged", 240, 258, { size: 11, color: fail ? pal.accent : pal.paper });
  },
};

const digest: Scene = {
  title: "Batching notifications into a digest",
  caption: "Ten likes in a minute should not be ten pushes. A batching window collects events per user and sends one summary when the window closes. A longer window means fewer messages but later delivery.",
  controls: [{ id: "w", kind: "range", label: "Batch window (s)", min: 0, max: 20, step: 5, initial: 10 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const win = g.v.w;
    const t = (g.t * 2) % 40;
    const x0 = 30;
    const sc = 420 / 40;
    g.line(x0, 100, 450, 100, pal.line, 1, 1.2);
    const ev = [3, 5, 6, 9, 14, 16, 17, 25, 28, 33];
    let sent = 0;
    let last = -99;
    ev.forEach((e) => {
      if (t < e) return;
      g.dot(x0 + e * sc, 100, 4, pal.accent);
      if (win === 0) {
        sent++;
        g.line(x0 + e * sc, 100, x0 + e * sc, 150, pal.bad, 0.7, 1.4);
      } else if (e - last >= win) {
        last = e;
      }
    });
    if (win > 0) {
      const closes: number[] = [];
      let s = ev[0];
      for (const e of ev) {
        if (e >= s + win) s = e;
        if (e === s && !closes.includes(s)) closes.push(s);
      }
      closes.forEach((c) => {
        if (t >= c + win) {
          sent++;
          g.rect(x0 + (c + win) * sc - 4, 140, 8, 20, pal.ok, 0.8, 2);
        }
        g.rect(x0 + c * sc, 90, win * sc, 4, pal.ok, 0.3, 2);
      });
    }
    node(g, "phone", 440, 200, { size: 28 });
    g.text(`${sent} message${sent === 1 ? "" : "s"} sent to the user`, 240, 210, { size: 13, color: win === 0 ? pal.bad : pal.ok });
    g.text(win === 0 ? "one push per event" : "one summary per window", 240, 250, { size: 10, color: pal.muted });
  },
};

const logBuffer: Scene = {
  title: "Buffering log bursts",
  caption: "Services emit logs in bursts, far faster than the index can absorb at the peak. A durable buffer in front soaks up the burst and feeds the indexer at its own steady pace. Without it the indexer drops logs or the services slow down.",
  controls: [{ id: "b", kind: "toggle", label: "Buffer in front", initial: true }],
  aspect: 0.62,
  make: () => {
    let q = 0;
    let last = -1;
    return (g) => {
      const { pal } = g;
      if (g.t < last) q = 0;
      last = g.t;
      const buf = g.v.b === 1;
      const dt = Math.min(g.dt, 0.1);
      const burst = (g.t % 10) < 3 ? 14 : 3;
      const cap = 6;
      let lost = 0;
      if (buf) q = Math.max(0, q + (burst - cap) * dt);
      else lost = Math.max(0, burst - cap);
      for (let k = 0; k < 3; k++) node(g, "server", 36, 50 + k * 50, { size: 24, active: true });
      for (let k = 0; k < Math.round(burst / 3); k++) g.packet(56, 50 + (k % 3) * 50, buf ? 150 : 330, 100, (g.t * 1.6 + k * 0.15) % 1, burst > 6 ? pal.accent : pal.blue, 2);
      if (buf) node(g, "queue", 190, 100, { label: "buffer", size: 44, fill: Math.min(1, q / 12) });
      g.packet(buf ? 220 : 56, 100, 330, 100, (g.t * 1.2) % 1, pal.ok, 2.4);
      node(g, "db", 380, 100, { label: "log index", size: 44, color: lost > 0 ? pal.bad : pal.blue, active: true });
      g.text(burst > 6 ? "burst: 14 logs/s in, index handles 6/s" : "quiet: 3 logs/s", 240, 190, { size: 12, color: pal.paper });
      g.text(buf ? `backlog ${Math.round(q)} drains after the burst` : lost > 0 ? `${Math.round(lost)} logs/s dropped ✕` : "no loss while quiet", 240, 226, { size: 12, color: buf ? pal.ok : lost > 0 ? pal.bad : pal.ok });
    };
  },
};

const ingestFailover: Scene = {
  title: "Ingest failover for a live stream",
  caption: "The encoder sends the stream to a primary ingest and a backup at the same time. When the primary fails the packager switches to the backup copy and viewers see a brief hiccup rather than a dead stream.",
  controls: [{ id: "f", kind: "toggle", label: "Primary ingest fails" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const fail = g.v.f === 1 && (g.t % 8) > 2.5;
    node(g, "client", 40, 110, { label: "encoder", size: 38 });
    node(g, "server", 190, 60, { label: "primary ingest", size: 36, color: fail ? pal.bad : pal.paper, active: !fail });
    node(g, "server", 190, 170, { label: "backup ingest", size: 36, active: true });
    if (fail) g.text("✕", 190, 60, { size: 16, color: pal.bad });
    g.packet(62, 104, 166, 64, g.loop(1.4), fail ? pal.bad : pal.accent, 2.4);
    g.packet(62, 116, 166, 168, g.loop(1.4, 0.3), pal.accent, 2.4);
    node(g, "gpu", 330, 110, { label: "packager", size: 38, active: true });
    g.packet(214, fail ? 170 : 66, 306, 108, g.loop(1.4, 0.5), fail ? pal.ok : pal.accent, 2.6);
    node(g, "cdn", 440, 110, { label: "CDN", size: 34 });
    g.packet(354, 110, 418, 110, g.loop(1.4, 0.7), pal.accent, 2.4);
    g.text(fail ? "switched to the backup copy: viewers see a short blip" : "both ingests receive the same stream", 240, 238, { size: 12, color: fail ? pal.accent : pal.paper });
  },
};

const trieBuild: Scene = {
  title: "The autocomplete data pipeline",
  caption: "Query logs are aggregated with decay, filtered for safety and rarity, and compiled into an index with top suggestions at every prefix. The new index is built beside the old one and swapped in atomically.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.6, 1.6, 1.8]);
    const stages: [string, "doc" | "server" | "shield" | "db" | "lb"][] = [["query logs", "doc"], ["aggregate + decay", "server"], ["filter unsafe/rare", "shield"], ["build prefix index", "db"], ["swap in", "lb"]];
    stages.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const on = k <= i + (i === 3 ? 1 : 0);
      node(g, kind, x, 100, { label: nm, size: 36, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.4, active: k === i });
      if (k < 4) g.arrow(x + 24, 100, x + 74, 100, pal.line, on ? 0.9 : 0.3);
    });
    const px = 44 + Math.min(4, i + p) * 98;
    g.dot(px, 100, 5, pal.accent);
    g.glow(px, 100, 14, pal.accent, 0.4);
    g.text(["billions of raw search events", "count per query, older events weigh less", "drop offensive and one-off queries", "top 10 suggestions stored at each prefix", "serving nodes load the new snapshot"][Math.min(4, i + (p > 0.8 ? 1 : 0))], 240, 190, { size: 12, color: pal.paper });
    g.text("a fast path adds trending queries between rebuilds", 240, 232, { size: 10, color: pal.muted });
  },
};

const missedRun: Scene = {
  title: "Missed runs: catch up or skip",
  caption: "The scheduler was down from 02:00 to 02:07. When it returns it must decide for each job. A report with a short deadline is skipped as stale, while a billing job with a long deadline is run late.",
  controls: [{ id: "d", kind: "range", label: "Start deadline (min)", min: 0, max: 15, step: 1, initial: 5 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const dl = g.v.d;
    const x0 = 40;
    const sc = 400 / 12;
    g.line(x0, 120, 440, 120, pal.line, 1, 1.4);
    g.rect(x0, 100, 7 * sc, 40, pal.bad, 0.2, 4);
    g.text("scheduler down", x0 + 3.5 * sc, 90, { size: 10, color: pal.bad });
    g.text("02:00", x0, 160, { size: 10, color: pal.muted });
    g.text("02:07", x0 + 7 * sc, 160, { size: 10, color: pal.muted });
    g.rect(x0, 190, Math.min(12, dl) * sc, 8, pal.accent, 0.5, 4);
    g.text("start deadline", x0, 214, { size: 9, align: "left", color: pal.muted });
    const late = 7 <= dl;
    const t = (g.t * 1.4) % 12;
    g.dot(x0 + t * sc, 120, 5, pal.accent);
    chip(g, 240, 240, late ? "recovered at 02:07: within deadline, run late ✓" : "recovered at 02:07: too stale, skipped", late ? pal.ok : pal.accent, 11);
    node(g, "server", 440, 190, { size: 22, active: late });
  },
};

const hintedHandoff: Scene = {
  title: "Sloppy quorum and hinted handoff",
  caption: "A replica that should receive the write is down. Instead of refusing, the coordinator writes to the next healthy node on the ring with a hint that the data belongs elsewhere. When the real owner returns the hint is handed back.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.8, 1.8, 2, 2]);
    const pts: [number, number][] = [[240, 40], [380, 100], [320, 200], [160, 200], [100, 100]];
    const names = ["A", "B", "C", "D", "E"];
    pts.forEach(([x, y], k) => {
      const dead = k === 1 && i < 3;
      node(g, "db", x, y, { size: 34, color: dead ? pal.bad : k === 2 && i >= 1 && i < 3 ? pal.accent : pal.blue, a: dead ? 0.5 : 1 });
      g.text(names[k], x, y + 28, { size: 10, color: pal.muted });
      if (dead) g.text("✕", x, y, { size: 16, color: pal.bad });
    });
    node(g, "client", 240, 120, { size: 28 });
    if (i === 0) g.packet(240, 130, 360, 104, p, pal.accent, 3);
    if (i === 1) g.packet(250, 134, 316, 184, p, pal.accent, 3);
    if (i === 2) g.text("hint: belongs to B", 320, 238, { size: 10, color: pal.accent });
    if (i === 3) g.packet(320, 184, 380, 118, p, pal.ok, 3);
    g.text(["B owns this key but is down", "write goes to C instead, with a hint", "C keeps the hint until B recovers", "B is back: hint handed off, data in place ✓"][i], 240, 266, { size: 12, color: i === 3 ? pal.ok : pal.paper });
  },
};

const taoCache: Scene = {
  title: "TAO: reads from cache, writes through the leader",
  caption: "Clients read from a follower cache, and on a miss the follower asks the leader cache, which asks the database. Writes go to the leader in the shard's master region and invalidate caches, so reads stay fast and writes stay ordered.",
  controls: [{ id: "o", kind: "choice", label: "Operation", options: ["read (cache hit)", "read (miss)", "write"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const o = g.v.o;
    node(g, "client", 36, 110, { label: "web", size: 34 });
    node(g, "cache", 150, 110, { label: "follower", size: 38, active: true });
    node(g, "cache", 270, 110, { label: "leader", size: 38, color: pal.violet });
    node(g, "db", 400, 110, { label: "MySQL", size: 42, color: pal.blue });
    const reach = o === 0 ? 1 : o === 1 ? 3 : 3;
    const xs = [60, 150, 270, 400];
    for (let k = 0; k < reach; k++) g.packet(xs[k] + 22, 110, xs[k + 1] - 22, 110, g.clamp(g.loop(3) * 3.2 - k), o === 2 ? pal.accent : pal.ok, 3);
    if (o >= 1) for (let k = 0; k < reach; k++) g.packet(xs[k + 1] - 22, 124, xs[k] + 22, 124, g.clamp(g.loop(3, 0.5) * 3.2 - (reach - 1 - k)), pal.teal, 2.2);
    g.text(["answered by the nearby follower", "miss climbs to the leader, then the database", "write goes through the leader and invalidates caches"][o], 240, 200, { size: 12, color: pal.paper });
    g.text(["~1 ms", "~10 ms, and the follower keeps the result", "ordered per shard, replicated asynchronously"][o], 240, 236, { size: 11, color: pal.muted });
  },
};

const commitWait: Scene = {
  title: "Spanner commit wait",
  caption: "TrueTime gives a time interval, not a point, with uncertainty epsilon. To make a transaction's timestamp safely in the past for everyone, Spanner waits out the uncertainty before releasing locks. A tighter clock means a shorter wait.",
  controls: [{ id: "e", kind: "range", label: "Clock uncertainty ε (ms)", min: 1, max: 10, step: 1, initial: 4 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const eps = g.v.e;
    const x0 = 40;
    const sc = 400 / 30;
    g.line(x0, 120, 440, 120, pal.line, 1, 1.4);
    const ts = 6;
    g.rect(x0 + (ts - eps) * sc, 100, 2 * eps * sc, 40, pal.accent, 0.25, 4);
    g.text("TrueTime interval", x0 + ts * sc, 90, { size: 9, color: pal.accent });
    g.dot(x0 + ts * sc, 120, 5, pal.accent);
    g.text("commit timestamp", x0 + ts * sc, 156, { size: 9, color: pal.paper });
    const wait = 2 * eps;
    const t = (g.t * 6) % 26;
    g.rect(x0 + ts * sc, 170, Math.min(t, wait) * sc, 10, pal.bad, 0.6, 4);
    g.rect(x0 + ts * sc, 170, wait * sc, 10, pal.bad, 0.15, 4);
    g.text(`commit wait ${wait} ms`, x0 + ts * sc, 196, { size: 11, align: "left", color: pal.bad });
    node(g, "gpu", 450, 60, { size: 24 });
    g.text(t >= wait ? "locks released, timestamp is in the past for everyone ✓" : "waiting out the uncertainty…", 240, 246, { size: 12, color: t >= wait ? pal.ok : pal.paper });
  },
};

const bulkhead: Scene = {
  title: "Bulkheads: isolate the slow dependency",
  caption: "A single shared thread pool lets one slow dependency eat every thread, and unrelated calls start failing. Separate pools per dependency confine the damage: the slow one fills its own pool and the rest keep working.",
  controls: [{ id: "b", kind: "toggle", label: "Separate pools", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const iso = g.v.b === 1;
    const slow = 0.5 + 0.5 * Math.min(1, (g.t % 8) / 3);
    const deps = ["payments (slow)", "search", "profile"];
    node(g, "server", 50, 110, { label: "service", size: 40, active: true });
    deps.forEach((d, k) => {
      const y = 50 + k * 60;
      const busy = k === 0 ? slow : 0.3;
      const poolFull = iso ? k === 0 && slow > 0.9 : slow > 0.9;
      g.rect(130, y - 18, 130, 36, poolFull ? pal.bad : pal.blue, 0.15, 8);
      g.frame(130, y - 18, 130, 36, poolFull ? pal.bad : pal.blue, 1, 8, 1.2);
      for (let t = 0; t < 8; t++) g.rect(138 + t * 15, y - 8, 11, 16, poolFull ? pal.bad : pal.blue, (iso ? busy : Math.min(1, slow * (k === 0 ? 1 : 0.9))) > t / 8 ? 0.7 : 0.12, 2);
      g.packet(260, y, 340, y, (g.t * 0.8 + k * 0.2) % 1, k === 0 ? pal.bad : pal.ok, 2.2);
      node(g, "cloud", 400, y, { size: 24, color: k === 0 ? pal.bad : pal.paper });
      g.text(d, 400, y + 24, { size: 9, color: pal.muted });
    });
    const down = !iso && slow > 0.9;
    g.text(down ? "shared pool exhausted: search and profile fail too ✕" : iso ? "only payments degrades, the rest stay healthy ✓" : "shared pool filling up…", 240, 250, { size: 12, color: down ? pal.bad : iso ? pal.ok : pal.paper });
  },
};

const dosaLayers: Scene = {
  title: "DOSA: one interface, swappable stores",
  caption: "Services declare typed entities against a common client. The platform maps them to whichever engine suits the workload, so a team can move from one backend to another without touching the application code.",
  controls: [{ id: "b", kind: "choice", label: "Backend", options: ["Cassandra", "MySQL"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const b = g.v.b;
    node(g, "server", 70, 70, { label: "service code", size: 40, active: true });
    node(g, "lb", 70, 170, { label: "DOSA client", size: 38, color: pal.accent });
    g.packet(70, 92, 70, 150, g.loop(1.4), pal.accent, 2.6);
    chip(g, 190, 120, "Trip{uuid, status}", pal.violet, 10);
    g.arrow(96, 170, 250, 170, pal.line, 0.8);
    ["Cassandra", "MySQL"].forEach((nm, k) => {
      const y = 100 + k * 90;
      const on = k === b;
      node(g, "db", 340, y, { label: nm, size: 44, color: on ? pal.ok : pal.muted, a: on ? 1 : 0.35, active: on });
      if (on) g.packet(250, 170, 316, y, g.loop(1.4, 0.4), pal.ok, 2.6);
    });
    g.text("same application code, different engine", 240, 262, { size: 12, color: pal.paper });
  },
};

const zeroCopy: Scene = {
  title: "Zero-copy: serving a log to a consumer",
  caption: "The ordinary path copies bytes from disk into the page cache, into the application, into a socket buffer, then to the network card. sendfile lets the kernel move them from page cache straight to the network, skipping the application copies.",
  controls: [{ id: "z", kind: "toggle", label: "sendfile (zero-copy)", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const zc = g.v.z === 1;
    const stops: [string, "db" | "cache" | "server" | "queue" | "cloud"][] = [["disk", "db"], ["page cache", "cache"], ["app buffer", "server"], ["socket buffer", "queue"], ["network", "cloud"]];
    const use = zc ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
    stops.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const skipped = !use.includes(k);
      node(g, kind, x, 100, { label: nm, size: 34, a: skipped ? 0.2 : 1, color: skipped ? pal.muted : pal.paper });
    });
    for (let k = 0; k < use.length - 1; k++) {
      const a = 44 + use[k] * 98;
      const b = 44 + use[k + 1] * 98;
      g.packet(a + 22, 100, b - 22, 100, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2.6);
    }
    const copies = zc ? 2 : 4;
    g.text("memory copies per byte", 80, 200, { size: 11 });
    bar(g, 200, 195, 200, 8, copies / 4, zc ? pal.ok : pal.bad);
    g.text(String(copies), 430, 200, { size: 12, color: pal.paper });
    g.text(zc ? "the CPU barely touches the data" : "extra copies burn CPU and memory bandwidth", 240, 244, { size: 11, color: zc ? pal.ok : pal.bad });
  },
};

export const MORE_SD_3: Record<string, Scene[]> = {
  [`${P}/geo-matching-and-recs/geospatial-indexing`]: [geohashGrid],
  [`${P}/geo-matching-and-recs/recommendation-systems-and-collaborative-filtering`]: [collabFilter],
  [`${P}/geo-matching-and-recs/two-sided-marketplace-matching`]: [greedyVsBatch],
  [`${P}/geo-matching-and-recs/real-time-bidding-and-auction-systems`]: [pacing],
  [`${P}/geo-matching-and-recs/eta-prediction-and-routing-estimation`]: [searchFrontier],
  [`${P}/media-files-and-cdn/cdns-and-content-delivery`]: [pushPull],
  [`${P}/media-files-and-cdn/object-storage-and-large-file-handling`]: [storageClasses],
  [`${P}/media-files-and-cdn/image-optimization-and-responsive-delivery`]: [responsiveImg],
  [`${P}/media-files-and-cdn/video-streaming-protocols-hls-dash-and-adaptive-bitrate`]: [segmentAlign],
  [`${P}/media-files-and-cdn/chunked-and-resumable-upload-for-large-files`]: [parallelParts],
  [`${P}/reliability-and-operations/load-balancing-and-health-checks`]: [healthCheck],
  [`${P}/reliability-and-operations/graceful-degradation-and-circuit-breakers`]: [breakerStates],
  [`${P}/reliability-and-operations/chaos-engineering-and-disaster-recovery`]: [drTiers],
  [`${P}/reliability-and-operations/slis-slos-and-error-budgets`]: [burnRate],
  [`${P}/reliability-and-operations/observability-metrics-logs-and-traces`]: [tracePropagation],
  [`${P}/reliability-and-operations/deployment-strategies-blue-green-rolling-and-feature-flags`]: [flagRollout],
  [`${P}/service-and-data-designs/rate-limiter-design`]: [windowBoundary],
  [`${P}/service-and-data-designs/designing-a-distributed-key-value-store`]: [quorumRW],
  [`${P}/service-and-data-designs/microservices-vs-monolith-and-service-boundaries`]: [callChain],
  [`${P}/service-and-data-designs/designing-a-distributed-task-scheduler`]: [jitter],
  [`${P}/service-and-data-designs/designing-a-payment-and-billing-system`]: [ledger],
  [`${P}/service-and-data-designs/designing-a-distributed-lock-service`]: [lockQueue],
  [`${P}/product-designs/designing-a-url-shortener`]: [base62],
  [`${P}/product-designs/designing-a-chat-system`]: [chatRouting],
  [`${P}/product-designs/designing-a-web-crawler`]: [politeness],
  [`${P}/product-designs/designing-a-ride-sharing-system`]: [surge],
  [`${P}/product-designs/designing-an-e-commerce-inventory-and-checkout-system`]: [waitingRoom],
  [`${P}/product-designs/designing-a-ticket-booking-system`]: [holdTimers],
  [`${P}/media-and-operations-designs/designing-a-video-upload-and-transcoding-pipeline`]: [transcodeFan],
  [`${P}/media-and-operations-designs/designing-a-notification-system`]: [digest],
  [`${P}/media-and-operations-designs/designing-a-distributed-logging-and-monitoring-system`]: [logBuffer],
  [`${P}/media-and-operations-designs/designing-a-live-streaming-platform`]: [ingestFailover],
  [`${P}/media-and-operations-designs/designing-a-search-autocomplete-service`]: [trieBuild],
  [`${P}/media-and-operations-designs/designing-a-distributed-cron-and-job-scheduler`]: [missedRun],
  [`${P}/engineering-case-studies/amazon-dynamo-lessons`]: [hintedHandoff],
  [`${P}/engineering-case-studies/case-study-facebook-tao-graph-store`]: [taoCache],
  [`${P}/engineering-case-studies/case-study-google-spanner`]: [commitWait],
  [`${P}/engineering-case-studies/case-study-netflix-chaos-engineering-and-resilience`]: [bulkhead],
  [`${P}/engineering-case-studies/case-study-uber-schemaless-and-dosa`]: [dosaLayers],
  [`${P}/engineering-case-studies/case-study-kafka-at-linkedin`]: [zeroCopy],
};

