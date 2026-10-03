import type { G, Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "system-design";

function meter(g: G, x: number, y: number, w: number, label: string, v: number, text: string, color: string): void {
  g.text(label, x, y - 6, { size: 9, color: g.pal.muted, align: "left" });
  bar(g, x, y, w, 8, v, color);
  g.text(text, x + w + 8, y + 5, { size: 10, color: g.pal.paper, align: "left" });
}

const littles: Scene = {
  title: "Little's Law and the utilisation cliff",
  caption: "Requests in flight equal arrival rate times time in system. Raise the arrival rate toward capacity and the average time in the system explodes: at 95% utilisation a 20 ms service takes 400 ms, though no request got slower to compute.",
  controls: [
    { id: "r", kind: "range", label: "Arrival rate (req/s)", min: 100, max: 990, step: 10, initial: 700 },
    { id: "w", kind: "range", label: "Workers (each 20 ms per request)", min: 10, max: 40, step: 1, initial: 20 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const cap = g.v.w * 50;
    const rho = Math.min(0.995, g.v.r / cap);
    const over = g.v.r >= cap;
    const t = over ? 5000 : 20 / (1 - rho);
    const inflight = over ? g.v.w * 20 : (g.v.r * t) / 1000;
    for (let i = 0; i < 24; i++) {
      const x = 30 + (i / 23) * 250;
      const rr = Math.min(0.99, 0.02 + (i / 23) * 0.97);
      const h = Math.min(100, (20 / (1 - rr)) / 8);
      g.rect(x, 140 - h, 8, h, rr > 0.9 ? pal.bad : rr > 0.7 ? pal.accent : pal.ok, 0.5, 2);
    }
    g.dot(30 + (rho / 0.99) * 250 + 4, 140 - Math.min(100, t / 8) - 4, 5, pal.paper, 1);
    g.text("time in system vs utilisation", 30, 28, { size: 9, color: pal.muted, align: "left" });
    node(g, "server", 380, 70, { label: `${g.v.w} workers`, size: 48, color: pal.paper, state: over ? "working" : "breathing" });
    meter(g, 30, 185, 250, "utilisation", rho, `${Math.round(rho * 100)}%`, rho > 0.9 ? pal.bad : rho > 0.7 ? pal.accent : pal.ok);
    meter(g, 30, 225, 250, "average time in system", Math.min(1, t / 800), over ? "unbounded: queue grows" : `${Math.round(t)} ms`, over ? pal.bad : pal.blue);
    g.text(`requests in flight (L = rate x time): ${over ? ">" : ""}${Math.round(inflight)}`, 30, 270, { size: 11, color: pal.paper, align: "left" });
  },
};

const retries: Scene = {
  title: "Retries multiply across layers",
  caption: "If each layer retries failed calls, one user request becomes (1 + retries) to the power of layers calls on the database. Backoff, jitter, a retry budget and retrying at only one layer keep a slowdown from becoming an outage.",
  controls: [
    { id: "l", kind: "range", label: "Layers that retry", min: 1, max: 4, step: 1, initial: 3 },
    { id: "n", kind: "range", label: "Retries per layer", min: 0, max: 4, step: 1, initial: 2 },
    { id: "b", kind: "toggle", label: "Retry budget (max +10%)" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const mult = g.v.b === 1 ? 1.1 : Math.pow(1 + g.v.n, g.v.l);
    const base = 1000;
    const load = base * mult;
    const cap = 3000;
    for (let i = 0; i < g.v.l; i++) node(g, "server", 50 + i * 90, 70, { label: `layer ${i + 1}`, size: 34, color: pal.paper });
    node(g, "db", 410, 70, { label: "database", size: 42, color: load > cap ? pal.bad : pal.teal, state: load > cap ? "working" : undefined });
    g.packet(60, 70, 380, 70, g.loop(Math.max(0.4, 1.6 / Math.min(8, mult))), load > cap ? pal.bad : pal.accent, 3);
    meter(g, 30, 150, 290, "calls reaching the database per user request", Math.min(1, mult / 40), g.v.b === 1 ? "1.1x (budget)" : `${fmt(Math.round(mult * 10) / 10)}x`, mult > 3 ? pal.bad : pal.ok);
    meter(g, 30, 195, 290, "database load (capacity 3,000 / s)", Math.min(1, load / 8000), `${fmt(Math.round(load))} / s`, load > cap ? pal.bad : pal.ok);
    g.text(load > cap ? "the slowdown is now an outage" : "within capacity", 240, 250, { size: 12, color: load > cap ? pal.bad : pal.ok });
    g.text("1,000 user requests / s, dependency failing", 240, 276, { size: 9, color: pal.muted });
  },
};

const cells: Scene = {
  title: "Cells shrink the blast radius",
  caption: "Each cell is an independent copy of the stack serving a slice of customers. A bad deploy to all cells is a global outage; staged deployment stops at the first failing cell, so only that slice is affected.",
  controls: [
    { id: "n", kind: "range", label: "Number of cells", min: 1, max: 20, step: 1, initial: 10 },
    { id: "s", kind: "choice", label: "Rollout", options: ["all cells at once", "staged, halt on errors"], initial: 1 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const staged = g.v.s === 1;
    const cols = Math.min(10, n);
    const rows = Math.ceil(n / cols);
    const size = Math.min(36, 400 / cols - 6);
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const bad = staged ? i === 0 : true;
      if (bad) hit++;
      const x = 40 + (i % cols) * (size + 6);
      const y = 40 + Math.floor(i / cols) * (size + 6);
      g.rect(x, y, size, size, bad ? pal.bad : pal.ok, bad ? 0.8 : 0.55, 5);
    }
    const impact = hit / n;
    g.text(staged ? "wave 1 fails its health check: rollout halts" : "all cells receive the bad build", 240, 40 + rows * (size + 6) + 18, { size: 10, color: staged ? pal.ok : pal.bad });
    meter(g, 40, 200, 290, "customers affected", impact, `${Math.round(impact * 100)}%`, impact > 0.5 ? pal.bad : pal.ok);
    meter(g, 40, 240, 290, "extra operational cost (N deployments)", Math.min(1, n / 20), `${n} cells`, pal.blue);
    g.text("keep the router thin: it is the one shared part", 240, 285, { size: 9, color: pal.muted });
  },
};

const outbox: Scene = {
  title: "Dual write versus the transactional outbox",
  caption: "Writing the database and the broker separately can fail between the two steps. The outbox writes the event in the same local transaction, and a relay publishes it later, at least once, so the event is never lost; consumers deduplicate.",
  controls: [
    { id: "p", kind: "choice", label: "Pattern", options: ["dual write", "outbox + CDC"], initial: 0 },
    { id: "c", kind: "toggle", label: "Crash right after the DB commit" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const outboxMode = g.v.p === 1;
    const crash = g.v.c === 1;
    node(g, "server", 60, 90, { label: "order service", size: 44, color: pal.paper });
    node(g, "db", 220, 90, { label: outboxMode ? "orders + outbox" : "orders", size: 44, color: pal.teal });
    node(g, "queue", 400, 90, { label: "broker", size: 44, color: pal.blue });
    g.packet(84, 90, 196, 90, g.loop(1.6), pal.accent, 3);
    if (outboxMode) {
      g.packet(246, 90, 376, 90, g.loop(1.6, 0.5), pal.ok, 3);
      g.text("log tail / relay", 310, 76, { size: 9, color: pal.muted });
    } else if (!crash) {
      g.line(84, 112, 376, 112, pal.line, 1, 1);
      g.packet(84, 112, 376, 112, g.loop(1.6, 0.5), pal.accent, 3);
    } else {
      g.text("crash", 140, 130, { size: 11, color: pal.bad });
    }
    const lost = !outboxMode && crash;
    const msg = lost ? "order saved, event never sent: other services never learn of it" : outboxMode ? (crash ? "relay restarts, publishes the stored event (maybe twice): consumers dedupe" : "event published from the outbox") : "both steps succeeded this time";
    g.text(msg, 240, 190, { size: 11, color: lost ? pal.bad : pal.ok });
    meter(g, 40, 235, 280, "chance the event is lost", lost ? 1 : 0, lost ? "100% in this run" : "0%", lost ? pal.bad : pal.ok);
    g.text(outboxMode ? "delivery is at-least-once: make consumers idempotent" : "no transaction spans the database and the broker", 240, 285, { size: 9, color: pal.muted });
  },
};

const crdt: Scene = {
  title: "Two replicas, two increments: LWW loses one",
  caption: "Each replica adds to a shared counter while disconnected. Last-writer-wins keeps one value and discards the other. A grow-only counter keeps one slot per replica and merges by taking the maximum per slot, so every increment survives.",
  controls: [
    { id: "m", kind: "choice", label: "Merge rule", options: ["last-writer-wins", "G-counter CRDT"], initial: 0 },
    { id: "a", kind: "range", label: "Increments on A", min: 1, max: 9, step: 1, initial: 3 },
    { id: "b", kind: "range", label: "Increments on B", min: 1, max: 9, step: 1, initial: 4 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const crdtMode = g.v.m === 1;
    const a = g.v.a;
    const b = g.v.b;
    node(g, "phone", 80, 80, { label: `replica A: +${a}`, size: 46, color: pal.accent });
    node(g, "client", 400, 80, { label: `replica B: +${b}`, size: 46, color: pal.blue });
    g.packet(110, 80, 370, 80, g.loop(1.8), pal.ok, 3);
    g.packet(370, 80, 110, 80, g.loop(1.8, 0.9), pal.ok, 3);
    const expected = a + b;
    const got = crdtMode ? a + b : Math.max(a, b);
    chip(g, 240, 150, crdtMode ? "slots: A=" + a + " B=" + b + " -> sum" : "keep the newest write", crdtMode ? pal.ok : pal.bad, 10);
    g.text(`merged value: ${got}`, 240, 195, { size: 16, color: got === expected ? pal.ok : pal.bad });
    g.text(`true total: ${expected}`, 240, 220, { size: 11, color: pal.muted });
    g.text(got === expected ? "no update lost, any merge order gives the same result" : `${expected - got} increments silently discarded`, 240, 262, { size: 11, color: got === expected ? pal.ok : pal.bad });
  },
};

const tenancy: Scene = {
  title: "One missing WHERE clause: who is exposed?",
  caption: "In shared tables a forgotten tenant filter returns everyone's rows. Row-level security enforces the filter inside the database. A database per tenant makes the leak impossible but costs more to run and migrate.",
  controls: [
    { id: "i", kind: "choice", label: "Isolation", options: ["shared tables + app filter", "shared tables + row-level security", "database per tenant"], initial: 0 },
    { id: "w", kind: "toggle", label: "Developer forgets the tenant filter", initial: true },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const lvl = g.v.i;
    const bug = g.v.w === 1;
    const leak = lvl === 0 && bug;
    for (let t = 0; t < 4; t++) node(g, "user", 60 + t * 40, 60, { label: "", size: 24, color: [pal.accent, pal.blue, pal.violet, pal.teal][t] });
    g.text("tenants A to D", 100, 90, { size: 9, color: pal.muted });
    node(g, "db", 330, 80, { label: lvl === 2 ? "one DB per tenant" : "shared database", size: 52, color: leak ? pal.bad : pal.teal });
    if (lvl === 2) for (let t = 0; t < 3; t++) g.frame(300 + t * 8, 56 + t * 8, 60, 50, pal.ok, 0.6, 5, 1);
    if (lvl === 1) g.frame(296, 48, 68, 64, pal.ok, 0.9, 6, 1.6);
    g.packet(120, 70, 300, 80, g.loop(1.6), leak ? pal.bad : pal.accent, 3);
    g.text(leak ? "tenant A reads tenants B, C and D" : "tenant A sees only its own rows", 240, 150, { size: 12, color: leak ? pal.bad : pal.ok });
    const cost = [0.15, 0.2, 1][lvl];
    const ops = [0.2, 0.3, 0.9][lvl];
    meter(g, 40, 205, 280, "relative infrastructure cost", cost, ["low", "low", "high"][lvl], pal.blue);
    meter(g, 40, 245, 280, "per-tenant restore, move, delete", 1 - ops, ["hard", "hard", "easy"][lvl], 1 - ops > 0.5 ? pal.ok : pal.accent);
  },
};

const mesh: Scene = {
  title: "What a service mesh costs per pod",
  caption: "Sidecars add a proxy to every pod. Ambient mode runs a shared per-node proxy for layer-4 security and adds layer-7 proxies only where needed. The numbers are illustrative, scaled from a reported benchmark of about 14 vCPU versus 5 vCPU for 70 pods.",
  controls: [
    { id: "p", kind: "range", label: "Pods", min: 10, max: 500, step: 10, initial: 70 },
    { id: "m", kind: "choice", label: "Data plane", options: ["no mesh", "sidecar per pod", "ambient (node proxy)"], initial: 1 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const pods = g.v.p;
    const per = [0, 0.2, 0.07][g.v.m];
    const cpu = pods * per;
    const feat = [["none", pal.bad], ["mTLS, retries, L7 policy, telemetry", pal.ok], ["mTLS + telemetry; L7 only where needed", pal.ok]][g.v.m];
    for (let i = 0; i < 12; i++) {
      const x = 50 + (i % 6) * 62;
      const y = 50 + Math.floor(i / 6) * 56;
      g.rect(x, y, 44, 36, pal.line, 0.3, 5);
      if (g.v.m === 1) g.rect(x + 28, y + 20, 14, 12, pal.accent, 0.9, 3);
    }
    if (g.v.m === 2) {
      g.rect(50, 168, 366, 10, pal.accent, 0.8, 4);
      g.text("per-node ztunnel (shared)", 233, 190, { size: 9, color: pal.muted });
    }
    meter(g, 40, 225, 290, "mesh CPU overhead", Math.min(1, cpu / 100), `${cpu.toFixed(1)} vCPU`, cpu > 40 ? pal.bad : pal.accent);
    g.text(`gives you: ${feat[0]}`, 40, 268, { size: 10, color: feat[1] as string, align: "left" });
  },
};

const lakehouse: Scene = {
  title: "Small files slow every query until you compact",
  caption: "Streaming commits create many small files. Query planning and reading cost grows with the file count. Compaction merges them into a few large files, and expiring old snapshots frees the storage they pin.",
  controls: [
    { id: "h", kind: "range", label: "Hours of streaming", min: 1, max: 48, step: 1, initial: 24 },
    { id: "c", kind: "toggle", label: "Hourly compaction" },
    { id: "e", kind: "toggle", label: "Expire old snapshots" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const hours = g.v.h;
    const files = g.v.c === 1 ? 40 + (hours % 1) * 0 + 20 : hours * 60;
    const q = 0.4 + files * 0.012;
    const storage = (g.v.e === 1 ? 1 : 1 + hours * 0.12) * 100;
    const shown = Math.min(60, Math.round(files / 12));
    for (let i = 0; i < 60; i++) {
      const x = 40 + (i % 20) * 21;
      const y = 40 + Math.floor(i / 20) * 20;
      g.rect(x, y, 16, 14, i < shown ? (g.v.c === 1 ? pal.ok : pal.accent) : pal.line, i < shown ? 0.85 : 0.2, 2);
    }
    g.text(`${fmt(files)} data files in the table`, 40, 118, { size: 10, color: pal.paper, align: "left" });
    meter(g, 40, 165, 280, "query time (planning + open files)", Math.min(1, q / 40), `${q.toFixed(1)} s`, q > 20 ? pal.bad : q > 8 ? pal.accent : pal.ok);
    meter(g, 40, 210, 280, "storage vs live data", Math.min(1, storage / 600), `${Math.round(storage)}%`, storage > 300 ? pal.bad : pal.ok);
    g.text(g.v.e === 1 ? "old snapshots expired: storage tracks live data (time travel limited)" : "old snapshots still pin deleted files", 40, 262, { size: 10, color: pal.muted, align: "left" });
  },
};

const tsdb: Scene = {
  title: "Cardinality, not points, decides the cost",
  caption: "Every distinct label combination is a new series with its own index entry and memory. A bounded label keeps 60 series; adding a user id multiplies them by the number of users. Compression shrinks points but cannot save an exploding series count.",
  controls: [
    { id: "v", kind: "range", label: "Distinct values of one extra label (log10)", min: 0, max: 6, step: 1, initial: 0 },
    { id: "c", kind: "toggle", label: "Delta-of-delta + XOR compression", initial: true },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const vals = Math.pow(10, g.v.v);
    const series = 60 * vals;
    const mem = (series * 3) / 1e6;
    const bytes = g.v.c === 1 ? 1.4 : 16;
    const perDay = (series * 5760 * bytes) / 1e9;
    const shown = Math.min(60, Math.round(Math.log10(series + 1) * 9));
    for (let i = 0; i < 60; i++) g.rect(40 + (i % 20) * 21, 40 + Math.floor(i / 20) * 18, 16, 12, i < shown ? (series > 1e6 ? pal.bad : pal.teal) : pal.line, i < shown ? 0.85 : 0.2, 2);
    g.text(`${fmt(Math.round(series))} active series`, 40, 112, { size: 11, color: series > 1e6 ? pal.bad : pal.paper, align: "left" });
    meter(g, 40, 160, 280, "memory at ~3 KB per series", Math.min(1, mem / 20000), mem < 1000 ? `${mem.toFixed(1)} MB` : `${(mem / 1000).toFixed(1)} GB`, mem > 8000 ? pal.bad : pal.ok);
    meter(g, 40, 205, 280, "storage per day (15 s scrape)", Math.min(1, perDay / 2000), perDay < 1 ? `${(perDay * 1000).toFixed(0)} MB` : `${perDay.toFixed(1)} GB`, perDay > 500 ? pal.bad : pal.blue);
    g.text(g.v.v >= 4 ? "unbounded label: move this data to logs or traces" : "bounded labels: healthy", 40, 255, { size: 10, color: g.v.v >= 4 ? pal.bad : pal.ok, align: "left" });
  },
};

const zeroTrust: Scene = {
  title: "How long does a leaked credential stay useful?",
  caption: "A static shared password works until someone rotates it, often never. A short-lived dynamic credential expires by itself, so the exposure window is the shorter of its lifetime and the time until the leak is found.",
  controls: [
    { id: "t", kind: "choice", label: "Credential", options: ["static shared password", "dynamic, 1 hour", "dynamic, 5 minutes"], initial: 0 },
    { id: "d", kind: "range", label: "Hours until the leak is noticed", min: 1, max: 720, step: 1, initial: 168 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const life = [1e9, 1, 5 / 60][g.v.t];
    const window = Math.min(life, g.v.d);
    node(g, "lock", 80, 80, { label: ["static secret", "1 h token", "5 min token"][g.v.t], size: 44, color: [pal.bad, pal.accent, pal.ok][g.v.t] });
    node(g, "user", 240, 80, { label: "attacker", size: 36, color: pal.bad });
    node(g, "db", 400, 80, { label: "database", size: 44, color: pal.teal });
    g.packet(104, 80, 214, 80, g.loop(1.5), pal.bad, 3);
    g.packet(264, 80, 376, 80, g.loop(1.5, 0.4), window > 1 ? pal.bad : pal.line, 3);
    meter(g, 40, 175, 280, "hours the attacker can use it", Math.min(1, window / 720), window >= 1 ? `${Math.round(window)} h` : `${Math.round(window * 60)} min`, window > 24 ? pal.bad : window > 1 ? pal.accent : pal.ok);
    g.text("also: log every secret read, scope per service, rotate automatically", 240, 235, { size: 10, color: pal.muted });
  },
};

const collab: Scene = {
  title: "Two people type at once",
  caption: "Alice inserts X and Bob inserts Y at the same spot in AB while offline from each other. Replacing the whole document keeps one edit. A merge rule (OT or a CRDT with unique character ids) keeps both, in the same order on every replica.",
  controls: [{ id: "m", kind: "choice", label: "Strategy", options: ["last save wins", "merge (CRDT / OT)"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const merge = g.v.m === 1;
    node(g, "user", 70, 70, { label: "Alice: A[X]B", size: 40, color: pal.accent });
    node(g, "user", 410, 70, { label: "Bob: A[Y]B", size: 40, color: pal.blue });
    node(g, "server", 240, 70, { label: "server", size: 40, color: pal.paper });
    g.packet(96, 70, 214, 70, g.loop(1.6), pal.accent, 3);
    g.packet(384, 70, 266, 70, g.loop(1.6, 0.4), pal.blue, 3);
    const result = merge ? "AXYB" : "AXB";
    chip(g, 240, 160, `every replica shows: ${result}`, merge ? pal.ok : pal.bad, 12);
    g.text(merge ? "both edits survive, same order everywhere" : "Bob's Y was silently discarded", 240, 205, { size: 11, color: merge ? pal.ok : pal.bad });
    g.text(merge ? "unique ids give a deterministic order for concurrent inserts" : "no locking needed, but data is lost", 240, 235, { size: 9, color: pal.muted });
  },
};

const fileSync: Scene = {
  title: "How much does an edit upload?",
  caption: "Whole-file sync re-sends everything. Fixed-size chunks send only changed chunks, but an insert shifts every later chunk. Content-defined chunking picks boundaries from the content, so an insert changes only a chunk or two.",
  controls: [
    { id: "s", kind: "range", label: "File size (MB)", min: 20, max: 2000, step: 20, initial: 400 },
    { id: "c", kind: "choice", label: "Strategy", options: ["whole file", "fixed 4 MB chunks", "content-defined chunks"], initial: 2 },
    { id: "k", kind: "choice", label: "Edit", options: ["overwrite 3% in place", "insert 3% in the middle"], initial: 1 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const size = g.v.s;
    const insert = g.v.k === 1;
    const changed = size * 0.03;
    const up = g.v.c === 0 ? size : g.v.c === 1 ? (insert ? size * 0.5 + 4 : changed + 4) : changed + 8;
    const chunks = Math.round(size / 4);
    const shown = Math.min(40, chunks);
    for (let i = 0; i < shown; i++) {
      const frac = i / shown;
      const dirty = g.v.c === 0 ? true : g.v.c === 1 ? (insert ? frac >= 0.5 : Math.abs(frac - 0.5) < 0.04) : Math.abs(frac - 0.5) < 0.04;
      g.rect(40 + (i % 20) * 21, 50 + Math.floor(i / 20) * 24, 16, 18, dirty ? pal.accent : pal.ok, dirty ? 0.9 : 0.5, 3);
    }
    g.text("orange = must be uploaded", 40, 120, { size: 9, color: pal.muted, align: "left" });
    meter(g, 40, 175, 280, "data uploaded for this edit", Math.min(1, up / size), `${fmt(Math.round(up))} MB`, up / size > 0.4 ? pal.bad : pal.ok);
    g.text(`saves ${Math.round((1 - up / size) * 100)}% of bandwidth versus resending the file`, 40, 230, { size: 11, color: pal.paper, align: "left" });
    g.text("identical chunks are also deduplicated across users", 40, 262, { size: 9, color: pal.muted, align: "left" });
  },
};

const dfs: Scene = {
  title: "3x replication or erasure coding: what survives?",
  caption: "Triple replication stores three copies on different racks at 200% overhead. Erasure coding 6+3 stores nine pieces with 50% overhead and survives any three losses, but reads and repairs touch more nodes.",
  controls: [
    { id: "s", kind: "choice", label: "Scheme", options: ["3 replicas", "erasure code 6+3"], initial: 0 },
    { id: "f", kind: "range", label: "Nodes lost", min: 0, max: 5, step: 1, initial: 2 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const ec = g.v.s === 1;
    const total = ec ? 9 : 3;
    const tol = ec ? 3 : 2;
    const lost = g.v.f;
    for (let i = 0; i < total; i++) {
      const dead = i < Math.min(lost, total);
      node(g, "server", 40 + (i % 9) * 48, 70, { label: ec ? (i < 6 ? "D" : "P") : "copy", size: 32, color: dead ? pal.bad : ec && i >= 6 ? pal.violet : pal.ok, a: dead ? 0.5 : 1 });
    }
    const ok = lost <= tol;
    g.text(ok ? "block is readable" : "BLOCK LOST: more pieces gone than the scheme tolerates", 240, 130, { size: 12, color: ok ? pal.ok : pal.bad });
    meter(g, 40, 185, 260, "storage overhead", ec ? 0.5 / 2 : 1, ec ? "50%" : "200%", ec ? pal.ok : pal.accent);
    meter(g, 40, 225, 260, "read and repair traffic", ec ? 0.8 : 0.25, ec ? "reads 6 pieces" : "reads 1 copy", ec ? pal.accent : pal.ok);
    g.text(`tolerates losing ${tol} of ${total} pieces`, 240, 275, { size: 10, color: pal.muted });
  },
};

const matching: Scene = {
  title: "Price-time priority in the order book",
  caption: "Asks wait in the book sorted by price, then by arrival time. A buy order matches the cheapest asks it can afford, oldest first, and any unfilled remainder rests in the book as a bid.",
  controls: [
    { id: "q", kind: "range", label: "Buy quantity", min: 100, max: 1700, step: 100, initial: 700 },
    { id: "p", kind: "range", label: "Limit price (cents above 10.00)", min: 1, max: 4, step: 1, initial: 2 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const book = [
      { n: "A", px: 2, q: 500 },
      { n: "B", px: 2, q: 300 },
      { n: "C", px: 3, q: 800 },
    ];
    let left = g.v.q;
    const limit = g.v.p;
    const fills: string[] = [];
    book.forEach((o, i) => {
      const take = o.px <= limit ? Math.min(left, o.q) : 0;
      left -= take;
      const y = 50 + i * 40;
      g.rect(30, y, 190, 28, pal.line, 0.25, 5);
      g.rect(30, y, 190 * ((o.q - take) / 800), 28, pal.accent, 0.8, 5);
      g.text(`order ${o.n}  ask 10.0${o.px}  ${o.q}`, 38, y + 18, { size: 10, color: pal.paper, align: "left" });
      if (take) fills.push(`${take} @ 10.0${o.px} from ${o.n}`);
      if (take) g.text(`-${take}`, 232, y + 18, { size: 10, color: pal.ok, align: "left" });
    });
    chip(g, 370, 66, `BUY ${g.v.q} limit 10.0${limit}`, pal.blue, 10);
    g.packet(250, 70, 330, 70, g.loop(1.4), pal.blue, 3);
    g.text("trades", 330, 130, { size: 10, color: pal.muted, align: "left" });
    (fills.length ? fills : ["no trade: price too low"]).forEach((f, i) => g.text(f, 330, 150 + i * 16, { size: 10, color: fills.length ? pal.ok : pal.bad, align: "left" }));
    g.text(left > 0 ? `${left} unfilled, rests in the book as a bid` : "fully filled", 30, 220, { size: 11, color: left > 0 ? pal.accent : pal.ok, align: "left" });
    g.text("same input sequence always gives the same trades: replayable", 30, 270, { size: 9, color: pal.muted, align: "left" });
  },
};

const crowdstrike: Scene = {
  title: "Same bug, different rollout",
  caption: "A latent bug ships in a content update to 8.5 million machines. Released everywhere at once it crashes them all. With rings and an automatic halt, the first failing ring stops the rollout and only a small slice is affected.",
  controls: [
    { id: "r", kind: "choice", label: "Rollout", options: ["all machines at once", "staged rings + auto halt"], initial: 1 },
    { id: "h", kind: "range", label: "Ring where failure is detected", min: 1, max: 4, step: 1, initial: 1 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const rings = [0.001, 0.01, 0.1, 1];
    const labels = ["0.1%", "1%", "10%", "100%"];
    const staged = g.v.r === 1;
    const stop = g.v.h - 1;
    const total = 8.5e6;
    const affected = staged ? total * rings[stop] : total;
    rings.forEach((r, i) => {
      const x = 40 + i * 104;
      const reached = staged ? i <= stop : true;
      g.rect(x, 60, 92, 40, reached ? (staged && i === stop ? pal.bad : staged ? pal.ok : pal.bad) : pal.line, reached ? 0.8 : 0.25, 6);
      g.text(`ring ${i + 1}: ${labels[i]}`, x + 46, 84, { size: 10, color: pal.ink });
    });
    if (staged) g.text("halt: crash rate above baseline", 40 + stop * 104 + 46, 120, { size: 9, color: pal.bad });
    meter(g, 40, 175, 290, "machines crashed", Math.min(1, affected / total), fmt(Math.round(affected)), affected > 1e6 ? pal.bad : pal.accent);
    g.text(staged ? "bake time and automatic halt cap the damage" : "no canary, no bake time, no kill switch", 240, 235, { size: 11, color: staged ? pal.ok : pal.bad });
    g.text("content interpreted in the kernel needs the same rigour as code", 240, 266, { size: 9, color: pal.muted });
  },
};

const dnsRace: Scene = {
  title: "Check-then-act on stale data empties the record",
  caption: "Enactor A is slow; Enactor B applies a newer plan and cleans up old plans. A then applies its stale plan, and cleanup deletes it, leaving no addresses. A compare-and-swap on the plan generation rejects A's stale write.",
  controls: [{ id: "c", kind: "toggle", label: "Compare-and-swap on plan generation" }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const cas = g.v.c === 1;
    const steps = ["B applies plan 7", "B cleanup deletes plans older than 5", "A (slow) applies plan 3", "result"];
    const { i } = g.stage([1.4, 1.4, 1.4, 2.4]);
    steps.forEach((s, k) => {
      const y = 44 + k * 30;
      g.rect(30, y, 300, 22, k <= i ? pal.line : pal.line, k <= i ? 0.5 : 0.15, 5);
      g.text(s, 40, y + 15, { size: 10, color: k <= i ? pal.paper : pal.muted, align: "left" });
    });
    const empty = !cas;
    node(g, "cloud", 410, 90, { label: "endpoint records", size: 44, color: i >= 3 && empty ? pal.bad : pal.ok });
    if (i === 2) g.text(cas ? "rejected: 3 < current 7" : "applies stale plan 3", 410, 140, { size: 9, color: cas ? pal.ok : pal.bad });
    g.text(i >= 3 ? (empty ? "record set is EMPTY: nobody can resolve the endpoint" : "plan 7 still in place: healthy") : "...", 240, 200, { size: 12, color: i >= 3 ? (empty ? pal.bad : pal.ok) : pal.muted });
    g.text(empty ? "automation cannot repair it: manual recovery, hours of cascade" : "cleanup never deletes the applied generation", 240, 240, { size: 10, color: pal.muted });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/foundations/littles-law-queueing-and-tail-latency`]: littles,
  [`${P}/reliability-and-operations/retries-timeouts-hedging-and-load-shedding`]: retries,
  [`${P}/reliability-and-operations/cell-based-architecture-and-blast-radius`]: cells,
  [`${P}/async-work-and-streams/change-data-capture-and-the-transactional-outbox`]: outbox,
  [`${P}/distributed-coordination/crdts-and-conflict-resolution`]: crdt,
  [`${P}/service-and-data-designs/multi-tenancy-patterns-for-saas`]: tenancy,
  [`${P}/apis-services-protocols/service-discovery-service-mesh-and-sidecars`]: mesh,
  [`${P}/analytics-and-sketches/data-lakes-lakehouses-and-table-formats`]: lakehouse,
  [`${P}/analytics-and-sketches/time-series-databases-and-metrics-storage`]: tsdb,
  [`${P}/reliability-and-operations/secrets-encryption-and-zero-trust-architecture`]: zeroTrust,
  [`${P}/product-designs/designing-a-collaborative-document-editor`]: collab,
  [`${P}/media-and-operations-designs/designing-a-file-sync-and-storage-service`]: fileSync,
  [`${P}/service-and-data-designs/designing-a-distributed-file-system`]: dfs,
  [`${P}/product-designs/designing-a-stock-exchange-matching-engine`]: matching,
  [`${P}/engineering-case-studies/case-study-crowdstrike-channel-file-291`]: crowdstrike,
  [`${P}/engineering-case-studies/case-study-aws-dynamodb-dns-outage-2025`]: dnsRace,
};
