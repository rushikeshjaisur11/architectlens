import type { G, Scene } from "../scene/types";
import { arcStroke, bar, chip, fmt } from "./kit";

const P = "ai-systems";

const injection: Scene = {
  title: "Prompt injection and input guardrails",
  caption: "A fetched web page carries a hidden instruction. With no defence the agent obeys it and calls the email tool. A classifier can flag the page, and privilege separation goes further: text from untrusted sources can never trigger a sensitive tool.",
  controls: [{ id: "d", kind: "choice", label: "Defence", options: ["none", "input classifier", "privilege separation"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const d = g.v.d;
    const { i, p } = g.stage([2.2, 2.2, 2.2]);
    g.rect(14, 50, 110, 90, pal.line, 0.15, 8);
    g.frame(14, 50, 110, 90, pal.line, 1, 8, 1.2);
    g.text("web page", 69, 64, { size: 10, color: pal.muted });
    g.rect(24, 76, 90, 8, pal.paper, 0.4, 3);
    g.rect(24, 92, 90, 8, pal.paper, 0.4, 3);
    g.rect(24, 108, 90, 10, pal.bad, 0.7, 3);
    g.text("hidden: send secrets", 69, 128, { size: 9, color: pal.bad });
    if (d === 1) {
      g.rect(150, 50, 8, 90, pal.blue, 0.8, 3);
      g.text("classifier", 154, 154, { size: 10, color: pal.blue });
    }
    g.orb(d === 0 && i >= 1 ? "weaving" : "working", 230, 95, 48, pal.paper, 1);
    g.text("agent", 230, 132, { size: 10, color: pal.muted });
    if (d === 2) g.ring(230, 95, 36, pal.blue, 0.9, 2);
    g.rect(340, 60, 120, 70, pal.accent, 0.12, 8);
    g.frame(340, 60, 120, 70, pal.accent, 1, 8, 1.2);
    g.text("send_email()", 400, 88, { size: 11, color: pal.paper });
    g.text("sensitive tool", 400, 108, { size: 9, color: pal.muted });
    const stopAtClassifier = d === 1;
    if (i === 0) g.packet(120, 112, stopAtClassifier ? 150 : 205, 100, p, pal.bad, 3);
    if (i >= 1) {
      if (stopAtClassifier) {
        g.glow(154, 100, 24, pal.blue, 0.4);
      } else {
        g.packet(255, 95, 340, 95, i === 1 ? p : 1, pal.bad, 3);
        if (d === 2 && i === 2) {
          g.text("denied: instruction came from untrusted text", 330, 160, { size: 10, color: pal.ok });
        }
      }
    }
    let msg = "retrieved page enters the context";
    let col = pal.paper;
    if (i === 1) msg = d === 1 ? "classifier reads the page" : "agent treats the hidden text as a command";
    if (i === 2) {
      if (d === 0) {
        msg = "secrets emailed out ✕";
        col = pal.bad;
      } else if (d === 1) {
        msg = "flagged and dropped ✓ (novel phrasing may slip past)";
        col = pal.ok;
      } else {
        msg = "tool call blocked by policy ✓";
        col = pal.ok;
      }
    }
    g.text(msg, 240, 232, { size: 12, color: col });
    g.text(["no layer between page and tool", "detects known attack patterns", "enforces who may trigger what, even if fooled"][d], 240, 262, { size: 10, color: pal.muted });
  },
};

const moderation: Scene = {
  title: "Content moderation: where to set the threshold",
  caption: "Each model output gets a risk score. Safe outputs cluster low, unsafe ones high, and the curves overlap. The threshold line splits them: move it right and fewer safe outputs are blocked but more unsafe ones get through.",
  controls: [{ id: "t", kind: "range", label: "Block above", min: 0.2, max: 0.85, step: 0.01, initial: 0.5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const th = g.v.t;
    const pdf = (x: number, m: number) => Math.exp(-((x - m) ** 2) / (2 * 0.12 * 0.12));
    const xOf = (v: number) => 30 + v * 420;
    const base = 190;
    let fp = 0;
    let fn = 0;
    let ts = 0;
    let tu = 0;
    for (let v = 0; v <= 1; v += 0.01) {
      ts += pdf(v, 0.3);
      tu += pdf(v, 0.7);
      if (v >= th) fp += pdf(v, 0.3);
      if (v < th) fn += pdf(v, 0.7);
    }
    const curve = (m: number, col: string, cut: (v: number) => boolean, cutCol: string) => {
      for (let v = 0; v < 1; v += 0.01) {
        const h = 110 * pdf(v + 0.005, m);
        const hot = cut(v);
        g.rect(xOf(v), base - h, 4.3, h, hot ? cutCol : col, hot ? 0.8 : 0.28, 0);
      }
    };
    curve(0.3, pal.ok, (v) => v >= th, pal.accent);
    curve(0.7, pal.bad, (v) => v < th, pal.bad);
    g.line(xOf(th), 60, xOf(th), base + 6, pal.paper, 1, 2);
    g.text("threshold", xOf(th), 50, { size: 10, color: pal.paper });
    g.text("safe outputs", xOf(0.3), 62, { size: 11, color: pal.ok });
    g.text("unsafe outputs", xOf(0.7), 62, { size: 11, color: pal.bad });
    g.text("risk score →", 240, 212, { size: 10, color: pal.muted });
    const px = xOf(0.5 + 0.5 * Math.sin(g.t * 0.9));
    g.dot(px, base + 4, 3, pal.paper);
    g.text(`safe blocked: ${Math.round((fp / ts) * 100)}%`, 130, 248, { size: 12, color: pal.accent });
    g.text(`unsafe allowed: ${Math.round((fn / tu) * 100)}%`, 350, 248, { size: 12, color: pal.bad });
    g.text("pick where the cost of each mistake balances", 240, 276, { size: 10, color: pal.muted });
  },
};

const jailbreak: Scene = {
  title: "Jailbreaks and layered defence",
  caption: "Every attack has to pass each independent layer, and each layer stops most but not all. Layers multiply: stack more and the share that gets through collapses. No single layer is trusted to be perfect.",
  controls: [{ id: "l", kind: "range", label: "Defence layers", min: 1, max: 4, step: 1, initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const L = g.v.l;
    const period = 4;
    const bucket = Math.floor(g.t / period);
    const f = (g.t % period) / period;
    const sx = 40;
    const ex = 440;
    const slabX = (k: number) => 130 + (k * 270) / L;
    for (let k = 0; k < L; k++) {
      const x = slabX(k);
      g.rect(x, 50, 9, 170, pal.blue, 0.55, 3);
      g.text(["filter", "classifier", "policy", "monitor"][k], x + 4, 238, { size: 9, color: pal.muted });
    }
    let through = 0;
    for (let id = 0; id < 10; id++) {
      const y = 62 + id * 16;
      let stop = -1;
      for (let k = 0; k < L; k++) {
        if (g.rnd(id * 7.3 + k * 1.9 + bucket * 11.1) < 0.7) {
          stop = k;
          break;
        }
      }
      if (stop < 0) through++;
      const reach = stop < 0 ? ex : slabX(stop) - 6;
      const x = sx + (reach - sx) * g.clamp(f * 1.3);
      const hit = stop >= 0 && x >= reach - 0.5;
      g.dot(x, y, 3.5, stop < 0 ? pal.bad : pal.accent, hit ? 0.35 : 1);
      if (hit) g.text("✕", reach, y, { size: 9, color: pal.bad, a: 0.8 });
    }
    g.orb("searching", 18, 130, 22, pal.paper, 1);
    g.text(`${through} of 10 attacks got through this round`, 240, 262, { size: 12, color: pal.paper });
    g.text(`long-run leak: ${(0.3 ** L * 100).toFixed(L > 2 ? 1 : 0)}% at 70% per layer`, 240, 282, { size: 10, color: pal.muted });
  },
};

function row(g: G, labels: string[], y: number, colors: string[], alphas: number[]): void {
  const w = labels.map((s) => s.length * 6.4 + 14);
  const total = w.reduce((a, b) => a + b, 0) + (labels.length - 1) * 8;
  let x = 240 - total / 2;
  labels.forEach((s, k) => {
    g.rect(x, y - 13, w[k], 26, colors[k], 0.18 * alphas[k], 6);
    g.frame(x, y - 13, w[k], 26, colors[k], alphas[k], 6, 1.2);
    g.text(s, x + w[k] / 2, y, { size: 10, color: g.pal.paper, a: alphas[k] });
    x += w[k] + 8;
  });
}

const pii: Scene = {
  title: "PII detection and redaction",
  caption: "The text is scanned for personal data before it reaches the model or the logs. Patterns catch the email and phone number. A name has no fixed shape, so only a named-entity model finds it. Compare the two detectors.",
  controls: [{ id: "m", kind: "choice", label: "Detector", options: ["regex only", "regex + NER"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ner = g.v.m === 1;
    const src = ["Priya Nair", "emailed", "priya@acme.io", "from", "98765 43210"];
    const kinds = ["NAME", "", "EMAIL", "", "PHONE"];
    const found = [ner, false, true, false, true];
    const f = g.loop(5);
    const scan = Math.floor(f * 6);
    row(g, src, 70, src.map((_, k) => (kinds[k] ? pal.accent : pal.line)), src.map(() => 1));
    g.text("input text", 240, 44, { size: 10, color: pal.muted });
    g.orb(scan < 5 ? "searching" : "breathing", 240, 130, 34, pal.paper, 1);
    g.packet(240, 90, 240, 112, g.loop(1.2), pal.accent, 2.5);
    const out = src.map((s, k) => (kinds[k] && found[k] && k <= scan - 1 ? `[${kinds[k]}]` : s));
    g.text("redacted output", 240, 176, { size: 10, color: pal.muted });
    row(g, out, 208, src.map((_, k) => (kinds[k] && found[k] && k <= scan - 1 ? pal.ok : kinds[k] && !found[k] && scan >= 5 ? pal.bad : pal.line)), src.map(() => 1));
    const leak = !ner && scan >= 5;
    g.text(leak ? "name leaked: regex cannot recognise a person" : ner && scan >= 5 ? "all three kinds of PII masked" : "scanning…", 240, 264, { size: 12, color: leak ? pal.bad : ner && scan >= 5 ? pal.ok : pal.paper });
  },
};

const agentSecurity: Scene = {
  title: "Multi-agent security boundaries",
  caption: "The reader agent has been compromised and tries to call the production deploy tool. With one shared broad token nothing stops it. With a scoped token per agent, the boundary refuses any call outside that agent's own tools.",
  controls: [{ id: "s", kind: "choice", label: "Credentials", options: ["shared broad token", "scoped per agent"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const scoped = g.v.s === 1;
    const xs = [80, 240, 400];
    const ag = ["reader", "writer", "deployer"];
    const tools = ["read_docs", "write_repo", "deploy_prod"];
    ag.forEach((nm, k) => {
      const bad = k === 0;
      g.orb(bad ? "weaving" : "working", xs[k], 60, 42, bad ? pal.bad : pal.paper, 1);
      g.text(nm + (bad ? " (compromised)" : ""), xs[k], 98, { size: 10, color: bad ? pal.bad : pal.muted });
      chip(g, xs[k], 210, tools[k], pal.line, 10);
      g.packet(xs[k], 112, xs[k], 196, (g.t * 0.5 + k * 0.3) % 1, pal.ok, 2.4);
    });
    g.rect(20, 150, 440, 6, pal.blue, scoped ? 0.8 : 0.15, 3);
    g.text(scoped ? "permission boundary: each token opens one tool" : "one broad token: no boundary", 240, 142, { size: 10, color: scoped ? pal.blue : pal.muted });
    const f = g.loop(3);
    const sx = 80 + 320 * g.clamp(f * 1.6);
    const sy = 112 + 84 * g.clamp(f * 1.6);
    if (scoped) {
      const hitY = 150;
      const t = g.clamp(f * 1.6);
      const y = Math.min(sy, hitY - 4);
      g.dot(80 + (sx - 80) * Math.min(1, (hitY - 112) / Math.max(1, sy - 112)), y, 4, pal.bad);
      if (t * 84 + 112 >= hitY) g.glow(80 + 320 * ((hitY - 112) / 84), hitY, 22, pal.bad, 0.5);
    } else {
      g.dot(sx, sy, 4, pal.bad);
      g.glow(sx, sy, 14, pal.bad, 0.4);
    }
    const hit = !scoped && f > 0.7;
    if (hit) g.ring(400, 210, 36, pal.bad, 1, 2);
    g.text(scoped ? "deploy call refused ✓" : hit ? "production deploy hijacked ✕" : "attacker moves sideways…", 240, 258, { size: 12, color: scoped ? pal.ok : hit ? pal.bad : pal.paper });
  },
};

const redTeam: Scene = {
  title: "Red-teaming coverage",
  caption: "Each arc is an attack category and its fill is how much of it has been probed. More rounds raise coverage unevenly and turn up findings, the red dots. A category with no coverage is one you know nothing about.",
  controls: [{ id: "r", kind: "range", label: "Rounds run", min: 0, max: 100, step: 5, initial: 40 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const R = g.v.r;
    const cats = ["injection", "jailbreak", "PII leak", "tool abuse", "bias", "harmful"];
    const rate = [0.05, 0.035, 0.02, 0.012, 0.03, 0.045];
    const cx = 240;
    const cy = 140;
    const rad = 82;
    let found = 0;
    cats.forEach((nm, k) => {
      const a0 = -Math.PI / 2 + (k / 6) * Math.PI * 2 + 0.06;
      const a1 = -Math.PI / 2 + ((k + 1) / 6) * Math.PI * 2 - 0.06;
      const cov = 1 - Math.exp(-R * rate[k]);
      arcStroke(g, cx, cy, rad, a0, a1 - 0.0001, pal.line, 8, 0.5);
      arcStroke(g, cx, cy, rad, a0, a0 + (a1 - a0) * Math.max(0.0001, cov), cov < 0.35 ? pal.bad : pal.ok, 8, 1);
      const am = (a0 + a1) / 2;
      g.text(nm, cx + (rad + 36) * Math.cos(am), cy + (rad + 24) * Math.sin(am), { size: 10, color: pal.paper });
      g.text(`${Math.round(cov * 100)}%`, cx + (rad + 36) * Math.cos(am), cy + (rad + 24) * Math.sin(am) + 13, { size: 9, color: pal.muted });
      const nf = Math.floor(cov * (1 + k % 3) * 1.4);
      found += nf;
      for (let j = 0; j < nf; j++) g.dot(cx + (rad - 16 - j * 7) * Math.cos(am), cy + (rad - 16 - j * 7) * Math.sin(am), 2.6, pal.bad);
    });
    g.orb("searching", cx, cy, 52, pal.bad, 1);
    g.text("attacker", cx, cy + 36, { size: 10, color: pal.muted });
    g.text(`${R} rounds, ${found} findings logged`, 240, 280, { size: 12, color: pal.paper });
  },
};

const governance: Scene = {
  title: "Data governance and the right to erasure",
  caption: "Requests route to the user's region and every store there keeps a copy: logs, vector index, training data, backups. An erasure request has to reach all of them. Backups are purged on their own schedule, which you must disclose.",
  controls: [
    { id: "r", kind: "choice", label: "User region", options: ["EU", "US"], initial: 0 },
    { id: "e", kind: "toggle", label: "Erasure request" },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const reg = g.v.r;
    const erase = g.v.e === 1;
    const stores = ["logs", "vectors", "training", "backup"];
    g.orb("listening", 44, 150, 34, pal.paper, 1);
    g.text("user", 44, 180, { size: 10, color: pal.muted });
    const f = g.loop(6);
    [0, 1].forEach((r) => {
      const y = 40 + r * 118;
      const live = r === reg;
      g.rect(110, y, 350, 100, live ? pal.blue : pal.line, live ? 0.1 : 0.05, 10);
      g.frame(110, y, 350, 100, live ? pal.blue : pal.line, live ? 1 : 0.5, 10, 1.3);
      g.text(r === 0 ? "EU region" : "US region", 160, y + 14, { size: 11, color: live ? pal.blue : pal.muted });
      stores.forEach((s, k) => {
        const x = 150 + k * 86;
        const wiped = live && erase && s !== "backup" && f > 0.15 + k * 0.18;
        const keep = live && erase && s === "backup" && f > 0.7;
        g.rect(x - 34, y + 38, 68, 36, wiped ? pal.line : pal.accent, wiped ? 0.1 : 0.2, 6);
        g.frame(x - 34, y + 38, 68, 36, wiped ? pal.line : keep ? pal.bad : pal.accent, wiped ? 0.4 : 1, 6, 1.2);
        g.text(s, x, y + 56, { size: 10, color: wiped ? pal.muted : pal.paper });
        if (wiped) g.line(x - 28, y + 56, x + 28, y + 56, pal.ok, 0.9, 1.5);
      });
    });
    const ty = 40 + reg * 118;
    g.packet(62, 150, 110, ty + 50, g.loop(1.6), erase ? pal.bad : pal.accent, 3);
    g.text(erase ? "delete user data in every store" : "data stored in the user's own region", 285, 270, { size: 12, color: pal.paper });
    if (erase && f > 0.7) g.text("backups purge in 30 days: disclosed, not instant", 285, 288, { size: 10, color: pal.bad });
  },
};

const costLatency: Scene = {
  title: "Cost and latency levers",
  caption: "One request, its cost split into input, output and retrieval. Switch levers on and watch both bars drop: cache the shared prefix, trim the context, route to a smaller model. Each has a quality price, so measure before keeping it.",
  controls: [
    { id: "c", kind: "toggle", label: "Cache prefix" },
    { id: "t", kind: "toggle", label: "Trim context" },
    { id: "m", kind: "toggle", label: "Smaller model" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    let input = 0.6;
    let output = 0.3;
    const retr = 0.1;
    let lat = 2400;
    if (g.v.c === 1) {
      input *= 0.35;
      lat -= 500;
    }
    if (g.v.t === 1) {
      input *= 0.55;
      lat -= 400;
    }
    if (g.v.m === 1) {
      input *= 0.25;
      output *= 0.25;
      lat -= 1100;
    }
    const total = input + output + retr;
    const parts: [string, number, string][] = [["input", input, pal.blue], ["output", output, pal.accent], ["retrieval", retr, pal.teal]];
    g.orb("shaping", 60, 52, 36, pal.paper, 1);
    g.text("cost per request", 240, 52, { size: 11, color: pal.muted });
    let x = 40;
    parts.forEach(([nm, v, col]) => {
      const w = (v / 1) * 400;
      g.rect(x, 80, w, 34, col, 0.75, 4);
      if (w > 42) g.text(nm, x + w / 2, 97, { size: 10, color: pal.ink });
      x += w;
    });
    g.text(`$${total.toFixed(3)} (was $1.000)`, 240, 138, { size: 13, color: total < 0.5 ? pal.ok : pal.paper });
    g.text("latency", 70, 190, { size: 11 });
    bar(g, 120, 185, 270, 8, lat / 2400, lat < 1500 ? pal.ok : pal.accent);
    g.text(`${fmt(lat)} ms`, 430, 190, { size: 12, color: pal.paper });
    g.text("each lever trades quality or freshness for savings", 240, 250, { size: 11, color: pal.muted });
  },
};

const respCache: Scene = {
  title: "Caching LLM responses: exact and semantic",
  caption: "A cached answer exists for one question. An exact cache only matches identical text. A semantic cache matches by embedding similarity, so rewordings hit too, but set the threshold too low and a different question gets the wrong cached answer.",
  controls: [
    { id: "m", kind: "choice", label: "Cache", options: ["exact match", "semantic"], initial: 1 },
    { id: "t", kind: "range", label: "Similarity threshold", min: 0.6, max: 0.99, step: 0.01, initial: 0.88 },
  ],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const qs: [string, number, boolean][] = [
      ["How do I reset my password?", 1, true],
      ["reset my password", 0.96, true],
      ["forgot password help", 0.9, true],
      ["change my email address", 0.78, false],
      ["delete my account", 0.68, false],
    ];
    const sem = g.v.m === 1;
    const th = g.v.t;
    g.text("cached: “How do I reset my password?”", 240, 28, { size: 11, color: pal.accent });
    let hits = 0;
    let wrong = 0;
    qs.forEach(([q, sim, same], k) => {
      const y = 62 + k * 38;
      const hit = sem ? sim >= th : sim === 1;
      const bad = hit && !same;
      if (hit) hits++;
      if (bad) wrong++;
      const col = bad ? pal.bad : hit ? pal.ok : pal.accent;
      g.rect(20, y - 15, 270, 30, col, 0.12, 6);
      g.frame(20, y - 15, 270, 30, col, 1, 6, 1.1);
      g.text(q, 30, y, { size: 10, align: "left", color: pal.paper });
      g.text(sim.toFixed(2), 262, y, { size: 10, color: pal.muted });
      chip(g, 380, y, bad ? "wrong cached answer" : hit ? "cache hit, $0" : "LLM call", col, 10);
      if (hit) g.packet(290, y, 330, y, (g.t * 0.6 + k * 0.2) % 1, col, 2.2);
    });
    g.text(`${hits} of 5 served from cache`, 140, 270, { size: 12, color: pal.paper });
    g.text(wrong > 0 ? `${wrong} wrong answer${wrong > 1 ? "s" : ""} served` : "no wrong hits", 360, 270, { size: 12, color: wrong > 0 ? pal.bad : pal.ok });
  },
};

const streaming: Scene = {
  title: "Streaming and perceived latency",
  caption: "Total generation time is the same either way. Waiting for the full answer shows a blank screen for three seconds. Streaming shows the first words after a fraction of a second, and reading starts while the rest is still being written.",
  controls: [{ id: "m", kind: "choice", label: "Delivery", options: ["wait for full answer", "stream tokens"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const stream = g.v.m === 1;
    const T = 3;
    const cyc = 5.5;
    const t = g.t % cyc;
    g.rect(24, 36, 432, 130, pal.line, 0.12, 10);
    g.frame(24, 36, 432, 130, pal.line, 1, 10, 1.2);
    g.orb(t < T ? "working" : "breathing", 450, 36, 26, pal.paper, 1);
    const ttft = 0.4;
    const lines = 5;
    let shown = 0;
    if (stream) shown = t < ttft ? 0 : Math.min(lines * 10, Math.floor(((t - ttft) / (T - ttft)) * lines * 10));
    else shown = t < T ? 0 : lines * 10;
    for (let k = 0; k < shown; k++) {
      const r = Math.floor(k / 10);
      g.rect(38 + (k % 10) * 40, 52 + r * 22, 34, 8, pal.paper, 0.7, 3);
    }
    if (shown === 0) {
      g.text(stream ? "…" : "waiting…", 240, 100, { size: 14, color: pal.muted });
    }
    g.line(24, 200, 456, 200, pal.line, 1, 1.2);
    const px = 24 + (t / cyc) * 432;
    g.dot(px, 200, 4, pal.accent);
    const firstX = 24 + ((stream ? ttft : T) / cyc) * 432;
    g.line(firstX, 192, firstX, 208, pal.ok, 1, 2);
    g.text(`first words at ${stream ? "0.4" : "3.0"} s`, firstX, 224, { size: 11, color: pal.ok });
    g.text("answer complete at 3.0 s either way", 240, 262, { size: 11, color: pal.muted });
  },
};

const modelEcon: Scene = {
  title: "Model selection economics",
  caption: "Each dot is a model: cost per million tokens on a log axis against quality on your own test set. The dashed line is the quality you need. The highlighted dot is the cheapest model that clears it, often far from the biggest.",
  controls: [{ id: "q", kind: "range", label: "Quality needed", min: 0.5, max: 0.95, step: 0.01, initial: 0.8 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const models: [string, number, number][] = [["tiny", 0.1, 0.55], ["small", 0.5, 0.72], ["mid", 3, 0.84], ["large", 15, 0.92], ["xl", 60, 0.95]];
    const need = g.v.q;
    const xOf = (c: number) => 50 + ((Math.log10(c) + 1) / 3) * 380;
    const yOf = (q: number) => 220 - ((q - 0.5) / 0.5) * 170;
    g.line(40, 225, 450, 225, pal.line, 1, 1.2);
    g.line(40, 40, 40, 225, pal.line, 1, 1.2);
    g.text("cost per 1M tokens →", 245, 252, { size: 10, color: pal.muted });
    g.text("quality", 22, 36, { size: 10, color: pal.muted });
    g.c.setLineDash([5, 4]);
    g.line(40, yOf(need), 450, yOf(need), pal.accent, 0.9, 1.3);
    g.c.setLineDash([]);
    const ok = models.filter((m) => m[2] >= need);
    const pick = ok.length ? ok.reduce((a, b) => (a[1] < b[1] ? a : b)) : null;
    models.forEach((m, k) => {
      if (k > 0) g.line(xOf(models[k - 1][1]), yOf(models[k - 1][2]), xOf(m[1]), yOf(m[2]), pal.line, 0.5, 1.2);
    });
    models.forEach(([nm, c, q]) => {
      const win = pick && pick[0] === nm;
      g.dot(xOf(c), yOf(q), win ? 8 : 5, win ? pal.ok : q >= need ? pal.blue : pal.line);
      if (win) g.glow(xOf(c), yOf(q), 22, pal.ok, 0.4 + 0.15 * Math.sin(g.t * 4));
      g.text(`${nm} $${c}`, xOf(c), yOf(q) - 16, { size: 10, color: win ? pal.ok : pal.paper });
    });
    g.text(pick ? `pick: ${pick[0]}, ${Math.round(60 / pick[1])}x cheaper than xl` : "no model reaches that quality", 240, 280, { size: 12, color: pick ? pal.ok : pal.bad });
  },
};

const batchAsync: Scene = {
  title: "Batch and async processing",
  caption: "Realtime requests are answered one by one at full price. A batch job collects them into a file, runs when capacity is idle and returns hours later at a discount. Use it for anything nobody is waiting on.",
  controls: [{ id: "m", kind: "choice", label: "Mode", options: ["realtime", "batch"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const batch = g.v.m === 1;
    const f = g.loop(7);
    for (let k = 0; k < 8; k++) {
      const x = 30 + (k % 4) * 22;
      const y = 60 + Math.floor(k / 4) * 28;
      g.dot(x, y, 5, pal.accent, 0.9);
    }
    g.text("8 requests", 74, 130, { size: 10, color: pal.muted });
    g.orb(batch ? (f > 0.35 && f < 0.85 ? "working" : "breathing") : "working", 330, 100, 54, pal.paper, 1);
    if (batch) {
      const boxP = g.clamp(f / 0.3);
      g.frame(150, 70, 80, 60, pal.violet, 1, 6, 1.3);
      for (let k = 0; k < 8; k++) if (k / 8 < boxP) g.dot(165 + (k % 4) * 17, 92 + Math.floor(k / 4) * 22, 4, pal.accent);
      g.text("batch file", 190, 62, { size: 10, color: pal.violet });
      if (f > 0.3 && f < 0.4) g.packet(232, 100, 300, 100, (f - 0.3) / 0.1, pal.violet, 3);
      const done = f > 0.85;
      chip(g, 330, 175, done ? "results ready" : f > 0.4 ? "queued, runs off-peak…" : "building file", done ? pal.ok : pal.violet, 10);
    } else {
      for (let k = 0; k < 4; k++) {
        g.packet(100, 70 + k * 12, 300, 100, (g.t * 0.9 + k * 0.25) % 1, pal.accent, 2.4);
        g.packet(360, 100, 440, 70 + k * 12, (g.t * 0.9 + k * 0.25 + 0.3) % 1, pal.ok, 2.4);
      }
      chip(g, 330, 175, "answered immediately", pal.ok, 10);
    }
    g.text("price", 70, 226, { size: 11 });
    bar(g, 110, 221, 250, 8, batch ? 0.5 : 1, batch ? pal.ok : pal.accent);
    g.text(batch ? "50%" : "100%", 410, 226, { size: 12, color: pal.paper });
    g.text("turnaround", 70, 254, { size: 11 });
    bar(g, 110, 249, 250, 8, batch ? 1 : 0.03, batch ? pal.bad : pal.ok);
    g.text(batch ? "up to 24 h" : "seconds", 410, 254, { size: 12, color: pal.paper });
  },
};

const budget: Scene = {
  title: "Token budget management",
  caption: "The context window is a fixed budget split between the system prompt, history, retrieved documents and room reserved for the answer. Retrieve more documents and the bar overflows. Enforcing the budget trims documents to fit.",
  controls: [
    { id: "k", kind: "range", label: "Retrieved docs", min: 0, max: 12, step: 1, initial: 8 },
    { id: "e", kind: "toggle", label: "Enforce budget", initial: true },
  ],
  aspect: 0.58,
  make: () => (g) => {
    const { pal } = g;
    const cap = 8000;
    const sys = 500;
    const hist = 2000;
    const out = 1000;
    const per = 800;
    let docs = g.v.k * per;
    const room = cap - sys - hist - out;
    const trimmed = g.v.e === 1 && docs > room;
    if (g.v.e === 1) docs = Math.min(docs, room);
    const sc = 400 / cap;
    const parts: [string, number, string][] = [["system", sys, pal.blue], ["history", hist, pal.violet], ["docs", docs, pal.teal], ["reserve", out, pal.accent]];
    g.frame(40, 80, 400, 50, pal.line, 1, 6, 1.3);
    g.text("context budget: 8,000 tokens", 240, 66, { size: 11, color: pal.muted });
    let x = 40;
    parts.forEach(([nm, v, col]) => {
      const w = v * sc;
      const over = x + w > 440;
      const cw = Math.min(w, Math.max(0, 440 - x));
      if (cw > 0) g.rect(x, 80, cw, 50, col, 0.7, 2);
      if (over) g.rect(Math.max(x, 440), 80, Math.min(w, x + w - 440) + 0.01, 50, pal.bad, 0.85, 2);
      if (w > 46) g.text(nm, x + Math.min(w, 440 - x) / 2, 105, { size: 10, color: pal.ink });
      x += w;
    });
    const used = sys + hist + docs + out;
    const overflow = used > cap;
    g.orb(overflow ? "searching" : "working", 240, 190, 40, pal.paper, 1);
    g.text(`${fmt(used)} of ${fmt(cap)} tokens`, 240, 232, { size: 13, color: overflow ? pal.bad : pal.paper });
    g.text(overflow ? "overflow: request rejected or oldest content cut" : trimmed ? "docs trimmed to fit, answer room kept" : "fits with room for the answer", 240, 258, { size: 11, color: overflow ? pal.bad : pal.ok });
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/safety-and-guardrails/prompt-injection-and-input-guardrails`]: injection,
  [`${P}/safety-and-guardrails/content-moderation-and-output-safety`]: moderation,
  [`${P}/safety-and-guardrails/jailbreaks-and-adversarial-robustness`]: jailbreak,
  [`${P}/safety-and-guardrails/pii-detection-and-redaction-pipelines`]: pii,
  [`${P}/safety-and-guardrails/multi-agent-security-boundaries-and-tool-permission-scoping`]: agentSecurity,
  [`${P}/safety-and-guardrails/red-teaming-methodology-for-llm-applications`]: redTeam,
  [`${P}/safety-and-guardrails/data-governance-and-compliance-for-llm-systems`]: governance,
  [`${P}/cost-and-latency/cost-and-latency-optimization`]: costLatency,
  [`${P}/cost-and-latency/caching-llm-responses`]: respCache,
  [`${P}/cost-and-latency/streaming-and-perceived-latency`]: streaming,
  [`${P}/cost-and-latency/model-selection-economics`]: modelEcon,
  [`${P}/cost-and-latency/batch-and-async-processing`]: batchAsync,
  [`${P}/cost-and-latency/token-budget-management`]: budget,
};
