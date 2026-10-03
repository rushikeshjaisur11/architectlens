import type { Scene } from "../scene/types";
import { bar, chip } from "./kit";
import { node } from "./shapes";

const P = "ai-system-design";
const K = `${P}/knowledge-and-search-products`;
const A = `${P}/assistants-and-agents`;

const semanticLayer: Scene = {
  title: "Raw schema versus a semantic layer",
  caption: "Asked for 'revenue by region', a model facing 3,000 raw tables must guess which ones and how to join them. A semantic layer exposes governed metrics and dimensions, so the model only selects among a few approved choices and the definition never varies.",
  controls: [{ id: "m", kind: "choice", label: "Model sees", options: ["raw warehouse schema", "semantic layer"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const sem = g.v.m === 1;
    chip(g, 240, 28, "revenue by region last quarter", pal.accent, 10);
    g.orb("solving", 70, 110, 44, pal.paper, 1);
    const n = sem ? 6 : 30;
    for (let k = 0; k < n; k++) {
      const x = 170 + (k % (sem ? 3 : 10)) * (sem ? 70 : 24);
      const y = 70 + Math.floor(k / (sem ? 3 : 10)) * (sem ? 50 : 22);
      if (sem) node(g, "doc", x, y, { size: 26, color: k === 0 || k === 3 ? pal.ok : pal.blue, label: ["revenue", "orders", "customers", "region", "date", "product"][k] });
      else g.rect(x - 9, y - 8, 18, 14, pal.line, 0.45, 2);
    }
    g.packet(94, 110, 160, 100, g.loop(1.6), pal.accent, 3);
    g.text("tables or governed fields to choose from", 330, 40, { size: 9, color: pal.muted });
    g.text("answer correct", 70, 214, { size: 10 });
    bar(g, 160, 209, 230, 8, sem ? 0.92 : 0.55, sem ? pal.ok : pal.bad);
    g.text(sem ? "92%" : "55%", 430, 214, { size: 11, color: pal.paper });
    g.text(sem ? "one fixed definition of revenue for everyone" : "which of 40 revenue-like columns is it?", 240, 252, { size: 11, color: sem ? pal.ok : pal.bad });
  },
};

const sqlGuard: Scene = {
  title: "Validate before you run the query",
  caption: "Generated SQL is untrusted. It is parsed and checked against an allow-list, estimated with a dry run, and only then executed read-only. Errors go back to the model for a bounded repair. Without validation a bad query runs or a harmful one slips through.",
  controls: [{ id: "v", kind: "toggle", label: "Validation pipeline", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.v === 1;
    const { i, p } = g.stage([1.5, 1.6, 1.6, 1.8]);
    g.orb("composing", 40, 100, 36, pal.paper, 1);
    const steps: [string, "doc" | "shield" | "gpu" | "db"][] = [["SQL", "doc"], ["parse + allow-list", "shield"], ["dry run", "gpu"], ["read-only run", "db"]];
    steps.forEach(([nm, kind], k) => {
      const x = 130 + k * 110;
      const skip = !on && (k === 1 || k === 2);
      node(g, kind, x, 100, { label: nm, size: 32, color: skip ? pal.muted : k <= i ? pal.paper : pal.muted, a: skip ? 0.25 : k <= i ? 1 : 0.5 });
      if (k < 3) g.arrow(x + 22, 100, x + 88, 100, pal.line, 0.8);
    });
    const bad = i >= 1;
    if (on) {
      if (i === 1) {
        g.text("✕ touches a forbidden table", 240, 160, { size: 11, color: pal.bad });
        g.packet(240, 112, 90, 112, p, pal.bad, 2.6);
      }
      if (i === 2) g.text("repaired query accepted, cost ok", 240, 160, { size: 11, color: pal.ok });
      if (i === 3) chip(g, 240, 160, "executed read-only, row limit 100", pal.ok, 10);
    } else if (bad) {
      chip(g, 240, 160, "ran unchecked on the full warehouse ✕", pal.bad, 10);
    }
    g.text(on ? "errors are fed back for a bounded repair" : "a wrong or harmful query reaches the data", 240, 232, { size: 11, color: on ? pal.ok : pal.bad });
  },
};

const searchOrNot: Scene = {
  title: "Search, or just answer?",
  caption: "A router decides per message. Small talk and stable knowledge need no search. Anything time-sensitive or needing sources triggers retrieval, and hard questions get several rounds. Searching everything wastes seconds and money, never searching hallucinates.",
  controls: [{ id: "q", kind: "choice", label: "User asks", options: ["tell me a joke", "who won last night's match?", "compare three vector databases"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const q = g.v.q;
    chip(g, 240, 28, ["tell me a joke", "who won last night's match?", "compare three vector databases"][q], pal.accent, 10);
    g.orb("searching", 90, 110, 40, pal.paper, 1);
    g.text("router", 90, 140, { size: 9, color: pal.muted });
    node(g, "cloud", 250, 80, { label: "web search", size: 34, color: q === 0 ? pal.muted : pal.ok, a: q === 0 ? 0.3 : 1 });
    g.orb("composing", 400, 110, 44, pal.paper, 1);
    g.text("answer model", 400, 142, { size: 9, color: pal.muted });
    if (q === 0) g.packet(114, 110, 376, 110, g.loop(1.4), pal.accent, 3);
    else {
      g.packet(114, 104, 226, 84, g.loop(1.4), pal.accent, 3);
      g.packet(274, 84, 376, 104, g.loop(1.4, 0.4), pal.ok, 3);
      if (q === 2) g.packet(250, 104, 250, 150, g.loop(1.4, 0.2), pal.violet, 2.4);
    }
    g.text(["no search: direct answer", "one fresh search, cite sources", "several searches, then combine"][q], 240, 210, { size: 12, color: pal.paper });
    g.text(["fastest and cheapest", "freshness matters here", "decompose, search each part, merge"][q], 240, 240, { size: 10, color: pal.muted });
  },
};

const sourceQuality: Scene = {
  title: "Ranking sources by quality and freshness",
  caption: "Raw search results mix authoritative pages, stale copies and spam. Each is scored for authority and recency. Turn up the freshness bias for news and a recent primary source jumps ahead of an older, more popular page.",
  controls: [{ id: "f", kind: "range", label: "Freshness bias", min: 0, max: 1, step: 0.1, initial: 0.6 }],
  aspect: 0.64,
  make: () => {
    const cur = [0, 1, 2, 3].map((k) => 60 + k * 44);
    return (g) => {
      const { pal } = g;
      const srcs: [string, number, number][] = [["blog (popular, old)", 0.8, 0.2], ["central bank press release", 0.95, 1], ["news wire (today)", 0.75, 0.95], ["spam aggregator", 0.2, 0.9]];
      const f = g.v.f;
      const score = srcs.map(([, a, r]) => a * (1 - f * 0.5) + r * f * 0.9);
      const rank = score.map((s, k) => score.filter((o, j) => o > s || (o === s && j < k)).length);
      srcs.forEach(([nm, a, r], k) => {
        cur[k] += (60 + rank[k] * 44 - cur[k]) * Math.min(1, g.dt * 6);
        const y = cur[k];
        const spam = a < 0.3;
        g.rect(20, y - 16, 250, 32, rank[k] === 0 ? pal.ok : pal.line, rank[k] === 0 ? 0.2 : 0.08, 6);
        g.frame(20, y - 16, 250, 32, spam ? pal.bad : rank[k] === 0 ? pal.ok : pal.line, 1, 6, 1.1);
        g.text(nm, 30, y, { size: 10, align: "left", color: spam ? pal.bad : pal.paper });
        bar(g, 290, y - 8, 60, 6, a, pal.blue);
        bar(g, 290, y + 2, 60, 6, r, pal.teal);
        g.text(score[k].toFixed(2), 420, y, { size: 11, color: pal.paper });
      });
      g.text("authority", 320, 34, { size: 9, color: pal.blue });
      g.text("fresh", 370, 34, { size: 9, color: pal.teal });
      node(g, "cloud", 456, 250, { size: 20 });
      g.text("low-authority pages are demoted whatever their date", 220, 258, { size: 10, color: pal.muted });
    };
  },
};

const sharedSpace: Scene = {
  title: "Text and images in one embedding space",
  caption: "A text encoder and an image encoder are trained so matching pairs land close together. A text query then retrieves images directly, and an image query retrieves similar images, with one index and one distance measure.",
  controls: [{ id: "q", kind: "choice", label: "Query", options: ["text: red sneakers", "image: upload a photo"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const img = g.v.q === 1;
    const clusters: [number, number, string][] = [[130, 90, "sneakers"], [340, 80, "dresses"], [250, 180, "bags"]];
    clusters.forEach(([cx, cy, nm], c) => {
      for (let k = 0; k < 8; k++) {
        const x = cx + (g.rnd(c * 11 + k * 3.1) - 0.5) * 70;
        const y = cy + (g.rnd(c * 17 + k * 5.3) - 0.5) * 50;
        node(g, "doc", x, y, { size: 12, color: c === 0 ? pal.accent : pal.muted, a: c === 0 ? 1 : 0.5 });
        if (c === 0 && k < 3) g.line(x, y, 130, 90, pal.accent, 0.3, 1);
      }
      g.text(nm, cx, cy + 44, { size: 9, color: pal.muted });
    });
    const q: [number, number] = [118 + Math.sin(g.t) * 4, 80];
    g.dot(q[0], q[1], 6, img ? pal.violet : pal.accent);
    g.glow(q[0], q[1], 20, img ? pal.violet : pal.accent, 0.4);
    node(g, img ? "client" : "doc", 40, 50, { label: img ? "photo" : "text", size: 28, color: img ? pal.violet : pal.accent });
    g.packet(60, 56, q[0], q[1], g.loop(1.4), img ? pal.violet : pal.accent, 2.6);
    g.text("the nearest points are the matching products", 240, 250, { size: 11, color: pal.paper });
  },
};

const composedQuery: Scene = {
  title: "Image plus text: steering a query",
  caption: "'This, but in green': the image embedding anchors the query on the shoe's shape, and the text embedding pulls it toward green. Slide the weight and the query moves between the two, and the nearest results change with it.",
  controls: [{ id: "w", kind: "range", label: "Text weight", min: 0, max: 1, step: 0.1, initial: 0.5 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const w = g.v.w;
    const img: [number, number] = [140, 140];
    const txt: [number, number] = [380, 70];
    const q: [number, number] = [img[0] + (txt[0] - img[0]) * w, img[1] + (txt[1] - img[1]) * w];
    const items: [number, number, string][] = [[150, 135, "same shoe, red"], [250, 110, "similar, green-ish"], [350, 80, "green sneaker"], [390, 160, "green bag"], [120, 80, "red boot"]];
    let best = 0;
    items.forEach(([x, y], k) => {
      if (Math.hypot(x - q[0], y - q[1]) < Math.hypot(items[best][0] - q[0], items[best][1] - q[1])) best = k;
    });
    g.line(img[0], img[1], txt[0], txt[1], pal.line, 0.5, 1.2);
    node(g, "client", img[0], img[1] + 28, { label: "image", size: 26, color: pal.violet });
    node(g, "doc", txt[0], txt[1] - 28, { label: "“green”", size: 24, color: pal.ok });
    items.forEach(([x, y, nm], k) => {
      g.dot(x, y, k === best ? 6 : 3.5, k === best ? pal.ok : pal.muted, k === best ? 1 : 0.6);
      if (k === best) g.ring(x, y, 11, pal.ok, 0.9, 1.6);
    });
    g.dot(q[0], q[1], 6, pal.accent);
    g.glow(q[0], q[1], 18, pal.accent, 0.4);
    g.text(`top result: ${items[best][2]}`, 240, 230, { size: 13, color: pal.paper });
    g.text("blend the two embeddings, expose the weight to the user", 240, 256, { size: 10, color: pal.muted });
  },
};

const leadWorkers: Scene = {
  title: "Lead agent and parallel research workers",
  caption: "The lead plans sub-questions and sends each to a worker with a small, focused context. Workers write cited notes to a shared notebook instead of returning everything. The lead merges the notebook and decides whether to run another round.",
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 2.2, 1.6, 1.8]);
    g.orb("shaping", 240, 40, 44, pal.paper, 1);
    g.text("lead agent", 240, 72, { size: 9, color: pal.muted });
    const names = ["performance", "cost", "filtering", "operations"];
    names.forEach((nm, k) => {
      const x = 60 + k * 120;
      const working = i === 1;
      g.orb(working ? "searching" : "breathing", x, 130, 30, pal.paper, i >= 1 ? 1 : 0.4);
      g.text(nm, x, 156, { size: 9, color: pal.muted });
      if (i === 0) g.packet(240, 62, x, 112, p, pal.accent, 2.4);
      if (i === 1) g.packet(x, 146, 240, 206, (g.t * 0.8 + k * 0.2) % 1, pal.ok, 2.2);
    });
    node(g, "doc", 240, 210, { label: "research notebook", size: 34, color: pal.ok, a: i >= 1 ? 1 : 0.4 });
    if (i >= 2) g.packet(240, 190, 240, 72, i === 2 ? p : 1, pal.ok, 3);
    g.text(["lead writes the plan and fans out", "workers research in parallel, notes with citations", "lead reads the notebook, finds a gap", "writer drafts, verifier checks every claim"][i], 240, 262, { size: 12, color: pal.paper });
  },
};

const budgetStop: Scene = {
  title: "A budget the runtime enforces",
  caption: "Open-ended research can keep going forever. The runtime counts searches, pages and tokens and stops the run at the limit, whatever the model wants. Raise or lower the budget to trade completeness against cost.",
  controls: [{ id: "b", kind: "range", label: "Search budget", min: 5, max: 60, step: 5, initial: 30 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const budget = g.v.b;
    const need = 45;
    const used = Math.min(budget, Math.floor((g.t * 6) % 70));
    const done = (g.t * 6) % 70 >= need;
    const covered = Math.min(1, used / need);
    node(g, "server", 70, 90, { label: "agent", size: 40, active: used < budget && !done });
    for (let k = 0; k < 12; k++) {
      const found = k / 12 < covered;
      node(g, "doc", 150 + (k % 6) * 46, 70 + Math.floor(k / 6) * 44, { size: 22, color: found ? pal.ok : pal.muted, a: found ? 1 : 0.3 });
    }
    g.text("searches used", 70, 186, { size: 10 });
    bar(g, 160, 181, 230, 8, used / 60, used >= budget ? pal.bad : pal.accent);
    g.line(160 + (budget / 60) * 230, 176, 160 + (budget / 60) * 230, 194, pal.paper, 0.8, 1.5);
    g.text(`${used}`, 430, 186, { size: 11, color: pal.paper });
    g.text(used >= budget && budget < need ? "budget reached: stop with what was found, state the gaps" : "enough evidence: finish early", 240, 232, { size: 12, color: used >= budget && budget < need ? pal.accent : pal.ok });
  },
};

const sweLoop: Scene = {
  title: "The sandbox loop: reproduce, fix, verify",
  caption: "The agent first reproduces the bug with a failing test, edits the code, then runs the tests and linters. A failure sends it back to edit, for a bounded number of rounds. Only a green run becomes a pull request for a human to review.",
  controls: [{ id: "f", kind: "toggle", label: "First attempt fails a test" }],
  aspect: 0.66,
  make: () => (g) => {
    const { pal } = g;
    const fail = g.v.f === 1;
    const t = (g.t * 0.9) % 9;
    const steps: [string, "doc" | "server" | "shield" | "cloud"][] = [["reproduce (failing test)", "doc"], ["edit code", "server"], ["run tests + lint", "shield"], ["open PR", "cloud"]];
    g.rect(14, 40, 452, 150, pal.line, 0.05, 12);
    g.frame(14, 40, 452, 150, pal.line, 0.8, 12, 1.1);
    g.text("sandbox (no secrets, limited network)", 240, 34, { size: 9, color: pal.muted });
    steps.forEach(([nm, kind], k) => {
      const x = 60 + k * 120;
      const stage = t < 1.5 ? 0 : t < 3 ? 1 : t < 4.5 ? 2 : fail && t < 6.5 ? 1 : 3;
      node(g, kind, x, 100, { label: nm, size: 32, color: k === stage ? pal.accent : pal.paper, a: k <= stage || t > 7 ? 1 : 0.5, active: k === stage });
      if (k < 3) g.arrow(x + 22, 100, x + 98, 100, pal.line, 0.8);
    });
    if (fail && t > 4.5 && t < 6.5) {
      g.text("✕ test failed: back to edit", 240, 160, { size: 11, color: pal.bad });
      g.arrow(300, 124, 180, 124, pal.bad, 0.9);
    }
    chip(g, 240, 222, t > 7 || (!fail && t > 4.5) ? "tests pass: PR opened for human review ✓" : "working…", t > 7 || (!fail && t > 4.5) ? pal.ok : pal.paper, 11);
  },
};

const agentTools: Scene = {
  title: "Purpose-built tools save the context",
  caption: "A raw grep floods the prompt with thousands of lines. A search tool built for agents returns a short ranked list with file and line numbers. The same model finds the right file in fewer steps and far fewer tokens.",
  controls: [{ id: "t", kind: "choice", label: "Search tool", options: ["raw grep output", "ranked agent tool"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const tool = g.v.t === 1;
    node(g, "server", 70, 100, { label: "repo", size: 44 });
    g.orb("searching", 400, 100, 44, pal.paper, 1);
    g.packet(100, 100, 370, 100, g.loop(1.5), pal.accent, 3);
    const lines = tool ? 4 : 28;
    for (let k = 0; k < lines; k++) {
      const x = 130 + (k % (tool ? 1 : 2)) * 120;
      const y = 50 + (tool ? k * 28 : Math.floor(k / 2) * 9);
      g.rect(x, y, tool ? 220 : 100, tool ? 20 : 6, tool ? pal.ok : pal.line, tool ? 0.25 : 0.5, 3);
      if (tool) g.text(["auth/session.py:42", "auth/tokens.py:88", "tests/test_auth.py:15", "docs/auth.md:3"][k], x + 8, y + 10, { size: 9, align: "left", color: pal.paper });
    }
    const tok = tool ? 300 : 9000;
    g.text("tokens added to the context", 80, 226, { size: 10 });
    bar(g, 230, 221, 180, 8, Math.min(1, tok / 9000), tool ? pal.ok : pal.bad);
    g.text(`${tok}`, 440, 226, { size: 11, color: pal.paper });
  },
};

const durableRun: Scene = {
  title: "A workflow run that survives a crash",
  caption: "After each step the engine saves the run state. When a worker dies in step three, another worker loads the saved state and retries only that step. Without persistence the whole run restarts, and earlier effects may repeat.",
  controls: [{ id: "p", kind: "toggle", label: "Persist state after every step", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const persist = g.v.p === 1;
    const t = (g.t * 0.8) % 10;
    const crashAt = 4.2;
    const labels = ["trigger", "extract", "LLM classify", "update ERP", "notify"];
    const cur = t < crashAt ? Math.floor(t) : persist ? Math.floor(t - 1) + 0 : Math.max(0, Math.floor(t - crashAt - 0.5));
    labels.forEach((nm, k) => {
      const x = 44 + k * 98;
      const done = k < Math.min(4, cur);
      node(g, k === 2 ? "server" : k === 3 ? "db" : "doc", x, 90, { label: nm, size: 30, color: done ? pal.ok : pal.paper, a: done ? 1 : 0.7 });
      if (k < 4) g.arrow(x + 20, 90, x + 78, 90, pal.line, 0.7);
      if (persist && done) g.dot(x, 126, 3, pal.ok);
    });
    node(g, "db", 240, 180, { label: "run state store", size: 30, color: persist ? pal.ok : pal.muted, a: persist ? 1 : 0.3 });
    if (t > crashAt && t < crashAt + 0.9) g.text("✕ worker crashed", 240, 40, { size: 13, color: pal.bad });
    const resumed = t > crashAt + 0.9;
    g.text(resumed ? (persist ? "new worker resumes at the failed step ✓" : "state lost: restarting from the trigger ✕") : "running…", 240, 236, { size: 12, color: resumed ? (persist ? pal.ok : pal.bad) : pal.paper });
  },
};

const idemRetry: Scene = {
  title: "Retried steps must not repeat their effect",
  caption: "The ERP call succeeded but the worker died before recording it, so the step is retried. With an idempotency key the ERP recognises the repeat and returns the existing record. Without one a second payable is created.",
  controls: [{ id: "k", kind: "toggle", label: "Idempotency key", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const key = g.v.k === 1;
    const { i, p } = g.stage([1.8, 1.4, 1.8, 1.8]);
    node(g, "server", 70, 100, { label: "worker", size: 40, color: i === 1 ? pal.bad : pal.paper });
    node(g, "db", 400, 100, { label: "ERP", size: 48, color: pal.blue });
    if (i === 0) g.packet(96, 100, 372, 100, p, pal.accent, 3);
    if (i === 1) g.text("✕ crash before saving", 240, 70, { size: 12, color: pal.bad });
    if (i >= 2) g.packet(96, 106, 372, 106, i === 2 ? p : 1, key ? pal.ok : pal.bad, 3);
    const n = i >= 2 && !key ? 2 : i >= 0 && !(i === 0 && p < 0.9) ? 1 : 0;
    for (let k = 0; k < n; k++) node(g, "doc", 340 + k * 40, 170, { size: 28, color: n === 2 ? pal.bad : pal.ok });
    g.text(["step calls the ERP", "the worker dies before recording success", key ? "retry with the same key" : "retry with no key", i === 3 ? (key ? "the ERP returns the existing record: 1 payable ✓" : "a duplicate payable was created ✕") : ""][i], 240, 232, { size: 12, color: i === 3 ? (key ? pal.ok : pal.bad) : pal.paper });
  },
};

const meetingPipeline: Scene = {
  title: "From audio to action items",
  caption: "Audio streams to speech recognition, then speaker attribution, then topic segmentation. Each segment is summarised, and the segment summaries are combined into the meeting summary and a list of action items linked to timestamps.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.4, 1.4, 1.4, 1.4, 1.6]);
    const steps: [string, "phone" | "gpu" | "user" | "doc" | "lb"][] = [["audio", "phone"], ["speech to text", "gpu"], ["who spoke", "user"], ["topic segments", "doc"], ["summary + tasks", "lb"]];
    steps.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const on = k <= i;
      node(g, kind, x, 90, { label: nm, size: 34, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.4, active: k === i });
      if (k < 4) g.arrow(x + 24, 90, x + 74, 90, pal.line, on ? 0.9 : 0.3);
    });
    const px = 44 + Math.min(4, i + p) * 98;
    g.dot(px, 90, 5, pal.accent);
    g.glow(px, 90, 14, pal.accent, 0.4);
    ["[0:00] Priya: let's plan the launch", "[12:30] Raj: I'll send the draft Friday"].forEach((l, k) => g.text(l, 240, 160 + k * 22, { size: 10, color: i >= 2 ? pal.paper : pal.muted, a: i >= 1 ? 1 : 0.3 }));
    g.text(["audio frames arrive per participant", "transcript with word timestamps", "each segment gets a speaker", "split into topics", "decisions and action items extracted"][i], 240, 236, { size: 12, color: pal.paper });
  },
};

const actionItems: Scene = {
  title: "Turning a sentence into an action item",
  caption: "'I'll send the draft by Friday' needs an owner and a date. The speaker gives the owner, and the meeting date resolves 'Friday'. 'Someone should check legal' has no owner, so it stays a suggestion for a person to confirm.",
  controls: [{ id: "s", kind: "choice", label: "Sentence", options: ["I'll send the draft by Friday", "someone should check legal"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ok = g.v.s === 0;
    chip(g, 240, 36, ["“I'll send the draft by Friday”", "“someone should check legal”"][g.v.s], pal.accent, 11);
    g.orb("solving", 70, 110, 40, pal.paper, 1);
    const fields: [string, string, boolean][] = [["task", ok ? "send the draft" : "check legal", true], ["owner", ok ? "Raj Patel (the speaker)" : "unknown", ok], ["due", ok ? "Fri 14 Oct (from meeting date)" : "none", ok]];
    fields.forEach(([k, v, found], i) => {
      const y = 90 + i * 36;
      g.rect(140, y - 14, 300, 28, found ? pal.ok : pal.accent, 0.18, 6);
      g.frame(140, y - 14, 300, 28, found ? pal.ok : pal.accent, 1, 6, 1.1);
      g.text(k, 150, y, { size: 10, align: "left", color: pal.muted });
      g.text(v, 210, y, { size: 10, align: "left", color: found ? pal.paper : pal.accent });
      g.packet(94, 110, 138, y, (g.t * 0.8 + i * 0.2) % 1, found ? pal.ok : pal.accent, 2);
    });
    chip(g, 240, 218, ok ? "created after the owner confirms" : "shown as a suggestion: needs an owner", ok ? pal.ok : pal.accent, 11);
  },
};

const agentPerceive: Scene = {
  title: "The perceive, decide, act loop",
  caption: "Each step the agent receives a screenshot with numbered element markers, chooses one action, the browser performs it, and the next screenshot shows the result. Verifying that the page changed as expected catches mistakes early.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.5, 1.5, 1.5, 1.5]);
    g.rect(24, 40, 200, 140, pal.line, 0.08, 8);
    g.frame(24, 40, 200, 140, pal.line, 1, 8, 1.2);
    g.rect(34, 52, 180, 14, pal.line, 0.3, 3);
    ["[1] search box", "[2] filters", "[3] Reorder"].forEach((t, k) => {
      g.rect(40, 80 + k * 28, 110, 20, pal.accent, k === 2 && i >= 1 ? 0.5 : 0.18, 4);
      g.text(t, 46, 90 + k * 28, { size: 9, align: "left", color: pal.paper });
    });
    g.orb(i === 1 ? "solving" : "working", 330, 100, 46, pal.paper, 1);
    g.text("agent", 330, 132, { size: 9, color: pal.muted });
    if (i === 0) g.packet(224, 110, 304, 104, p, pal.accent, 3);
    if (i === 1) chip(g, 330, 160, "click [3]", pal.accent, 10);
    if (i === 2) {
      g.packet(306, 100, 224, 130, p, pal.ok, 3);
      g.dot(95, 148, 6, pal.accent);
      g.glow(95, 148, 16, pal.accent, 0.5);
    }
    if (i === 3) chip(g, 120, 205, "cart page opened ✓", pal.ok, 10);
    g.text(["observe: screenshot + element markers", "decide: choose one action", "act: the browser clicks", "verify: did the page change as expected?"][i], 240, 250, { size: 12, color: pal.paper });
  },
};

const actionGate: Scene = {
  title: "Gating risky actions",
  caption: "Reading a page is free, but submitting a form, paying or deleting acts with the user's authority. The policy layer classifies each proposed action and stops the risky ones for explicit confirmation showing exactly what will happen.",
  controls: [{ id: "a", kind: "choice", label: "Proposed action", options: ["scroll the page", "type into the search box", "place the order"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const a = g.v.a;
    const risky = a === 2;
    g.orb("solving", 60, 100, 40, pal.paper, 1);
    chip(g, 60, 150, ["scroll", "type text", "click Place order"][a], risky ? pal.bad : pal.accent, 9);
    node(g, "shield", 200, 100, { label: "policy check", size: 36, color: risky ? pal.bad : pal.ok });
    g.packet(84, 100, 176, 100, g.loop(1.4), pal.accent, 3);
    if (risky) {
      node(g, "user", 330, 100, { label: "you confirm", size: 34, color: pal.accent });
      g.packet(226, 100, 304, 100, g.loop(1.4, 0.3), pal.accent, 3);
      g.rect(270, 150, 120, 50, pal.accent, 0.15, 8);
      g.text("$84.20, ships to", 330, 166, { size: 9, color: pal.paper });
      g.text("12 Park Road", 330, 182, { size: 9, color: pal.paper });
      g.text("irreversible: waits for approval", 240, 232, { size: 12, color: pal.accent });
    } else {
      node(g, "client", 360, 100, { label: "browser", size: 34 });
      g.packet(226, 100, 336, 100, g.loop(1.4, 0.3), pal.ok, 3);
      g.text("low risk: runs automatically", 240, 232, { size: 12, color: pal.ok });
    }
  },
};

export const MORE_AD_2: Record<string, Scene[]> = {
  [`${K}/designing-a-text-to-sql-analytics-assistant`]: [semanticLayer, sqlGuard],
  [`${K}/designing-an-ai-answer-engine`]: [searchOrNot, sourceQuality],
  [`${K}/designing-a-multimodal-search-system`]: [sharedSpace, composedQuery],
  [`${A}/designing-a-deep-research-agent`]: [leadWorkers, budgetStop],
  [`${A}/designing-an-autonomous-software-engineering-agent`]: [sweLoop, agentTools],
  [`${A}/designing-an-agent-workflow-automation-platform`]: [durableRun, idemRetry],
  [`${A}/designing-a-meeting-assistant`]: [meetingPipeline, actionItems],
  [`${A}/designing-a-computer-use-browser-agent`]: [agentPerceive, actionGate],
};
