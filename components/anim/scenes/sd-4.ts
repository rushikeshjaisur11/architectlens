import type { Scene } from "../scene/types";
import { arcStroke, bar, chip, db, server } from "./kit";

const P = "system-design";
const TAU = Math.PI * 2;

const btreeLsm: Scene = {
  title: "Where a write goes: B-tree vs LSM-tree",
  caption: "A B-tree finds the right leaf page and rewrites it in place, which is random I/O. An LSM-tree appends to memory, flushes sorted runs sequentially, and merges them later in the background.",
  controls: [{ id: "m", kind: "choice", label: "Engine", options: ["B-tree", "LSM-tree"], initial: 0 }],
  aspect: 0.64,
  make: () => {
    let writes = 0;
    let lastTick = -1;
    return (g) => {
      const { pal } = g;
      const lsm = g.v.m === 1;
      const tick = Math.floor(g.t / 0.6);
      if (tick !== lastTick) {
        lastTick = tick;
        writes++;
      }
      const q = (g.t % 0.6) / 0.6;
      if (!lsm) {
        const mids = [90, 190, 290, 390];
        const leaf = Math.floor(g.rnd(tick * 3.1) * 8);
        const mid = Math.floor(leaf / 2);
        g.rect(214, 28, 52, 20, pal.panel, 1, 4);
        g.frame(214, 28, 52, 20, pal.line, 1, 4);
        g.text("root", 240, 38, { size: 10, color: pal.paper });
        mids.forEach((x, k) => {
          const on = k === mid;
          g.line(240, 48, x, 92, on ? pal.accent : pal.line, on ? 1 : 0.5, on ? 1.8 : 1);
          g.rect(x - 24, 92, 48, 20, pal.panel, 1, 4);
          g.frame(x - 24, 92, 48, 20, on ? pal.accent : pal.line, 1, 4);
          g.text("page", x, 102, { size: 10, color: pal.paper });
        });
        for (let k = 0; k < 8; k++) {
          const x = 48 + k * 55;
          const on = k === leaf;
          g.line(mids[Math.floor(k / 2)], 112, x, 166, on ? pal.accent : pal.line, on ? 1 : 0.4, on ? 1.8 : 1);
          g.rect(x - 20, 166, 40, 26, on ? pal.bad : pal.panel, on ? 0.25 + 0.4 * Math.sin(q * Math.PI) : 1, 4);
          g.frame(x - 20, 166, 40, 26, on ? pal.bad : pal.line, 1, 4);
          g.text(on && q > 0.4 ? "rewrite" : "leaf", x, 179, { size: 9, color: on ? pal.bad : pal.muted });
        }
        g.packet(240, 48, mids[mid], 92, g.clamp(q * 2), pal.accent, 2.6);
        if (q > 0.5) g.packet(mids[mid], 112, 48 + leaf * 55, 166, g.clamp((q - 0.5) * 2), pal.accent, 2.6);
        g.text(`random page writes: ${writes}`, 240, 226, { size: 13, color: pal.paper });
        g.text("each write rewrites a page in place", 240, 250, { size: 11 });
      } else {
        const cycle = writes % 24;
        const mem = cycle % 8;
        const runs = Math.floor(cycle / 8);
        g.rect(40, 36, 120, 44, pal.panel, 1, 6);
        g.frame(40, 36, 120, 44, pal.accent, 1, 6);
        g.text("memtable", 100, 30, { size: 10 });
        for (let k = 0; k < mem; k++) g.dot(54 + k * 13, 58, 4, pal.accent);
        g.packet(8, 58, 40, 58, q, pal.accent, 2.6);
        g.text("level 0", 60, 112, { size: 10 });
        for (let r = 0; r < 3; r++) {
          const on = r < runs;
          g.rect(100 + r * 70, 104, 60, 16, on ? pal.blue : pal.ink, on ? 0.8 : 0.4, 4);
          g.frame(100 + r * 70, 104, 60, 16, on ? pal.blue : pal.line, 1, 4);
        }
        if (mem === 0 && writes > 0 && q < 0.8) g.packet(100, 80, 130 + (Math.max(0, runs - 1)) * 70, 104, q / 0.8, pal.blue, 3);
        g.text("level 1", 60, 168, { size: 10 });
        const l1 = Math.min(4, Math.floor(writes / 24));
        for (let r = 0; r < l1; r++) g.rect(100 + r * 70, 160, 64, 16, pal.violet, 0.8, 4);
        if (cycle > 21 || (cycle === 0 && writes > 0 && l1 > 0)) {
          g.text("merging runs into one sorted file", 330, 134, { size: 10, color: pal.violet });
          g.packet(240, 120, 130 + Math.max(0, l1 - 1) * 70, 160, g.clamp(((cycle + q) % 24) - 21 > 0 ? (((cycle + q) % 24) - 21) / 3 : 1), pal.violet, 3);
        }
        g.text(`sequential writes: ${writes}`, 240, 226, { size: 13, color: pal.paper });
        g.text("append in memory, flush runs, merge later", 240, 250, { size: 11 });
      }
    };
  },
};

