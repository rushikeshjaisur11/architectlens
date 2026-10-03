import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-system-design";
const F = `${P}/foundations-and-methodology`;
const K = `${P}/knowledge-and-search-products`;
const A = `${P}/assistants-and-agents`;
const E = `${P}/enterprise-and-multi-tenant-ai`;

const nineSteps: Scene = {
  title: "The nine questions, in order",
  caption: "Each step produces a decision that constrains the next. The marker walks the sequence from problem and value through data, approach, architecture, evaluation, safety, operations and evolution. Skipping ahead to architecture is the classic failure.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const steps = ["problem + value", "requirements", "data", "approach", "architecture", "evaluation", "safety + security", "operations", "evolution"];
    const cur = Math.floor(g.loop(13.5) * 9);
    steps.forEach((s, k) => {
      const x = 90 + (k % 3) * 150;
      const y = 50 + Math.floor(k / 3) * 56;
      const on = k === cur;
      const done = k < cur;
      g.rect(x - 64, y - 20, 128, 40, on ? pal.accent : done ? pal.ok : pal.line, on ? 0.3 : done ? 0.15 : 0.06, 8);
      g.frame(x - 64, y - 20, 128, 40, on ? pal.accent : done ? pal.ok : pal.line, on ? 1 : 0.5, 8, on ? 2 : 1);
      g.text(`${k + 1}. ${s}`, x, y, { size: 10, color: on || done ? pal.paper : pal.muted });
    });
    g.orb("shaping", 456, 36, 22, pal.paper, 1);
    g.text(["who is it for and what is the outcome", "quality, latency, cost, risk, scale", "what exists, who owns it, who may see it", "rules, prompts, RAG, workflows, agents, tuning", "components and data flows", "golden set, metrics, gates", "threats, controls, approvals, audit", "tracing, SLOs, rollout, incident response", "feedback loops and drift"][cur], 240, 226, { size: 12, color: pal.paper });
  },
};

