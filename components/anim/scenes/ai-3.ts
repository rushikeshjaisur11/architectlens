import type { Scene } from "../scene/types";
import { bar, chip, server } from "./kit";

const P = "ai-systems";

const agentLoop: Scene = {
  title: "The agent loop: think, act, observe",
  caption: "The orb circles the loop. Each lap it decides, calls a tool, reads the result and decides again. After the step budget it leaves the loop with an answer. More steps means more tool calls, more tokens and more latency.",
  controls: [{ id: "n", kind: "range", label: "Steps before answering", min: 1, max: 5, step: 1, initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const nodes: [number, number, string, string][] = [
      [170, 60, "think", pal.blue],
      [262, 188, "act", pal.accent],
      [78, 188, "observe", pal.teal],
    ];
    const tools = ["search", "calculator", "database", "search", "calculator"];
    const total = n * 3 + 1;
    const pos = (g.t * 1.1) % (total + 1);
    const seg = Math.min(total - 1, Math.floor(pos));
    const f = pos >= total ? 1 : pos - seg;
    for (let k = 0; k < 3; k++) {
      const a = nodes[k];
      const b = nodes[(k + 1) % 3];
      g.line(a[0], a[1], b[0], b[1], pal.line, 0.8, 1.3);
    }
    nodes.forEach(([x, y, s, c], k) => {
      const on = seg < n * 3 && seg % 3 === k;
      g.glow(x, y, 34, c, on ? 0.3 : 0.08);
      g.ring(x, y, 24, c, 1, 1.5);
      g.text(s, x, y + 38, { size: 11, color: pal.paper });
    });
    const ans: [number, number] = [400, 60];
    const last = seg === total - 1;
    const a = last ? nodes[0] : nodes[seg % 3];
    const b = last ? ans : nodes[(seg + 1) % 3];
    const ox = g.mix(a[0], b[0], g.ease(f));
    const oy = g.mix(a[1], b[1], g.ease(f));
    g.orb(last ? "composing" : seg % 3 === 1 ? "connecting" : "solving", ox, oy, 38, pal.paper, 1);
    const turn = Math.floor(seg / 3);
    if (!last && seg % 3 === 1) chip(g, 395, 188, tools[turn], pal.accent, 12);
    else if (!last) g.text("tool", 395, 188, { size: 11, color: pal.muted });
    chip(g, 400, 60, "answer", last ? pal.ok : pal.line, 13, last ? 1 : 0.4);
    g.text(last ? "budget reached: respond" : `step ${turn + 1} of ${n}`, 395, 112, { size: 12, color: pal.paper });
    g.text(`${n} tool call${n > 1 ? "s" : ""}, ${n + 1} model calls`, 240, 280, { size: 12, color: pal.paper });
  },
};

const orchestration: Scene = {
  title: "Multi-agent orchestration patterns",
  caption: "Three ways to wire agents together. A supervisor delegates and collects. A pipeline hands work stage to stage. In a debate two agents argue and a judge decides. Pick by how much the sub-tasks depend on each other.",
  controls: [{ id: "m", kind: "choice", label: "Pattern", options: ["supervisor", "pipeline", "debate"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    if (m === 0) {
      g.orb("weaving", 240, 70, 56, pal.paper, 1);
      g.text("supervisor", 240, 110, { size: 11, color: pal.muted });
      ["research", "code", "test"].forEach((nm, k) => {
        const x = 80 + k * 160;
        g.orb("working", x, 210, 38, pal.paper, 1);
        g.text(nm, x, 242, { size: 11, color: pal.muted });
        g.packet(240, 100, x, 190, (g.t * 0.5 + k * 0.17) % 1, pal.accent, 2.6);
        g.packet(x, 190, 240, 100, (g.t * 0.5 + k * 0.17 + 0.5) % 1, pal.ok, 2.6);
      });
      g.text("delegates, then merges the results", 240, 280, { size: 12, color: pal.paper });
    } else if (m === 1) {
      const names = ["research", "draft", "review", "publish"];
      names.forEach((nm, k) => {
        const x = 50 + k * 127;
        g.orb(Math.floor(g.t * 0.8) % 4 === k ? "working" : "breathing", x, 130, 42, pal.paper, 1);
        g.text(nm, x, 170, { size: 11, color: pal.muted });
        if (k < 3) g.packet(x + 24, 130, x + 103, 130, (g.t * 0.8) % 1, pal.accent, 3);
      });
      g.text("each stage output is the next stage input", 240, 250, { size: 12, color: pal.paper });
    } else {
      g.orb("solving", 70, 110, 46, pal.paper, 1);
      g.orb("solving", 410, 110, 46, pal.paper, 1);
      g.text("for", 70, 146, { size: 11, color: pal.ok });
      g.text("against", 410, 146, { size: 11, color: pal.bad });
      g.packet(94, 110, 386, 110, g.loop(2.4), pal.ok, 3);
      g.packet(386, 124, 94, 124, g.loop(2.4, 0.5), pal.bad, 3);
      g.orb("weaving", 240, 220, 46, pal.accent, 1);
      g.text("judge", 240, 256, { size: 11, color: pal.muted });
      g.packet(80, 140, 214, 210, g.loop(3, 0.2), pal.ok, 2);
      g.packet(400, 140, 266, 210, g.loop(3, 0.6), pal.bad, 2);
    }
  },
};

const memory: Scene = {
  title: "Agent memory: working, summary, long-term",
  caption: "New messages land in working memory, which is the context window. When it fills the oldest turns are summarised, durable facts are written to a vector store, and later a query pulls the relevant ones back in.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([2.2, 2.2, 2.2, 2.4]);
    g.text("working memory", 90, 34, { size: 11, color: pal.blue });
    g.frame(24, 44, 132, 150, pal.blue, 1, 8, 1.3);
    const filled = i === 0 ? 1 + Math.floor(p * 3) : i === 1 ? 4 - Math.floor(p * 2) : i === 2 ? 2 : 2 + Math.floor(p * 2);
    for (let k = 0; k < 4; k++) {
      const on = k < filled;
      g.rect(34, 54 + k * 34, 112, 26, on ? pal.blue : pal.line, on ? 0.35 : 0.1, 5);
    }
    g.text("summary", 240, 34, { size: 11, color: pal.violet });
    g.frame(190, 44, 100, 70, pal.violet, 1, 8, 1.3);
    g.rect(200, 58, 80 * (i >= 1 ? Math.min(1, i === 1 ? p : 1) : 0.15), 12, pal.violet, 0.6, 3);
    g.rect(200, 78, 60 * (i >= 1 ? Math.min(1, i === 1 ? p : 1) : 0.1), 12, pal.violet, 0.4, 3);
    g.text("long-term store", 400, 34, { size: 11, color: pal.teal });
    g.frame(340, 44, 120, 150, pal.teal, 1, 8, 1.3);
    for (let k = 0; k < 6; k++) {
      const stored = i >= 2 || k < 2;
      g.dot(370 + (k % 3) * 28, 80 + Math.floor(k / 3) * 44, 6, pal.teal, stored ? (i === 3 && k === 1 ? 1 : 0.7) : 0.15);
    }
    if (i === 0) g.packet(8, 100, 34, 100, p, pal.accent, 3);
    if (i === 1) g.packet(156, 90, 190, 80, p, pal.violet, 3);
    if (i === 2) g.packet(290, 90, 340, 110, p, pal.teal, 3);
    if (i === 3) {
      g.packet(156, 150, 340, 118, g.clamp(p * 2), pal.accent, 3);
      if (p > 0.5) g.packet(340, 125, 156, 160, (p - 0.5) * 2, pal.ok, 3);
    }
    g.orb(i === 3 ? "searching" : "breathing", 240, 190, 34, pal.paper, 1);
    const msg = ["new message enters the context", "old turns are compressed into a summary", "durable facts written to the vector store", "a query retrieves relevant memories back"][i];
    g.text(msg, 240, 262, { size: 13, color: pal.paper });
  },
};

const toolSchema: Scene = {
  title: "Tool schemas and argument validation",
  caption: "The model proposes arguments as JSON. With a loose schema a vague value like 'next tuesday' reaches the tool and breaks it. A strict schema rejects it, returns the error to the model, and the retry arrives well formed.",
  controls: [{ id: "s", kind: "choice", label: "Schema", options: ["loose", "strict"], initial: 1 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const strict = g.v.s === 1;
    const { i, p } = g.stage([2, 2, 2.2]);
    g.orb(i === 1 && strict ? "solving" : "working", 50, 110, 44, pal.paper, 1);
    g.text("model", 50, 146, { size: 11, color: pal.muted });
    const bad = i < 2 || !strict;
    g.rect(110, 70, 150, 78, pal.line, 0.15, 8);
    g.frame(110, 70, 150, 78, bad ? pal.bad : pal.ok, 1, 8, 1.4);
    g.text('{ "date": ' + (bad ? '"next tuesday"' : '"2026-10-06"') + ",", 120, 94, { size: 10, align: "left", color: pal.paper });
    g.text('  "qty": ' + (bad ? '"two"' : "2") + " }", 120, 116, { size: 10, align: "left", color: pal.paper });
    g.text("arguments", 185, 62, { size: 10, color: pal.muted });
    chip(g, 310, 110, strict ? "validator" : "no validation", strict ? pal.blue : pal.line, 11);
    g.rect(380, 80, 80, 60, pal.accent, 0.12, 8);
    g.frame(380, 80, 80, 60, pal.accent, 1, 8, 1.2);
    g.text("calendar", 420, 106, { size: 11, color: pal.paper });
    g.text("tool", 420, 124, { size: 10, color: pal.muted });
    if (i === 0) g.packet(95, 110, 285, 110, p, pal.accent, 3);
    if (!strict) {
      if (i >= 1) g.packet(335, 110, 380, 110, i === 1 ? p : 1, pal.bad, 3);
      if (i === 2) {
        g.text("tool crashed on bad input", 240, 200, { size: 13, color: pal.bad });
        g.text("error: cannot parse date", 240, 224, { size: 11, color: pal.muted });
      }
    } else {
      if (i === 1) {
        g.packet(290, 120, 70, 140, p, pal.bad, 3);
        g.text("rejected: date must be ISO, qty a number", 240, 200, { size: 12, color: pal.bad });
      }
      if (i === 2) {
        g.packet(335, 110, 380, 110, p, pal.ok, 3);
        g.text("valid on retry, tool runs", 240, 200, { size: 13, color: pal.ok });
      }
    }
    g.text(["model proposes arguments", strict ? "validator checks the schema" : "arguments pass straight through", strict ? "retry with the error as context" : "failure surfaces inside the tool"][i], 240, 268, { size: 12, color: pal.paper });
  },
};

const planning: Scene = {
  title: "Planning strategies: ReAct, tree of thought, plan-and-execute",
  caption: "ReAct interleaves a thought, an action and an observation one step at a time. Tree of thought branches, scores each branch and prunes the weak ones. Plan-and-execute writes the whole plan first, then ticks it off.",
  controls: [{ id: "m", kind: "choice", label: "Strategy", options: ["ReAct", "tree of thought", "plan-and-execute"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const f = g.loop(7);
    if (m === 0) {
      const seq = [["thought", pal.blue], ["action", pal.accent], ["observe", pal.teal]] as const;
      const n = 9;
      const shown = Math.floor(f * (n + 2));
      for (let k = 0; k < n; k++) {
        const x = 50 + (k % 3) * 140;
        const y = 60 + Math.floor(k / 3) * 70;
        const [lab, col] = seq[k % 3];
        if (k < shown) {
          chip(g, x, y, lab, col, 12);
          if (k > 0) g.arrow(k % 3 === 0 ? 50 : x - 52, k % 3 === 0 ? y - 38 : y, k % 3 === 0 ? 50 : x - 28, k % 3 === 0 ? y - 16 : y, pal.line, 0.8);
        }
      }
      g.orb("solving", 440, 130, 40, pal.paper, 1);
      g.text("one step at a time, adapt on each result", 240, 270, { size: 12, color: pal.paper });
    } else if (m === 1) {
      const root: [number, number] = [60, 130];
      const mids: [number, number][] = [[200, 60], [200, 130], [200, 200]];
      const leaves: [number, number][] = [[360, 40], [360, 80], [360, 110], [360, 150], [360, 180], [360, 220]];
      const scores = [0.3, 0.5, 0.2, 0.9, 0.4, 0.3];
      const showMid = f > 0.15;
      const showLeaf = f > 0.45;
      const prune = f > 0.7;
      mids.forEach((mm, k) => {
        if (!showMid) return;
        const dead = prune && k !== 1;
        g.line(root[0], root[1], mm[0], mm[1], dead ? pal.bad : pal.line, dead ? 0.35 : 0.9, 1.4);
        g.dot(mm[0], mm[1], 6, dead ? pal.bad : pal.accent, dead ? 0.4 : 1);
      });
      leaves.forEach((lf, k) => {
        if (!showLeaf) return;
        const parent = mids[Math.floor(k / 2)];
        const best = k === 3;
        const dead = prune && !best;
        g.line(parent[0], parent[1], lf[0], lf[1], best && prune ? pal.ok : dead ? pal.bad : pal.line, best && prune ? 1 : dead ? 0.3 : 0.8, best && prune ? 2.4 : 1.2);
        g.dot(lf[0], lf[1], 6, best && prune ? pal.ok : dead ? pal.bad : pal.blue, dead ? 0.4 : 1);
        g.text(scores[k].toFixed(1), lf[0] + 24, lf[1], { size: 10, color: dead ? pal.muted : pal.paper });
      });
      g.orb("searching", root[0], root[1], 34, pal.paper, 1);
      g.text(prune ? "weak branches pruned, best path kept" : showLeaf ? "scoring each branch" : "proposing branches", 240, 270, { size: 12, color: pal.paper });
    } else {
      const steps = ["find sources", "extract figures", "compute growth", "write summary"];
      const done = Math.floor(f * 5);
      g.text("plan (written first)", 120, 30, { size: 11, color: pal.accent });
      steps.forEach((s, k) => {
        const y = 62 + k * 46;
        g.rect(30, y - 16, 180, 32, pal.line, 0.12, 6);
        g.frame(30, y - 16, 180, 32, k < done ? pal.ok : k === done ? pal.accent : pal.line, 1, 6, 1.2);
        g.text(`${k + 1}. ${s}`, 40, y, { size: 11, align: "left", color: pal.paper });
        if (k < done) g.text("✓", 192, y, { size: 13, color: pal.ok });
      });
      g.orb("working", 360, 140, 52, pal.paper, 1);
      g.text("executor", 360, 180, { size: 11, color: pal.muted });
      if (done < 4) g.packet(212, 62 + done * 46, 336, 140, g.loop(1.2), pal.accent, 3);
      g.text("plan stays fixed unless a step fails", 240, 270, { size: 12, color: pal.paper });
    }
  },
};

const protocols: Scene = {
  title: "Tool protocols versus agent protocols",
  caption: "A tool call is one stateless request and one response. An agent-to-agent task has a life: it is submitted, worked on, may pause to ask for input, and finishes with an artifact, with status updates streaming in between.",
  controls: [{ id: "m", kind: "choice", label: "Calls a", options: ["tool", "remote agent"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const agent = g.v.m === 1;
    g.orb("solving", 70, 100, 50, pal.paper, 1);
    g.text("your agent", 70, 138, { size: 11, color: pal.muted });
    if (!agent) {
      g.rect(350, 70, 100, 60, pal.accent, 0.12, 8);
      g.frame(350, 70, 100, 60, pal.accent, 1, 8, 1.3);
      g.text("get_weather()", 400, 100, { size: 11, color: pal.paper });
      g.packet(100, 92, 345, 92, g.loop(2.4), pal.accent, 3);
      g.packet(345, 108, 100, 108, g.loop(2.4, 0.5), pal.ok, 3);
      g.text("request → response, nothing remembered", 240, 190, { size: 12, color: pal.paper });
    } else {
      g.orb("working", 410, 100, 50, pal.paper, 1);
      g.text("remote agent", 410, 138, { size: 11, color: pal.muted });
      g.packet(100, 92, 380, 92, g.loop(3), pal.accent, 3);
      g.packet(380, 108, 100, 108, g.loop(1.2), pal.teal, 2);
      const states = ["submitted", "working", "input needed", "completed"];
      const cur = Math.floor(g.loop(8) * 4);
      states.forEach((s, k) => {
        const x = 52 + k * 125;
        chip(g, x + 20, 200, s, k === cur ? pal.accent : pal.line, 11, k === cur ? 1 : 0.5);
        if (k < 3) g.arrow(x + 70, 200, x + 100, 200, pal.line, 0.7);
      });
      g.text("task lifecycle, updates streamed back", 240, 240, { size: 12, color: pal.paper });
    }
    g.text(agent ? "agents negotiate and report progress" : "tools just execute", 240, 280, { size: 11, color: pal.muted });
  },
};

const selfCorrect: Scene = {
  title: "Failure recovery and self-correction",
  caption: "Each attempt is checked. A failure produces a critique that feeds the next try. Set how many attempts the task really needs and how many retries you allow: if the budget runs out first, the agent escalates instead of looping.",
  controls: [
    { id: "need", kind: "range", label: "Attempts task needs", min: 1, max: 5, step: 1, initial: 3 },
    { id: "r", kind: "range", label: "Retries allowed", min: 0, max: 4, step: 1, initial: 2 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const need = g.v.need;
    const budget = g.v.r + 1;
    const tries = Math.min(need, budget);
    const ok = budget >= need;
    const shown = Math.min(tries + 1, Math.floor(g.loop(1.2 * (tries + 2)) * (tries + 2)));
    for (let k = 0; k < tries; k++) {
      const x = 56 + k * 92;
      const pass = k === need - 1;
      if (k < shown) {
        g.orb(pass ? "composing" : "working", x, 100, 40, pal.paper, 1);
        chip(g, x, 140, `attempt ${k + 1}`, pal.blue, 10);
        chip(g, x, 168, pass ? "check ✓" : "check ✕", pass ? pal.ok : pal.bad, 10);
        if (!pass && k < tries - 1) {
          g.arrow(x + 24, 100, x + 66, 100, pal.accent, 0.9);
          g.text("critique", x + 45, 86, { size: 9, color: pal.accent });
        }
      }
    }
    if (shown > tries) {
      chip(g, 240, 225, ok ? "solved after " + tries + (tries > 1 ? " attempts" : " attempt") : "budget spent: escalate to human", ok ? pal.ok : pal.bad, 13);
    }
    g.text(`${budget} attempt${budget > 1 ? "s" : ""} allowed, ${need} needed`, 240, 270, { size: 12, color: pal.paper });
  },
};

const hitl: Scene = {
  title: "Human-in-the-loop approval gates",
  caption: "Actions stream toward execution. The gate lets low-risk ones through and holds the rest for a person. Gating only high-risk actions keeps interruptions few while the dangerous ones still get reviewed.",
  controls: [{ id: "p", kind: "choice", label: "Policy", options: ["approve all", "gate high-risk", "gate everything"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pol = g.v.p;
    const acts: [string, number][] = [["read file", 0], ["send email", 2], ["query db", 0], ["delete rows", 2], ["draft reply", 1], ["list users", 0]];
    const gx = 210;
    const y = 110;
    g.line(20, y, 440, y, pal.line, 0.5, 1);
    g.rect(gx - 4, y - 50, 8, 100, pal.accent, 0.8, 3);
    g.text("gate", gx, y - 62, { size: 11, color: pal.accent });
    g.orb("listening", 330, 200, 36, pal.paper, 1);
    g.text("human", 330, 234, { size: 10, color: pal.muted });
    server(g, 430, y, "execute", { size: 36, state: "working", ring: pal.ok });
    let humans = 0;
    let unreviewed = 0;
    acts.forEach(([nm, risk], k) => {
      const held = pol === 2 || (pol === 1 && risk === 2);
      if (held) humans++;
      else if (risk === 2) unreviewed++;
      const f = (g.t * 0.16 + k / acts.length) % 1;
      const col = risk === 2 ? pal.bad : risk === 1 ? pal.accent : pal.ok;
      let x: number;
      if (!held) x = 20 + f * 400;
      else if (f < 0.4) x = 20 + (f / 0.4) * (gx - 24 - 20);
      else if (f < 0.62) x = gx - 24;
      else x = gx - 24 + ((f - 0.62) / 0.38) * (430 - gx + 24);
      g.dot(x, y, 5, col);
      g.text(nm, x, y + 16 + (k % 2) * 11, { size: 9, color: pal.muted });
      if (held && f >= 0.4 && f < 0.62) {
        g.ring(x, y, 12, pal.accent, 0.9, 1.5);
        g.line(x, y + 8, 330, 180, pal.accent, 0.4, 1);
      }
    });
    g.text(`${humans} of 6 wait for a person`, 140, 266, { size: 12, color: pal.paper });
    g.text(`${unreviewed} risky unreviewed`, 360, 266, { size: 12, color: unreviewed > 0 ? pal.bad : pal.ok });
  },
};

const mcp: Scene = {
  title: "Model Context Protocol: one handshake, three primitives",
  caption: "The host's client opens a session with initialize, lists what the server offers, then uses it. Servers expose tools the model calls, resources the app reads and prompts the user picks. Switch primitive to see who is in control.",
  controls: [{ id: "k", kind: "choice", label: "Primitive", options: ["tools", "resources", "prompts"], initial: 0 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const k = g.v.k;
    const names = ["tools", "resources", "prompts"];
    const items = [["search_issues", "create_ticket"], ["file:///notes.md", "db://orders"], ["summarize_pr", "triage_bug"]][k];
    const ctrl = ["model decides", "app decides", "user picks"][k];
    const use = ["tools/call", "resources/read", "prompts/get"][k];
    const { i, p } = g.stage([2, 2, 2.4]);
    g.rect(14, 40, 150, 160, pal.blue, 0.1, 10);
    g.frame(14, 40, 150, 160, pal.blue, 1, 10, 1.3);
    g.text("host app", 89, 54, { size: 11, color: pal.blue });
    g.orb("solving", 89, 110, 40, pal.paper, 1);
    g.text("MCP client", 89, 150, { size: 11, color: pal.paper });
    g.rect(316, 40, 150, 160, pal.teal, 0.1, 10);
    g.frame(316, 40, 150, 160, pal.teal, 1, 10, 1.3);
    g.text("MCP server", 391, 54, { size: 11, color: pal.teal });
    items.forEach((it, j) => chip(g, 391, 100 + j * 36, it, i === 2 && j === 0 ? pal.accent : pal.line, 10));
    g.text(names[k], 391, 84, { size: 10, color: pal.muted });
    const msgs = ["initialize", `${names[k]}/list`, use];
    const label = msgs[i];
    g.packet(164, 96, 316, 96, p, pal.accent, 3);
    g.packet(316, 116, 164, 116, g.clamp(p * 1.2 - 0.2), pal.ok, 3);
    chip(g, 240, 76, label, pal.accent, 11);
    g.text("JSON-RPC over stdio or HTTP", 240, 214, { size: 10, color: pal.muted });
    g.text(["step 1: agree on capabilities", "step 2: discover what is offered", "step 3: use one item"][i], 240, 244, { size: 12, color: pal.paper });
    g.text(ctrl, 240, 270, { size: 13, color: pal.accent, bold: true });
  },
};

const evalApps: Scene = {
  title: "Evaluating an LLM application",
  caption: "Every cell is a test case. Run the suite on version 1, then version 2. The score is only half the story: green outlines are cases the change fixed, red outlines are cases it broke. Regressions hide behind a rising average.",
  controls: [{ id: "v", kind: "choice", label: "App version", options: ["v1", "v2"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const N = 24;
    const p1 = (k: number) => g.rnd(k * 3.1 + 1) < 0.58;
    const p2 = (k: number) => (p1(k) ? g.rnd(k * 7.7 + 2) > 0.14 : g.rnd(k * 5.3 + 3) < 0.6);
    const v2 = g.v.v === 1;
    const sweep = Math.min(N, Math.floor(g.loop(4) * 1.5 * N));
    let pass = 0;
    let fixed = 0;
    let broke = 0;
    for (let k = 0; k < N; k++) {
      const x = 28 + (k % 8) * 55;
      const y = 40 + Math.floor(k / 8) * 52;
      const ok = v2 ? p2(k) : p1(k);
      const done = k < sweep;
      if (done && ok) pass++;
      if (v2 && done && ok && !p1(k)) fixed++;
      if (v2 && done && !ok && p1(k)) broke++;
      g.rect(x, y, 48, 40, done ? (ok ? pal.ok : pal.bad) : pal.line, done ? 0.28 : 0.1, 6);
      if (v2 && done && ok && !p1(k)) g.frame(x, y, 48, 40, pal.ok, 1, 6, 2);
      if (v2 && done && !ok && p1(k)) g.frame(x, y, 48, 40, pal.bad, 1, 6, 2);
      g.text(done ? (ok ? "✓" : "✕") : "·", x + 24, y + 20, { size: 15, color: done ? (ok ? pal.ok : pal.bad) : pal.muted });
    }
    g.text(`${pass} / ${N} pass`, 130, 220, { size: 15, color: pal.paper, bold: true });
    if (v2) {
      g.text(`fixed ${fixed}`, 290, 214, { size: 12, color: pal.ok });
      g.text(`broke ${broke}`, 380, 214, { size: 12, color: pal.bad });
    }
    g.text(v2 ? "outlined cells differ from v1" : "baseline run", 240, 262, { size: 11, color: pal.muted });
  },
};

const tracing: Scene = {
  title: "Tracing a multi-step LLM pipeline",
  caption: "A trace is a waterfall of spans: retrieve, rerank, generate, call a tool. Inject a fault and see how it travels. A silent retrieval failure still produces an answer, just an ungrounded one, which is why traces matter.",
  controls: [{ id: "f", kind: "choice", label: "Fault in", options: ["none", "retriever", "tool call"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const f = g.v.f;
    const spans: [string, number, number][] = [["retrieve", 0, 180], ["rerank", 180, 120], ["generate", 300, 520], ["tool call", 820, 240], ["respond", 1060, 90]];
    const sx = 100;
    const sc = 360 / 1200;
    const cursor = (g.t * 280) % 1400;
    spans.forEach(([nm, s, d], k) => {
      const y = 44 + k * 38;
      const bad = (f === 1 && k === 0) || (f === 2 && k === 3);
      const weak = f === 1 && k >= 1 && k <= 2;
      const col = bad ? pal.bad : weak ? pal.accent : pal.blue;
      g.text(nm, 20, y + 11, { size: 11, align: "left", color: bad ? pal.bad : pal.paper });
      const prog = g.clamp((cursor - s) / d);
      g.rect(sx + s * sc, y, d * sc, 22, col, 0.2, 4);
      g.rect(sx + s * sc, y, d * sc * prog, 22, col, 0.8, 4);
      if (bad && prog > 0.5) g.text("error", sx + s * sc + d * sc * 0.5, y + 11, { size: 10, color: pal.paper });
    });
    g.line(sx + cursor * sc, 38, sx + cursor * sc, 232, pal.paper, 0.6, 1.3);
    const note = f === 0 ? "healthy: 1,150 ms end to end" : f === 1 ? "retriever returned nothing, model answered ungrounded" : "tool errored, retried, latency doubled";
    g.text(note, 240, 262, { size: 12, color: f === 0 ? pal.ok : pal.bad });
  },
};

const feedback: Scene = {
  title: "Human feedback and the reward model",
  caption: "People compare two answers and pick the better one. Those pairs train a reward model that scores answers the way people did. More pairs, more agreement. The reward then steers the language model toward answers people prefer.",
  controls: [{ id: "n", kind: "range", label: "Preference pairs", min: 0, max: 200, step: 10, initial: 60 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const acc = 0.5 + 0.4 * (1 - Math.exp(-n / 60));
    g.rect(20, 40, 120, 56, pal.ok, 0.18, 8);
    g.frame(20, 40, 120, 56, pal.ok, 1, 8, 1.4);
    g.text("answer A", 80, 60, { size: 11, color: pal.ok });
    g.text("clear, correct", 80, 80, { size: 10, color: pal.paper });
    g.rect(20, 112, 120, 56, pal.line, 0.15, 8);
    g.frame(20, 112, 120, 56, pal.line, 1, 8, 1.2);
    g.text("answer B", 80, 132, { size: 11, color: pal.muted });
    g.text("rambling", 80, 152, { size: 10, color: pal.paper });
    g.orb("listening", 190, 104, 34, pal.paper, 1);
    g.text("picks A", 190, 140, { size: 10, color: pal.ok });
    g.packet(142, 68, 172, 98, g.loop(1.6), pal.ok, 2.5);
    for (let k = 0; k < Math.min(10, Math.round(n / 20)); k++) g.rect(166 + (k % 5) * 8, 160 + Math.floor(k / 5) * 8, 6, 6, pal.accent, 0.8, 1);
    g.text(`${n} pairs`, 190, 190, { size: 10, color: pal.muted });
    g.packet(214, 104, 290, 104, g.loop(1.6, 0.4), pal.accent, 2.5);
    g.text("reward model", 360, 36, { size: 11, color: pal.blue });
    g.frame(290, 44, 170, 130, pal.blue, 1, 8, 1.3);
    const gap = (acc - 0.5) * 2;
    const sA = 0.5 + gap * 0.35;
    const sB = 0.5 - gap * 0.35;
    g.rect(325, 160 - sA * 90, 36, sA * 90, pal.ok, 0.8, 4);
    g.rect(389, 160 - sB * 90, 36, sB * 90, pal.line, 0.8, 4);
    g.text("A", 343, 170, { size: 11, color: pal.paper });
    g.text("B", 407, 170, { size: 11, color: pal.paper });
    g.text("agrees with people", 120, 232, { size: 11 });
    bar(g, 200, 227, 190, 8, acc, acc > 0.8 ? pal.ok : pal.accent);
    g.text(`${Math.round(acc * 100)}%`, 430, 232, { size: 12, color: pal.paper });
    g.text("reward then trains the policy toward preferred answers", 240, 270, { size: 11, color: pal.muted });
  },
};

const judge: Scene = {
  title: "LLM-as-judge and its biases",
  caption: "Answer A is better but short, answer B is worse but longer. A biased judge leans toward whichever comes first or whichever is longer. Swapping the order and averaging cancels position bias and exposes the rest.",
  controls: [
    { id: "b", kind: "choice", label: "Judge bias", options: ["none", "position (prefers first)", "verbosity (prefers long)"], initial: 1 },
    { id: "s", kind: "toggle", label: "Swap order and average" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const b = g.v.b;
    const swap = g.v.s === 1;
    const base = { A: 0.62, B: 0.4 };
    const score = (firstIsA: boolean) => {
      let a = base.A;
      let bb = base.B;
      if (b === 1) {
        if (firstIsA) a += 0.25;
        else bb += 0.25;
      }
      if (b === 2) bb += 0.25;
      return [a, bb];
    };
    const r1 = score(true);
    const r2 = score(false);
    const fa = swap ? (r1[0] + r2[0]) / 2 : r1[0];
    const fb = swap ? (r1[1] + r2[1]) / 2 : r1[1];
    const winA = fa > fb;
    g.orb("weaving", 240, 56, 40, pal.paper, 1);
    g.text("judge", 240, 90, { size: 10, color: pal.muted });
    const rows = swap ? [["A first", r1], ["B first", r2]] as const : [["A first", r1]] as const;
    rows.forEach(([lab, r], k) => {
      const y = 120 + k * 46;
      g.text(lab, 20, y + 6, { size: 10, align: "left", color: pal.muted });
      g.text("A", 100, y, { size: 11, color: pal.ok });
      bar(g, 115, y - 4, 140, 8, r[0] > 1 ? 1 : r[0], pal.ok);
      g.text("B", 285, y, { size: 11, color: pal.bad });
      bar(g, 300, y - 4, 140, 8, r[1] > 1 ? 1 : r[1], pal.bad);
    });
    g.packet(240, 72, 240, 108, g.loop(1.4), pal.accent, 2.5);
    chip(g, 240, 236, winA ? "verdict: A wins ✓" : "verdict: B wins ✕", winA ? pal.ok : pal.bad, 13);
    g.text(b === 0 ? "no bias, either way is fine" : swap ? "bias averaged out across both orders" : "one ordering only: the bias decides", 240, 272, { size: 11, color: pal.muted });
  },
};

const golden: Scene = {
  title: "Golden datasets and regression gates",
  caption: "Each prompt version is scored on the same golden set. The line tracks the pass rate version by version, and a version that falls under the threshold is blocked before it ships. Raise the threshold to see what it would have caught.",
  controls: [{ id: "t", kind: "range", label: "Pass threshold %", min: 80, max: 95, step: 1, initial: 90 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const th = g.v.t / 100;
    const rates = [0.88, 0.92, 0.84, 0.94, 0.9];
    const x0 = 50;
    const x1 = 450;
    const yOf = (r: number) => 220 - ((r - 0.78) / 0.2) * 150;
    g.line(x0, yOf(th), x1, yOf(th), pal.accent, 0.8, 1.2);
    g.text(`gate ${g.v.t}%`, x1, yOf(th) - 8, { size: 10, color: pal.accent, align: "right" });
    const prog = g.loop(5) * 1.3 * (rates.length - 1);
    rates.forEach((r, k) => {
      const x = x0 + (k * (x1 - x0)) / (rates.length - 1);
      const on = k <= prog;
      if (k > 0 && k - 1 < prog) {
        const px = x0 + ((k - 1) * (x1 - x0)) / (rates.length - 1);
        const frac = Math.min(1, prog - (k - 1));
        g.line(px, yOf(rates[k - 1]), px + (x - px) * frac, yOf(rates[k - 1]) + (yOf(r) - yOf(rates[k - 1])) * frac, pal.blue, 1, 2);
      }
      if (on) {
        const blocked = r < th;
        g.dot(x, yOf(r), 6, blocked ? pal.bad : pal.ok);
        g.text(`${Math.round(r * 100)}`, x, yOf(r) - 14, { size: 11, color: pal.paper });
        chip(g, x, 244, blocked ? "blocked" : "ship", blocked ? pal.bad : pal.ok, 10);
      }
      g.text(`v${k + 1}`, x, 262, { size: 10, color: pal.muted });
    });
    g.orb("shaping", 60, 40, 24, pal.paper, 1);
    g.text("golden set: 200 cases", 180, 40, { size: 11, color: pal.muted });
  },
};

const monitoring: Scene = {
  title: "Production monitoring: drift and hallucination",
  caption: "The line is a rolling groundedness score from sampled production traffic. Quality is steady, then a data change pushes it down. The alert fires when the recent average drops under the floor. Raise the drift to see it fire sooner.",
  controls: [{ id: "d", kind: "range", label: "Drift strength", min: 0.05, max: 0.4, step: 0.05, initial: 0.2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const d = g.v.d;
    const floor = 0.82;
    const T0 = Math.floor(g.t * 8);
    const val = (T: number) => {
      const c = ((T % 480) + 480) % 480;
      const drift = d * g.clamp((c - 200) / 120);
      return 0.92 - drift + (g.rnd(T * 1.37 + 5) - 0.5) * 0.04;
    };
    const n = 64;
    const x0 = 24;
    const sx = 432 / (n - 1);
    const yOf = (v: number) => 210 - ((v - 0.5) / 0.5) * 150;
    g.line(x0, yOf(floor), 456, yOf(floor), pal.bad, 0.7, 1.2);
    g.text(`floor ${floor}`, 456, yOf(floor) + 12, { size: 10, color: pal.bad, align: "right" });
    let prev: [number, number] | null = null;
    let recent = 0;
    for (let j = 0; j < n; j++) {
      const T = T0 - (n - 1 - j);
      const v = val(T);
      const x = x0 + j * sx;
      const y = yOf(v);
      if (prev) g.line(prev[0], prev[1], x, y, pal.blue, 1, 1.8);
      prev = [x, y];
      if (j >= n - 8) recent += v / 8;
    }
    g.glow(prev![0], prev![1], 14, pal.blue, 0.4);
    const alert = recent < floor;
    g.orb(alert ? "searching" : "breathing", 40, 40, 26, pal.paper, 1);
    chip(g, 240, 252, alert ? "ALERT: groundedness below floor" : "healthy", alert ? pal.bad : pal.ok, 12);
    g.text("rolling 8-point average vs floor", 240, 280, { size: 10, color: pal.muted });
  },
};

const abTest: Scene = {
  title: "A/B testing an LLM feature",
  caption: "Variant B really is 6 points better, but with few users the error bars overlap and the result is noise. Add traffic and the whiskers shrink until they separate. Stopping early is how teams ship a coin flip.",
  controls: [{ id: "n", kind: "range", label: "Users per arm 10^", min: 1.5, max: 4.5, step: 0.25, initial: 2.5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = 10 ** g.v.n;
    const pa = 0.6;
    const pb = 0.66;
    const sea = Math.sqrt((pa * (1 - pa)) / n);
    const seb = Math.sqrt((pb * (1 - pb)) / n);
    const oa = pa + (g.rnd(11.3) - 0.5) * sea * 2;
    const ob = pb + (g.rnd(23.1) - 0.5) * seb * 2;
    const xOf = (v: number) => 40 + ((v - 0.45) / 0.3) * 400;
    g.line(40, 190, 440, 190, pal.line, 1, 1.2);
    [0.5, 0.6, 0.7].forEach((v) => {
      g.line(xOf(v), 186, xOf(v), 194, pal.line, 1, 1.2);
      g.text(`${Math.round(v * 100)}%`, xOf(v), 208, { size: 10, color: pal.muted });
    });
    [[oa, sea, 100, pal.blue, "A"], [ob, seb, 150, pal.accent, "B"]].forEach(([o, se, y, col, nm]) => {
      const lo = xOf((o as number) - 1.96 * (se as number));
      const hi = xOf((o as number) + 1.96 * (se as number));
      g.line(lo, y as number, hi, y as number, col as string, 0.9, 2.5);
      g.line(lo, (y as number) - 6, lo, (y as number) + 6, col as string, 0.9, 2);
      g.line(hi, (y as number) - 6, hi, (y as number) + 6, col as string, 0.9, 2);
      g.dot(xOf(o as number), y as number, 6, col as string);
      g.text(nm as string, 22, y as number, { size: 13, color: col as string });
    });
    const sig = Math.abs(ob - oa) > 1.96 * Math.sqrt(sea * sea + seb * seb);
    for (let k = 0; k < 30; k++) g.dot(60 + g.rnd(k * 2.1) * 360, 40 + g.rnd(k * 3.7) * 30, 2, k % 2 ? pal.blue : pal.accent, Math.min(1, n / 3000 + 0.2));
    g.text(`${Math.round(n).toLocaleString("en-US")} users per arm`, 240, 232, { size: 12, color: pal.paper });
    chip(g, 240, 262, sig ? "difference is real" : "cannot tell A from B yet", sig ? pal.ok : pal.bad, 12);
  },
};

export const SCENES: Record<string, Scene> = {
  [`${P}/agents-and-tool-use/agent-loops-and-tool-use`]: agentLoop,
  [`${P}/agents-and-tool-use/multi-agent-orchestration`]: orchestration,
  [`${P}/agents-and-tool-use/agent-memory-architectures`]: memory,
  [`${P}/agents-and-tool-use/tool-schema-design-and-argument-validation`]: toolSchema,
  [`${P}/agents-and-tool-use/planning-strategies-react-tot-plan-and-execute`]: planning,
  [`${P}/agents-and-tool-use/agent-to-agent-and-tool-protocols`]: protocols,
  [`${P}/agents-and-tool-use/failure-recovery-and-self-correction-loops`]: selfCorrect,
  [`${P}/agents-and-tool-use/human-in-the-loop-and-approval-gates`]: hitl,
  [`${P}/agents-and-tool-use/model-context-protocol`]: mcp,
  [`${P}/evaluation-and-observability/evaluating-llm-applications`]: evalApps,
  [`${P}/evaluation-and-observability/tracing-and-debugging-multi-step-llm-pipelines`]: tracing,
  [`${P}/evaluation-and-observability/human-feedback-and-rlhf-basics`]: feedback,
  [`${P}/evaluation-and-observability/llm-as-judge-design-calibration-and-bias-pitfalls`]: judge,
  [`${P}/evaluation-and-observability/golden-datasets-and-regression-testing-for-prompts`]: golden,
  [`${P}/evaluation-and-observability/production-monitoring-drift-and-hallucination-tracking`]: monitoring,
  [`${P}/evaluation-and-observability/ab-testing-and-online-evaluation-for-llm-features`]: abTest,
};