const replication: Scene = {
  title: "Sync vs async replication when the leader dies",
  caption: "Synchronous replication waits for the follower, so an acknowledged write survives a leader crash. Asynchronous acknowledges first, and writes that had not been copied yet are lost.",
  controls: [
    { id: "m", kind: "choice", label: "Mode", options: ["sync", "async"], initial: 1 },
    { id: "crash", kind: "button", label: "Crash the leader" },
  ],
  aspect: 0.62,
  make: () => {
    let crashAt = -10;
    let lost = 0;
    return (g) => {
      const { pal } = g;
      const async = g.v.m === 1;
      if (g.pressed("crash")) {
        crashAt = g.t;
        const inflight = async ? 2 : 0;
        lost = inflight;
      }
      const down = g.t - crashAt < 3.2;
      const L = [90, 135];
      const F = [390, 135];
      const W = 1.4;
      const k = Math.floor(g.t / W);
      const q = (g.t % W) / W;
      server(g, L[0], L[1], "leader", { size: 46, color: down ? pal.bad : pal.paper, ring: down ? pal.bad : pal.accent });
      server(g, F[0], F[1], "follower", { size: 46 });
      if (down) g.text("✕", L[0], L[1], { size: 24, color: pal.bad, bold: true });
      g.line(L[0] + 30, L[1], F[0] - 30, F[1], pal.line, 0.5);
      if (!down) {
        g.dot(L[0] - 56, 100 + (k % 3) * 8, 3, pal.accent);
        if (async) {
          g.packet(L[0] - 56, 104, L[0] - 28, L[1] - 6, g.clamp(q * 3), pal.accent, 2.4);
          if (q > 0.2) g.packet(L[0] - 28, L[1] - 8, L[0] - 56, 104, g.clamp((q - 0.2) * 4), pal.ok, 2.4);
          if (q > 0.55) g.packet(L[0] + 30, L[1], F[0] - 30, F[1], g.clamp((q - 0.55) * 2.2), pal.blue, 2.6);
          g.text("ack immediately, copy after", 240, 70, { size: 11, color: pal.paper });
        } else {
          g.packet(L[0] - 56, 104, L[0] - 28, L[1] - 6, g.clamp(q * 4), pal.accent, 2.4);
          if (q > 0.2 && q < 0.6) g.packet(L[0] + 30, L[1], F[0] - 30, F[1], (q - 0.2) / 0.4, pal.blue, 2.6);
          if (q > 0.6) g.packet(L[0] - 28, L[1] - 8, L[0] - 56, 104, g.clamp((q - 0.6) * 3), pal.ok, 2.4);
          g.text("copy first, then ack", 240, 70, { size: 11, color: pal.paper });
        }
      }
      const kept = Math.min(k, 8);
      for (let d = 0; d < kept; d++) g.rect(F[0] - 30 + (d % 4) * 16, F[1] + 40 + Math.floor(d / 4) * 12, 12, 8, pal.blue, 0.8, 2);
      if (down) {
        g.text(lost > 0 ? `${lost} acknowledged writes never reached the follower: lost` : "every acknowledged write is already on the follower", 240, 236, { size: 12, color: lost > 0 ? pal.bad : pal.ok });
        for (let d = 0; d < lost; d++) g.dot(L[0] + d * 12 - 6, L[1] + 46, 4, pal.bad);
      } else g.text("press crash to cut the leader off mid-stream", 240, 236, { size: 11 });
    };
  },
};

const columnar: Scene = {
  title: "Reading two columns of a wide table",
  caption: "An analytic query needs only two columns. A row store drags every column of every row off disk. A column store reads just those two, and similar neighboring values compress well.",
  controls: [{ id: "m", kind: "choice", label: "Layout", options: ["row store", "column store"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const col = g.v.m === 1;
    const cols = 8;
    const rows = 12;
    const need = [2, 5];
    const total = cols * rows;
    const sweep = (g.t % 5) / 5;
    let read = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 70 + c * 38;
        const y = 36 + r * 14;
        const wanted = need.includes(c);
        const reached = col ? (wanted ? r / rows < sweep : false) : r / rows < sweep;
        if (reached) read++;
        const lit = reached;
        g.rect(x, y, 32, 10, lit ? (wanted ? pal.accent : pal.bad) : wanted ? pal.line : pal.ink, lit ? 0.85 : wanted ? 0.9 : 0.5, 2);
      }
    }
    for (let c = 0; c < cols; c++) g.text(need.includes(c) ? "◆" : "", 86 + c * 38, 26, { size: 10, color: pal.accent });
    const sy = 36 + sweep * rows * 14;
    g.line(60, sy, 380, sy, pal.paper, 0.4);
    g.text("rows", 30, 120, { size: 10 });
    bar(g, 70, 230, 306, 8, read / total, col ? pal.accent : pal.bad);
    g.text(`${((read / total) * 100).toFixed(0)}% of the table read from disk`, 240, 256, { size: 12, color: pal.paper });
    g.text(col ? "only the 2 needed columns are touched" : "every column of every row is read, needed or not", 240, 278, { size: 11, color: col ? pal.ok : pal.bad });
    if (col) {
      g.text("run-length encoded:", 410, 90, { size: 9 });
      for (let k = 0; k < 6; k++) g.rect(380 + (k % 3) * 28, 100 + Math.floor(k / 3) * 14, 24 - (k % 2) * 8, 8, pal.blue, 0.8, 2);
    }
  },
};

const wal: Scene = {
  title: "Write-ahead logging and crash recovery",
  caption: "A change is appended to the log and flushed before it counts as committed, while the data pages are updated lazily. After a crash the pages are gone but the log replays them back.",
  controls: [{ id: "crash", kind: "button", label: "Crash now" }],
  aspect: 0.64,
  make: () => {
    let crashAt = -20;
    return (g) => {
      const { pal } = g;
      if (g.pressed("crash")) crashAt = g.t;
      const since = g.t - crashAt;
      const phase = since < 0 ? "run" : since < 1.2 ? "crash" : since < 5.2 ? "recover" : "run";
      const k = Math.floor(g.t / 0.9);
      const logN = phase === "run" ? Math.min(9, 4 + (k % 6)) : 7;
      g.text("write-ahead log (on disk)", 150, 28, { size: 11, color: pal.paper });
      for (let i = 0; i < 9; i++) {
        const has = i < logN;
        g.rect(40 + i * 28, 38, 24, 22, has ? pal.blue : pal.ink, has ? 0.8 : 0.4, 3);
        g.frame(40 + i * 28, 38, 24, 22, has ? pal.blue : pal.line, 1, 3);
        if (has) g.text(String(i + 1), 52 + i * 28, 49, { size: 10, color: pal.paper });
      }
      g.text("data pages (in memory)", 150, 108, { size: 11, color: pal.paper });
      const rebuilt = phase === "recover" ? Math.min(logN, Math.floor((since - 1.2) / 0.45)) : phase === "crash" ? 0 : Math.max(0, logN - 2);
      for (let i = 0; i < 9; i++) {
        const has = i < rebuilt;
        g.rect(40 + i * 28, 118, 24, 22, has ? pal.ok : pal.ink, has ? 0.75 : 0.35, 3);
        g.frame(40 + i * 28, 118, 24, 22, has ? pal.ok : phase === "crash" ? pal.bad : pal.line, 1, 3);
      }
      if (phase === "recover" && rebuilt < logN) {
        const i = rebuilt;
        g.packet(52 + i * 28, 62, 52 + i * 28, 116, g.clamp(((since - 1.2) / 0.45) % 1), pal.ok, 3);
      }
      if (phase === "run") {
        g.packet(330, 38, 52 + (logN - 1) * 28, 49, g.clamp((g.t % 0.9) / 0.4), pal.accent, 2.6);
        g.text("1  append to the log, flush it", 420, 80, { size: 10, color: pal.accent });
        g.text("2  commit is acknowledged", 420, 94, { size: 10, color: pal.ok });
        g.text("3  pages are updated later", 420, 108, { size: 10, color: pal.muted });
      }
      if (phase === "crash") {
        g.glow(200, 130, 140, pal.bad, 0.18);
        g.text("crash: memory is wiped, the log survives", 240, 190, { size: 13, color: pal.bad, bold: true });
      }
      if (phase === "recover") g.text(`replaying the log: ${rebuilt}/${logN} changes restored`, 240, 190, { size: 13, color: pal.ok });
      if (phase === "run") g.text("running normally", 240, 190, { size: 12 });
      g.text("committed work is never lost, because the log is written first", 240, 250, { size: 11, color: pal.paper });
    };
  },
};