const complexityLadder: Scene = {
  title: "Climb the ladder only as far as needed",
  caption: "Stop at the first rung that meets the requirement. Each rung adds cost, risk and operational burden. Slide the difficulty of the task and watch where the right approach lands and what you pay for it.",
  controls: [{ id: "n", kind: "range", label: "Task difficulty", min: 1, max: 7, step: 1, initial: 3 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const rungs = ["rules or existing code", "prompted model", "prompt + retrieval", "workflow of calls and tools", "agent with tools", "fine-tuned model", "own trained model"];
    rungs.forEach((r, k) => {
      const y = 50 + (6 - k) * 26;
      const on = k + 1 === n;
      g.rect(30, y - 11, 240, 22, on ? pal.ok : k + 1 < n ? pal.line : pal.line, on ? 0.3 : 0.08, 6);
      g.frame(30, y - 11, 240, 22, on ? pal.ok : pal.line, on ? 1 : 0.4, 6, on ? 2 : 1);
      g.text(`${k + 1}. ${r}`, 40, y, { size: 10, align: "left", color: on ? pal.paper : pal.muted });
    });
    [["cost", n / 7, pal.accent], ["risk", n / 7, pal.bad], ["ops burden", n / 7, pal.violet]].forEach(([nm, v, col], k) => {
      const y = 70 + k * 42;
      g.text(nm as string, 290, y - 12, { size: 10, align: "left" });
      bar(g, 290, y - 4, 160, 8, v as number, col as string);
    });
    node(g, "gpu", 456, 230, { size: 20 });
  },
};

const diagnoseGap: Scene = {
  title: "Diagnose what is actually missing",
  caption: "The symptom points to the cure. Wrong format needs better prompting. Missing or fresh knowledge needs retrieval. A consistent style at high volume points to fine-tuning. An unknown path needs an agent. Pick a symptom.",
  controls: [{ id: "s", kind: "choice", label: "Symptom", options: ["wrong format or tone", "invents our policies", "answers are out of date", "prompts too long, cost high", "path not known in advance"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const order = ["prompting + examples", "retrieval (RAG)", "workflow", "agent", "fine-tuning"];
    g.orb("searching", 60, 110, 44, pal.paper, 1);
    order.forEach((nm, k) => {
      const y = 40 + k * 38;
      const target = (s === 0 && k === 0) || (s === 1 && k === 1) || (s === 2 && k === 1) || (s === 3 && k === 4) || (s === 4 && k === 3);
      g.rect(150, y - 14, 220, 28, target ? pal.ok : pal.line, target ? 0.3 : 0.07, 7);
      g.frame(150, y - 14, 220, 28, target ? pal.ok : pal.line, target ? 1 : 0.4, 7, target ? 2 : 1);
      g.text(nm, 164, y, { size: 11, align: "left", color: target ? pal.paper : pal.muted });
      if (target) g.packet(86, 110, 148, y, g.loop(1.4), pal.ok, 3);
    });
    g.text(["format and tone are cheap to ask for", "missing knowledge: retrieve it, do not bake it in", "fresh facts must come from live data", "move instructions into weights at high volume", "only an agent can choose its own steps"][s], 240, 246, { size: 11, color: pal.paper });
  },
};

const staleness: Scene = {
  title: "Why fine-tuning is the wrong place for facts",
  caption: "A policy document changes on Monday. A retrieval system reads the new text at the next query. A fine-tuned model still answers with the old policy until someone retrains and redeploys it, and it cannot cite where the fact came from.",
  controls: [{ id: "m", kind: "choice", label: "Where the fact lives", options: ["in the model weights", "in a retrieved document"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const rag = g.v.m === 1;
    const t = (g.t * 0.7) % 10;
    const changed = t > 3;
    node(g, "doc", 70, 90, { label: changed ? "policy v2" : "policy v1", size: 44, color: changed ? pal.accent : pal.blue });
    if (rag) {
      node(g, "db", 210, 90, { label: "index", size: 38, color: pal.blue });
      if (changed) g.packet(94, 90, 188, 90, g.clamp((t - 3) / 0.8), pal.accent, 3);
    } else {
      node(g, "gpu", 210, 90, { label: "weights", size: 38, color: pal.blue });
      g.text("retrain + redeploy: weeks", 210, 140, { size: 9, color: pal.muted });
    }
    g.orb("composing", 360, 90, 44, pal.paper, 1);
    const fresh = rag ? t > 4 : false;
    chip(g, 240, 190, changed ? (fresh ? "answer uses policy v2, with a citation ✓" : "answer still uses policy v1 ✕") : "answer uses policy v1", changed && !fresh ? pal.bad : pal.ok, 11);
    g.text(rag ? "update the document, not the model" : "knowledge in weights goes stale and cannot be cited", 240, 236, { size: 11, color: pal.muted });
  },
};

const tokenCost: Scene = {
  title: "Building the cost of one question",
  caption: "Add up what goes into the prompt: system text, retrieved chunks, history and the question. Output tokens cost more per token. Change the number of chunks and turns and watch the cost per call move.",
  controls: [
    { id: "c", kind: "range", label: "Retrieved chunks", min: 0, max: 12, step: 1, initial: 5 },
    { id: "h", kind: "range", label: "History turns", min: 0, max: 10, step: 1, initial: 4 },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const parts: [string, number, string][] = [["system", 600, pal.blue], ["chunks", g.v.c * 400, pal.violet], ["history", g.v.h * 125, pal.teal], ["question", 50, pal.accent]];
    const input = parts.reduce((a, p) => a + p[1], 0);
    const out = 300;
    const cents = (input / 1e6) * 300 + (out / 1e6) * 1500;
    let x = 30;
    const sc = 420 / 6000;
    parts.forEach(([nm, v, col]) => {
      const w = v * sc;
      g.rect(x, 70, Math.max(1, w - 1), 32, col, 0.7, 3);
      if (w > 44) g.text(nm, x + w / 2, 86, { size: 9, color: pal.ink });
      x += w;
    });
    g.text("input tokens in the prompt", 30, 60, { size: 9, align: "left", color: pal.muted });
    g.text(`${fmt(input)} input + ${out} output tokens`, 240, 140, { size: 13, color: pal.paper });
    g.text(`${cents.toFixed(2)} cents per call`, 240, 176, { size: 20, color: cents > 2 ? pal.bad : pal.ok, bold: true });
    g.text("illustrative prices: $3 and $15 per million tokens", 240, 212, { size: 9, color: pal.muted });
    node(g, "gpu", 456, 40, { size: 22 });
  },
};

const memoryFit: Scene = {
  title: "Does the model fit, with room for the cache?",
  caption: "The GPU holds the weights plus a KV cache for every request in flight. A longer context and more concurrent requests grow the cache until it no longer fits. Memory, not compute, is often what caps concurrency.",
  controls: [
    { id: "c", kind: "range", label: "Concurrent requests", min: 4, max: 96, step: 4, initial: 32 },
    { id: "k", kind: "range", label: "Context tokens", min: 1000, max: 16000, step: 1000, initial: 4000 },
  ],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const cap = 160;
    const weights = 70;
    const kv = (g.v.c * g.v.k * 0.0004) / 1;
    const total = weights + kv;
    const fits = total <= cap;
    const sc = 420 / 200;
    g.frame(30, 80, cap * sc, 40, pal.paper, 0.7, 6, 1.5);
    g.rect(30, 82, weights * sc, 36, pal.blue, 0.7, 4);
    g.text("weights", 30 + (weights * sc) / 2, 100, { size: 10, color: pal.ink });
    g.rect(30 + weights * sc, 82, Math.min(kv, cap - weights) * sc, 36, fits ? pal.accent : pal.bad, 0.7, 4);
    if (kv > 24) g.text("KV cache", 30 + weights * sc + (Math.min(kv, cap - weights) * sc) / 2, 100, { size: 10, color: pal.ink });
    if (!fits) g.rect(30 + cap * sc, 82, (total - cap) * sc, 36, pal.bad, 0.5, 4);
    node(g, "gpu", 456, 40, { label: "2 GPUs, 160 GB", size: 24 });
    g.text(`${Math.round(total)} GB needed of ${cap} GB`, 240, 160, { size: 14, color: fits ? pal.ok : pal.bad, bold: true });
    g.text(fits ? "fits: this concurrency is possible" : "out of memory: fewer requests, shorter context or a smaller cache", 240, 200, { size: 11, color: fits ? pal.muted : pal.bad });
  },
};

const layers: Scene = {
  title: "The layers of an enterprise AI platform",
  caption: "Experience on top, then orchestration, shared platform services, knowledge, models and the foundation, with governance across all of them. Pick a layer to see what lives there and which teams usually own it.",
  controls: [{ id: "l", kind: "choice", label: "Layer", options: ["experience", "orchestration", "platform services", "knowledge", "models", "foundation"], initial: 2 }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const l = g.v.l;
    const names = ["experience", "orchestration", "platform services", "knowledge", "models", "foundation"];
    const items = [["web, chat, APIs, voice", "product teams"], ["prompts, workflows, agents", "product teams"], ["gateway, guardrails, evaluation, observability", "platform team"], ["connectors, indexes, caches", "data platform"], ["providers, self-hosted, routing", "platform + vendors"], ["identity, network, compute, storage", "infrastructure"]];
    names.forEach((nm, k) => {
      const y = 36 + k * 34;
      const on = k === l;
      g.rect(30, y - 14, 250, 28, on ? pal.accent : pal.line, on ? 0.3 : 0.07, 7);
      g.frame(30, y - 14, 250, 28, on ? pal.accent : pal.line, on ? 1 : 0.4, 7, on ? 2 : 1);
      g.text(nm, 44, y, { size: 11, align: "left", color: on ? pal.paper : pal.muted });
    });
    g.rect(292, 26, 12, 6 * 34 - 8, pal.violet, 0.25, 4);
    g.text("governance + security", 298, 215, { size: 8, color: pal.violet });
    g.text(items[l][0], 330, 100, { size: 11, align: "left", color: pal.paper });
    g.text(`owned by: ${items[l][1]}`, 330, 130, { size: 10, align: "left", color: pal.muted });
    node(g, ["client", "server", "lb", "db", "gpu", "cloud"][l] as "client", 400, 180, { size: 34 });
  },
};

const paved: Scene = {
  title: "Paved road versus every team on its own",
  caption: "Without a platform every team builds its own gateway, guardrails and logging, so controls are uneven and spend is invisible. A shared paved road gives them once, with an escape hatch for the rare special case.",
  controls: [{ id: "p", kind: "toggle", label: "Shared platform", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const shared = g.v.p === 1;
    for (let k = 0; k < 4; k++) {
      const y = 44 + k * 44;
      node(g, "server", 60, y, { label: "", size: 24 });
      g.text(`team ${k + 1}`, 60, y + 24, { size: 8, color: pal.muted });
      if (shared) g.packet(80, y, 170, 110, (g.t * 0.7 + k * 0.2) % 1, pal.accent, 2.4);
      else {
        node(g, "lb", 150, y, { size: 20, color: pal.bad });
        node(g, "shield", 200, y, { size: 20, color: pal.bad });
        g.packet(80, y, 330, y, (g.t * 0.7 + k * 0.2) % 1, pal.accent, 2.2);
      }
    }
    if (shared) {
      g.rect(150, 40, 70, 140, pal.accent, 0.12, 10);
      g.frame(150, 40, 70, 140, pal.accent, 1, 10, 1.4);
      g.text("gateway", 185, 70, { size: 9, color: pal.paper });
      g.text("guardrails", 185, 110, { size: 9, color: pal.paper });
      g.text("evaluation", 185, 140, { size: 9, color: pal.paper });
      g.packet(222, 110, 330, 110, g.loop(1.4), pal.ok, 3);
    }
    node(g, "cloud", 400, 110, { label: "models", size: 40 });
    g.text(shared ? "controls built once, spend attributed ✓" : "four gateways, four sets of gaps ✕", 240, 236, { size: 12, color: shared ? pal.ok : pal.bad });
  },
};

const sourcingSpectrum: Scene = {
  title: "The sourcing spectrum",
  caption: "From buying a finished product to training your own model, control rises and so does the burden of running it. Pick a level and compare how fast you ship, how much control you keep and how much you must operate yourself.",
  controls: [{ id: "s", kind: "choice", label: "Approach", options: ["buy a product", "model API", "managed platform", "self-host open model", "train your own"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const speed = [0.95, 0.85, 0.65, 0.4, 0.15][s];
    const control = [0.1, 0.3, 0.5, 0.8, 1][s];
    const ops = [0.05, 0.15, 0.4, 0.8, 1][s];
    [["speed to ship", speed, pal.ok], ["control of data and behaviour", control, pal.blue], ["operational burden", ops, pal.bad]].forEach(([nm, v, col], k) => {
      const y = 60 + k * 44;
      g.text(nm as string, 30, y - 12, { size: 10, align: "left" });
      bar(g, 30, y - 4, 300, 10, v as number, col as string);
    });
    node(g, ["doc", "cloud", "cloud", "server", "gpu"][s] as "doc", 410, 100, { size: 44, color: pal.accent });
    g.text(["a vendor product: fastest, least control", "pay per token, data leaves under contract", "inside your cloud tenancy", "your GPUs, your data boundary, your on-call", "maximum control, highest cost and expertise"][s], 240, 230, { size: 11, color: pal.paper });
  },
};

const breakEvenVolume: Scene = {
  title: "When self-hosting beats the API",
  caption: "API cost grows with every token. Self-hosting has a large fixed cost for GPUs and people, then a low cost per extra token while the cluster stays busy. The lines cross at a volume that depends on utilisation. Slide the volume.",
  controls: [{ id: "v", kind: "range", label: "Tokens per day (millions)", min: 10, max: 2000, step: 10, initial: 400 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const v = g.v.v;
    const api = (m: number) => m * 4;
    const own = (m: number) => 3000 + m * 0.6;
    const x = (m: number) => 40 + (m / 2000) * 400;
    const y = (c: number) => 195 - (c / 8000) * 130;
    let pa: [number, number] | null = null;
    let pb: [number, number] | null = null;
    for (let m = 0; m <= 2000; m += 50) {
      if (pa && pb) {
        g.line(pa[0], pa[1], x(m), y(api(m)), pal.blue, 1, 2);
        g.line(pb[0], pb[1], x(m), y(own(m)), pal.accent, 1, 2);
      }
      pa = [x(m), y(api(m))];
      pb = [x(m), y(own(m))];
    }
    g.line(x(v), 50, x(v), 196, pal.paper, 0.5, 1.2);
    g.text("API", 380, 80, { size: 10, color: pal.blue });
    g.text("self-hosted", 120, 120, { size: 10, color: pal.accent });
    const cheaper = own(v) < api(v);
    g.text(cheaper ? "self-hosting is cheaper at this volume" : "the API is cheaper at this volume", 240, 226, { size: 12, color: cheaper ? pal.ok : pal.accent });
    g.text("monthly cost vs volume (illustrative)", 240, 248, { size: 9, color: pal.muted });
  },
};

const sloDashboard: Scene = {
  title: "One dashboard, four kinds of objective",
  caption: "Availability, latency, quality and cost each have a target. Switch on a prompt change and quality falls under its objective while latency and availability look fine. That is why quality needs an SLO of its own.",
  controls: [{ id: "c", kind: "toggle", label: "After a prompt change" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const chg = g.v.c === 1;
    const rows: [string, number, number, string][] = [["availability", 99.7, 99.5, "%"], ["time to first token p95", 1.3, 1.5, "s"], ["faithfulness (sampled)", chg ? 0.86 : 0.93, 0.9, ""], ["cost per resolved ticket", chg ? 0.14 : 0.11, 0.15, "$"]];
    rows.forEach(([nm, v, t, u], k) => {
      const y = 50 + k * 44;
      const lowerBetter = k === 1 || k === 3;
      const ok = lowerBetter ? v <= t : v >= t;
      g.rect(30, y - 16, 420, 32, ok ? pal.ok : pal.bad, 0.12, 8);
      g.frame(30, y - 16, 420, 32, ok ? pal.ok : pal.bad, 1, 8, 1.2);
      g.text(nm, 42, y, { size: 11, align: "left", color: pal.paper });
      g.text(`${v}${u}  vs target ${t}${u}`, 320, y, { size: 10, color: ok ? pal.ok : pal.bad });
      g.text(ok ? "✓" : "✕", 434, y, { size: 14, color: ok ? pal.ok : pal.bad });
    });
    g.text(chg ? "quality is out of budget while everything else looks green" : "all objectives met", 240, 238, { size: 12, color: chg ? pal.bad : pal.ok });
  },
};

const modelTradeoff: Scene = {
  title: "Quality, latency and cost trade against each other",
  caption: "A larger model raises quality and also latency and cost. Pick the model and check it against all three targets at once. The right choice is the cheapest one that still passes every objective.",
  controls: [{ id: "m", kind: "choice", label: "Model", options: ["small", "medium", "large"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const q = [0.84, 0.92, 0.95][m];
    const lat = [0.6, 1.2, 2.6][m];
    const cost = [0.03, 0.11, 0.42][m];
    const rows: [string, number, number, boolean, number][] = [["quality", q, 0.9, true, 1], ["time to first token (s)", lat, 1.5, false, 3], ["cost per task ($)", cost, 0.15, false, 0.5]];
    rows.forEach(([nm, v, t, hi, mx], k) => {
      const y = 60 + k * 50;
      const ok = hi ? v >= t : v <= t;
      g.text(nm, 30, y - 12, { size: 10, align: "left" });
      bar(g, 30, y - 4, 300, 10, v / mx, ok ? pal.ok : pal.bad);
      g.line(30 + (t / mx) * 300, y - 10, 30 + (t / mx) * 300, y + 8, pal.accent, 0.9, 1.6);
      g.text(ok ? "meets target" : "misses target", 350, y, { size: 10, align: "left", color: ok ? pal.ok : pal.bad });
    });
    g.orb(["working", "solving", "solving"][m] as "working", 440, 40, 22 + m * 8, pal.paper, 1);
    const all = rows.every(([, v, t, hi]) => (hi ? v >= t : v <= t));
    g.text(all ? "passes every objective" : "fails at least one objective", 240, 236, { size: 12, color: all ? pal.ok : pal.bad });
  },
};

const entryPoints: Scene = {
  title: "Where untrusted data enters the prompt",
  caption: "The threat model starts with a map of trust boundaries. Pick an entry point: user input, retrieved documents, tool output or an uploaded file. Each one carries instructions the model may follow, and each needs its own control before it reaches the prompt.",
  controls: [{ id: "e", kind: "choice", label: "Entry point", options: ["user input", "retrieved documents", "tool output", "uploaded file"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const e = g.v.e;
    const srcs: [string, "user" | "db" | "cloud" | "doc"][] = [["user input", "user"], ["retrieved docs", "db"], ["tool output", "cloud"], ["uploaded file", "doc"]];
    srcs.forEach(([nm, kind], k) => {
      const y = 40 + k * 46;
      const on = k === e;
      node(g, kind, 50, y, { label: "", size: 24, color: on ? pal.bad : pal.muted, a: on ? 1 : 0.4 });
      g.text(nm, 90, y, { size: 10, align: "left", color: on ? pal.paper : pal.muted });
      if (on) g.packet(74, y, 250, 110, g.loop(1.4), pal.bad, 3);
    });
    g.rect(200, 20, 8, 180, pal.accent, 0.5, 3);
    g.text("trust boundary", 204, 212, { size: 8, color: pal.accent });
    g.orb("working", 300, 110, 50, pal.paper, 1);
    const ctl = ["rate limits, injection classifier", "permission filter, source trust, sanitise", "schema validation, treat as data", "malware scan, strip hidden text"][e];
    chip(g, 380, 60, ctl, pal.ok, 8);
    g.text("never rely on the model to refuse by itself", 240, 242, { size: 10, color: pal.muted });
  },
};

const depthLayers: Scene = {
  title: "Defence in depth against an injected instruction",
  caption: "An attack has to get past every layer. Turn layers off one at a time and see how far it travels. With only the prompt as a defence the attack reaches the tool; with deterministic checks at the tool boundary it stops there even if the model is fooled.",
  controls: [
    { id: "a", kind: "toggle", label: "Input classifier", initial: true },
    { id: "b", kind: "toggle", label: "Least-privilege tools", initial: true },
    { id: "c", kind: "toggle", label: "Approval for risky actions", initial: true },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const layers = [g.v.a === 1, g.v.b === 1, g.v.c === 1];
    const names = ["input classifier", "least privilege", "human approval"];
    const stopAt = layers.findIndex((on) => on);
    const reach = stopAt < 0 ? 3 : stopAt;
    layers.forEach((on, k) => {
      const x = 130 + k * 95;
      g.rect(x, 50, 10, 110, on ? pal.ok : pal.line, on ? 0.6 : 0.15, 3);
      g.text(names[k], x + 5, 176, { size: 8, color: on ? pal.ok : pal.muted });
    });
    const f = g.loop(3) * 1.6;
    const x = Math.min(40 + f * 400, reach < 3 ? 130 + reach * 95 - 6 : 440);
    g.dot(x, 105, 5, pal.bad);
    g.glow(x, 105, 14, pal.bad, 0.4);
    node(g, "cloud", 40, 105, { size: 22, color: pal.bad });
    node(g, "db", 456, 105, { size: 26, color: reach >= 3 ? pal.bad : pal.ok });
    g.text(reach >= 3 ? "no layer stopped it: data leaked ✕" : `stopped by ${names[reach]} ✓`, 240, 222, { size: 12, color: reach >= 3 ? pal.bad : pal.ok });
  },
};

const boundarySpectrum: Scene = {
  title: "How private does the deployment need to be?",
  caption: "From a hosted API to a fully air-gapped site, data exposure falls and so does convenience, while the operating burden rises. Choose the level the data classification actually requires, not the highest one.",
  controls: [{ id: "b", kind: "choice", label: "Boundary", options: ["hosted API", "VPC / private link", "on-premises", "air-gapped"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const b = g.v.b;
    const exposure = [0.9, 0.5, 0.15, 0.02][b];
    const ops = [0.1, 0.3, 0.8, 1][b];
    const upd = [1, 0.9, 0.6, 0.2][b];
    g.rect(30, 40, 200, 120, pal.line, 0.08, 10);
    g.frame(30, 40, 200, 120, b >= 1 ? pal.ok : pal.line, 1, 10, 1.4);
    g.text(["", "your cloud", "your data centre", "no outside network"][b], 130, 34, { size: 9, color: pal.muted });
    node(g, "server", 80, 100, { label: "app", size: 32 });
    node(g, b === 0 ? "cloud" : "gpu", b === 0 ? 330 : 170, 100, { label: "model", size: 34, color: pal.accent });
    if (b === 0) g.packet(104, 100, 304, 100, g.loop(1.6), pal.bad, 3);
    else g.packet(104, 100, 148, 100, g.loop(1.2), pal.ok, 2.6);
    [["data exposure", exposure, pal.bad], ["operating burden", ops, pal.accent], ["ease of model updates", upd, pal.ok]].forEach(([nm, v, col], k) => {
      const y = 182 + k * 26;
      g.text(nm as string, 30, y, { size: 9, align: "left" });
      bar(g, 160, y - 4, 220, 8, v as number, col as string);
    });
  },
};

const modelImport: Scene = {
  title: "Importing a model into an air-gapped site",
  caption: "New model versions arrive on a controlled path: scan the artifact, verify its signature, run your evaluation suite, register it and canary it. Skipping the evaluation step lets a regression or a poisoned model go straight to users.",
  controls: [{ id: "e", kind: "toggle", label: "Run the evaluation suite", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ev = g.v.e === 1;
    const steps: [string, "cloud" | "shield" | "gpu" | "db" | "server"][] = [["outside source", "cloud"], ["scan + verify", "shield"], ["evaluate", "gpu"], ["registry", "db"], ["canary", "server"]];
    const f = g.loop(7) * 5;
    steps.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const skip = !ev && k === 2;
      node(g, kind, x, 100, { label: nm, size: 34, color: skip ? pal.muted : k <= f ? pal.paper : pal.muted, a: skip ? 0.25 : k <= f ? 1 : 0.5 });
      if (k < 4) g.arrow(x + 24, 100, x + 74, 100, pal.line, 0.8);
    });
    const px = 44 + Math.min(4, f) * 98;
    g.dot(px, 100, 5, ev ? pal.accent : pal.bad);
    g.glow(px, 100, 14, ev ? pal.accent : pal.bad, 0.4);
    g.text(ev ? "a regression is caught before any user sees it ✓" : "unevaluated model reaches production ✕", 240, 200, { size: 12, color: ev ? pal.ok : pal.bad });
  },
};

const validationCycle: Scene = {
  title: "The model risk lifecycle",
  caption: "Build, validate independently, approve with conditions, monitor in production and control changes. The cycle repeats: a material change sends the system back through validation in proportion to its risk.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const pts: [number, number, string, "doc" | "shield" | "lock" | "server" | "db"][] = [[240, 40, "build + document", "doc"], [380, 100, "independent validation", "shield"], [330, 190, "approve with conditions", "lock"], [150, 190, "monitor in production", "server"], [100, 100, "change control", "db"]];
    pts.forEach(([x, y], k) => {
      const [nx, ny] = pts[(k + 1) % 5];
      g.line(x, y, nx, ny, pal.line, 0.7, 1.4);
      g.packet(x, y, nx, ny, (g.t * 0.3 + k * 0.2) % 1, pal.accent, 2.6);
    });
    pts.forEach(([x, y, nm, kind]) => node(g, kind, x, y, { label: nm, size: 32 }));
    g.orb("shaping", 240, 120, 40, pal.paper, 1);
    g.text("evidence is collected at every stage, not assembled at audit time", 240, 244, { size: 11, color: pal.muted });
  },
};

const changeLevel: Scene = {
  title: "How much re-validation does a change need?",
  caption: "Not every change is equal. A typo fix passes the automated regression gate. A new model version or data source is material and needs validation in proportion to the risk tier. Pick a change and a tier.",
  controls: [
    { id: "c", kind: "choice", label: "Change", options: ["fix a typo in a prompt", "new prompt logic", "new model version", "new data source"], initial: 2 },
    { id: "t", kind: "choice", label: "Risk tier", options: ["low", "medium", "high"], initial: 2 },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const c = g.v.c;
    const t = g.v.t;
    const base = [0, 1, 2, 2][c];
    const lvl = Math.min(3, base + t);
    const names = ["automated regression gate", "gate + owner review", "partial independent validation", "full independent validation + committee"];
    names.forEach((n, k) => {
      const y = 48 + k * 40;
      const on = k === lvl;
      g.rect(40, y - 14, 300, 28, on ? [pal.ok, pal.accent, pal.accent, pal.bad][k] : pal.line, on ? 0.3 : 0.07, 7);
      g.frame(40, y - 14, 300, 28, on ? [pal.ok, pal.accent, pal.accent, pal.bad][k] : pal.line, on ? 1 : 0.4, 7, on ? 2 : 1);
      g.text(n, 54, y, { size: 11, align: "left", color: on ? pal.paper : pal.muted });
    });
    node(g, "shield", 410, 100, { size: 38, color: [pal.ok, pal.accent, pal.accent, pal.bad][lvl] });
    g.text("provider model updates count as changes too: pin versions", 240, 236, { size: 10, color: pal.muted });
  },
};

const connectorFanIn: Scene = {
  title: "Many connectors, one normalised index",
  caption: "Each source has its own API, permissions and change feed. Connectors translate them into one document model with ACLs, and the index serves one search over everything. More sources means more connectors to keep healthy.",
  controls: [{ id: "n", kind: "range", label: "Connected systems", min: 2, max: 8, step: 1, initial: 5 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const kinds: ("doc" | "cloud" | "db" | "user" | "client" | "server" | "queue" | "cache")[] = ["doc", "cloud", "db", "user", "client", "server", "queue", "cache"];
    const names = ["wiki", "drive", "mail", "chat", "tickets", "CRM", "code", "HR"];
    for (let k = 0; k < n; k++) {
      const y = 36 + k * (180 / Math.max(1, n - 1));
      node(g, kinds[k], 50, y, { size: 22, color: pal.blue });
      g.text(names[k], 84, y, { size: 8, align: "left", color: pal.muted });
      g.packet(70, y, 230, 110, (g.t * 0.7 + k * 0.12) % 1, pal.accent, 2);
    }
    node(g, "lb", 250, 110, { label: "normalise + ACLs", size: 34 });
    node(g, "db", 400, 110, { label: "one index", size: 44, color: pal.ok });
    g.packet(274, 110, 376, 110, g.loop(1.4), pal.ok, 3);
    g.text(`${n} connectors to monitor for sync lag and failures`, 240, 246, { size: 11, color: pal.muted });
  },
};

const permResolve: Scene = {
  title: "Resolving who may see a result",
  caption: "Alice searches. Each candidate document carries an access list of users and groups. Her identity plus her current group memberships decide what is returned. After she is removed from a group, results must disappear quickly, so propagation speed matters.",
  controls: [{ id: "f", kind: "toggle", label: "Group change propagates in seconds", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const fast = g.v.f === 1;
    const t = (g.t * 0.8) % 10;
    const removed = t > 3;
    const synced = fast ? t > 4 : t > 8;
    node(g, "user", 50, 100, { label: "Alice", size: 36 });
    chip(g, 50, 150, removed ? "removed from Legal" : "member of Legal", removed ? pal.accent : pal.ok, 8);
    node(g, "db", 220, 100, { label: "index with ACLs", size: 42, color: pal.blue });
    const visible = !(removed && synced);
    node(g, "doc", 400, 100, { label: "merger memo (Legal only)", size: 40, color: visible ? (removed ? pal.bad : pal.ok) : pal.muted, a: visible ? 1 : 0.25 });
    g.packet(76, 100, 194, 100, g.loop(1.5), pal.accent, 3);
    if (visible) g.packet(246, 100, 372, 100, g.loop(1.5, 0.4), removed ? pal.bad : pal.ok, 3);
    g.text(!removed ? "Alice may read it" : synced ? "access removed everywhere ✓" : "stale ACL: still visible after removal ✕", 240, 214, { size: 12, color: !removed || synced ? pal.ok : pal.bad });
    g.text("on doubt, deny", 240, 240, { size: 10, color: pal.muted });
  },
};

const straightThrough: Scene = {
  title: "Confidence thresholds and straight-through processing",
  caption: "Each extracted document gets a calibrated confidence. Above the threshold it posts automatically, below it goes to a person. Raise the threshold and fewer errors slip through, but more documents need review.",
  controls: [{ id: "t", kind: "range", label: "Auto-accept threshold", min: 0.5, max: 0.99, step: 0.01, initial: 0.9 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const th = g.v.t;
    let auto = 0;
    let errors = 0;
    for (let k = 0; k < 60; k++) {
      const conf = 0.5 + g.rnd(k * 3.1 + 1) * 0.5;
      const wrong = g.rnd(k * 7.3 + 2) > conf;
      const isAuto = conf >= th;
      if (isAuto) {
        auto++;
        if (wrong) errors++;
      }
      g.rect(30 + (k % 20) * 21, 50 + Math.floor(k / 20) * 24, 17, 18, isAuto ? (wrong ? pal.bad : pal.ok) : pal.accent, 0.55, 3);
    }
    g.text("green: posted · red: posted but wrong · orange: sent to review", 240, 40, { size: 9, color: pal.muted });
    node(g, "user", 440, 170, { label: "reviewers", size: 24 });
    g.text(`${Math.round((auto / 60) * 100)}% straight-through, ${errors} wrong slipped through`, 240, 170, { size: 13, color: errors > 2 ? pal.bad : pal.ok });
    g.text("calibrate so 'high confidence' really means the accuracy you promise", 240, 214, { size: 10, color: pal.muted });
  },
};

const ocrCheck: Scene = {
  title: "Validation catches what OCR gets wrong",
  caption: "OCR read the invoice total as 4,280 while the line items add up to 4,230. A cross-field check notices the mismatch, lowers confidence and triggers a second look. Without checks the wrong total is posted.",
  controls: [{ id: "v", kind: "toggle", label: "Cross-field validation", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.v === 1;
    node(g, "doc", 70, 100, { label: "invoice", size: 50, color: pal.blue });
    ["line 1   1,500.00", "line 2   2,730.00", "total   4,280.00"].forEach((l, k) => g.text(l, 150, 60 + k * 26, { size: 11, align: "left", color: k === 2 ? pal.bad : pal.paper }));
    g.line(150, 112, 290, 112, pal.line, 0.8, 1.2);
    g.text("sum of lines = 4,230.00", 150, 138, { size: 10, align: "left", color: pal.ok });
    if (on) {
      node(g, "shield", 380, 90, { label: "validator", size: 34, color: pal.accent });
      g.packet(300, 90, 354, 90, g.loop(1.4), pal.accent, 3);
      chip(g, 380, 150, "mismatch: re-read the total", pal.accent, 9);
    } else {
      node(g, "db", 380, 90, { label: "ERP", size: 40, color: pal.bad });
      g.packet(300, 90, 354, 90, g.loop(1.4), pal.bad, 3);
    }
    g.text(on ? "total corrected to 4,230.00 before posting ✓" : "wrong total posted: 50.00 overpaid ✕", 240, 214, { size: 12, color: on ? pal.ok : pal.bad });
  },
};

const cancelOnDisconnect: Scene = {
  title: "Streams are long-lived connections",
  caption: "Millions of open streams make the chat tier connection-bound. When a user closes the tab the server should notice and cancel generation. Without cancellation the GPU keeps producing text nobody will read.",
  controls: [{ id: "c", kind: "toggle", label: "Cancel on disconnect", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const cancel = g.v.c === 1;
    const t = (g.t * 0.9) % 9;
    const gone = t > 3;
    node(g, "phone", 50, 100, { label: "user", size: 38, color: gone ? pal.muted : pal.paper, a: gone ? 0.4 : 1 });
    if (gone) g.text("✕ tab closed", 50, 150, { size: 10, color: pal.bad });
    node(g, "server", 200, 100, { label: "chat server", size: 38, active: true });
    node(g, "gpu", 360, 100, { label: "GPU", size: 40, active: !gone || !cancel });
    if (!gone) g.packet(224, 100, 60, 100, g.loop(0.8), pal.ok, 2.4);
    g.packet(228, 100, 336, 100, g.loop(0.8, 0.3), gone && cancel ? pal.muted : pal.accent, 2.4);
    const wasted = gone ? (cancel ? 0 : Math.round((t - 3) * 40)) : 0;
    g.text("tokens generated for nobody", 80, 196, { size: 10, align: "left" });
    bar(g, 240, 191, 180, 8, Math.min(1, wasted / 240), wasted > 0 ? pal.bad : pal.ok);
    g.text(`${wasted}`, 448, 196, { size: 11, color: pal.paper });
    g.text(gone ? (cancel ? "generation cancelled, partial text saved for resume ✓" : "the GPU keeps working for nobody ✕") : "streaming normally", 240, 236, { size: 11, color: gone && !cancel ? pal.bad : pal.paper });
  },
};

const tierAdmission: Scene = {
  title: "Overload: who waits, who is served",
  caption: "Capacity is fixed, so past a point something must give. Reserved capacity keeps paid users fast, admission control tells free users their wait, and routing simple queries to a smaller model stretches the capacity further.",
  controls: [{ id: "l", kind: "range", label: "Load % of capacity", min: 50, max: 220, step: 10, initial: 160 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const load = g.v.l;
    const paid = 40;
    const free = load - paid;
    const freeCap = 60;
    const over = Math.max(0, free - freeCap);
    const wait = over > 0 ? Math.round(over * 0.4) : 0;
    node(g, "user", 60, 70, { label: "paid", size: 30, color: pal.accent });
    node(g, "user", 60, 150, { label: "free", size: 30 });
    node(g, "queue", 190, 70, { label: "reserved", size: 34, fill: 0.3 });
    node(g, "queue", 190, 150, { label: "shared", size: 34, fill: Math.min(1, over / 80) });
    for (let k = 0; k < 3; k++) node(g, "gpu", 340, 50 + k * 50, { size: 26, active: true });
    g.packet(86, 70, 166, 70, g.loop(1.2), pal.accent, 2.6);
    g.packet(86, 150, 166, 150, g.loop(over > 0 ? 2.2 : 1.2), over > 0 ? pal.bad : pal.ok, 2.6);
    g.text("paid wait", 30, 220, { size: 10, align: "left" });
    bar(g, 110, 215, 100, 8, 0.05, pal.ok);
    g.text("free wait", 240, 220, { size: 10, align: "left" });
    bar(g, 310, 215, 100, 8, Math.min(1, wait / 40), over > 0 ? pal.bad : pal.ok);
    g.text(over > 0 ? `free users see an estimated ${wait} s wait` : "everyone served promptly", 240, 248, { size: 11, color: over > 0 ? pal.accent : pal.ok });
  },
};

const cardsFromData: Scene = {
  title: "Product cards from data, not from the model",
  caption: "The model picks which products to show, but the title, price and stock on each card come straight from the catalogue and pricing services at response time. A price written by the model can be wrong, so it is never trusted.",
  controls: [{ id: "g", kind: "choice", label: "Where the price comes from", options: ["written by the model", "pricing service, live"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const live = g.v.g === 1;
    g.orb("composing", 60, 100, 44, pal.paper, 1);
    node(g, "db", 220, 60, { label: "catalogue", size: 34, color: pal.blue });
    node(g, "cloud", 220, 150, { label: "pricing + stock", size: 34, color: live ? pal.ok : pal.muted, a: live ? 1 : 0.3 });
    g.packet(86, 90, 196, 66, g.loop(1.5), pal.accent, 2.6);
    if (live) g.packet(86, 112, 196, 148, g.loop(1.5, 0.3), pal.ok, 2.6);
    g.rect(300, 50, 150, 110, live ? pal.ok : pal.bad, 0.12, 10);
    g.frame(300, 50, 150, 110, live ? pal.ok : pal.bad, 1, 10, 1.4);
    node(g, "doc", 340, 90, { size: 36, color: pal.blue });
    g.text("trail jacket", 410, 78, { size: 10, align: "left" });
    g.text(live ? "$129.00  in stock" : "$99.00  (guessed)", 410, 100, { size: 10, align: "left", color: live ? pal.ok : pal.bad });
    g.text(live ? "price and stock are exact ✓" : "customer is quoted a price that does not exist ✕", 240, 230, { size: 12, color: live ? pal.ok : pal.bad });
  },
};

const confirmOrder: Scene = {
  title: "No order without an explicit confirmation",
  caption: "Placing an order moves money and cannot be quietly undone. The assistant may propose it, but the customer must see the items, total, shipping and payment method and confirm on a screen that the checkout service controls.",
  controls: [{ id: "c", kind: "toggle", label: "Explicit confirmation step", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const conf = g.v.c === 1;
    const { i, p } = g.stage([1.6, 1.8, 1.8]);
    g.orb("working", 60, 100, 44, pal.paper, 1);
    chip(g, 60, 150, "“buy it”", pal.accent, 10);
    if (conf) {
      g.rect(150, 50, 150, 100, pal.accent, 0.12, 10);
      g.frame(150, 50, 150, 100, pal.accent, 1, 10, 1.4);
      ["trail jacket", "total $129.00", "ship to 12 Park Rd", "card ending 4421"].forEach((l, k) => g.text(l, 160, 66 + k * 20, { size: 9, align: "left", color: pal.paper }));
      node(g, "user", 340, 100, { label: "you confirm", size: 30, color: pal.accent });
      if (i === 0) g.packet(86, 100, 150, 100, p, pal.accent, 3);
      if (i >= 1) g.packet(366, 100, 392, 100, i === 1 ? p : 1, pal.ok, 3);
      node(g, "server", 420, 100, { label: "checkout", size: 28, active: i === 2 });
    } else {
      node(g, "server", 330, 100, { label: "checkout", size: 40, color: pal.bad });
      g.packet(86, 100, 304, 100, g.loop(1.4), pal.bad, 3);
    }
    g.text(conf ? ["assistant proposes the order", "the customer reviews exact details", "checkout runs with an idempotency key"][i] : "order placed on a vague sentence: a wrong order ships ✕", 240, 214, { size: 12, color: conf ? pal.paper : pal.bad });
  },
};

export const MORE_AD_5: Record<string, Scene[]> = {
  [`${F}/a-framework-for-designing-ai-systems`]: [nineSteps, complexityLadder],
  [`${F}/choosing-between-prompting-rag-fine-tuning-and-agents`]: [diagnoseGap, staleness],
  [`${F}/estimating-tokens-gpus-and-cost-for-ai-systems`]: [tokenCost, memoryFit],
  [`${F}/reference-architecture-for-an-enterprise-ai-platform`]: [layers, paved],
  [`${F}/build-vs-buy-and-model-vendor-strategy`]: [sourcingSpectrum, breakEvenVolume],
  [`${F}/defining-slos-for-quality-latency-and-cost`]: [sloDashboard, modelTradeoff],
  [`${E}/designing-ai-security-architecture-and-threat-modeling`]: [entryPoints, depthLayers],
  [`${E}/designing-a-private-and-on-premises-llm-deployment`]: [boundarySpectrum, modelImport],
  [`${E}/designing-model-risk-management-for-regulated-industries`]: [validationCycle, changeLevel],
  [`${K}/designing-an-enterprise-search-copilot`]: [connectorFanIn, permResolve],
  [`${K}/designing-an-intelligent-document-processing-pipeline`]: [straightThrough, ocrCheck],
  [`${A}/designing-a-consumer-chat-assistant-at-scale`]: [cancelOnDisconnect, tierAdmission],
  [`${A}/designing-a-conversational-commerce-assistant`]: [cardsFromData, confirmOrder],
};
