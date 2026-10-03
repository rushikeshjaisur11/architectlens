import type { Scene } from "../scene/types";
import { bar, chip, fmt, hash32 } from "./kit";
import { node } from "./shapes";

const P = "system-design";

const lsmWrite: Scene = {
  title: "The LSM write path",
  caption: "A write lands in the in-memory memtable and a log, which is fast and sequential. When the memtable fills it is flushed as an immutable sorted file, and background compaction merges those files so reads do not have to check dozens of them.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.6, 1.8, 2]);
    node(g, "client", 36, 70, { label: "write", size: 34 });
    node(g, "cache", 150, 70, { label: "memtable", size: 40, active: i === 0 });
    node(g, "db", 150, 170, { label: "WAL", size: 36, color: pal.violet });
    g.packet(60, 70, 124, 70, i === 0 ? p : 1, pal.accent, 3);
    if (i === 0) g.packet(150, 92, 150, 148, p, pal.violet, 2.4);
    const flushed = i >= 1;
    if (i === 1) g.packet(176, 70, 250, 70, p, pal.accent, 3);
    for (let k = 0; k < 4; k++) {
      const show = k < (flushed ? 3 : 0) || (i >= 3 && k === 3);
      node(g, "doc", 280 + k * 46, 70, { size: 34, color: i === 2 && k < 3 ? pal.accent : pal.blue, a: show ? 1 : 0.15 });
    }
    g.text("SSTables (sorted, immutable)", 330, 106, { size: 9, color: pal.muted });
    if (i >= 2) {
      g.packet(280, 90, 330, 160, i === 2 ? p : 1, pal.accent, 2.4);
      g.packet(372, 90, 336, 160, i === 2 ? p : 1, pal.accent, 2.4);
      node(g, "doc", 336, 170, { size: 40, color: pal.ok, a: i === 2 ? p : 1, label: "merged" });
    }
    g.text(["write goes to the memtable and the log", "memtable is full: flush a sorted file", "compaction merges files in the background", "fewer files to check on each read"][i], 240, 262, { size: 12, color: pal.paper });
  },
};