const compaction: Scene = {
  title: "Compaction: size-tiered vs leveled",
  caption: "Both keep merging small sorted files so reads stay fast. Size-tiered merges files of similar size, writing less but using more space. Leveled keeps tight non-overlapping levels, reading less but rewriting more.",
  controls: [{ id: "m", kind: "choice", label: "Strategy", options: ["size-tiered", "leveled"], initial: 0 }],
  aspect: 0.64,
  make: () => {
    let n = 0;
    let last = -1;
    return (g) => {
      const { pal } = g;
      const leveled = g.v.m === 1;
      const tick = Math.floor(g.t / 0.7);
      if (tick !== last) {
        last = tick;
        n++;
      }
      const q = (g.t % 0.7) / 0.7;
      if (!leveled) {
        const small = n % 4;
        const mid = Math.floor(n / 4) % 4;
        const big = Math.floor(n / 16) % 4;
        const tiers = [
          { c: small, w: 24, y: 70, name: "small" },
          { c: mid, w: 52, y: 120, name: "medium" },
          { c: big, w: 100, y: 170, name: "large" },
        ];
        tiers.forEach((t) => {
          g.text(t.name, 36, t.y, { size: 10, align: "left" });
          for (let k = 0; k < t.c; k++) g.rect(90 + k * (t.w + 8), t.y - 9, t.w, 18, pal.blue, 0.8, 4);
        });
        if (small === 0 && n > 0) g.packet(150, 78, 150, 112, g.clamp(q * 1.5), pal.violet, 3);
        if (mid === 0 && small === 0 && n > 4) g.packet(150, 128, 150, 162, g.clamp(q * 1.5), pal.violet, 3);
        g.text("merge similar-sized files into one bigger file", 240, 222, { size: 12, color: pal.paper });
        g.text("less rewriting, but several files may hold a key", 240, 246, { size: 11 });
        bar(g, 60, 262, 360, 6, ((n % 16) + 1) / 16, pal.ok);
        g.text("write amplification: low", 440, 262, { size: 9, align: "right" });
      } else {
        const levels = [
          { cap: 2, y: 66, name: "L0" },
          { cap: 4, y: 116, name: "L1" },
          { cap: 8, y: 166, name: "L2" },
        ];
        levels.forEach((lv, li) => {
          g.text(lv.name, 36, lv.y, { size: 10, align: "left" });
          const filled = Math.min(lv.cap, 1 + Math.floor((n + li * 3) / (li + 2)) % lv.cap);
          for (let k = 0; k < lv.cap; k++) {
            const on = k < filled;
            g.rect(70 + k * (360 / lv.cap), lv.y - 9, 360 / lv.cap - 4, 18, on ? pal.blue : pal.ink, on ? 0.8 : 0.35, 3);
          }
        });
        const hot = n % 3;
        g.packet(100 + hot * 40, 75, 100 + hot * 70, 107, g.clamp(q), pal.violet, 2.6);
        g.packet(100 + hot * 70, 125, 100 + hot * 90, 157, g.clamp(q), pal.violet, 2.6);
        g.text("each level holds non-overlapping files, 10x bigger than the last", 240, 222, { size: 12, color: pal.paper });
        g.text("a read checks one file per level, but data is rewritten often", 240, 246, { size: 11 });
        bar(g, 60, 262, 360, 6, 0.85, pal.bad);
        g.text("write amplification: high", 440, 262, { size: 9, align: "right" });
      }
    };
  },
};

