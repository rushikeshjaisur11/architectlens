import type { Scene } from "../scene/types";
import { bar, chip } from "./kit";
import { node } from "./shapes";

const P = "ai-system-design";
const K = `${P}/knowledge-and-search-products`;
const A = `${P}/assistants-and-agents`;
const L = `${P}/llm-platforms-and-infrastructure`;
const D = `${P}/data-feedback-and-training-loops`;
const E = `${P}/enterprise-and-multi-tenant-ai`;

const ragArchitecture: Scene = {
  title: "Enterprise RAG: two pipelines, one index",
  caption: "Ingestion runs continuously in the background: connectors pull documents, a parser and chunker prepare them, an embedder vectorises them and they land in the index with their access rules. The query path reads that index at request time. Switch between them.",
  controls: [{ id: "p", kind: "choice", label: "Pipeline", options: ["ingestion (offline)", "query (online)"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const q = g.v.p === 1;
    const steps: [string, "cloud" | "doc" | "lb" | "gpu" | "db" | "user" | "model" | "shield"][] = q
      ? [["question", "user"], ["rewrite", "model"], ["ACL-filtered search", "db"], ["rerank", "gpu"], ["LLM + citations", "model"]]
      : [["sources", "cloud"], ["parser", "doc"], ["chunker", "lb"], ["embedder", "gpu"], ["index + ACLs", "db"]];
    const f = g.loop(6) * 5;
    steps.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const on = k <= f;
      node(g, kind, x, 100, { label: nm, size: 36, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.45, active: Math.floor(f) === k, state: "working" });
      if (k < 4) g.arrow(x + 24, 100, x + 74, 100, pal.line, on ? 0.9 : 0.3);
    });
    const px = 44 + Math.min(4, f) * 98;
    g.dot(px, 100, 5, pal.accent);
    g.glow(px, 100, 14, pal.accent, 0.4);
    g.text(q ? "the user's group list is passed as a filter on every search" : "each chunk keeps its source, version and who may read it", 240, 190, { size: 12, color: pal.paper });
    g.text(q ? "answer must cite chunk ids, then citations are verified" : "change feeds keep the index current", 240, 220, { size: 10, color: pal.muted });
  },
};