const multiLeader: Scene = {
  title: "Multi-leader write conflict",
  caption: "Two data centres each accept a write to the same key at nearly the same time. Replication then crosses and each side sees the other's value. Last-write-wins silently drops one update, while a merge keeps both.",
  controls: [{ id: "r", kind: "choice", label: "Resolution", options: ["last write wins", "merge"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const merge = g.v.r === 1;
    const { i, p } = g.stage([1.6, 1.8, 2.4]);
    node(g, "db", 80, 100, { label: "leader EU", color: pal.blue, size: 46 });
    node(g, "db", 400, 100, { label: "leader US", color: pal.violet, size: 46 });
    node(g, "user", 80, 210, { size: 28 });
    node(g, "user", 400, 210, { size: 28 });
    if (i === 0) {
      chip(g, 80, 160, "cart = [book]", pal.blue, 10);
      chip(g, 400, 160, "cart = [pen]", pal.violet, 10);
      g.packet(80, 195, 80, 130, p, pal.accent, 3);
      g.packet(400, 195, 400, 130, p, pal.accent, 3);
    }
    if (i >= 1) {
      g.packet(112, 96, 368, 96, i === 1 ? p : 1, pal.blue, 2.8);
      g.packet(368, 110, 112, 110, i === 1 ? p : 1, pal.violet, 2.8);
    }
    if (i === 2) {
      const val = merge ? "[book, pen]" : "[pen]";
      chip(g, 80, 160, `cart = ${val}`, merge ? pal.ok : pal.bad, 10);
      chip(g, 400, 160, `cart = ${merge ? val : "[book]"}`, merge ? pal.ok : pal.bad, 10);
    }
    g.text(["both sides accept a write to the same key", "each leader ships its write to the other", merge ? "merged: nothing lost ✓" : "each side kept a different value, one update is lost ✕"][i], 240, 262, { size: 12, color: i === 2 ? (merge ? pal.ok : pal.bad) : pal.paper });
  },
};

const rle: Scene = {
  title: "Run-length encoding in a column",
  caption: "A column stores one kind of value, so repeats sit next to each other and collapse into (value, count) pairs. Sorting the column first makes the runs longer, which is why columnar files compress so well.",
  controls: [{ id: "s", kind: "toggle", label: "Sort by this column" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const sorted = g.v.s === 1;
    const raw = ["NY", "LA", "NY", "SF", "LA", "NY", "SF", "LA", "NY", "SF", "NY", "LA"];
    const col = sorted ? [...raw].sort() : raw;
    const cmap: Record<string, string> = { NY: pal.blue, LA: pal.violet, SF: pal.teal };
    col.forEach((v, k) => {
      g.rect(30 + k * 36, 56, 32, 30, cmap[v], 0.45, 4);
      g.text(v, 46 + k * 36, 71, { size: 11, color: pal.paper });
    });
    g.text("column as stored", 30, 44, { size: 10, align: "left", color: pal.muted });
    const runs: [string, number][] = [];
    col.forEach((v) => {
      const l = runs[runs.length - 1];
      if (l && l[0] === v) l[1]++;
      else runs.push([v, 1]);
    });
    g.arrow(240, 94, 240, 120, pal.accent, 1);
    g.text("after RLE", 30, 134, { size: 10, align: "left", color: pal.muted });
    runs.forEach(([v, n], k) => {
      const x = 30 + k * 62;
      if (x > 430) return;
      g.rect(x, 144, 58, 30, cmap[v], 0.45, 4);
      g.text(`${v}×${n}`, x + 29, 159, { size: 11, color: pal.paper });
    });
    const ratio = col.length / runs.length;
    g.text(`${col.length} values → ${runs.length} runs (${ratio.toFixed(1)}x smaller)`, 240, 220, { size: 13, color: ratio > 3 ? pal.ok : pal.paper });
    g.text(sorted ? "sorted data forms long runs" : "unsorted data barely compresses", 240, 252, { size: 11, color: pal.muted });
  },
};

const walRecovery: Scene = {
  title: "Crash recovery from the write-ahead log",
  caption: "Changes are logged before the data pages are updated. After a crash the database starts at the last checkpoint and replays the log forward, redoing committed work and skipping anything that never committed.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2, 1.4, 2.2, 2]);
    const recs = ["T1 set a=5", "T2 set b=9", "CHECKPOINT", "T3 set a=7", "T4 set c=1"];
    recs.forEach((r, k) => {
      const x = 24 + k * 90;
      const cp = r === "CHECKPOINT";
      const replay = i >= 2 && k >= 2;
      g.rect(x, 70, 84, 40, cp ? pal.accent : replay ? pal.ok : pal.blue, cp ? 0.35 : 0.25, 6);
      g.frame(x, 70, 84, 40, cp ? pal.accent : replay ? pal.ok : pal.blue, 1, 6, 1.3);
      g.text(r, x + 42, 90, { size: 9, color: pal.paper });
    });
    g.text("write-ahead log (append-only)", 240, 54, { size: 10, color: pal.muted });
    if (i === 0) g.packet(24, 130, 24 + 4 * 90 + 84, 130, p, pal.accent, 3);
    node(g, "db", 70, 190, { label: "data pages", size: 44, color: i >= 3 ? pal.ok : pal.blue, fill: i >= 3 ? 1 : 0.6 });
    if (i === 1) {
      g.text("✕ crash", 240, 160, { size: 18, color: pal.bad });
      g.glow(240, 160, 50, pal.bad, 0.2);
    }
    if (i >= 2) {
      const x = 24 + 2 * 90 + 84 * (g.clamp(i === 2 ? p : 1)) * 2.2;
      g.dot(Math.min(x, 440), 125, 5, pal.ok);
      g.packet(220, 120, 94, 175, i === 2 ? p : 1, pal.ok, 2.6);
    }
    g.text(["transactions are logged, then applied", "the server crashes before data pages are flushed", "restart from the checkpoint and replay the log", "state restored, nothing committed is lost"][i], 240, 262, { size: 12, color: i === 3 ? pal.ok : pal.paper });
  },
};

const compactionAmp: Scene = {
  title: "Size-tiered versus leveled compaction",
  caption: "Size-tiered merges files of similar size, so each byte is rewritten few times but many overlapping files must be read. Leveled keeps non-overlapping levels, so reads touch one file per level but data is rewritten more often.",
  controls: [{ id: "m", kind: "choice", label: "Strategy", options: ["size-tiered", "leveled"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const lev = g.v.m === 1;
    if (!lev) {
      [0, 1, 2].forEach((tier) => {
        const n = 4 - tier;
        for (let k = 0; k < n; k++) node(g, "doc", 60 + k * 50, 50 + tier * 56, { size: 28 + tier * 8, color: [pal.blue, pal.violet, pal.teal][tier] });
        g.text(`tier ${tier + 1}: ${n} similar files`, 300, 56 + tier * 56, { size: 10, align: "left", color: pal.muted });
      });
    } else {
      [0, 1, 2].forEach((lv) => {
        const n = [2, 4, 8][lv];
        for (let k = 0; k < n; k++) g.rect(40 + k * (400 / n), 40 + lv * 50, 400 / n - 4, 34, [pal.blue, pal.violet, pal.teal][lv], 0.4, 4);
        g.text(`L${lv}`, 22, 57 + lv * 50, { size: 10, color: pal.muted });
      });
    }
    const wamp = lev ? 10 : 4;
    const ramp = lev ? 3 : 8;
    g.text("write amplification", 80, 214, { size: 10 });
    bar(g, 190, 209, 200, 8, wamp / 12, lev ? pal.bad : pal.ok);
    g.text(`${wamp}x`, 430, 214, { size: 11, color: pal.paper });
    g.text("files read per lookup", 80, 240, { size: 10 });
    bar(g, 190, 235, 200, 8, ramp / 12, lev ? pal.ok : pal.bad);
    g.text(`~${ramp}`, 430, 240, { size: 11, color: pal.paper });
    g.text(lev ? "great for reads, heavier write cost" : "great for writes, slower point reads", 240, 276, { size: 10, color: pal.muted });
  },
};

const competing: Scene = {
  title: "Competing consumers and queue depth",
  caption: "Producers add jobs faster than one consumer can finish them, so the queue grows. Adding consumers drains it. Drag both sliders to find the point where the queue stays flat.",
  controls: [
    { id: "p", kind: "range", label: "Jobs in per second", min: 2, max: 20, step: 1, initial: 12 },
    { id: "c", kind: "range", label: "Consumers (4 jobs/s each)", min: 1, max: 6, step: 1, initial: 2 },
  ],
  aspect: 0.62,
  make: () => {
    let q = 0;
    let last = -1;
    return (g) => {
      const { pal } = g;
      if (g.t < last) q = 0;
      last = g.t;
      const dt = Math.min(g.dt, 0.1);
      const inRate = g.v.p;
      const out = g.v.c * 4;
      q = Math.max(0, Math.min(60, q + (inRate - out) * dt));
      node(g, "server", 40, 90, { label: "producers", size: 38, active: true });
      node(g, "queue", 190, 90, { label: "queue", size: 52, fill: Math.min(1, q / 40) });
      for (let k = 0; k < g.v.c; k++) {
        node(g, "server", 380, 36 + k * 36, { size: 26, active: q > 0.2 });
        g.packet(222, 90, 360, 36 + k * 36, (g.t * 1.4 + k * 0.2) % 1, pal.ok, 2);
      }
      g.packet(62, 90, 156, 90, (g.t * (inRate / 8)) % 1, pal.accent, 2.4);
      g.text(`${inRate} in/s vs ${out} out/s`, 240, 232, { size: 12, color: pal.paper });
      g.text(`backlog ${Math.round(q)} jobs`, 240, 256, { size: 13, color: q > 30 ? pal.bad : q > 5 ? pal.accent : pal.ok, bold: true });
    };
  },
};

const windows: Scene = {
  title: "Windows and the late event",
  caption: "Events arrive on a timeline and are grouped into windows by their event time. A late event, delayed in transit, belongs in an earlier window. The watermark decides how long to wait before a window is closed and emitted.",
  controls: [{ id: "w", kind: "range", label: "Watermark delay (s)", min: 0, max: 6, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const wm = g.v.w;
    const t = (g.t * 1.2) % 22;
    const x0 = 30;
    const sc = 420 / 20;
    g.line(x0, 130, 450, 130, pal.line, 1, 1.4);
    for (let w = 0; w < 4; w++) {
      g.rect(x0 + w * 5 * sc, 80, 5 * sc - 3, 100, w % 2 ? pal.blue : pal.violet, 0.1, 6);
      g.text(`window ${w + 1}`, x0 + w * 5 * sc + 2.5 * sc, 70, { size: 10, color: pal.muted });
    }
    const events: [number, number][] = [[1, 1.5], [3, 3.2], [4.2, 4.4], [6, 6.1], [2.6, 8.2], [8, 8.3], [12, 12.2], [16, 16.1]];
    let missed = false;
    events.forEach(([et, at]) => {
      if (t < at) return;
      const late = at - et > 2;
      const closeAt = (Math.floor(et / 5) + 1) * 5 + wm;
      const dropped = late && at > closeAt;
      if (dropped) missed = true;
      g.dot(x0 + et * sc, 130, 5, dropped ? pal.bad : late ? pal.accent : pal.ok);
      if (late) g.line(x0 + et * sc, 130, x0 + at * sc, 108, pal.accent, 0.5, 1);
    });
    g.line(x0 + Math.max(0, t - wm) * sc, 60, x0 + Math.max(0, t - wm) * sc, 190, pal.accent, 0.9, 1.6);
    g.text("watermark", x0 + Math.max(0, t - wm) * sc, 52, { size: 9, color: pal.accent });
    g.text(missed ? "late event arrived after its window closed: dropped ✕" : "late event still counted in its own window ✓", 240, 232, { size: 12, color: missed ? pal.bad : pal.ok });
    g.text("longer delay = more complete, but results come later", 240, 262, { size: 10, color: pal.muted });
  },
};

const cqrs: Scene = {
  title: "Event log and read models",
  caption: "Commands are checked and appended to an event log, the source of truth. A projector folds the events into a read model shaped for queries. If the read model is wrong or a new view is needed, replay the log to rebuild it.",
  controls: [{ id: "r", kind: "toggle", label: "Rebuild read model" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const rebuild = g.v.r === 1;
    node(g, "client", 36, 100, { label: "command", size: 34 });
    node(g, "server", 140, 100, { label: "write side", size: 38, active: true });
    node(g, "queue", 260, 100, { label: "event log", size: 44, fill: 1 });
    node(g, "server", 350, 100, { label: "projector", size: 38, active: true });
    node(g, "db", 432, 100, { label: "read model", size: 40, color: pal.blue, fill: rebuild ? (g.t * 0.4) % 1 : 0.8 });
    g.packet(56, 100, 120, 100, g.loop(1.4), pal.accent, 2.6);
    g.packet(162, 100, 232, 100, g.loop(1.4, 0.3), pal.accent, 2.6);
    g.packet(290, 100, 326, 100, g.loop(1.4, 0.6), pal.ok, 2.6);
    g.packet(392, 100, 412, 100, g.loop(1.4, 0.8), pal.ok, 2.6);
    if (rebuild) {
      g.c.setLineDash([4, 4]);
      g.line(260, 128, 260, 168, pal.violet, 0.9, 1.4);
      g.line(260, 168, 350, 168, pal.violet, 0.9, 1.4);
      g.line(350, 168, 350, 128, pal.violet, 0.9, 1.4);
      g.c.setLineDash([]);
      g.text("replay from event 1", 305, 186, { size: 10, color: pal.violet });
    }
    node(g, "client", 432, 220, { label: "query", size: 28 });
    g.text(rebuild ? "projection rebuilt from history" : "reads never touch the write model", 220, 262, { size: 12, color: pal.paper });
  },
};

const retryLadder: Scene = {
  title: "Retries, backoff and the dead-letter queue",
  caption: "A poison message fails every time. Each retry waits longer than the last, and after the retry limit the message is moved to the dead-letter queue instead of blocking everything behind it.",
  controls: [{ id: "m", kind: "range", label: "Max retries", min: 1, max: 5, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const max = g.v.m;
    const total = max + 1.5;
    const pos = (g.t * 0.9) % (total + 1.5);
    node(g, "queue", 50, 90, { label: "main queue", size: 44, fill: 0.5 });
    node(g, "server", 220, 90, { label: "consumer", size: 40, active: pos < total });
    node(g, "queue", 420, 90, { label: "dead-letter", size: 44, color: pal.bad, fill: pos > max + 0.8 ? 0.6 : 0.1 });
    for (let k = 0; k <= max; k++) {
      const x = 60 + k * (360 / Math.max(1, max));
      const reached = pos > k;
      g.dot(x, 170, 6, reached ? pal.bad : pal.line);
      g.text(k === 0 ? "try 1" : `retry ${k}`, x, 190, { size: 9, color: reached ? pal.paper : pal.muted });
      if (k > 0) g.text(`wait ${2 ** (k - 1)}s`, x - 180 / Math.max(1, max), 160, { size: 8, color: pal.muted });
    }
    if (pos > max + 0.3) g.packet(246, 90, 392, 90, g.clamp((pos - max - 0.3) / 0.8), pal.bad, 3);
    else g.packet(76, 90, 196, 90, (g.t * 1.4) % 1, pal.accent, 3);
    g.text(pos > max + 1 ? "moved to the DLQ: the queue behind it flows again" : "failing every attempt", 240, 246, { size: 12, color: pos > max + 1 ? pal.ok : pal.bad });
  },
};

const outbox: Scene = {
  title: "Transactional outbox",
  caption: "Updating the database and publishing an event are two systems, so one can fail after the other. The outbox writes the event into the same database transaction as the data, and a relay publishes it afterwards, so neither is lost.",
  controls: [{ id: "o", kind: "choice", label: "Approach", options: ["write DB then publish", "outbox"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ob = g.v.o === 1;
    const { i, p } = g.stage([1.8, 1.8, 2.4]);
    node(g, "server", 50, 100, { label: "service", size: 40, active: true });
    node(g, "db", 210, 100, { label: "database", size: 48, color: pal.blue, fill: i >= 0 ? 0.7 : 0.5 });
    node(g, "queue", 410, 100, { label: "broker", size: 44, fill: 0.4 });
    if (i === 0) g.packet(74, 100, 184, 100, p, pal.accent, 3);
    if (ob) {
      chip(g, 210, 168, "order row + outbox row", pal.ok, 10);
      if (i >= 1) g.packet(240, 100, 384, 100, i === 1 ? p : 1, pal.ok, 3);
      g.text(i === 1 ? "relay reads the outbox, publishes" : "", 320, 84, { size: 9, color: pal.ok });
    } else {
      if (i === 1) {
        g.packet(74, 82, 384, 82, g.clamp(p * 0.5), pal.accent, 3);
        g.text("✕ crash before publish", 300, 66, { size: 11, color: pal.bad });
      }
    }
    g.text(ob ? ["service writes data and event in one transaction", "relay publishes, retrying until acknowledged", "at-least-once delivery, nothing lost ✓"][i] : ["service saves the order", "process dies before the event is sent", "database changed but nobody was told ✕"][i], 240, 250, { size: 12, color: ob ? (i === 2 ? pal.ok : pal.paper) : i === 2 ? pal.bad : pal.paper });
  },
};

const rebalance: Scene = {
  title: "Consumer group rebalance",
  caption: "Partitions are shared among the consumers in a group. When a consumer joins or crashes, the group rebalances and the partitions are dealt out again. Drag the consumer count to see the assignment change.",
  controls: [{ id: "c", kind: "range", label: "Consumers", min: 1, max: 6, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.c;
    const parts = 6;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent, pal.ok, pal.bad];
    for (let k = 0; k < parts; k++) {
      const x = 50 + k * 76;
      const owner = k % n;
      g.rect(x - 28, 50, 56, 36, cols[owner], 0.3, 6);
      g.frame(x - 28, 50, 56, 36, cols[owner], 1, 6, 1.3);
      g.text(`P${k}`, x, 68, { size: 11, color: pal.paper });
      g.packet(x, 90, 50 + owner * (380 / Math.max(1, n - 1 || 1)) * (n > 1 ? 1 : 0) + (n > 1 ? 0 : 200), 150, (g.t * 0.8 + k * 0.15) % 1, cols[owner], 2.2);
    }
    for (let c = 0; c < n; c++) {
      const x = n === 1 ? 240 : 50 + c * (380 / (n - 1));
      node(g, "server", x, 175, { label: `consumer ${c + 1}`, size: 30, color: cols[c], active: true });
    }
    const idle = Math.max(0, n - parts);
    g.text(idle > 0 ? "more consumers than partitions: some sit idle" : `each consumer owns ${Math.ceil(parts / n)} or fewer partitions`, 240, 250, { size: 12, color: idle > 0 ? pal.bad : pal.paper });
    g.text("during a rebalance the group briefly stops consuming", 240, 274, { size: 10, color: pal.muted });
  },
};

const buildIndex: Scene = {
  title: "Building and querying an inverted index",
  caption: "Each document is split into terms, and every term points to the list of documents containing it. A two-word query fetches two posting lists and intersects them, without scanning any document text.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2.4, 2.6, 2.4]);
    const docs = ["red shoes sale", "blue shoes", "red dress"];
    docs.forEach((d, k) => {
      node(g, "doc", 40, 50 + k * 56, { size: 34, color: pal.blue });
      g.text(`${k + 1}: ${d}`, 64, 50 + k * 56, { size: 10, align: "left", color: pal.paper });
    });
    const terms: [string, number[]][] = [["red", [1, 3]], ["shoes", [1, 2]], ["blue", [2]], ["dress", [3]], ["sale", [1]]];
    const shown = i === 0 ? Math.floor(p * 6) : 5;
    terms.forEach(([t, ids], k) => {
      if (k >= shown) return;
      const y = 40 + k * 32;
      const hot = i >= 1 && (t === "red" || t === "shoes");
      g.rect(250, y, 66, 24, hot ? pal.accent : pal.violet, hot ? 0.4 : 0.22, 5);
      g.text(t, 283, y + 12, { size: 11, color: pal.paper });
      ids.forEach((d, j) => {
        g.rect(326 + j * 36, y, 30, 24, hot ? pal.accent : pal.teal, hot ? 0.4 : 0.2, 4);
        g.text(String(d), 341 + j * 36, y + 12, { size: 11, color: pal.paper });
      });
      if (i === 0) g.packet(150, 50 + (k % 3) * 56, 248, y + 12, (g.t * 1.2 + k * 0.1) % 1, pal.accent, 2);
    });
    if (i >= 1) chip(g, 240, 218, "query: red AND shoes", pal.accent, 11);
    if (i === 2) chip(g, 240, 248, "intersection → doc 1", pal.ok, 12);
    g.text(["index terms point to documents", "fetch the posting lists for both words", "intersect the lists: only doc 1 has both"][i], 240, 280, { size: 11, color: pal.paper });
  },
};

const boost: Scene = {
  title: "Boosting beyond text match",
  caption: "Text relevance alone ranks the old article first. A recency boost lifts newer results and a popularity boost lifts well-liked ones. Drag the boost and the ranking reshuffles, so tune it against real queries, not by feel.",
  controls: [{ id: "b", kind: "range", label: "Recency boost", min: 0, max: 1, step: 0.05, initial: 0.4 }],
  aspect: 0.64,
  make: () => {
    const cur = [0, 1, 2, 3].map((k) => 60 + k * 44);
    return (g) => {
      const { pal } = g;
      const docs: [string, number, number][] = [["guide (2019)", 0.9, 0.1], ["tutorial (2021)", 0.7, 0.5], ["release notes (2024)", 0.55, 0.9], ["blog post (2025)", 0.45, 1]];
      const b = g.v.b;
      const score = docs.map(([, t, r]) => t * (1 - b * 0.6) + r * b);
      const rank = score.map((s, k) => score.filter((o, j) => o > s || (o === s && j < k)).length);
      docs.forEach(([nm, t, r], k) => {
        const target = 60 + rank[k] * 44;
        cur[k] += (target - cur[k]) * Math.min(1, g.dt * 6);
        const y = cur[k];
        g.rect(20, y - 16, 240, 32, rank[k] === 0 ? pal.accent : pal.line, rank[k] === 0 ? 0.2 : 0.1, 6);
        g.frame(20, y - 16, 240, 32, rank[k] === 0 ? pal.accent : pal.line, 1, 6, 1.1);
        g.text(nm, 32, y, { size: 11, align: "left", color: pal.paper });
        bar(g, 290, y - 8, 60, 6, t, pal.blue);
        bar(g, 290, y + 2, 60, 6, r, pal.teal);
        g.text(score[k].toFixed(2), 440, y, { size: 11, color: pal.paper });
      });
      g.text("text", 320, 36, { size: 9, color: pal.blue });
      g.text("fresh", 360, 36, { size: 9, color: pal.teal });
      g.text("score", 440, 36, { size: 9, color: pal.muted });
      node(g, "user", 456, 250, { size: 20 });
      g.text("too much boost buries the best text matches", 230, 262, { size: 10, color: pal.muted });
    };
  },
};

const facets: Scene = {
  title: "Faceted search",
  caption: "Alongside the results, each facet shows how many hits fall in each bucket. Picking a facet value narrows the result set and recomputes the counts for the other facets, which is an aggregation over the matching documents.",
  controls: [{ id: "f", kind: "choice", label: "Brand filter", options: ["all", "Acme", "Nova"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const f = g.v.f;
    const items = [["Acme", "red"], ["Acme", "blue"], ["Nova", "red"], ["Acme", "red"], ["Nova", "blue"], ["Nova", "red"], ["Acme", "blue"], ["Nova", "blue"]];
    const brand = ["all", "Acme", "Nova"][f];
    const shown = items.filter((it) => f === 0 || it[0] === brand);
    node(g, "user", 36, 40, { size: 24 });
    g.text("brand", 40, 76, { size: 11, align: "left", color: pal.accent });
    ["Acme", "Nova"].forEach((b, k) => {
      const n = items.filter((it) => it[0] === b).length;
      g.rect(20, 86 + k * 26, 110, 22, brand === b ? pal.accent : pal.line, brand === b ? 0.3 : 0.12, 5);
      g.text(`${b} (${n})`, 75, 97 + k * 26, { size: 10, color: pal.paper });
    });
    g.text("colour", 40, 158, { size: 11, align: "left", color: pal.accent });
    ["red", "blue"].forEach((c, k) => {
      const n = shown.filter((it) => it[1] === c).length;
      g.rect(20, 168 + k * 26, 110, 22, pal.line, 0.12, 5);
      g.text(`${c} (${n})`, 75, 179 + k * 26, { size: 10, color: pal.paper });
    });
    shown.forEach((it, k) => {
      const x = 170 + (k % 4) * 70;
      const y = 60 + Math.floor(k / 4) * 70;
      node(g, "doc", x + 24, y + 20, { size: 40, color: it[1] === "red" ? pal.bad : pal.blue });
      g.text(it[0], x + 24, y + 50, { size: 9, color: pal.muted });
    });
    g.text(`${shown.length} results`, 300, 232, { size: 13, color: pal.paper });
    g.text("counts are aggregations over the matching set", 300, 262, { size: 10, color: pal.muted });
  },
};

const scatterGather: Scene = {
  title: "Scatter-gather across shards",
  caption: "The coordinator sends the query to every shard, each shard returns its own top results, and the coordinator merges them into a final top ten. The slowest shard sets the latency, so one sick shard slows every query.",
  controls: [{ id: "s", kind: "toggle", label: "One slow shard" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const slow = g.v.s === 1;
    const { i, p } = g.stage([1.4, 2, 1.6]);
    node(g, "lb", 50, 130, { label: "coordinator", size: 40 });
    for (let k = 0; k < 4; k++) {
      const y = 44 + k * 60;
      const isSlow = slow && k === 2;
      node(g, "db", 280, y, { label: `shard ${k + 1}`, size: 36, color: isSlow ? pal.bad : pal.blue, active: i === 1 });
      if (i === 0) g.packet(76, 126, 258, y, p, pal.accent, 2.4);
      if (i === 1) g.packet(258, y, 76, 130, g.clamp(isSlow ? p * 0.4 : p), isSlow ? pal.bad : pal.ok, 2.4);
    }
    if (i === 2 || (i === 1 && !slow && p > 0.9)) chip(g, 400, 130, "merged top 10", pal.ok, 11);
    const wait = slow ? "waiting on shard 3…" : "";
    g.text(["query fans out to every shard", slow && i === 1 ? wait : "each shard returns its local top results", "coordinator merges and returns"][i], 240, 262, { size: 12, color: slow && i === 1 ? pal.bad : pal.paper });
  },
};

const queryCache: Scene = {
  title: "Which cache answers the query?",
  caption: "A repeated filter can come from the filter cache, a repeated whole request from the shard request cache, and anything else must be computed against the index. Pick what repeats to see how far the request travels.",
  controls: [{ id: "q", kind: "choice", label: "Query", options: ["same filter, new text", "exact repeat", "brand new"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const q = g.v.q;
    const stop = q === 1 ? 1 : q === 0 ? 2 : 3;
    const tiers: [string, "cache" | "cdn" | "db"][] = [["", "client"] as never, ["request cache", "cache"], ["filter cache", "cache"], ["index scan", "db"]];
    node(g, "client", 40, 110, { label: "query", size: 34 });
    tiers.slice(1).forEach(([nm, kind], k) => {
      const x = 170 + k * 115;
      const idx = k + 1;
      node(g, kind, x, 110, { label: nm, size: 40, color: idx === stop ? pal.ok : pal.paper, a: idx <= stop ? 1 : 0.35 });
      g.arrow(x - 70, 110, x - 26, 110, pal.line, idx <= stop ? 0.9 : 0.3);
    });
    const f = g.loop(3) * 3.4;
    const x = Math.min(60 + f * 100, 60 + (stop - 0.5) * 115 + 52);
    g.dot(x, 110, 5, pal.accent);
    g.glow(x, 110, 14, pal.accent, 0.4);
    const ms = [0, 2, 8, 90][stop];
    g.text(`answered by the ${tiers[stop][0]}`, 240, 186, { size: 13, color: pal.ok });
    g.text("latency", 90, 232, { size: 11 });
    bar(g, 140, 227, 260, 8, ms / 90, stop === 3 ? pal.bad : pal.ok);
    g.text(`~${ms} ms`, 440, 232, { size: 12, color: pal.paper });
  },
};

const hll: Scene = {
  title: "HyperLogLog intuition",
  caption: "Hash each user id and look at the run of leading zero bits. Seeing a long run is rare, so the longest run seen estimates how many distinct ids went by, with a few hundred bytes of state instead of a set of every id.",
  controls: [{ id: "n", kind: "range", label: "Distinct users 10^", min: 1, max: 6, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = 10 ** g.v.n;
    const k = Math.floor(Math.log2(n)) + 1;
    const hex = (seed: number) => {
      let s = "";
      for (let b = 0; b < 12; b++) s += g.rnd(seed * 12.9 + b) > 0.5 ? "1" : "0";
      return s;
    };
    const stream = Math.floor(g.t * 3);
    for (let r = 0; r < 4; r++) {
      const bits = hex(stream + r);
      const z = bits.indexOf("1") < 0 ? 12 : bits.indexOf("1");
      for (let b = 0; b < 12; b++) g.rect(30 + b * 22, 40 + r * 34, 18, 24, b < z ? pal.accent : pal.line, b < z ? 0.7 : 0.25, 3);
      g.text(`${z} leading zeros`, 330, 52 + r * 34, { size: 10, align: "left", color: pal.muted });
    }
    g.text("longest run seen", 90, 200, { size: 11 });
    g.text(String(k), 190, 200, { size: 14, color: pal.accent, bold: true });
    g.text(`estimate ≈ 2^${k} = ${fmt(2 ** k)} (true ${fmt(n)})`, 240, 236, { size: 13, color: pal.paper });
    g.text("real HLL averages many buckets to cut the error to ~2%", 240, 266, { size: 10, color: pal.muted });
  },
};

const lambdaKappa: Scene = {
  title: "Lambda versus Kappa",
  caption: "Lambda runs a slow accurate batch path and a fast approximate stream path, then merges them at query time. Kappa keeps only a replayable log and one stream-processing code path, reprocessing history from the log when logic changes.",
  controls: [{ id: "m", kind: "choice", label: "Architecture", options: ["Lambda", "Kappa"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const kappa = g.v.m === 1;
    node(g, "queue", 50, 120, { label: "event log", size: 46, fill: 0.7 });
    if (!kappa) {
      node(g, "server", 200, 60, { label: "batch (hourly)", size: 34 });
      node(g, "server", 200, 180, { label: "stream (seconds)", size: 34, active: true });
      node(g, "db", 340, 60, { label: "batch view", size: 34, color: pal.blue });
      node(g, "db", 340, 180, { label: "speed view", size: 34, color: pal.violet });
      node(g, "lb", 440, 120, { label: "merge", size: 32 });
      [[74, 112, 176, 70], [74, 128, 176, 170], [224, 60, 316, 60], [224, 180, 316, 180], [360, 70, 420, 112], [360, 170, 420, 128]].forEach(([a, b, c, d], k) => g.packet(a, b, c, d, (g.t * 0.7 + k * 0.13) % 1, pal.accent, 2.2));
      g.text("two code paths to keep consistent", 240, 262, { size: 12, color: pal.bad });
    } else {
      node(g, "server", 210, 120, { label: "stream job", size: 40, active: true });
      node(g, "db", 360, 120, { label: "serving view", size: 40, color: pal.blue });
      g.packet(76, 120, 186, 120, g.loop(1.4), pal.accent, 3);
      g.packet(236, 120, 334, 120, g.loop(1.4, 0.4), pal.ok, 3);
      g.c.setLineDash([4, 4]);
      g.line(50, 150, 50, 196, pal.violet, 0.9, 1.4);
      g.line(50, 196, 210, 196, pal.violet, 0.9, 1.4);
      g.line(210, 196, 210, 146, pal.violet, 0.9, 1.4);
      g.c.setLineDash([]);
      g.text("replay history after a code change", 130, 214, { size: 10, color: pal.violet });
      g.text("one code path, history lives in the log", 240, 262, { size: 12, color: pal.ok });
    }
  },
};

const tailLatency: Scene = {
  title: "Average hides the tail",
  caption: "Most requests are fast but a few are very slow. The mean sits in the comfortable middle while the 99th percentile shows what unlucky users feel. Drag the tail weight and watch the mean barely move.",
  controls: [{ id: "t", kind: "range", label: "Slow requests %", min: 0, max: 10, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const slow = g.v.t / 100;
    const buckets = 24;
    const hist: number[] = [];
    let mean = 0;
    for (let b = 0; b < buckets; b++) {
      const ms = 20 + b * 40;
      const fast = Math.exp(-(((ms - 100) / 60) ** 2));
      const tail = Math.exp(-(((ms - 700) / 150) ** 2)) * 0.3;
      hist.push((1 - slow) * fast + slow * tail * 3);
      mean += hist[b] * ms;
    }
    const tot = hist.reduce((a, b) => a + b, 0);
    mean /= tot;
    let c = 0;
    let p50 = 0;
    let p99 = 0;
    hist.forEach((h, b) => {
      c += h / tot;
      const ms = 20 + b * 40;
      if (!p50 && c >= 0.5) p50 = ms;
      if (!p99 && c >= 0.99) p99 = ms;
    });
    hist.forEach((h, b) => g.rect(30 + b * 18, 190 - h * 130, 15, Math.max(1, h * 130), b * 40 + 20 > p99 ? pal.bad : pal.blue, 0.7, 2));
    const xOf = (ms: number) => 30 + ((ms - 20) / 40) * 18 + 7;
    [[mean, "mean", pal.accent], [p50, "p50", pal.ok], [p99, "p99", pal.bad]].forEach(([v, nm, col], k) => {
      g.line(xOf(v as number), 50, xOf(v as number), 194, col as string, 0.9, 1.6);
      g.text(`${nm} ${Math.round(v as number)}ms`, xOf(v as number), 40 + (k % 2) * 8 - 4, { size: 9, color: col as string });
    });
    g.text("latency (ms) →", 240, 214, { size: 10, color: pal.muted });
    g.text("alert on p99, not on the average", 240, 258, { size: 12, color: pal.paper });
  },
};

const countMin: Scene = {
  title: "Count-Min sketch",
  caption: "Each item is hashed by several functions, one per row, and each hash bumps one counter. To ask how often an item appeared, take the smallest of its counters. Collisions only inflate counts, so the estimate never undercounts.",
  controls: [{ id: "w", kind: "range", label: "Counters per row", min: 4, max: 16, step: 2, initial: 8 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const W = g.v.w;
    const rows = 3;
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const counts: Record<string, number> = { a: 40, b: 5, c: 3, d: 8, e: 2, f: 6, g: 4, h: 7 };
    const grid: number[][] = Array.from({ length: rows }, () => Array(W).fill(0));
    items.forEach((it) => {
      for (let r = 0; r < rows; r++) grid[r][Math.floor(hash32(`${r}${it}`) * W)] += counts[it];
    });
    const q = "c";
    const cw = Math.min(26, 400 / W);
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < W; k++) {
        const hit = Math.floor(hash32(`${r}${q}`) * W) === k;
        g.rect(40 + k * cw, 50 + r * 38, cw - 2, 30, hit ? pal.accent : pal.blue, 0.12 + Math.min(0.6, grid[r][k] / 60), 4);
        g.text(String(grid[r][k]), 40 + k * cw + cw / 2 - 1, 65 + r * 38, { size: Math.min(10, cw * 0.45), color: pal.paper });
      }
    const est = Math.min(...Array.from({ length: rows }, (_, r) => grid[r][Math.floor(hash32(`${r}${q}`) * W)]));
    g.text(`query "c": min of highlighted = ${est}`, 240, 186, { size: 13, color: pal.paper });
    g.text(`true count 3, overcount +${est - 3}`, 240, 214, { size: 12, color: est - 3 > 5 ? pal.bad : pal.ok });
    g.text("wider rows mean fewer collisions and tighter estimates", 240, 258, { size: 10, color: pal.muted });
  },
};

const starSchema: Scene = {
  title: "Star schema",
  caption: "A central fact table holds the measurements and small dimension tables describe them. A query joins the fact to just the dimensions it needs and aggregates a few columns, which is exactly what a columnar engine is fast at.",
  controls: [{ id: "q", kind: "choice", label: "Query", options: ["revenue by region", "revenue by product"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const q = g.v.q;
    const dims: [string, number, number][] = [["region", 90, 60], ["product", 390, 60], ["date", 90, 200], ["customer", 390, 200]];
    dims.forEach(([, x, y], k) => {
      const used = (q === 0 && k === 0) || (q === 1 && k === 1);
      g.line(x, y, 240, 130, used ? pal.ok : pal.line, used ? 0.9 : 0.4, used ? 2 : 1);
    });
    node(g, "db", 240, 130, { label: "sales (fact)", size: 62, color: pal.accent, fill: 0.9 });
    dims.forEach(([nm, x, y], k) => {
      const used = (q === 0 && k === 0) || (q === 1 && k === 1);
      node(g, "doc", x, y, { label: nm, size: 40, color: used ? pal.ok : pal.blue, a: used ? 1 : 0.55 });
      if (used) g.packet(x, y, 240, 130, g.loop(1.4), pal.ok, 3);
    });
    g.text("SUM(amount) GROUP BY " + (q === 0 ? "region" : "product"), 240, 262, { size: 12, color: pal.paper });
  },
};

const celebrity: Scene = {
  title: "The celebrity problem in fan-out",
  caption: "Pushing a post into every follower's timeline is cheap for ordinary accounts but explosive for someone with millions of followers. The hybrid approach pushes for normal users and pulls the celebrity's posts at read time.",
  controls: [{ id: "f", kind: "range", label: "Followers 10^", min: 2, max: 7, step: 1, initial: 4 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = 10 ** g.v.f;
    const push = n;
    const pull = 1;
    node(g, "user", 60, 100, { label: "author", size: 40 });
    const dots = Math.min(40, 4 + (g.v.f - 2) * 8);
    for (let k = 0; k < dots; k++) {
      const y = 36 + (k % 8) * 22;
      const x = 330 + Math.floor(k / 8) * 22;
      g.dot(x, y, 3.5, pal.blue, 0.8);
      g.packet(84, 100, x, y, (g.t * 1 + k * 0.03) % 1, pal.accent, 1.6);
    }
    g.text("follower timelines", 380, 220, { size: 10, color: pal.muted });
    g.text("fan-out on write", 70, 190, { size: 11 });
    bar(g, 70, 200, 300, 8, Math.log10(push) / 7, push > 1e5 ? pal.bad : pal.ok);
    g.text(`${fmt(push)} writes per post`, 440, 205, { size: 11, color: pal.paper });
    g.text("pull at read time", 70, 232, { size: 11 });
    bar(g, 70, 242, 300, 8, 0.05, pal.ok);
    g.text(`${pull} merge per reader`, 440, 247, { size: 11, color: pal.paper });
    g.text(push > 1e5 ? "push this author on read, not on write" : "push is fine here", 240, 280, { size: 11, color: push > 1e5 ? pal.bad : pal.ok });
  },
};

const transports: Scene = {
  title: "Polling, SSE and WebSockets over ten seconds",
  caption: "Same stream of updates, three transports. Polling asks on a timer and mostly gets nothing. SSE holds one connection and the server pushes. WebSockets hold one connection that carries messages in both directions.",
  controls: [{ id: "m", kind: "choice", label: "Transport", options: ["polling", "SSE", "WebSocket"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const t = (g.t * 1.3) % 10;
    node(g, "client", 50, 110, { label: "browser", size: 38 });
    node(g, "server", 410, 110, { label: "server", size: 38, active: true });
    const updates = [2.2, 5.1, 7.4];
    let reqs = 0;
    if (m === 0) {
      for (let k = 1; k <= 9; k++) {
        if (t > k) reqs++;
        if (t > k && t - k < 0.5) g.packet(76, 100, 384, 100, (t - k) / 0.5, pal.line, 2.2);
      }
      updates.forEach((u) => {
        const seen = Math.ceil(u);
        if (t > seen) g.dot(100 + (u / 10) * 260, 150, 4, pal.accent);
      });
    } else {
      reqs = 1;
      g.line(76, 110, 384, 110, m === 1 ? pal.teal : pal.violet, 0.6, 2);
      updates.forEach((u) => {
        if (t > u) {
          if (t - u < 0.7) g.packet(384, 110, 76, 110, (t - u) / 0.7, pal.accent, 3);
          g.dot(100 + (u / 10) * 260, 150, 4, pal.accent);
        }
      });
      if (m === 2 && t > 4 && t < 4.7) g.packet(76, 118, 384, 118, (t - 4) / 0.7, pal.violet, 2.6);
    }
    g.text(`${reqs} request${reqs === 1 ? "" : "s"} so far`, 240, 200, { size: 13, color: m === 0 ? pal.bad : pal.ok });
    g.text(["updates wait for the next poll", "server pushes the moment it has news", "full duplex, client can send too"][m], 240, 240, { size: 11, color: pal.muted });
  },
};

const rankFunnel: Scene = {
  title: "The feed ranking funnel",
  caption: "A thousand candidate posts are narrowed by cheap filters, then a light model, then a heavy model that can afford only a few dozen items. Each stage is slower per item, so each sees fewer items.",
  controls: [{ id: "d", kind: "toggle", label: "Diversity re-rank", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const stages: [string, number, string][] = [["candidates", 1000, "doc"], ["light model", 200, "server"], ["heavy model", 50, "gpu"], ["final feed", 10, "phone"]];
    stages.forEach(([nm, n, kind], k) => {
      const x = 60 + k * 120;
      const h = 30 + (Math.log10(n) / 3) * 90;
      g.rect(x - 34, 120 - h / 2, 68, h, [pal.line, pal.blue, pal.violet, pal.ok][k], 0.25, 8);
      g.frame(x - 34, 120 - h / 2, 68, h, [pal.line, pal.blue, pal.violet, pal.ok][k], 1, 8, 1.2);
      g.text(String(n), x, 120, { size: 15, color: pal.paper, bold: true });
      node(g, kind as "doc", x, 196, { label: nm, size: 26 });
      if (k < 3) g.packet(x + 36, 120, x + 84, 120, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2.4);
    });
    g.text(g.v.d === 1 ? "diversity step avoids ten posts from one author" : "pure score order: one author can dominate", 240, 260, { size: 11, color: g.v.d === 1 ? pal.ok : pal.accent });
  },
};

const heartbeat: Scene = {
  title: "Presence by heartbeat and timeout",
  caption: "The client sends a heartbeat every five seconds and the server marks the user online. When the heartbeats stop, nothing announces the departure, so the server waits for the timeout and then flips the user to offline.",
  controls: [{ id: "t", kind: "range", label: "Timeout (s)", min: 6, max: 20, step: 2, initial: 12 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const to = g.v.t;
    const t = (g.t * 2) % 40;
    const dropAt = 18;
    const x0 = 30;
    const sc = 420 / 40;
    g.line(x0, 100, 450, 100, pal.line, 1, 1.4);
    for (let b = 0; b <= 8; b++) {
      const bt = b * 5;
      if (bt > t) break;
      const lost = bt >= dropAt;
      g.dot(x0 + bt * sc, 100, lost ? 3 : 5, lost ? pal.bad : pal.ok, lost ? 0.4 : 1);
    }
    g.line(x0 + dropAt * sc, 70, x0 + dropAt * sc, 130, pal.bad, 0.8, 1.4);
    g.text("connection drops", x0 + dropAt * sc, 62, { size: 9, color: pal.bad });
    const last = 15;
    const offlineAt = last + to;
    const offline = t >= offlineAt;
    g.rect(x0 + last * sc, 140, Math.min(to, Math.max(0, t - last)) * sc, 10, offline ? pal.bad : pal.accent, 0.6, 4);
    g.text("timeout window", x0 + last * sc, 164, { size: 9, align: "left", color: pal.muted });
    node(g, "user", 60, 215, { size: 30, color: offline ? pal.muted : pal.ok });
    chip(g, 240, 220, offline ? "status: offline" : t >= last ? "status: online (waiting)" : "status: online", offline ? pal.bad : pal.ok, 12);
    g.text(`${to}s timeout: longer is calmer, shorter shows exits faster`, 240, 262, { size: 10, color: pal.muted });
  },
};

const notifyFanout: Scene = {
  title: "Notification fan-out with preferences",
  caption: "One event becomes several deliveries. Each user's preferences decide which channels fire, and a dedupe key stops the same event from notifying twice when producers retry.",
  controls: [{ id: "d", kind: "toggle", label: "Dedupe key", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const dd = g.v.d === 1;
    node(g, "server", 50, 110, { label: "event", size: 36, active: true });
    node(g, "shield", 160, 110, { label: "prefs + dedupe", size: 36, color: pal.blue });
    const ch: [string, number, "phone" | "doc" | "cloud"][] = [["push", 50, "phone"], ["email", 110, "doc"], ["SMS", 170, "phone"]];
    const sent = [true, true, false];
    ch.forEach(([nm, y, kind], k) => {
      node(g, kind, 380, y, { label: nm, size: 30, a: sent[k] ? 1 : 0.3, color: sent[k] ? pal.ok : pal.muted });
      if (sent[k]) {
        g.packet(184, 110, 356, y, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2.4);
        if (!dd) g.packet(184, 114, 356, y + 6, (g.t * 0.8 + k * 0.2 + 0.4) % 1, pal.bad, 2.4);
      }
    });
    g.packet(70, 110, 136, 110, g.loop(1.4), pal.accent, 2.4);
    g.text(dd ? "same event id seen twice: second one dropped" : "producer retry sends it twice: duplicate alerts ✕", 240, 236, { size: 12, color: dd ? pal.ok : pal.bad });
    g.text("SMS off by user preference", 240, 262, { size: 10, color: pal.muted });
  },
};

export const MORE_SD_2: Record<string, Scene[]> = {
  [`${P}/storage-engines/b-trees-vs-lsm-trees`]: [lsmWrite],
  [`${P}/storage-engines/replication-strategies`]: [multiLeader],
  [`${P}/storage-engines/compression-and-columnar-storage-formats`]: [rle],
  [`${P}/storage-engines/write-ahead-logging-and-crash-recovery`]: [walRecovery],
  [`${P}/storage-engines/compaction-strategies-and-storage-engine-internals`]: [compactionAmp],
  [`${P}/async-work-and-streams/message-queues-and-delivery-guarantees`]: [competing],
  [`${P}/async-work-and-streams/stream-processing-batch-vs-stream`]: [windows],
  [`${P}/async-work-and-streams/event-sourcing-and-cqrs`]: [cqrs],
  [`${P}/async-work-and-streams/dead-letter-queues-and-poison-message-handling`]: [retryLadder],
  [`${P}/async-work-and-streams/exactly-once-processing-semantics`]: [outbox],
  [`${P}/async-work-and-streams/kafka-pulsar-architecture-deep-dive`]: [rebalance],
  [`${P}/search-and-retrieval/inverted-indexes-and-full-text-search`]: [buildIndex],
  [`${P}/search-and-retrieval/search-relevance-and-autocomplete`]: [boost],
  [`${P}/search-and-retrieval/spell-correction-and-faceted-search`]: [facets],
  [`${P}/search-and-retrieval/distributed-search-index-sharding-and-replication`]: [scatterGather],
  [`${P}/search-and-retrieval/search-query-caching-and-performance-tuning`]: [queryCache],
  [`${P}/analytics-and-sketches/probabilistic-data-structures`]: [hll],
  [`${P}/analytics-and-sketches/real-time-analytics-pipelines`]: [lambdaKappa],
  [`${P}/analytics-and-sketches/t-digest-and-percentile-estimation`]: [tailLatency],
  [`${P}/analytics-and-sketches/bloom-filters-and-count-min-sketch`]: [countMin],
  [`${P}/analytics-and-sketches/olap-vs-oltp-and-columnar-engines`]: [starSchema],
  [`${P}/realtime-social-and-feeds/fanout-strategies-for-news-feeds`]: [celebrity],
  [`${P}/realtime-social-and-feeds/websockets-long-polling-and-sse`]: [transports],
  [`${P}/realtime-social-and-feeds/ranking-feeds-beyond-chronological`]: [rankFunnel],
  [`${P}/realtime-social-and-feeds/presence-systems`]: [heartbeat],
  [`${P}/realtime-social-and-feeds/notification-delivery-at-scale`]: [notifyFanout],
};