const queues: Scene = {
  title: "At-least-once delivery and duplicates",
  caption: "The consumer processes a message but dies before acknowledging, so the queue delivers it again. Without idempotency the effect happens twice. With a dedupe key the repeat is skipped.",
  controls: [
    { id: "idem", kind: "toggle", label: "Idempotent consumer", initial: true },
    { id: "crash", kind: "button", label: "Crash before ack" },
  ],
  aspect: 0.6,
  make: () => {
    let crashAt = -20;
    let effects = 0;
    let lastMsg = -1;
    return (g) => {
      const { pal } = g;
      const idem = g.v.idem === 1;
      if (g.pressed("crash")) crashAt = g.t;
      const W = 1.8;
      const msg = Math.floor(g.t / W);
      const q = (g.t % W) / W;
      if (msg !== lastMsg) {
        lastMsg = msg;
        effects++;
      }
      const crashing = g.t - crashAt < 3.6;
      const Q = [130, 120];
      const C = [350, 120];
      g.rect(60, 96, 140, 48, pal.panel, 1, 8);
      g.frame(60, 96, 140, 48, pal.line, 1, 8);
      g.text("queue", 130, 88, { size: 10 });
      for (let k = 0; k < 4; k++) g.dot(78 + k * 28, 120, 6, k === 0 ? pal.accent : pal.muted, k === 0 ? 1 : 0.6);
      server(g, C[0], C[1], "consumer", { size: 46, color: crashing && g.t - crashAt > 1.2 && g.t - crashAt < 2.4 ? pal.bad : pal.paper });
      const t = g.t - crashAt;
      if (crashing) {
        if (t < 0.8) g.packet(Q[0] + 70, Q[1], C[0] - 30, C[1], t / 0.8, pal.accent, 3.4);
        else if (t < 2.0) g.text("processed, then crashed before the ack", 240, 200, { size: 11, color: pal.bad });
        else if (t < 3.2) {
          g.packet(Q[0] + 70, Q[1], C[0] - 30, C[1], (t - 2) / 1.2, pal.accent, 3.4);
          g.text(idem ? "same message again: dedupe key seen, skipped" : "same message again: effect runs twice", 240, 200, { size: 11, color: idem ? pal.ok : pal.bad });
        }
        const doubled = !idem && t > 3.0;
        chip(g, C[0], C[1] + 62, doubled ? "charged twice" : "charged once", doubled ? pal.bad : pal.ok, 11);
      } else {
        if (q < 0.6) g.packet(Q[0] + 70, Q[1], C[0] - 30, C[1], q / 0.6, pal.accent, 3);
        else g.packet(C[0] - 30, C[1] + 8, Q[0] + 70, Q[1] + 8, (q - 0.6) / 0.4, pal.ok, 2.4);
        chip(g, C[0], C[1] + 62, "charged once", pal.ok, 11);
        g.text("normal delivery: processed, acknowledged, removed", 240, 200, { size: 11 });
      }
      g.text(idem ? "idempotent: repeats are harmless" : "not idempotent: repeats repeat the effect", 240, 250, { size: 12, color: idem ? pal.ok : pal.accent });
      void effects;
    };
  },
};

const streamWindows: Scene = {
  title: "Event time, windows and the watermark",
  caption: "Events fall into windows by when they happened, but they arrive late and out of order. The watermark decides when a window closes: wait longer and you catch more late events, at the cost of delay.",
  controls: [{ id: "wm", kind: "range", label: "Watermark delay", min: 0, max: 4, step: 0.5, initial: 1.5, unit: " s" }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const L = 16;
    const now = g.t % L;
    const x0 = 40;
    const sx = 24;
    const X = (tm: number) => x0 + tm * sx;
    const wm = Math.max(0, now - g.v.wm);
    for (let w = 0; w < 3; w++) {
      const a = w * 5;
      const closed = wm >= a + 5;
      g.rect(X(a), 36, 5 * sx - 4, 118, closed ? pal.ok : pal.line, closed ? 0.12 : 0.1, 6);
      g.frame(X(a), 36, 5 * sx - 4, 118, closed ? pal.ok : pal.line, 1, 6);
      g.text(`window ${a}-${a + 5}s`, X(a) + 2.5 * sx, 28, { size: 10, color: closed ? pal.ok : pal.muted });
    }
    let kept = 0;
    let dropped = 0;
    for (let i = 0; i < 20; i++) {
      const ev = 0.4 + i * 0.7;
      const delay = g.rnd(i * 5.7) * 3.6 * (i % 3 === 0 ? 1.4 : 0.5);
      const arrive = ev + delay;
      if (now < arrive) continue;
      const w = Math.floor(ev / 5);
      if (w > 2) continue;
      const windowEnd = (w + 1) * 5;
      const late = arrive > windowEnd + g.v.wm;
      if (late) dropped++;
      else kept++;
      const y = 60 + (i % 6) * 15;
      const fall = g.clamp((now - arrive) / 0.4);
      g.dot(X(ev), 12 + (y - 12) * fall, 3.4, late ? pal.bad : pal.accent, late ? 0.9 : 1);
    }
    g.line(X(wm), 34, X(wm), 160, pal.blue, 0.9, 1.6);
    g.text("watermark", X(wm), 172, { size: 10, color: pal.blue });
    g.line(X(now), 34, X(now), 160, pal.paper, 0.3, 1);
    g.text("now", X(now), 184, { size: 10 });
    g.text(`counted: ${kept}`, 130, 224, { size: 14, color: pal.accent, bold: true });
    g.text(`late, dropped: ${dropped}`, 330, 224, { size: 14, color: dropped > 0 ? pal.bad : pal.muted, bold: true });
    g.text("results are emitted when the watermark passes a window's end", 240, 262, { size: 11, color: pal.paper });
  },
};