const aclFilter: Scene = {
  title: "Permission-aware retrieval",
  caption: "Alice may read the public policy but not the restricted legal memo. Post-filtering retrieves the best five first and then removes forbidden ones, leaving too few results. Filtering inside the search never lets the memo in, and still returns five.",
  controls: [{ id: "m", kind: "choice", label: "Filter", options: ["no filter", "post-filter", "filter inside the search"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const docs: [string, boolean][] = [["policy v4", true], ["legal memo", false], ["faq", true], ["draft contract", false], ["handbook", true], ["wiki page", true], ["old policy", true], ["board notes", false]];
    const ranked = docs.map((d, k) => ({ d, k }));
    let shown = ranked;
    if (m === 1) shown = ranked.slice(0, 5).filter((r) => r.d[1]);
    else if (m === 2) shown = ranked.filter((r) => r.d[1]).slice(0, 5);
    else shown = ranked.slice(0, 5);
    node(g, "user", 40, 110, { label: "Alice", size: 36 });
    node(g, "db", 150, 110, { label: "index", size: 44, color: pal.blue });
    g.packet(62, 110, 124, 110, g.loop(1.4), pal.accent, 2.6);
    shown.forEach((r, i) => {
      const leak = !r.d[1];
      const y = 40 + i * 36;
      g.rect(250, y - 14, 200, 28, leak ? pal.bad : pal.ok, 0.2, 6);
      g.frame(250, y - 14, 200, 28, leak ? pal.bad : pal.ok, 1, 6, 1.2);
      g.text(r.d[0] + (leak ? " (restricted)" : ""), 262, y, { size: 11, align: "left", color: pal.paper });
      g.packet(176, 110, 248, y, (g.t * 0.7 + i * 0.15) % 1, leak ? pal.bad : pal.accent, 2);
    });
    const leaks = shown.filter((r) => !r.d[1]).length;
    g.text(leaks ? `${leaks} restricted document reached the prompt ✕` : shown.length < 5 ? `only ${shown.length} results left after removal` : "5 allowed results, nothing restricted ✓", 240, 236, { size: 12, color: leaks ? pal.bad : shown.length < 5 ? pal.accent : pal.ok });
  },
};

const hybridQuery: Scene = {
  title: "Hybrid query: two searches, one ranking",
  caption: "The query runs a vector search and a keyword search in parallel. Rank fusion merges the two lists without needing comparable scores, and a reranker then reads the top candidates against the query for the final order.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.6, 1.8]);
    node(g, "user", 40, 110, { label: "query", size: 32 });
    node(g, "db", 170, 60, { label: "vector search", size: 36, color: pal.blue, active: i === 0 });
    node(g, "doc", 170, 160, { label: "keyword search", size: 36, color: pal.violet, active: i === 0 });
    if (i === 0) {
      g.packet(62, 102, 148, 66, p, pal.accent, 2.6);
      g.packet(62, 118, 148, 154, p, pal.accent, 2.6);
    }
    node(g, "lb", 290, 110, { label: "rank fusion", size: 34, active: i === 1 });
    if (i >= 1) {
      g.packet(196, 66, 266, 104, i === 1 ? p : 1, pal.blue, 2.6);
      g.packet(196, 154, 266, 116, i === 1 ? p : 1, pal.violet, 2.6);
    }
    g.orb(i === 2 ? "solving" : "breathing", 410, 110, 44, pal.paper, 1);
    g.text("reranker", 410, 144, { size: 9, color: pal.muted });
    if (i === 2) g.packet(312, 110, 384, 110, p, pal.ok, 3);
    g.text(["both searches run at once", "fuse the two ranked lists by rank", "rerank the shortlist for precision"][i], 240, 232, { size: 12, color: pal.paper });
  },
};

const deltaIndex: Scene = {
  title: "Freshness with a delta index",
  caption: "Rebuilding a huge index for every change is slow. New and edited documents go into a small delta index that is searched alongside the main one, and the two are merged on a schedule. A new document becomes searchable in seconds.",
  controls: [{ id: "d", kind: "toggle", label: "Delta index", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const delta = g.v.d === 1;
    const t = g.t % 10;
    node(g, "doc", 50, 100, { label: "new doc", size: 38, color: pal.accent });
    node(g, "db", 250, 70, { label: "main index (nightly)", size: 58, color: pal.blue, fill: 0.9 });
    if (delta) {
      node(g, "db", 250, 170, { label: "delta index (live)", size: 36, color: pal.ok, active: t > 1 });
      g.packet(76, 106, 224, 164, g.clamp((t - 0.5) / 1.5), pal.accent, 3);
    }
    node(g, "user", 430, 110, { label: "search", size: 32 });
    const visible = delta ? t > 2 : t > 8;
    g.packet(402, 104, 290, 76, g.loop(1.6), pal.accent, 2.4);
    if (delta) g.packet(402, 120, 278, 166, g.loop(1.6, 0.4), pal.ok, 2.4);
    chip(g, 240, 230, visible ? "document is searchable ✓" : "not searchable yet…", visible ? pal.ok : pal.bad, 12);
    g.text(delta ? "searchable after about 2 seconds" : "waits for the nightly rebuild", 240, 262, { size: 10, color: pal.muted });
  },
};

const summarizePatterns: Scene = {
  title: "Map-reduce versus refine",
  caption: "Map-reduce summarises every section independently, in parallel, then summarises those summaries. Refine walks through in order, carrying a running summary. Map-reduce is faster, refine keeps the thread of the story.",
  controls: [{ id: "m", kind: "choice", label: "Pattern", options: ["map-reduce", "refine"], initial: 0 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const refine = g.v.m === 1;
    for (let k = 0; k < 4; k++) node(g, "doc", 50 + k * 100, 50, { label: `section ${k + 1}`, size: 34, color: pal.blue });
    if (!refine) {
      for (let k = 0; k < 4; k++) {
        g.orb("working", 50 + k * 100, 130, 28, pal.paper, 1);
        g.packet(50 + k * 100, 70, 50 + k * 100, 114, (g.t * 0.8 + k * 0.05) % 1, pal.accent, 2.4);
        g.packet(50 + k * 100, 146, 200, 184, (g.t * 0.8 + k * 0.05 + 0.4) % 1, pal.ok, 2.2);
      }
      node(g, "doc", 200, 190, { label: "final summary", size: 34, color: pal.ok });
      g.text("sections run in parallel: fast", 340, 190, { size: 10, align: "left", color: pal.ok });
    } else {
      const f = g.loop(6) * 4;
      for (let k = 0; k < 4; k++) {
        g.orb(k <= f ? "working" : "breathing", 50 + k * 100, 130, 28, pal.paper, k <= f ? 1 : 0.4);
        if (k < 3) g.arrow(70 + k * 100, 130, 130 + k * 100, 130, pal.accent, k < f ? 0.9 : 0.3);
        g.packet(50 + k * 100, 70, 50 + k * 100, 114, k <= f ? (g.t * 1.2) % 1 : 0, pal.accent, 2.2);
      }
      node(g, "doc", 350, 190, { label: "running summary", size: 34, color: pal.ok });
      g.text("one after another: slower, keeps order", 40, 190, { size: 10, align: "left", color: pal.muted });
    }
  },
};

const citeCheck: Scene = {
  title: "Verifying citations and numbers",
  caption: "Each claim carries a page reference. The system checks that the cited passage exists and that every number in the claim appears there. A paraphrase error on a figure is caught before the answer is shown.",
  controls: [{ id: "c", kind: "toggle", label: "Verification on", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.c === 1;
    node(g, "doc", 60, 100, { label: "source pages", size: 56, color: pal.blue });
    const claims: [string, string, boolean][] = [["notice period is 90 days", "p. 87", true], ["early fee is 25%", "p. 212", true], ["penalty is capped at $50k", "p. 212", false]];
    claims.forEach(([c, ref, ok], k) => {
      const y = 50 + k * 44;
      const caught = on && !ok;
      g.rect(140, y - 16, 270, 32, caught ? pal.bad : ok ? pal.ok : pal.accent, 0.18, 6);
      g.frame(140, y - 16, 270, 32, caught ? pal.bad : ok ? pal.ok : pal.accent, 1, 6, 1.1);
      g.text(c, 150, y, { size: 10, align: "left", color: pal.paper });
      g.text(ref, 372, y, { size: 9, color: pal.muted });
      g.text(on ? (ok ? "✓" : "✕") : "", 396, y, { size: 13, color: ok ? pal.ok : pal.bad });
      g.packet(90, 100, 138, y, (g.t * 0.8 + k * 0.2) % 1, ok ? pal.ok : pal.bad, 2);
    });
    g.text(on ? "$50k does not appear on p. 212: the claim is removed ✓" : "unverified: a wrong figure reaches the user ✕", 240, 214, { size: 12, color: on ? pal.ok : pal.bad });
    g.text("also check that cited spans really exist in the document", 240, 250, { size: 10, color: pal.muted });
  },
};

const supportRouter: Scene = {
  title: "Route to a narrow flow, not one giant agent",
  caption: "An intent classifier sends the message to a small flow with only the tools it needs. Unknown or sensitive messages go straight to a person. Narrow flows are easier to test, cheaper and safer than one agent with every tool.",
  controls: [{ id: "m", kind: "choice", label: "Customer says", options: ["where is my order?", "I want to return this", "I am going to sue you"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    chip(g, 240, 28, ["where is my order?", "I want to return this", "I am going to sue you"][m], pal.accent, 10);
    g.orb("searching", 240, 80, 38, pal.paper, 1);
    g.text("intent router", 240, 108, { size: 9, color: pal.muted });
    const flows = ["order status", "returns", "billing"];
    flows.forEach((f, k) => {
      const x = 70 + k * 120;
      const on = m === k;
      node(g, "server", x, 170, { label: f, size: 34, color: on ? pal.ok : pal.muted, a: on ? 1 : 0.35, active: on });
      if (on) g.packet(240, 100, x, 150, g.loop(1.4), pal.ok, 3);
    });
    const human = m === 2;
    node(g, "user", 440, 170, { label: "human agent", size: 34, color: human ? pal.accent : pal.muted, a: human ? 1 : 0.35 });
    if (human) g.packet(266, 84, 420, 160, g.loop(1.4), pal.accent, 3);
    g.text(human ? "sensitive: handed to a person with a summary" : `routed to the ${flows[m]} flow with its own small toolset`, 240, 244, { size: 12, color: pal.paper });
  },
};

const identityInject: Scene = {
  title: "Identity comes from the platform, not the model",
  caption: "A prompt-injected message tries to read someone else's order. If the model chooses the customer id, it can be talked into a different one. If the platform injects the authenticated id, the tool simply cannot return another customer's data.",
  controls: [{ id: "m", kind: "choice", label: "Who supplies the customer id", options: ["the model", "the platform"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const platform = g.v.m === 1;
    chip(g, 240, 28, '"look up order for customer 4412"', pal.bad, 10);
    g.orb("working", 70, 110, 44, pal.paper, 1);
    g.text("agent", 70, 142, { size: 9, color: pal.muted });
    node(g, "lock", 230, 110, { label: platform ? "platform adds id 9001" : "no check", size: 34, color: platform ? pal.ok : pal.bad });
    node(g, "db", 400, 110, { label: "orders", size: 44, color: pal.blue });
    g.packet(94, 110, 206, 110, g.loop(1.5), platform ? pal.accent : pal.bad, 3);
    g.packet(254, 110, 376, 110, g.loop(1.5, 0.4), platform ? pal.ok : pal.bad, 3);
    chip(g, 240, 190, platform ? "only customer 9001's orders can be read" : "customer 4412's data returned ✕", platform ? pal.ok : pal.bad, 11);
    g.text("the model passes order ids, never identities", 240, 236, { size: 10, color: pal.muted });
  },
};

const assistPaths: Scene = {
  title: "Three products, three latency budgets",
  caption: "Inline completion must answer in a few hundred milliseconds, so it uses a small fast model. Chat can take seconds and streams. Multi-file edits take longer and use the strongest model with tools. Route each feature to its own tier.",
  controls: [{ id: "p", kind: "choice", label: "Feature", options: ["inline completion", "chat", "multi-file edit"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const p = g.v.p;
    const ms = [300, 3000, 30000][p];
    const size = [24, 38, 52][p];
    node(g, "client", 60, 100, { label: "editor", size: 40 });
    g.orb(["working", "solving", "solving"][p] as "working", 260, 100, size + 10, pal.paper, 1);
    g.text(["small fast model", "larger model", "strongest model + tools"][p], 260, 100 + size / 2 + 22, { size: 10, color: pal.muted });
    g.packet(86, 100, 220, 100, g.loop(ms / 1500 + 0.6), pal.accent, 3);
    g.text("latency budget", 70, 196, { size: 11 });
    bar(g, 170, 191, 220, 8, Math.log10(ms) / 4.5, p === 0 ? pal.ok : pal.accent);
    g.text(["~300 ms", "a few seconds", "tens of seconds"][p], 430, 196, { size: 11, color: pal.paper });
    g.text(["debounced, cancelled on each keystroke", "streams tokens as they arrive", "shows a diff and runs the tests"][p], 240, 240, { size: 11, color: pal.muted });
  },
};

const contextAssembly: Scene = {
  title: "Assembling the prompt under a token budget",
  caption: "The cursor context always goes in first, then imports and definitions the code uses, then similar snippets from a repository search, then rules. When the budget is small the lowest-priority items are the ones dropped.",
  controls: [{ id: "b", kind: "range", label: "Token budget", min: 500, max: 4000, step: 250, initial: 2000 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const budget = g.v.b;
    const items: [string, number, string][] = [["code around the cursor", 600, pal.accent], ["imports + definitions used", 500, pal.blue], ["similar code from repo search", 900, pal.violet], ["project rules", 300, pal.teal], ["recently edited files", 700, pal.ok]];
    let used = 0;
    const scale = 420 / 4000;
    g.frame(30, 60, budget * scale, 46, pal.paper, 0.6, 6, 1.4);
    items.forEach(([nm, t, col], k) => {
      const fits = used + t <= budget;
      const w = t * scale;
      if (fits) {
        g.rect(30 + used * scale, 62, w - 2, 42, col, 0.45, 4);
        used += t;
      }
      g.text(`${fits ? "✓" : "✕"} ${nm} (${t})`, 40, 140 + k * 22, { size: 10, align: "left", color: fits ? pal.paper : pal.muted });
    });
    node(g, "gpu", 450, 80, { size: 24, active: true });
    g.text(`${used} of ${budget} tokens used`, 240, 36, { size: 12, color: pal.paper });
  },
};

const voiceWaterfall: Scene = {
  title: "Voice latency: streamed versus sequential",
  caption: "Run one stage after another and the delays add up past a second. Stream each stage into the next: the model starts on partial text and speech synthesis starts on the first sentence, so the reply begins while later words are still being produced.",
  controls: [{ id: "s", kind: "toggle", label: "Stream every stage", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const stream = g.v.s === 1;
    const stages: [string, number, number][] = stream ? [["speech to text", 0, 250], ["LLM", 150, 400], ["text to speech", 330, 300]] : [["speech to text", 0, 400], ["LLM", 400, 600], ["text to speech", 1000, 400]];
    const total = stream ? 630 : 1400;
    const sc = 400 / 1500;
    const t = (g.t * 600) % 1700;
    stages.forEach(([nm, s, d], k) => {
      const y = 50 + k * 44;
      g.text(nm, 20, y + 8, { size: 9, align: "left", color: pal.muted });
      g.rect(110 + s * sc, y, d * sc, 22, [pal.blue, pal.violet, pal.accent][k], 0.2, 5);
      g.rect(110 + s * sc, y, d * sc * g.clamp((t - s) / d), 22, [pal.blue, pal.violet, pal.accent][k], 0.75, 5);
    });
    g.line(110 + total * sc, 40, 110 + total * sc, 190, pal.ok, 0.8, 1.4);
    g.text("first audio", 110 + total * sc, 200, { size: 9, color: pal.ok });
    g.orb("listening", 456, 40, 22, pal.paper, 1);
    g.text(`${total} ms to the first words`, 240, 232, { size: 13, color: total < 900 ? pal.ok : pal.bad });
    g.text("target: well under a second", 240, 258, { size: 10, color: pal.muted });
  },
};

const bargeIn: Scene = {
  title: "Barge-in: stopping when the user interrupts",
  caption: "The assistant is speaking and the user cuts in. With barge-in, playback stops at once and generation is cancelled so the new input is handled. Without it the assistant talks over the user and wastes the rest of the reply.",
  controls: [{ id: "b", kind: "toggle", label: "Barge-in enabled", initial: true }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.b === 1;
    const t = (g.t * 1.2) % 10;
    const cut = 4;
    g.text("assistant", 20, 70, { size: 10, align: "left", color: pal.accent });
    for (let k = 0; k < 24; k++) {
      const spoken = k < Math.min(24, t * 3);
      const stopped = on && t > cut && k > cut * 3;
      g.rect(80 + k * 15, 56 - (spoken && !stopped ? 8 + 8 * Math.abs(Math.sin(k + g.t * 6)) : 3), 10, spoken && !stopped ? 16 + 16 * Math.abs(Math.sin(k + g.t * 6)) : 6, stopped ? pal.line : pal.accent, spoken && !stopped ? 0.8 : 0.3, 3);
    }
    g.text("user", 20, 150, { size: 10, align: "left", color: pal.ok });
    for (let k = 0; k < 14; k++) {
      const speaking = t > cut && k * 0.5 + cut < t;
      g.rect(80 + (k + 12) * 15, 150 - (speaking ? 12 : 3), 10, speaking ? 24 : 6, pal.ok, speaking ? 0.8 : 0.2, 3);
    }
    g.line(80 + cut * 3 * 15, 30, 80 + cut * 3 * 15, 180, pal.bad, 0.7, 1.4);
    node(g, "user", 440, 150, { size: 26, color: pal.ok });
    g.text(t > cut ? (on ? "playback stopped, new input handled ✓" : "assistant keeps talking over the user ✕") : "assistant speaking…", 240, 222, { size: 12, color: t > cut ? (on ? pal.ok : pal.bad) : pal.paper });
  },
};

const gatewayFlow: Scene = {
  title: "A request through the LLM gateway",
  caption: "Every call passes the same gates: authenticate, check quotas, look in the cache, route to a provider, filter the reply and meter the tokens. Pick an outcome to see where the request leaves the pipeline.",
  controls: [{ id: "o", kind: "choice", label: "Outcome", options: ["normal call", "rate limited", "cache hit", "primary down: fallback"], initial: 3 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const o = g.v.o;
    const stops: [string, "lock" | "shield" | "cache" | "lb" | "cloud"][] = [["auth", "lock"], ["quota", "shield"], ["cache", "cache"], ["router", "lb"], ["provider", "cloud"]];
    const end = o === 1 ? 1 : o === 2 ? 2 : 4;
    stops.forEach(([nm, kind], k) => {
      const x = 40 + k * 100;
      const hit = k === end && o !== 0 && o !== 3;
      node(g, kind, x, 90, { label: nm, size: 34, color: k > end ? pal.muted : hit ? (o === 1 ? pal.bad : pal.ok) : pal.paper, a: k > end ? 0.3 : 1 });
      if (k < 4) g.arrow(x + 22, 90, x + 78, 90, pal.line, k < end ? 0.9 : 0.3);
    });
    const f = g.loop(3.4) * (end + 1);
    const x = 40 + Math.min(end, f) * 100;
    g.dot(x, 90, 5, o === 1 ? pal.bad : pal.accent);
    g.glow(x, 90, 14, o === 1 ? pal.bad : pal.accent, 0.4);
    if (o === 3) {
      node(g, "cloud", 440, 170, { label: "secondary", size: 30, color: pal.ok });
      g.packet(440, 110, 440, 154, g.loop(2), pal.ok, 3);
      g.text("✕ primary", 440, 120, { size: 9, color: pal.bad });
    }
    g.text(["forwarded and metered", "429 returned with a retry hint", "served from cache, no model call", "circuit open: sent to the secondary provider"][o], 240, 232, { size: 12, color: o === 1 ? pal.bad : pal.paper });
  },
};

const teamQuotas: Scene = {
  title: "Per-team quotas on one shared provider key",
  caption: "Three teams share the provider's rate limit. The gateway meters each team against its own quota, so a runaway batch job from one team is throttled while the others keep their share.",
  controls: [{ id: "a", kind: "range", label: "Team A load (K tokens/min)", min: 50, max: 600, step: 50, initial: 400 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const loads = [g.v.a, 120, 80];
    const quota = 200;
    const names = ["team A (batch)", "team B (chat)", "team C (search)"];
    let served = 0;
    names.forEach((nm, k) => {
      const y = 60 + k * 50;
      const over = loads[k] > quota;
      g.text(nm, 20, y, { size: 10, align: "left" });
      bar(g, 130, y - 5, 230, 10, Math.min(1, loads[k] / 600), over ? pal.bad : pal.ok);
      g.line(130 + (quota / 600) * 230, y - 9, 130 + (quota / 600) * 230, y + 9, pal.accent, 0.9, 1.6);
      g.text(over ? `${loads[k]}K → ${quota}K` : `${loads[k]}K`, 440, y, { size: 10, color: over ? pal.bad : pal.paper });
      served += Math.min(loads[k], quota);
    });
    node(g, "lb", 456, 200, { size: 22 });
    g.text("orange tick = the team's quota", 240, 214, { size: 9, color: pal.muted });
    g.text(`${served}K tokens/min reach the provider, within its limit`, 240, 244, { size: 12, color: pal.ok });
  },
};

const evalRun: Scene = {
  title: "Anatomy of an evaluation run",
  caption: "A run takes a versioned dataset and a target (prompt, model, pipeline), produces outputs, then scores each case with deterministic checks and judges. Results are stored per case so two runs can be compared case by case.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.6, 1.6, 1.8]);
    const steps: [string, "doc" | "gpu" | "shield" | "db" | "lb"][] = [["dataset v7", "doc"], ["target under test", "gpu"], ["scorers", "shield"], ["results store", "db"], ["compare runs", "lb"]];
    steps.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const on = k <= i + 1;
      node(g, kind, x, 100, { label: nm, size: 34, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.4, active: k === i + 1 });
      if (k < 4) g.arrow(x + 24, 100, x + 74, 100, pal.line, on ? 0.9 : 0.3);
    });
    const px = 44 + Math.min(4, i + p) * 98;
    g.dot(px, 100, 5, pal.accent);
    g.glow(px, 100, 14, pal.accent, 0.4);
    g.text(["a frozen dataset of cases", "each case is run through the target", "checks and judges score every output", "per-case scores, latency, cost saved"][i], 240, 190, { size: 12, color: pal.paper });
  },
};

const sliceView: Scene = {
  title: "Overall flat, one slice broken",
  caption: "The average score barely changes, so a headline number looks fine. Split by slice and the numeric-table cases dropped sharply while the others improved slightly. Always compare slices, not just the mean.",
  controls: [{ id: "s", kind: "toggle", label: "Show slices", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const slices = g.v.s === 1;
    const rows: [string, number, number][] = slices ? [["general text", 0.84, 0.87], ["short answers", 0.8, 0.83], ["numeric tables", 0.78, 0.6], ["multilingual", 0.7, 0.72]] : [["all cases", 0.78, 0.77]];
    rows.forEach(([nm, a, b], k) => {
      const y = 50 + k * 40;
      const drop = b < a - 0.05;
      g.text(nm, 20, y + 4, { size: 10, align: "left", color: drop ? pal.bad : pal.paper });
      bar(g, 150, y - 4, 150, 7, a, pal.blue);
      bar(g, 150, y + 6, 150, 7, b, drop ? pal.bad : pal.ok);
      g.text(`${Math.round(a * 100)} → ${Math.round(b * 100)}`, 340, y + 4, { size: 11, align: "left", color: drop ? pal.bad : pal.paper });
    });
    node(g, "db", 450, 60, { size: 24, color: pal.blue });
    g.text(slices ? "numeric tables regressed 18 points: hold the release" : "the average hides the regression ✕", 240, 236, { size: 12, color: slices ? pal.bad : pal.accent });
  },
};

const promptLabels: Scene = {
  title: "Prompt versions and labels",
  caption: "Each edit creates an immutable version. Apps ask for a label such as production, which points at one version. Promoting or rolling back just moves the label, so no code is redeployed and every call can still record the exact version it used.",
  controls: [{ id: "a", kind: "choice", label: "Action", options: ["current state", "promote v14 to production", "roll back to v13"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const a = g.v.a;
    const prod = a === 1 ? 2 : 1;
    const stag = a === 0 ? 1 : 2;
    ["v12", "v13", "v14"].forEach((v, k) => {
      const x = 80 + k * 140;
      node(g, "doc", x, 100, { label: v, size: 42, color: k === 2 ? pal.accent : pal.blue });
    });
    const lab: [string, number, string][] = [["staging", stag, pal.violet], ["production", prod, pal.ok]];
    lab.forEach(([nm, to, col], k) => {
      const x = 80 + to * 140;
      const y = 180 + k * 22;
      g.line(x, 126, x, y - 12, col, 0.8, 1.6);
      chip(g, x, y, nm, col, 10);
    });
    node(g, "server", 456, 60, { size: 22, active: true });
    g.text(a === 2 ? "label moved back: instant rollback" : a === 1 ? "production label moved to v14" : "app reads the version behind the label", 240, 40, { size: 12, color: pal.paper });
  },
};

const lastKnownGood: Scene = {
  title: "Serving prompts when the prompt service fails",
  caption: "The app caches the prompt it last fetched. If the prompt service goes down, the app keeps answering with that last known good copy instead of failing. Without it, an outage in the prompt service breaks every AI feature.",
  controls: [
    { id: "d", kind: "toggle", label: "Prompt service down" },
    { id: "c", kind: "toggle", label: "Local last-known-good copy", initial: true },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const down = g.v.d === 1;
    const cached = g.v.c === 1;
    node(g, "server", 70, 110, { label: "app", size: 40, active: true });
    if (cached) node(g, "cache", 70, 180, { label: "last known good", size: 28, color: pal.ok });
    node(g, "db", 230, 110, { label: "prompt service", size: 44, color: down ? pal.bad : pal.blue, a: down ? 0.5 : 1 });
    if (down) g.text("✕", 230, 110, { size: 20, color: pal.bad });
    else g.packet(96, 110, 204, 110, g.loop(1.5), pal.accent, 2.6);
    g.orb("working", 400, 110, 44, pal.paper, 1);
    g.packet(96, 118, 372, 118, g.loop(1.5, 0.5), down && !cached ? pal.bad : pal.ok, 3);
    chip(g, 240, 230, down ? (cached ? "serving the cached prompt ✓" : "no prompt: feature is down ✕") : "fresh prompt fetched", down && !cached ? pal.bad : pal.ok, 12);
  },
};

const flywheel: Scene = {
  title: "The data flywheel",
  caption: "Real usage produces feedback, feedback is triaged and labelled, labels become tests and training data, and the improved release produces better usage. Each lap makes the next one cheaper and better.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const pts: [number, number, string, "user" | "doc" | "shield" | "db" | "gpu"][] = [[240, 40, "usage", "user"], [380, 110, "feedback", "doc"], [320, 190, "triage + label", "shield"], [160, 190, "tests + data", "db"], [100, 110, "improved release", "gpu"]];
    pts.forEach(([x, y], k) => {
      const [nx, ny] = pts[(k + 1) % 5];
      g.line(x, y, nx, ny, pal.line, 0.7, 1.4);
      g.packet(x, y, nx, ny, (g.t * 0.35 + k * 0.2) % 1, pal.accent, 2.6);
    });
    pts.forEach(([x, y, nm, kind]) => node(g, kind, x, y, { label: nm, size: 34 }));
    g.orb("shaping", 240, 120, 44, pal.paper, 1);
    g.text("each lap raises quality", 240, 242, { size: 12, color: pal.paper });
  },
};

const triage: Scene = {
  title: "Choosing what to label",
  caption: "Failures fall into clusters. A random sample of the labelling budget often misses the small clusters entirely. Selecting from negative feedback and low-confidence cases finds more clusters for the same number of labels.",
  controls: [{ id: "m", kind: "choice", label: "Selection", options: ["random sample", "targeted triage"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const tri = g.v.m === 1;
    const cl: [number, number, string][] = [[100, 80, pal.bad], [260, 70, pal.accent], [380, 140, pal.violet], [160, 160, pal.teal]];
    const pts: { x: number; y: number; c: number }[] = [];
    for (let k = 0; k < 80; k++) {
      const c = g.rnd(k * 2.1) < 0.7 ? -1 : Math.floor(g.rnd(k * 5.3) * 4);
      pts.push(c < 0 ? { x: 30 + g.rnd(k * 3.3) * 420, y: 40 + g.rnd(k * 7.7) * 160, c } : { x: cl[c][0] + (g.rnd(k * 9.1) - 0.5) * 60, y: cl[c][1] + (g.rnd(k * 6.7) - 0.5) * 40, c });
    }
    const found = new Set<number>();
    pts.forEach((p, k) => {
      const picked = tri ? p.c >= 0 && k % 3 === 0 : k % 6 === 0;
      if (picked && p.c >= 0) found.add(p.c);
      g.dot(p.x, p.y, picked ? 5 : 3, p.c < 0 ? pal.muted : cl[p.c][2], picked ? 1 : 0.55);
      if (picked) g.ring(p.x, p.y, 9, pal.paper, 0.8, 1.2);
    });
    g.text(`${found.size} of 4 failure clusters reached`, 240, 230, { size: 13, color: found.size === 4 ? pal.ok : pal.accent });
    g.text("circled items are the ones sent to labelers", 240, 256, { size: 10, color: pal.muted });
  },
};

const trainingGates: Scene = {
  title: "Fine-tuning pipeline with gates",
  caption: "Data is prepared and training runs, but the new model only moves on if it passes the evaluation gates against the current baseline. A model that fails stays out of the registry, no matter how good its training loss looked.",
  controls: [{ id: "f", kind: "toggle", label: "Model fails the gate" }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const fail = g.v.f === 1;
    const { i, p } = g.stage([1.5, 1.5, 1.6, 1.8]);
    const steps: [string, "doc" | "gpu" | "shield" | "db" | "cloud"][] = [["data prep", "doc"], ["training", "gpu"], ["eval gates", "shield"], ["registry", "db"], ["canary", "cloud"]];
    steps.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const blocked = fail && k >= 3;
      const on = k <= i + 1 && !blocked;
      node(g, kind, x, 100, { label: nm, size: 34, color: blocked ? pal.bad : on ? pal.paper : pal.muted, a: on || blocked ? 1 : 0.4, active: k === i + 1 && !blocked });
      if (k < 4) g.arrow(x + 24, 100, x + 74, 100, pal.line, on ? 0.9 : 0.3);
    });
    const stopX = fail ? 44 + 2 * 98 : 44 + 4 * 98;
    const px = Math.min(stopX, 44 + Math.min(4, i + p) * 98);
    g.dot(px, 100, 5, fail && px >= stopX ? pal.bad : pal.accent);
    g.glow(px, 100, 14, fail && px >= stopX ? pal.bad : pal.accent, 0.4);
    g.text(fail ? "fails the regression and safety gates: not promoted ✕" : "passes every gate: moves to canary ✓", 240, 190, { size: 12, color: fail ? pal.bad : pal.ok });
    g.text("gates compare against the current baseline, not against nothing", 240, 220, { size: 10, color: pal.muted });
  },
};

const leakage: Scene = {
  title: "Test data leaking into training",
  caption: "Near-duplicates of test examples hide in the training set, so the model has effectively seen the answers. The reported accuracy looks great and the real accuracy is lower. Deduplicate across splits before measuring anything.",
  controls: [{ id: "d", kind: "toggle", label: "Deduplicate across splits" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const dd = g.v.d === 1;
    g.rect(30, 50, 200, 90, pal.blue, 0.1, 8);
    g.frame(30, 50, 200, 90, pal.blue, 1, 8, 1.2);
    g.text("training set", 130, 44, { size: 10, color: pal.blue });
    g.rect(270, 50, 180, 90, pal.violet, 0.1, 8);
    g.frame(270, 50, 180, 90, pal.violet, 1, 8, 1.2);
    g.text("test set", 360, 44, { size: 10, color: pal.violet });
    for (let k = 0; k < 6; k++) {
      const leak = k < 3 && !dd;
      g.rect(42 + (k % 3) * 62, 62 + Math.floor(k / 3) * 36, 54, 28, leak ? pal.bad : pal.blue, 0.4, 4);
      g.rect(282 + (k % 3) * 56, 62 + Math.floor(k / 3) * 36, 48, 28, leak ? pal.bad : pal.violet, 0.4, 4);
      if (leak) g.line(96 + (k % 3) * 62 - 8, 76 + Math.floor(k / 3) * 36, 282 + (k % 3) * 56, 76 + Math.floor(k / 3) * 36, pal.bad, 0.5, 1);
    }
    const rep = dd ? 0.86 : 0.95;
    g.text("reported accuracy", 60, 190, { size: 10 });
    bar(g, 170, 185, 200, 8, rep, dd ? pal.ok : pal.bad);
    g.text(`${Math.round(rep * 100)}%`, 420, 190, { size: 11, color: pal.paper });
    g.text(dd ? "honest estimate of unseen performance ✓" : "inflated: red pairs are near-duplicates ✕", 240, 236, { size: 12, color: dd ? pal.ok : pal.bad });
  },
};

const tenantTiers: Scene = {
  title: "Tenant isolation tiers",
  caption: "A shared index with a tenant filter is cheapest, but one missing filter is a breach. Partitions give logical separation inside shared infrastructure. A dedicated cluster isolates fully and costs the most. Most platforms mix tiers.",
  controls: [{ id: "t", kind: "choice", label: "Isolation", options: ["shared index + filter", "partition per tenant", "dedicated cluster"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const t = g.v.t;
    const cols = [pal.blue, pal.violet, pal.teal];
    if (t === 0) {
      node(g, "db", 240, 90, { size: 80, color: pal.blue, fill: 0.7 });
      [0, 1, 2].forEach((k) => g.dot(215 + k * 25, 100, 5, cols[k]));
      g.text("one index, rows tagged by tenant", 240, 150, { size: 10, color: pal.muted });
    } else if (t === 1) {
      [0, 1, 2].forEach((k) => node(g, "db", 110 + k * 130, 90, { label: `tenant ${"ABC"[k]}`, size: 54, color: cols[k], fill: 0.6 }));
      g.rect(50, 52, 380, 80, pal.line, 0.05, 10);
      g.frame(50, 52, 380, 80, pal.line, 0.8, 10, 1.1);
      g.text("shared infrastructure", 240, 142, { size: 10, color: pal.muted });
    } else {
      [0, 1, 2].forEach((k) => {
        g.rect(40 + k * 140, 52, 120, 84, cols[k], 0.1, 10);
        g.frame(40 + k * 140, 52, 120, 84, cols[k], 1, 10, 1.3);
        node(g, "db", 100 + k * 140, 92, { size: 46, color: cols[k], fill: 0.6 });
      });
    }
    [["isolation", [0.4, 0.7, 1][t]], ["cost per tenant", [0.2, 0.45, 1][t]]].forEach(([nm, v], k) => {
      const y = 178 + k * 30;
      g.text(nm as string, 40, y, { size: 10, align: "left" });
      bar(g, 170, y - 5, 220, 8, v as number, k === 0 ? pal.ok : pal.accent);
    });
  },
};

const fairQueue: Scene = {
  title: "Noisy neighbours and fair scheduling",
  caption: "Tenant A uploads a huge batch while tenant B sends a few small updates. In one shared queue B waits behind thousands of A's jobs. With per-tenant queues and weighted scheduling B's updates are served within seconds.",
  controls: [{ id: "f", kind: "toggle", label: "Per-tenant fair scheduling", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const fair = g.v.f === 1;
    if (fair) {
      node(g, "queue", 90, 70, { label: "A (bulk)", size: 40, fill: 1 });
      node(g, "queue", 90, 150, { label: "B (small)", size: 40, fill: 0.2 });
      node(g, "lb", 220, 110, { label: "weighted", size: 32 });
      g.packet(124, 70, 200, 104, g.loop(1.6), pal.blue, 2.6);
      g.packet(124, 150, 200, 116, g.loop(0.9), pal.violet, 3);
    } else {
      node(g, "queue", 140, 110, { label: "one shared queue", size: 50, fill: 1 });
      g.packet(170, 110, 240, 110, g.loop(1.6), pal.blue, 2.6);
      chip(g, 120, 160, "B waits behind A", pal.bad, 9);
    }
    for (let k = 0; k < 3; k++) node(g, "gpu", 330, 50 + k * 50, { size: 24, active: true });
    g.packet(250, 110, 306, 70 + (Math.floor(g.t) % 3) * 40, g.loop(1.2), pal.accent, 2.4);
    const wait = fair ? 2 : 90;
    g.text("tenant B's wait", 70, 224, { size: 10 });
    bar(g, 170, 219, 200, 8, wait / 100, fair ? pal.ok : pal.bad);
    g.text(`${wait} s`, 420, 224, { size: 11, color: pal.paper });
  },
};

const riskTiers: Scene = {
  title: "Risk tiers decide the controls",
  caption: "A brainstorming helper needs only automated checks. A customer-facing assistant adds evaluations and monitoring. A system that influences decisions about people needs formal review, bias testing and human oversight. Controls scale with impact.",
  controls: [{ id: "u", kind: "choice", label: "Use case", options: ["internal brainstorming", "customer-facing assistant", "screening job applicants"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const u = g.v.u;
    const tiers = ["low", "medium", "high"];
    const cols = [pal.ok, pal.accent, pal.bad];
    tiers.forEach((t, k) => {
      const y = 50 + k * 44;
      const on = k === u;
      g.rect(30, y, 130, 36, cols[k], on ? 0.3 : 0.08, 8);
      g.frame(30, y, 130, 36, cols[k], on ? 1 : 0.4, 8, on ? 2 : 1);
      g.text(`${t} risk`, 95, y + 18, { size: 11, color: on ? pal.paper : pal.muted });
    });
    const controls = [["self-service registration", "automated checks"], ["required evaluations", "security review", "monitoring"], ["formal approval", "bias testing", "human review of every decision", "periodic reassessment"]][u];
    node(g, "shield", 200, 100, { size: 30, color: cols[u] });
    controls.forEach((c, k) => {
      g.text(`✓ ${c}`, 230, 70 + k * 28, { size: 11, align: "left", color: pal.paper });
    });
    g.text("more impact on people means more evidence required", 240, 236, { size: 11, color: pal.muted });
  },
};

const auditTrail: Scene = {
  title: "Reconstructing a request from the audit trail",
  caption: "To answer 'what did the system do for this customer?' each call must record who, which model and prompt version, which documents were used and what was approved. Drop the prompt version from the log and the incident cannot be traced.",
  controls: [{ id: "v", kind: "toggle", label: "Log the prompt version", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const withVer = g.v.v === 1;
    const rows: [string, string, boolean][] = [["who", "agent-7 for user 4412", true], ["model", "model-x, temperature 0.2", true], ["prompt version", withVer ? "refund-reply@14" : "(not recorded)", withVer], ["documents used", "policy v4, faq 12", true], ["guardrails", "PII masked, 0 blocks", true], ["human approval", "j.rao at 14:02", true]];
    node(g, "db", 50, 100, { label: "audit store", size: 50, color: pal.blue });
    rows.forEach(([k, v, ok], i) => {
      const y = 40 + i * 30;
      g.rect(120, y - 12, 320, 24, ok ? pal.ok : pal.bad, 0.15, 5);
      g.text(k, 130, y, { size: 10, align: "left", color: pal.muted });
      g.text(v, 240, y, { size: 10, align: "left", color: ok ? pal.paper : pal.bad });
    });
    g.text(withVer ? "the exact prompt text can be recovered ✓" : "cannot tell which prompt produced this answer ✕", 240, 236, { size: 12, color: withVer ? pal.ok : pal.bad });
  },
};

export const MORE_AD: Record<string, Scene[]> = {
  [`${K}/designing-an-enterprise-rag-assistant`]: [ragArchitecture, aclFilter],
  [`${K}/designing-a-semantic-search-service`]: [hybridQuery, deltaIndex],
  [`${K}/designing-a-document-qa-and-summarization-pipeline`]: [summarizePatterns, citeCheck],
  [`${A}/designing-a-customer-support-agent`]: [supportRouter, identityInject],
  [`${A}/designing-an-ai-coding-assistant`]: [assistPaths, contextAssembly],
  [`${A}/designing-a-voice-assistant`]: [voiceWaterfall, bargeIn],
  [`${L}/designing-an-llm-gateway`]: [gatewayFlow, teamQuotas],
  [`${L}/designing-an-evaluation-platform`]: [evalRun, sliceView],
  [`${L}/designing-a-prompt-management-and-versioning-system`]: [promptLabels, lastKnownGood],
  [`${D}/designing-a-feedback-and-data-flywheel`]: [flywheel, triage],
  [`${D}/designing-a-fine-tuning-pipeline`]: [trainingGates, leakage],
  [`${E}/designing-a-multi-tenant-rag-platform`]: [tenantTiers, fairQueue],
  [`${E}/designing-ai-governance-and-audit-for-enterprise`]: [riskTiers, auditTrail],
};
