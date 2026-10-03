import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-system-design";
const L = `${P}/llm-platforms-and-infrastructure`;
const I = `${P}/industry-solutions`;

const riskClass: Scene = {
  title: "The registry decides how a tool may be used",
  caption: "Each tool is registered with a risk class. Reads run automatically, writes need approval above a threshold, and destructive operations are blocked for this agent entirely. The agent can ask for anything, but the gateway enforces the class.",
  controls: [{ id: "t", kind: "choice", label: "Agent calls", options: ["lookup_user (read)", "reset_password (write)", "delete_account (destructive)"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const t = g.v.t;
    g.orb("solving", 60, 100, 44, pal.paper, 1);
    chip(g, 60, 150, ["lookup_user", "reset_password", "delete_account"][t], pal.accent, 9);
    node(g, "doc", 200, 100, { label: "registry entry", size: 36, color: pal.violet });
    g.text(["risk: read", "risk: write", "risk: destructive"][t], 200, 144, { size: 9, color: [pal.ok, pal.accent, pal.bad][t] });
    g.packet(86, 100, 176, 100, g.loop(1.4), pal.accent, 3);
    node(g, "lock", 320, 100, { label: "tool gateway", size: 36, color: [pal.ok, pal.accent, pal.bad][t] });
    g.packet(226, 100, 296, 100, g.loop(1.4, 0.3), pal.accent, 3);
    if (t === 0) {
      node(g, "db", 430, 100, { label: "users", size: 36, color: pal.blue });
      g.packet(346, 100, 406, 100, g.loop(1.4, 0.6), pal.ok, 3);
    } else if (t === 1) {
      node(g, "user", 430, 60, { label: "verify user", size: 26, color: pal.accent });
      g.packet(346, 90, 410, 66, g.loop(1.4, 0.6), pal.accent, 3);
    } else g.text("✕", 400, 100, { size: 22, color: pal.bad });
    g.text(["runs automatically with a scoped token", "waits for verification, then runs once", "blocked: this agent has no grant for it"][t], 240, 224, { size: 12, color: [pal.ok, pal.accent, pal.bad][t] });
  },
};

const runLimits: Scene = {
  title: "Limits the runtime enforces, not the prompt",
  caption: "A confused agent can loop forever. The runtime counts steps, tokens and seconds and stops the run at the limit, with loop detection for repeated calls. Telling the model to be economical in its prompt enforces nothing.",
  controls: [{ id: "r", kind: "toggle", label: "Runtime limits", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.r === 1;
    const t = (g.t * 6) % 40;
    const steps = on ? Math.min(t, 18) : t;
    const stopped = on && t >= 18;
    for (let k = 0; k < Math.floor(steps); k++) g.rect(30 + (k % 20) * 21, 50 + Math.floor(k / 20) * 24, 17, 18, k > 12 ? pal.bad : pal.blue, 0.55, 3);
    g.orb(stopped ? "breathing" : "searching", 456, 40, 24, pal.paper, 1);
    ["steps", "tokens", "seconds"].forEach((nm, k) => {
      const y = 130 + k * 28;
      g.text(nm, 30, y, { size: 10, align: "left" });
      const frac = Math.min(1, steps / (on ? 18 : 40));
      bar(g, 110, y - 4, 250, 8, frac, frac >= 1 ? pal.bad : pal.accent);
    });
    g.text(stopped ? "limit hit: run stopped with a clear error ✓" : on ? "within limits" : steps > 25 ? "no enforcement: the loop keeps spending ✕" : "running…", 240, 236, { size: 12, color: stopped ? pal.ok : !on && steps > 25 ? pal.bad : pal.paper });
  },
};

const hashSkip: Scene = {
  title: "Only re-embed what changed",
  caption: "Each chunk has a content hash. When a document is edited, chunks whose hash is unchanged are skipped, and only the changed ones are embedded again. Embedding the whole document every time would pay again for text that did not change.",
  controls: [{ id: "e", kind: "range", label: "Share of the document edited %", min: 5, max: 100, step: 5, initial: 20 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const e = g.v.e / 100;
    const n = 20;
    let changed = 0;
    for (let k = 0; k < n; k++) {
      const ch = k / n < e;
      if (ch) changed++;
      g.rect(30 + (k % 10) * 43, 56 + Math.floor(k / 10) * 40, 38, 32, ch ? pal.accent : pal.blue, ch ? 0.55 : 0.25, 5);
      g.text(ch ? "new" : "same", 49 + (k % 10) * 43, 72 + Math.floor(k / 10) * 40, { size: 8, color: pal.paper });
    }
    node(g, "gpu", 456, 40, { size: 22 });
    g.text(`${changed} of ${n} chunks embedded again`, 240, 160, { size: 13, color: pal.paper });
    g.text("embedding cost", 70, 204, { size: 10 });
    bar(g, 160, 199, 220, 8, changed / n, pal.accent);
    g.text(`${Math.round((1 - changed / n) * 100)}% saved`, 430, 204, { size: 11, color: pal.ok });
  },
};

const deleteProp: Scene = {
  title: "Deletes must reach every copy",
  caption: "A document is deleted at the source. If the pipeline ignores delete events, its chunks stay in the index, the cache and the vector store, and the assistant keeps quoting a document that no longer exists. A tombstone event removes it everywhere.",
  controls: [{ id: "d", kind: "toggle", label: "Handle delete events", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.d === 1;
    const t = (g.t * 0.7) % 10;
    const gone = t > 3;
    node(g, "doc", 60, 100, { label: gone ? "deleted at source" : "source document", size: 42, color: gone ? pal.bad : pal.blue, a: gone ? 0.5 : 1 });
    const stores: [string, "db" | "cache" | "doc"][] = [["search index", "db"], ["vector store", "db"], ["answer cache", "cache"]];
    stores.forEach(([nm, kind], k) => {
      const y = 50 + k * 50;
      const removed = gone && on && t > 4 + k * 0.4;
      node(g, kind, 300, y, { label: nm, size: 28, color: removed ? pal.muted : gone ? pal.bad : pal.paper, a: removed ? 0.3 : 1 });
      g.text(removed ? "removed" : gone ? "still has it" : "has it", 350, y, { size: 9, align: "left", color: removed ? pal.ok : gone ? pal.bad : pal.muted });
      if (gone && on) g.packet(90, 100, 276, y, g.clamp((t - 3.2 - k * 0.3) / 0.8), pal.accent, 2.2);
    });
    g.text(gone ? (on ? "tombstone propagated: the content is gone ✓" : "removed content is still searchable ✕") : "document is live", 240, 232, { size: 12, color: gone ? (on ? pal.ok : pal.bad) : pal.paper });
  },
};

const asOfJoin: Scene = {
  title: "Point-in-time correct training data",
  caption: "A label is created at 10:00. The feature value to train on is the one known at 10:00. Joining the latest value instead leaks information from the future, so the model looks better offline than it ever will online.",
  controls: [{ id: "p", kind: "toggle", label: "As-of join (point-in-time)", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const asof = g.v.p === 1;
    const x0 = 40;
    const sc = 400 / 24;
    g.line(x0, 120, 440, 120, pal.line, 1, 1.4);
    const vals: [number, number][] = [[2, 3], [8, 5], [14, 9], [20, 15]];
    vals.forEach(([h, v]) => {
      g.dot(x0 + h * sc, 120, 4, pal.blue);
      g.text(String(v), x0 + h * sc, 104, { size: 10, color: pal.blue });
    });
    g.text("feature value over time", 240, 80, { size: 9, color: pal.muted });
    const label = 10;
    g.line(x0 + label * sc, 70, x0 + label * sc, 150, pal.accent, 0.9, 1.6);
    g.text("label at 10:00", x0 + label * sc, 62, { size: 9, color: pal.accent });
    const used = asof ? vals.filter(([h]) => h <= label).pop()! : vals[vals.length - 1];
    g.ring(x0 + used[0] * sc, 120, 9, asof ? pal.ok : pal.bad, 1, 2);
    g.packet(x0 + used[0] * sc, 124, x0 + label * sc, 170, g.loop(1.6), asof ? pal.ok : pal.bad, 3);
    node(g, "gpu", 456, 170, { size: 22 });
    g.text(asof ? `uses ${used[1]}, known at 10:00 ✓` : `uses ${used[1]}, from 20:00: leaks the future ✕`, 240, 222, { size: 12, color: asof ? pal.ok : pal.bad });
  },
};

const offOnline: Scene = {
  title: "Offline history, online latest",
  caption: "Features are defined once and computed by batch, streaming or at request time. Every value lands in the offline store with full history for training, and the latest value is copied to the online store for fast serving.",
  controls: [{ id: "p", kind: "choice", label: "Follow", options: ["batch features", "streaming features", "on-demand features"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const p = g.v.p;
    node(g, ["db", "queue", "client"][p] as "db", 50, 100, { label: ["warehouse", "event stream", "request"][p], size: 36 });
    node(g, "server", 160, 100, { label: "same definition", size: 34, active: true });
    g.packet(76, 100, 136, 100, g.loop(1.4), pal.accent, 2.6);
    if (p !== 2) {
      node(g, "db", 300, 50, { label: "offline store", size: 34, color: pal.blue });
      g.packet(186, 94, 276, 56, g.loop(1.4, 0.3), pal.blue, 2.4);
    }
    node(g, "cache", 300, 150, { label: "online store", size: 34, color: pal.ok });
    g.packet(186, 106, 276, 146, g.loop(1.4, 0.5), pal.ok, 2.4);
    node(g, "gpu", 430, 50, { label: "training", size: 26, a: p === 2 ? 0.3 : 1 });
    node(g, "server", 430, 150, { label: "serving", size: 26 });
    if (p !== 2) g.packet(326, 50, 408, 50, g.loop(1.4, 0.7), pal.blue, 2.2);
    g.packet(326, 150, 408, 150, g.loop(1.4, 0.8), pal.ok, 2.2);
    g.text(["refreshed on a schedule, written to both stores", "windowed aggregates updated in near real time", "computed at request time with the same code"][p], 240, 232, { size: 11, color: pal.paper });
  },
};

const evidenceLink: Scene = {
  title: "Every sentence of the note links to evidence",
  caption: "The draft note is built from extracted facts, and each sentence points at the transcript lines or record entries that support it. Pick a sentence to see its evidence. Anything without support is flagged, never guessed.",
  controls: [{ id: "s", kind: "choice", label: "Sentence", options: ["cough for three weeks", "denies fever", "started an ACE inhibitor"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const note = ["cough for three weeks", "denies fever", "started an ACE inhibitor"];
    const evid = ["patient: “it’s been about three weeks now”", "patient: “no, no fever at all”", "EHR medication list: lisinopril, started 4 weeks ago; patient: “the new pill”"];
    node(g, "doc", 60, 80, { label: "draft note", size: 40, color: pal.blue });
    note.forEach((n, k) => {
      const y = 50 + k * 30;
      g.rect(120, y - 11, 160, 22, k === s ? pal.accent : pal.line, k === s ? 0.3 : 0.07, 5);
      g.text(n, 130, y, { size: 10, align: "left", color: k === s ? pal.paper : pal.muted });
    });
    node(g, "phone", 360, 80, { label: "transcript + record", size: 40, color: pal.violet });
    g.packet(282, 50 + s * 30, 330, 80, g.loop(1.4), pal.accent, 3);
    g.rect(40, 160, 400, 44, pal.ok, 0.12, 8);
    g.frame(40, 160, 400, 44, pal.ok, 1, 8, 1.2);
    g.text(evid[s], 50, 182, { size: 10, align: "left", color: pal.paper });
    g.text("unclear audio is flagged for the clinician, not guessed", 240, 238, { size: 10, color: pal.muted });
  },
};

const safetyChecks: Scene = {
  title: "Automatic checks before the clinician sees the draft",
  caption: "Independent checks compare the draft with the transcript: unsupported claims, medication names and doses, negation and laterality. Flip on a negation error and the verifier highlights it so the clinician cannot miss it.",
  controls: [{ id: "n", kind: "toggle", label: "Draft drops a negation" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const bad = g.v.n === 1;
    const checks: [string, boolean][] = [["every claim has transcript support", true], ["drug names valid, doses plausible", true], ["negation preserved (denies, no)", !bad], ["left / right and numbers match", true], ["required template sections present", true]];
    checks.forEach(([c, ok], k) => {
      const y = 46 + k * 30;
      g.rect(30, y - 12, 330, 24, ok ? pal.ok : pal.bad, 0.15, 6);
      g.text(c, 40, y, { size: 10, align: "left", color: pal.paper });
      g.text(ok ? "✓" : "✕ flagged", 340, y, { size: 11, color: ok ? pal.ok : pal.bad });
    });
    node(g, "shield", 420, 90, { size: 34, color: bad ? pal.bad : pal.ok });
    g.text(bad ? "“patient has fever” vs “denies fever”: highlighted for review" : "no flags: still reviewed and signed by the clinician", 240, 224, { size: 11, color: bad ? pal.bad : pal.ok });
  },
};

const fsRisk: Scene = {
  title: "Controls scale with what the assistant does",
  caption: "Answering a balance question, drafting a meeting note, recommending a product and deciding on credit are different activities. Pick one: the further down the list, the more the system relies on deterministic rules and human sign-off.",
  controls: [{ id: "u", kind: "choice", label: "Use case", options: ["answer a balance question", "draft an advisor meeting note", "recommend an investment", "decide on a credit limit"], initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const u = g.v.u;
    const risk = [0.15, 0.4, 0.8, 1][u];
    const ctl: string[][] = [["figures from the system of record"], ["advisor reviews and owns the note", "approved language"], ["deterministic suitability engine", "licensed advisor signs off", "disclosures inserted by code"], ["model is advisory only", "fairness testing, explainable reasons", "formal validation + human decision"]];
    g.text("risk", 30, 50, { size: 10, align: "left" });
    bar(g, 70, 45, 250, 10, risk, risk > 0.7 ? pal.bad : risk > 0.3 ? pal.accent : pal.ok);
    ctl[u].forEach((c, k) => g.text(`✓ ${c}`, 40, 96 + k * 28, { size: 11, align: "left", color: pal.paper }));
    node(g, ["server", "doc", "lock", "shield"][u] as "server", 410, 110, { size: 40, color: risk > 0.7 ? pal.bad : pal.ok });
    g.text("never let the model produce the numbers or make the decision", 240, 232, { size: 10, color: pal.muted });
  },
};

const numbersFromSystems: Scene = {
  title: "Figures come from the system of record",
  caption: "A model writing a number from memory can be wrong. The assistant fetches balances and rates from the authoritative service and renders them into the reply. The model explains, it does not calculate.",
  controls: [{ id: "m", kind: "choice", label: "Where the figure comes from", options: ["model-generated text", "ledger service, rendered"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const live = g.v.m === 1;
    g.orb("composing", 60, 100, 44, pal.paper, 1);
    node(g, "db", 220, 100, { label: "ledger", size: 42, color: live ? pal.ok : pal.muted, a: live ? 1 : 0.3 });
    g.text("balance $4,210.55", 220, 140, { size: 9, color: pal.muted });
    if (live) g.packet(86, 100, 196, 100, g.loop(1.5), pal.ok, 3);
    g.rect(300, 60, 150, 80, live ? pal.ok : pal.bad, 0.12, 10);
    g.frame(300, 60, 150, 80, live ? pal.ok : pal.bad, 1, 10, 1.4);
    g.text("Your balance is", 375, 86, { size: 10, color: pal.paper });
    g.text(live ? "$4,210.55" : "about $4,200", 375, 112, { size: 14, color: live ? pal.ok : pal.bad, bold: true });
    g.text(live ? "exact and auditable ✓" : "approximate figure given as fact ✕", 240, 206, { size: 12, color: live ? pal.ok : pal.bad });
  },
};

const definitionsMatter: Scene = {
  title: "A clause means what its definitions say",
  caption: "The liability clause caps damages at 'the Charges', a defined term, and clause 14 carves out data breaches. Read alone the clause looks harmless. With the definitions and the exception supplied, the real position is clear.",
  controls: [{ id: "c", kind: "toggle", label: "Supply definitions and cross-references", initial: true }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const ctx = g.v.c === 1;
    node(g, "doc", 60, 80, { label: "clause 12", size: 40, color: pal.blue });
    g.text("liability capped at the Charges", 130, 70, { size: 10, align: "left", color: pal.paper });
    if (ctx) {
      node(g, "doc", 60, 150, { label: "definitions", size: 28, color: pal.violet });
      g.text("“Charges” = fees paid in 12 months", 130, 140, { size: 10, align: "left", color: pal.violet });
      node(g, "doc", 60, 205, { label: "clause 14", size: 28, color: pal.accent });
      g.text("exception: data breach is uncapped", 130, 196, { size: 10, align: "left", color: pal.accent });
      g.packet(80, 90, 80, 134, g.loop(1.4), pal.violet, 2.4);
    }
    g.orb("solving", 400, 110, 44, pal.paper, 1);
    chip(g, 400, 170, ctx ? "cap = 12 months; breaches uncapped" : "cap looks fine", ctx ? pal.ok : pal.bad, 9);
    g.text(ctx ? "correct reading ✓" : "risk missed: the exception was never seen ✕", 240, 244, { size: 12, color: ctx ? pal.ok : pal.bad });
  },
};

const absenceProof: Scene = {
  title: "Proving a clause is absent",
  caption: "'No termination for convenience clause found' is only trustworthy if every part of the contract was searched, including schedules and amendments. The system reports the sections it covered so the lawyer can see the search was complete.",
  controls: [{ id: "s", kind: "toggle", label: "Search schedules and amendments too", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const full = g.v.s === 1;
    const parts = ["main terms", "definitions", "schedule 1", "schedule 2", "amendment 1", "order form"];
    const covered = parts.map((_, k) => (full ? true : k < 2));
    parts.forEach((p, k) => {
      const x = 30 + (k % 3) * 140;
      const y = 60 + Math.floor(k / 3) * 56;
      g.rect(x, y, 128, 40, covered[k] ? pal.ok : pal.line, covered[k] ? 0.22 : 0.07, 7);
      g.frame(x, y, 128, 40, covered[k] ? pal.ok : pal.line, covered[k] ? 1 : 0.4, 7, 1.2);
      g.text(p, x + 64, y + 14, { size: 10, color: pal.paper });
      g.text(covered[k] ? "searched" : "not searched", x + 64, y + 28, { size: 8, color: covered[k] ? pal.ok : pal.bad });
    });
    node(g, "doc", 440, 40, { size: 20 });
    const n = covered.filter(Boolean).length;
    g.text(n === 6 ? "absence is justified: all 6 parts searched ✓" : `only ${n} of 6 parts searched: absence is not proven ✕`, 240, 200, { size: 12, color: n === 6 ? pal.ok : pal.bad });
  },
};

const sharedDevice: Scene = {
  title: "Relationships reveal the pattern",
  caption: "The alerted account looks ordinary alone. In the entity graph it shares a device with several other accounts, some already reported. Widen the neighbourhood and the cluster appears, which is evidence the narrative can cite.",
  controls: [{ id: "h", kind: "range", label: "Hops from the alerted account", min: 0, max: 3, step: 1, initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const h = g.v.h;
    const pts: [number, number, number, boolean][] = [[240, 110, 0, false], [150, 70, 1, false], [330, 70, 1, false], [100, 140, 2, true], [190, 170, 2, false], [380, 140, 2, true], [290, 175, 2, false], [60, 70, 3, true], [420, 190, 3, true]];
    const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [3, 7], [5, 8]];
    edges.forEach(([a, b]) => {
      if (pts[a][2] <= h && pts[b][2] <= h) g.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], pal.line, 0.8, 1.4);
    });
    pts.forEach(([x, y, d, bad], k) => {
      if (d > h) return;
      node(g, k === 0 ? "user" : "phone", x, y, { size: 22, color: k === 0 ? pal.accent : bad ? pal.bad : pal.paper });
    });
    const flagged = pts.filter((p) => p[2] <= h && p[3]).length;
    g.text(flagged ? `${flagged} linked accounts previously reported` : "no linked reports within this distance", 240, 232, { size: 12, color: flagged ? pal.bad : pal.muted });
    g.text("the assistant cites these records, it does not infer intent", 240, 254, { size: 10, color: pal.muted });
  },
};

const playbookSteps: Scene = {
  title: "A playbook workflow, with the analyst deciding",
  caption: "For this alert type the workflow pulls the same evidence every time: profile, transactions, devices, counterparties, prior cases. The model summarises what came back and drafts the narrative, then the analyst reviews and decides.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.4, 1.4, 1.4, 1.4, 1.6]);
    const steps: [string, "user" | "db" | "phone" | "doc" | "shield"][] = [["profile", "user"], ["transactions", "db"], ["devices", "phone"], ["graph + prior cases", "doc"], ["analyst decides", "shield"]];
    steps.forEach(([nm, kind], k) => {
      const x = 44 + k * 98;
      const on = k <= i;
      node(g, kind, x, 90, { label: nm, size: 32, color: on ? pal.paper : pal.muted, a: on ? 1 : 0.4, active: k === i });
      if (k < 4) g.arrow(x + 22, 90, x + 76, 90, pal.line, on ? 0.9 : 0.3);
    });
    const px = 44 + Math.min(4, i + p) * 98;
    g.dot(px, 90, 5, pal.accent);
    g.glow(px, 90, 14, pal.accent, 0.4);
    g.orb(i >= 3 ? "composing" : "breathing", 240, 175, 36, pal.paper, 1);
    g.text(["fixed lookups, no free-form agent", "", "", "the model summarises results with source links", "the person is accountable for the outcome"][i] || "gathering evidence", 240, 232, { size: 12, color: pal.paper });
  },
};

const hintLadder: Scene = {
  title: "The hint ladder",
  caption: "The tutor starts with a question, then a nudge, then a worked step, and only reveals the answer after real attempts. Pick the level to see what the student receives. Giving the answer first teaches the student to ask, not to think.",
  controls: [{ id: "h", kind: "range", label: "Hint level", min: 1, max: 4, step: 1, initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const h = g.v.h;
    const rungs = ["ask what they notice", "point at the key idea", "show one worked step", "reveal the answer"];
    const sample = ["Are halves and thirds the same size?", "Try drawing both on the same bar.", "Six equal pieces fit both: 3/6 + 2/6.", "1/2 + 1/3 = 5/6."];
    rungs.forEach((r, k) => {
      const y = 180 - k * 36;
      const on = k + 1 === h;
      g.rect(30, y - 13, 220, 26, on ? pal.ok : k + 1 < h ? pal.line : pal.line, on ? 0.3 : 0.07, 7);
      g.frame(30, y - 13, 220, 26, on ? pal.ok : pal.line, on ? 1 : 0.4, 7, on ? 2 : 1);
      g.text(`${k + 1}. ${r}`, 40, y, { size: 10, align: "left", color: on ? pal.paper : pal.muted });
    });
    g.orb("composing", 330, 90, 40, pal.paper, 1);
    g.rect(280, 130, 180, 58, pal.accent, 0.12, 8);
    g.text(sample[h - 1], 290, 159, { size: 9, align: "left", color: pal.paper });
    g.text(h === 4 ? "only after genuine attempts" : "keeps the student thinking", 240, 230, { size: 11, color: h === 4 ? pal.accent : pal.ok });
  },
};

const mastery: Scene = {
  title: "Tracking mastery per skill",
  caption: "Each answer updates the student model. Correct answers raise the estimate for that skill, mistakes lower it, and a weak prerequisite explains trouble further up. The tutor moves on only when mastery clears the gate.",
  controls: [{ id: "c", kind: "range", label: "Correct answers in a row", min: 0, max: 8, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const c = g.v.c;
    const skills: [string, number, number][] = [["unit fractions", 0.8, 0], ["common denominators", 0.3, 1], ["adding fractions", 0.2, 2]];
    skills.forEach(([nm, base, k], i) => {
      const y = 60 + i * 46;
      const m = Math.min(1, base + (i === 1 ? c * 0.09 : i === 2 ? Math.max(0, c - 3) * 0.1 : 0));
      g.text(nm, 30, y - 12, { size: 10, align: "left" });
      bar(g, 30, y - 4, 260, 10, m, m >= 0.8 ? pal.ok : m >= 0.5 ? pal.accent : pal.bad);
      g.line(30 + 0.8 * 260, y - 8, 30 + 0.8 * 260, y + 10, pal.paper, 0.6, 1.2);
      g.text(m >= 0.8 ? "mastered" : "practising", 310, y, { size: 10, align: "left", color: m >= 0.8 ? pal.ok : pal.muted });
      if (k > 0) g.arrow(60, y - 22, 60, y - 14, pal.line, 0.6);
    });
    node(g, "user", 430, 110, { label: "student", size: 30 });
    g.text("white tick = mastery gate", 240, 224, { size: 9, color: pal.muted });
    g.text("weak prerequisites explain trouble above them", 240, 246, { size: 10, color: pal.muted });
  },
};

const recFunnel: Scene = {
  title: "Retrieve, rank, re-rank",
  caption: "Millions of items are narrowed to a few thousand candidates by fast retrieval, scored by a heavier ranking model, then re-ranked for diversity and policy. Each stage is slower per item, so each sees fewer items.",
  controls: [{ id: "c", kind: "range", label: "Candidates retrieved", min: 200, max: 5000, step: 200, initial: 2000 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const cand = g.v.c;
    const stages: [string, number, string][] = [["catalogue", 50000000, pal.line], ["retrieved", cand, pal.blue], ["ranked", Math.min(cand, 300), pal.violet], ["shown", 20, pal.ok]];
    stages.forEach(([nm, n, col], k) => {
      const w = 40 + (Math.log10(n) / 7.7) * 320;
      g.rect(240 - w / 2, 36 + k * 44, w, 32, col, 0.55, 6);
      g.text(`${nm}: ${fmt(n)}`, 240, 52 + k * 44, { size: 10, color: pal.paper });
    });
    const lat = 8 + cand / 100 + 20;
    g.text(`latency ~${Math.round(lat)} ms`, 240, 218, { size: 13, color: lat < 120 ? pal.ok : pal.bad });
    g.text("more candidates raise recall and also ranking time", 240, 246, { size: 10, color: pal.muted });
    node(g, "gpu", 456, 40, { size: 22 });
  },
};

const whereLlmRuns: Scene = {
  title: "Where the LLM runs in a recommender",
  caption: "Offline, the LLM enriches every item once and the results are stored as features, so the hot path stays fast. Online, it appears only for explicit conversational requests where a second or two is acceptable. Calling it per request at scale would break latency and budget.",
  controls: [{ id: "w", kind: "choice", label: "LLM placement", options: ["offline enrichment", "conversational request only", "on every request"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const w = g.v.w;
    node(g, "user", 40, 100, { label: "request", size: 30 });
    node(g, "gpu", 150, 100, { label: "ranker", size: 34, active: true });
    node(g, "db", 270, 100, { label: "features", size: 34, color: pal.blue });
    g.packet(64, 100, 126, 100, g.loop(1.2), pal.accent, 2.6);
    g.packet(176, 100, 246, 100, g.loop(1.2, 0.3), pal.accent, 2.6);
    if (w === 0) {
      g.orb("working", 400, 50, 34, pal.paper, 1);
      g.text("LLM, nightly", 400, 80, { size: 9, color: pal.muted });
      g.packet(380, 70, 292, 92, g.loop(2.4), pal.ok, 2.6);
    } else if (w === 1) {
      g.orb("working", 400, 150, 34, pal.paper, 1);
      g.text("LLM, only when the user chats", 400, 180, { size: 9, color: pal.muted });
      g.packet(176, 112, 378, 150, g.loop(2.4), pal.accent, 2.6);
    } else {
      g.orb("working", 150, 190, 34, pal.paper, 1);
      g.packet(150, 118, 150, 168, g.loop(1.0), pal.bad, 2.6);
    }
    const lat = [60, 60, 1500][w];
    g.text("page latency", 60, 222, { size: 10 });
    bar(g, 150, 217, 220, 8, Math.min(1, lat / 1500), lat > 500 ? pal.bad : pal.ok);
    g.text(`~${lat} ms`, 430, 222, { size: 11, color: pal.paper });
    g.text(["fast hot path, richer features", "interactive latency only where the user expects it", "too slow and too costly at millions of requests"][w], 240, 252, { size: 10, color: w === 2 ? pal.bad : pal.muted });
  },
};

export const MORE_AD_6: Record<string, Scene[]> = {
  [`${L}/designing-an-agent-runtime-and-tool-registry`]: [riskClass, runLimits],
  [`${L}/designing-a-rag-ingestion-and-connector-platform`]: [hashSkip, deleteProp],
  [`${L}/designing-a-feature-and-embedding-store`]: [asOfJoin, offOnline],
  [`${I}/designing-a-clinical-documentation-assistant`]: [evidenceLink, safetyChecks],
  [`${I}/designing-a-financial-services-advisory-and-compliance-assistant`]: [fsRisk, numbersFromSystems],
  [`${I}/designing-a-legal-contract-review-system`]: [definitionsMatter, absenceProof],
  [`${I}/designing-a-fraud-and-risk-investigation-assistant`]: [sharedDevice, playbookSteps],
  [`${I}/designing-an-ai-tutoring-system`]: [hintLadder, mastery],
  [`${I}/designing-an-llm-augmented-recommendation-system`]: [recFunnel, whereLlmRuns],
};