const eventSourcing: Scene = {
  title: "Event sourcing: state is a replay",
  caption: "The log of immutable events is the source of truth, and the balance is just a fold over it. Drag to rebuild the account as it stood after any event, with no history ever lost.",
  controls: [{ id: "n", kind: "range", label: "Replay up to event", min: 0, max: 8, step: 1, initial: 8 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const ev = [100, -30, 50, -20, 200, -80, 10, -5];
    const n = g.v.n;
    let bal = 0;
    for (let i = 0; i < n; i++) bal += ev[i];
    g.text("event log (append only)", 130, 26, { size: 11, color: pal.paper });
    ev.forEach((v, i) => {
      const x = 28 + i * 52;
      const on = i < n;
      g.rect(x, 38, 46, 56, on ? (v > 0 ? pal.ok : pal.bad) : pal.ink, on ? 0.22 : 0.4, 5);
      g.frame(x, 38, 46, 56, on ? (v > 0 ? pal.ok : pal.bad) : pal.line, 1, 5, on ? 1.6 : 1);
      g.text(v > 0 ? "deposit" : "withdraw", x + 23, 52, { size: 8 });
      g.text(`${v > 0 ? "+" : ""}${v}`, x + 23, 72, { size: 13, color: on ? pal.paper : pal.muted, bold: true });
      if (on && i === n - 1) g.packet(x + 23, 96, 240, 150, g.loop(1.2), v > 0 ? pal.ok : pal.bad, 3);
    });
    g.ring(240, 168, 38, pal.line, 1, 1.5);
    g.glow(240, 168, 60, pal.accent, 0.15);
    g.text(String(bal), 240, 166, { size: 26, color: pal.accent, bold: true });
    g.text("balance", 240, 190, { size: 10 });
    g.text(`state after ${n} event${n === 1 ? "" : "s"}`, 240, 224, { size: 12, color: pal.paper });
    g.text("projections like this one are disposable: replay rebuilds them", 240, 256, { size: 11 });
    arcStroke(g, 240, 168, 38, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(0.999, Math.max(0.001, n / 8)), pal.accent, 3, 0.9);
  },
};

const dlq: Scene = {
  title: "A poison message and the dead-letter queue",
  caption: "One malformed message fails every time. Without a dead-letter queue it blocks the head of the line and everything waits behind it. With one, it is retried a few times, set aside, and the queue flows again.",
  controls: [{ id: "dlq", kind: "toggle", label: "Dead-letter queue", initial: true }],
  aspect: 0.6,
  make: () => {
    const done: number[] = [];
    return (g) => {
      const { pal } = g;
      const on = g.v.dlq === 1;
      const T = 14;
      const t = g.t % T;
      if (t < 0.05) done.length = 0;
      const C = [380, 110];
      server(g, C[0], C[1], "consumer", { size: 44, color: t > 1 && t < 6 ? pal.bad : pal.paper });
      db(g, 380, 215, 36, 40, on ? pal.violet : pal.line, on ? 1 : 0.4);
      g.text("dead-letter queue", 380, 246, { size: 10, color: on ? pal.violet : pal.muted });
      g.rect(30, 86, 250, 48, pal.panel, 1, 8);
      g.frame(30, 86, 250, 48, pal.line, 1, 8);
      const poisonOut = on && t > 6;
      const attempts = t < 1 ? 0 : Math.min(3, Math.floor((t - 1) / 1.6) + 1);
      const labels = ["P", "2", "3", "4", "5"];
      let shown = 0;
      labels.forEach((l, k) => {
        const poison = k === 0;
        let x = 250 - k * 44;
        if (poison && poisonOut) return;
        if (!poison && on && t > 6.5) {
          const served = Math.floor((t - 6.5) / 1.4);
          if (k - 1 < served) return;
          x = 250 - (k - 1) * 44;
        }
        if (!poison && !on) x = 250 - k * 44;
        shown++;
        g.dot(x, 110, 11, poison ? pal.bad : pal.accent, 0.9);
        g.text(poison ? "!" : l, x, 110, { size: 11, color: pal.ink, bold: true });
      });
      if (t < 6) {
        g.packet(250, 110, C[0] - 28, C[1], g.clamp(((t - 1) % 1.6) / 0.6), pal.bad, 3.4);
        g.text(`attempt ${attempts} failed`, 330, 160, { size: 11, color: pal.bad });
      }
      if (on && t >= 5.6 && t < 7) g.packet(C[0], C[1] + 24, 380, 195, g.clamp((t - 5.6) / 1.2), pal.violet, 3.4);
      const msg = !on ? (t < 6 ? "the poison message is retried forever" : "everything behind it is stuck") : t < 6 ? "retrying with backoff" : t < 7 ? "retry limit reached: set aside" : "queue is moving again";
      g.text(msg, 240, 190, { size: 13, color: !on && t > 6 ? pal.bad : on && t >= 7 ? pal.ok : pal.paper });
      g.text(!on && t > 6 ? "waiting messages: 4 and growing" : "", 240, 214, { size: 11, color: pal.bad });
      void shown;
    };
  },
};

const exactlyOnce: Scene = {
  title: "Exactly-once effect from at-least-once delivery",
  caption: "The processor crashes before saving its position, so the event is read again. A sink that dedupes by event id ignores the repeat, so the effect still happens once.",
  controls: [{ id: "dedupe", kind: "toggle", label: "Sink dedupes by id", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const dedupe = g.v.dedupe === 1;
    const T = 12;
    const t = g.t % T;
    const S = [60, 120];
    const Pr = [210, 120];
    const K = [390, 120];
    server(g, S[0], S[1], "source", { size: 40 });
    server(g, Pr[0], Pr[1], "processor", { size: 44, color: t > 3 && t < 5 ? pal.bad : pal.paper });
    g.rect(340, 70, 100, 110, pal.panel, 1, 6);
    g.frame(340, 70, 100, 110, pal.line, 1, 6);
    g.text("sink table", 390, 62, { size: 10 });
    const rows = t < 2.6 ? 0 : t < 7.4 ? 1 : dedupe ? 1 : 2;
    for (let r = 0; r < rows; r++) {
      const dup = r === 1;
      g.rect(348, 80 + r * 26, 84, 20, dup ? pal.bad : pal.ok, 0.25, 4);
      g.frame(348, 80 + r * 26, 84, 20, dup ? pal.bad : pal.ok, 1, 4);
      g.text("id=42  $50", 390, 90 + r * 26, { size: 10, color: dup ? pal.bad : pal.paper });
    }
    if (t < 1.6) g.packet(S[0] + 26, S[1], Pr[0] - 28, Pr[1], t / 1.6, pal.accent);
    else if (t < 2.6) g.packet(Pr[0] + 28, Pr[1], 340, K[1] - 10, t - 1.6, pal.accent);
    if (t > 3 && t < 5) g.text("crash before saving position", 210, 70, { size: 11, color: pal.bad });
    if (t >= 5 && t < 6.6) {
      g.packet(S[0] + 26, S[1], Pr[0] - 28, Pr[1], (t - 5) / 1.6, pal.accent);
      g.text("same event read again", 135, 96, { size: 10, color: pal.accent });
    } else if (t >= 6.6 && t < 7.6) g.packet(Pr[0] + 28, Pr[1], 340, K[1] - 10, t - 6.6, pal.accent);
    if (t > 7.6) {
      g.text(dedupe ? "id=42 already stored: write ignored" : "no dedupe: the effect happened twice", 240, 230, { size: 12, color: dedupe ? pal.ok : pal.bad, bold: true });
      g.text(dedupe ? "processing ran twice, the effect ran once" : "the customer is charged twice", 240, 254, { size: 11 });
    } else g.text(t < 3 ? "event 42 is processed and written" : "recovering...", 240, 230, { size: 12, color: pal.paper });
  },
};

const kafka: Scene = {
  title: "Partitions and consumer groups",
  caption: "A topic is split into partitions, each an append-only log. Within a group every partition is read by exactly one consumer, so adding consumers helps only until each partition has its own.",
  controls: [{ id: "c", kind: "range", label: "Consumers in group", min: 1, max: 8, step: 1, initial: 3 }],
  aspect: 0.66,
  make: () => {
    const lens = [3, 5, 2, 4, 3, 6];
    let last = -1;
    return (g) => {
      const { pal } = g;
      const C = g.v.c;
      const tick = Math.floor(g.t / 0.5);
      if (tick !== last) {
        last = tick;
        lens[Math.floor(g.rnd(tick * 4.1) * 6)] = Math.min(13, lens[Math.floor(g.rnd(tick * 4.1) * 6)] + 1);
        if (lens.every((l) => l > 11)) lens.fill(3);
      }
      const cols = [pal.accent, pal.blue, pal.ok, pal.violet, pal.teal, pal.bad, pal.paper, pal.muted];
      g.text("producers", 30, 20, { size: 10, align: "left" });
      for (let p = 0; p < 6; p++) {
        const y = 40 + p * 34;
        g.text(`P${p}`, 24, y, { size: 10 });
        g.line(40, y, 300, y, pal.line, 0.5);
        for (let k = 0; k < lens[p]; k++) g.rect(44 + k * 20, y - 7, 16, 14, pal.panel, 1, 2);
        const consumer = p % C;
        const off = Math.max(0, lens[p] - 2 - (consumer % 3));
        g.rect(44 + off * 20, y - 7, 16, 14, cols[consumer], 0.5, 2);
        g.line(300, y, 330, 56 + consumer * 28, cols[consumer], 0.55, 1.4);
      }
      for (let c = 0; c < C; c++) {
        const owned = [0, 1, 2, 3, 4, 5].filter((p) => p % C === c).length;
        const y = 56 + c * 28;
        server(g, 342, y, "", { size: 22, color: cols[c], ring: owned === 0 ? pal.line : cols[c] });
        g.text(owned === 0 ? "idle" : `${owned} partition${owned > 1 ? "s" : ""}`, 360, y, { size: 10, align: "left", color: owned === 0 ? pal.bad : pal.paper });
      }
      g.text(C > 6 ? `${C - 6} consumers are idle: only 6 partitions` : "every partition has exactly one reader in the group", 240, 258, { size: 12, color: C > 6 ? pal.bad : pal.paper });
      g.packet(10, 40 + (tick % 6) * 34, 44, 40 + (tick % 6) * 34, g.clamp((g.t % 0.5) / 0.4), pal.accent, 2.4);
    };
  },
};

const inverted: Scene = {
  title: "Building and querying an inverted index",
  caption: "Documents are split into terms, and each term keeps a posting list of the documents containing it. A two-word query reads two short lists and intersects them instead of scanning the text.",
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const docs = [
      ["red", "fox", "runs"],
      ["red", "dog", "sleeps"],
      ["fox", "sleeps", "red"],
    ];
    const { i, p } = g.stage([4.2, 3.4]);
    docs.forEach((d, k) => {
      const y = 24 + k * 40;
      g.rect(20, y, 150, 32, pal.panel, 1, 5);
      g.frame(20, y, 150, 32, pal.line, 1, 5);
      g.text(`doc ${k + 1}`, 38, y + 10, { size: 9 });
      d.forEach((w, j) => g.text(w, 52 + j * 40, y + 22, { size: 10, color: pal.paper }));
    });
    const terms = ["dog", "fox", "red", "runs", "sleeps"];
    const post: Record<string, number[]> = { dog: [2], fox: [1, 3], red: [1, 2, 3], runs: [1], sleeps: [2, 3] };
    const built = i === 0 ? Math.floor(p * 9) : 9;
    let n = 0;
    terms.forEach((tm, r) => {
      const y = 22 + r * 28;
      g.rect(250, y, 70, 22, pal.ink, 0.8, 4);
      g.frame(250, y, 70, 22, pal.line, 1, 4);
      g.text(tm, 285, y + 11, { size: 10, color: pal.paper });
      post[tm].forEach((d, j) => {
        n++;
        const show = n <= built;
        g.rect(330 + j * 30, y + 2, 24, 18, show ? pal.blue : pal.ink, show ? 0.7 : 0.2, 3);
        if (show) g.text(String(d), 342 + j * 30, y + 11, { size: 10, color: pal.paper });
      });
    });
    if (i === 0) {
      docs.forEach((d, k) => d.forEach((w, j) => {
        const r = terms.indexOf(w);
        const idx = k * 3 + j;
        if (idx < built) g.packet(52 + j * 40, 46 + k * 40, 250, 33 + r * 28, g.clamp(p * 4 - idx * 0.4), pal.accent, 2);
      }));
      g.text("1  index: every term points to its documents", 240, 186, { size: 12, color: pal.paper });
    } else {
      g.text("2  query: red AND fox", 240, 186, { size: 12, color: pal.paper });
      [2, 1].forEach((r) => g.frame(246, 18 + r * 28, 130, 30, pal.accent, 0.8 + 0.2 * Math.sin(g.t * 5), 5, 1.8));
      const ok = [1, 3];
      ok.forEach((d) => {
        g.glow(342 + (d === 1 ? 0 : 30), 22 + 2 * 28 + 11, 22, pal.ok, p > 0.5 ? 0.5 : 0);
      });
      g.text(p > 0.5 ? "intersection: docs 1 and 3" : "reading two posting lists", 240, 214, { size: 13, color: p > 0.5 ? pal.ok : pal.accent, bold: true });
    }
    g.text("no document text is scanned at query time", 240, 262, { size: 11 });
  },
};

const autocomplete: Scene = {
  title: "Autocomplete, then ranked search",
  caption: "Each keystroke asks a prefix index for popular completions. Submitting runs the full search, whose ranking blends text relevance with boosts such as recency.",
  controls: [{ id: "boost", kind: "toggle", label: "Boost recent", initial: false }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const word = "rocket";
    const T = 9;
    const t = g.t % T;
    const typed = Math.min(word.length, Math.floor(t / 0.55));
    const q = word.slice(0, typed);
    g.rect(60, 18, 240, 26, pal.panel, 1, 6);
    g.frame(60, 18, 240, 26, pal.accent, 1, 6, 1.4);
    g.text(q + (Math.floor(g.t * 2) % 2 === 0 ? "|" : ""), 72, 31, { size: 13, color: pal.paper, align: "left" });
    const pool = [
      ["rocket", 90],
      ["rocket league", 70],
      ["rock", 60],
      ["road", 40],
      ["robot", 35],
      ["ro", 10],
    ] as [string, number][];
    const sug = pool.filter(([w]) => w.startsWith(q) && w !== q).slice(0, 4);
    if (t < 4.2 && q.length > 0) {
      sug.forEach(([w, pop], k) => {
        const y = 56 + k * 22;
        g.rect(60, y - 8, 240, 20, pal.ink, 0.8, 4);
        g.text(w, 72, y + 2, { size: 11, color: pal.paper, align: "left" });
        bar(g, 220, y - 2, 70, 5, pop / 100, pal.blue);
      });
      g.text("popularity", 255, 50, { size: 8 });
    }
    if (t >= 4.6) {
      const boost = g.v.boost === 1;
      const items = [
        { n: "rocket science basics", rel: 0.9, rec: 0.1 },
        { n: "new rocket launch today", rel: 0.6, rec: 0.95 },
        { n: "rocket stove plans", rel: 0.7, rec: 0.2 },
      ];
      const scored = items.map((it) => ({ ...it, s: it.rel + (boost ? it.rec * 0.7 : 0) })).sort((a, b) => b.s - a.s);
      scored.forEach((it, k) => {
        const y = 100 + k * 46;
        g.rect(40, y, 360, 38, pal.panel, 1, 6);
        g.frame(40, y, 360, 38, k === 0 ? pal.accent : pal.line, 1, 6);
        g.text(it.n, 52, y + 12, { size: 11, color: pal.paper, align: "left" });
        bar(g, 52, y + 24, it.rel * 120, 5, 1, pal.blue);
        if (boost) bar(g, 52 + it.rel * 120, y + 24, it.rec * 0.7 * 120, 5, 1, pal.ok);
        g.text(`score ${it.s.toFixed(2)}`, 388, y + 19, { size: 10, color: pal.accent, align: "right" });
      });
      g.text("text relevance", 90, 244, { size: 9, color: pal.blue });
      if (boost) g.text("+ recency boost", 200, 244, { size: 9, color: pal.ok });
    }
    g.text(t < 4.2 ? "prefix lookup on every keystroke" : "full ranked search", 240, 270, { size: 11, color: pal.paper });
  },
};

const spell: Scene = {
  title: "Did you mean, and facet counts",
  caption: "A typo is matched against nearby words, and the one that is common in your own query logs wins. Facets then count results per brand for the current query, and shrink as you filter.",
  controls: [{ id: "brand", kind: "choice", label: "Filter brand", options: ["all", "Acme", "Zed"], initial: 0 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const brandSel = g.v.brand;
    const cands = [
      { w: "receive", p: 0.62 },
      { w: "recipe", p: 0.2 },
      { w: "reserve", p: 0.1 },
      { w: "relieve", p: 0.08 },
    ];
    g.text('"recieve"', 90, 28, { size: 13, color: pal.bad });
    g.text("→ did you mean receive?", 90, 48, { size: 11, color: pal.ok });
    const cx = 90;
    const cy = 120;
    cands.forEach((c, k) => {
      const a = -Math.PI / 2 + (k / 4) * TAU + g.t * 0.2;
      const r = 40;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      g.line(cx, cy, x, y, pal.line, 0.5);
      g.dot(x, y, 4 + c.p * 12, k === 0 ? pal.ok : pal.muted, k === 0 ? 0.9 : 0.6);
      g.text(c.w, x, y + 18 + c.p * 8, { size: 9, color: k === 0 ? pal.ok : pal.muted });
    });
    g.dot(cx, cy, 5, pal.bad);
    g.text("probability from query logs", 90, 190, { size: 9 });
    const brands = ["Acme", "Zed", "Orbit"];
    const cols = [pal.accent, pal.blue, pal.violet];
    const items: number[] = [];
    for (let k = 0; k < 30; k++) items.push(k % 3 === 2 ? 2 : k % 5 < 3 ? 0 : 1);
    items.forEach((b, k) => {
      const x = 240 + (k % 6) * 22;
      const y = 40 + Math.floor(k / 6) * 22;
      const on = brandSel === 0 || (brandSel === 1 && b === 0) || (brandSel === 2 && b === 1);
      g.dot(x, y, 6, cols[b], on ? 1 : 0.12);
    });
    const counts = brands.map((_, b) => items.filter((v, k) => v === b && (brandSel === 0 || (brandSel === 1 && b === 0) || (brandSel === 2 && b === 1))).length);
    brands.forEach((n, b) => {
      g.dot(260, 170 + b * 22, 5, cols[b]);
      g.text(`${n}  (${counts[b]})`, 274, 170 + b * 22, { size: 11, color: counts[b] ? pal.paper : pal.muted, align: "left" });
    });
    g.text("facet counts update with the filter", 320, 150, { size: 10 });
    g.text("spell correction + faceted navigation", 240, 262, { size: 11 });
  },
};

const scatter: Scene = {
  title: "Scatter-gather across shards",
  caption: "The index is split across shards, so the coordinator sends the query to all of them, each returns its best hits, and the coordinator merges them into one global ranking.",
  controls: [{ id: "n", kind: "range", label: "Shards", min: 2, max: 8, step: 1, initial: 5 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const N = g.v.n;
    const C = [76, 130];
    const T = 8;
    const t = g.t % T;
    server(g, C[0], C[1], "coordinator", { size: 46, state: t < 5 ? "searching" : "composing" });
    const ys = Array.from({ length: N }, (_, k) => 32 + (k * 190) / Math.max(1, N - 1));
    ys.forEach((y, k) => {
      const x = 270;
      g.rect(x, y - 10, 60, 20, pal.panel, 1, 5);
      g.frame(x, y - 10, 60, 20, pal.line, 1, 5);
      g.text(`shard ${k + 1}`, x + 30, y, { size: 9, color: pal.paper });
      if (t < 1.4) g.packet(C[0] + 28, C[1], x, y, t / 1.4, pal.accent, 2.2);
      else if (t < 2.6) g.glow(x + 30, y, 26, pal.accent, 0.35);
      else if (t < 4.4) {
        g.packet(x + 60, y, 400, 130, g.clamp((t - 2.6) / 1.8), pal.blue, 2.2);
      }
      if (t >= 2.6 && t < 4.4) for (let b = 0; b < 3; b++) g.rect(x + 66 + b * 6, y - 3 - b, 4, 6 + b * 2, pal.blue, 0.6, 1);
    });
    if (t >= 4.4) {
      g.text("merged global ranking", 410, 60, { size: 10, color: pal.ok });
      for (let k = 0; k < 6; k++) {
        const w = 60 - k * 7;
        g.rect(370, 74 + k * 20, w, 12, pal.ok, 0.8 - k * 0.08, 3);
      }
      g.packet(400, 130, 76 + 28, 130, g.clamp((t - 4.4) / 1.4), pal.ok, 3);
    }
    g.text(t < 1.4 ? "1  fan the query out to every shard" : t < 4.4 ? "2  each shard returns its own top hits" : "3  merge into one ranked list", 240, 270, { size: 12, color: pal.paper });
  },
};

const queryCache: Scene = {
  title: "What a search cache buys",
  caption: "A cache hit answers in a couple of milliseconds without touching the shards, while a miss pays the full fan-out. Raise the hit rate and both average latency and backend load drop.",
  controls: [{ id: "hit", kind: "range", label: "Hit rate", min: 0, max: 95, step: 5, initial: 60, unit: "%" }],
  aspect: 0.62,
  make: () => {
    type R = { born: number; hit: boolean; y: number };
    const reqs: R[] = [];
    let acc = 0;
    let n = 0;
    let hits = 0;
    let total = 0;
    return (g) => {
      const { pal } = g;
      acc += g.dt * 5;
      while (acc >= 1) {
        acc -= 1;
        n++;
        const hit = g.rnd(n * 3.7) * 100 < g.v.hit;
        reqs.push({ born: g.t, hit, y: 50 + g.rnd(n * 1.9) * 150 });
        total++;
        if (hit) hits++;
      }
      while (reqs.length && g.t - reqs[0].born > 2) reqs.shift();
      g.rect(150, 40, 50, 170, pal.panel, 1, 8);
      g.frame(150, 40, 50, 170, pal.ok, 0.8, 8);
      g.text("cache", 175, 30, { size: 10, color: pal.ok });
      for (let s = 0; s < 4; s++) server(g, 400, 56 + s * 50, `shard ${s + 1}`, { size: 28 });
      for (const r of reqs) {
        const age = g.t - r.born;
        if (r.hit) {
          if (age < 0.5) g.packet(40, r.y, 150, r.y, age / 0.5, pal.ok, 2.2);
          else g.packet(150, r.y, 40, r.y, g.clamp((age - 0.5) / 0.4), pal.ok, 2.2);
        } else if (age < 0.5) g.packet(40, r.y, 150, r.y, age / 0.5, pal.accent, 2.2);
        else if (age < 1.5) g.packet(200, r.y, 372, 56 + (Math.floor(r.y) % 4) * 50, g.clamp((age - 0.5) / 1), pal.accent, 2.2);
        else g.packet(372, 56 + (Math.floor(r.y) % 4) * 50, 40, r.y, g.clamp((age - 1.5) / 0.5), pal.accent, 2.2);
      }
      const hr = total ? hits / total : 0;
      const avg = 2 * hr + 120 * (1 - hr);
      g.text(`average latency ${avg.toFixed(0)} ms`, 240, 236, { size: 14, color: avg > 60 ? pal.accent : pal.ok, bold: true });
      g.text(`${((1 - hr) * 100).toFixed(0)}% of queries reach the shards`, 240, 260, { size: 11, color: pal.paper });
      if (total > 400) {
        hits = Math.round(hits / 2);
        total = Math.round(total / 2);
      }
    };
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/storage-engines/b-trees-vs-lsm-trees`]: btreeLsm,
  [`${P}/storage-engines/replication-strategies`]: replication,
  [`${P}/storage-engines/compression-and-columnar-storage-formats`]: columnar,
  [`${P}/storage-engines/write-ahead-logging-and-crash-recovery`]: wal,
  [`${P}/storage-engines/compaction-strategies-and-storage-engine-internals`]: compaction,
  [`${P}/async-work-and-streams/message-queues-and-delivery-guarantees`]: queues,
  [`${P}/async-work-and-streams/stream-processing-batch-vs-stream`]: streamWindows,
  [`${P}/async-work-and-streams/event-sourcing-and-cqrs`]: eventSourcing,
  [`${P}/async-work-and-streams/dead-letter-queues-and-poison-message-handling`]: dlq,
  [`${P}/async-work-and-streams/exactly-once-processing-semantics`]: exactlyOnce,
  [`${P}/async-work-and-streams/kafka-pulsar-architecture-deep-dive`]: kafka,
  [`${P}/search-and-retrieval/inverted-indexes-and-full-text-search`]: inverted,
  [`${P}/search-and-retrieval/search-relevance-and-autocomplete`]: autocomplete,
  [`${P}/search-and-retrieval/spell-correction-and-faceted-search`]: spell,
  [`${P}/search-and-retrieval/distributed-search-index-sharding-and-replication`]: scatter,
  [`${P}/search-and-retrieval/search-query-caching-and-performance-tuning`]: queryCache,
};
