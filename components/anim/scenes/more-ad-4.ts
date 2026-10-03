import type { Scene } from "../scene/types";
import { bar, chip, fmt } from "./kit";
import { node } from "./shapes";

const P = "ai-system-design";
const E = `${P}/enterprise-and-multi-tenant-ai`;
const M = `${P}/media-and-content-ai`;
const R = `${P}/reliability-cost-and-scale`;

const threeWayAuth: Scene = {
  title: "An action needs three yeses",
  caption: "The user must hold the right, the agent must be allowed to use that tool, and the task's scope must include it. Toggle each: remove any one and the action is refused. Trusting only the agent or only the user's broad rights is how over-reach happens.",
  controls: [
    { id: "u", kind: "toggle", label: "User has the right", initial: true },
    { id: "a", kind: "toggle", label: "Agent may use the tool", initial: true },
    { id: "t", kind: "toggle", label: "Task scope includes it", initial: true },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const c = [g.v.u === 1, g.v.a === 1, g.v.t === 1];
    const allow = c.every(Boolean);
    const lab = ["user", "agent", "task scope"];
    c.forEach((on, k) => {
      const x = 90 + k * 150;
      node(g, k === 0 ? "user" : k === 1 ? "server" : "doc", x, 70, { label: lab[k], size: 40, color: on ? pal.ok : pal.bad });
      g.text(on ? "✓" : "✕", x, 114, { size: 16, color: on ? pal.ok : pal.bad });
      g.line(x, 126, 240, 160, on ? pal.ok : pal.bad, 0.6, 1.4);
    });
    node(g, "lock", 240, 176, { label: "tool call", size: 34, color: allow ? pal.ok : pal.bad });
    if (allow) g.packet(240, 130, 240, 158, g.loop(1.2), pal.ok, 3);
    chip(g, 240, 236, allow ? "authorised" : "refused: one check failed", allow ? pal.ok : pal.bad, 12);
  },
};

const narrowChain: Scene = {
  title: "Delegation must narrow, never widen",
  caption: "The user grants an agent a set of scopes. Each time it hands work to another agent, the new token can carry only a subset. A downstream agent asking for more than its caller holds is rejected, and the originating user stays visible throughout.",
  controls: [{ id: "w", kind: "toggle", label: "Downstream asks for more" }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const wide = g.v.w === 1;
    const hops: [string, string[]][] = [["user grants", ["mail.read", "files.read", "calendar.write"]], ["agent A", ["mail.read", "files.read"]], ["agent B", wide ? ["mail.read", "mail.send"] : ["files.read"]]];
    hops.forEach(([nm, scopes], k) => {
      const x = 80 + k * 160;
      node(g, k === 0 ? "user" : "server", x, 60, { label: nm, size: 36, color: wide && k === 2 ? pal.bad : pal.paper });
      scopes.forEach((s, j) => {
        const bad = wide && k === 2 && s === "mail.send";
        chip(g, x, 110 + j * 26, s, bad ? pal.bad : pal.accent, 9);
      });
      if (k < 2) g.packet(x + 24, 60, x + 136, 60, (g.t * 0.8 + k * 0.3) % 1, wide && k === 1 ? pal.bad : pal.accent, 2.6);
    });
    g.text(wide ? "mail.send was never granted upstream: token request rejected ✕" : "each hop holds a subset of the scopes above it ✓", 240, 232, { size: 12, color: wide ? pal.bad : pal.ok });
  },
};

const attribution: Scene = {
  title: "Attributing token spend",
  caption: "Every call through the gateway carries a team and feature tag, so each token lands on a bar. Calls without tags fall into an unattributed bucket nobody owns, which is why the gateway should refuse them.",
  controls: [{ id: "t", kind: "toggle", label: "Gateway requires tags", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const tags = g.v.t === 1;
    const teams: [string, number, string][] = [["support", 0.42, pal.blue], ["search", 0.26, pal.violet], ["sales tools", 0.14, pal.teal]];
    const unattrib = tags ? 0.02 : 0.18;
    let x = 30;
    teams.forEach(([nm, v, col]) => {
      const w = v * 420;
      g.rect(x, 70, w - 2, 36, col, 0.7, 4);
      if (w > 50) g.text(nm, x + w / 2, 88, { size: 10, color: pal.ink });
      x += w;
    });
    g.rect(x, 70, unattrib * 420, 36, pal.bad, 0.7, 4);
    g.text("unowned", x + 4, 130, { size: 9, align: "left", color: pal.bad });
    node(g, "lb", 456, 40, { size: 22 });
    g.text("monthly LLM spend by owner", 240, 50, { size: 10, color: pal.muted });
    g.text(tags ? "almost everything has an owner ✓" : `${Math.round(unattrib * 100)}% of spend has no owner ✕`, 240, 180, { size: 13, color: tags ? pal.ok : pal.bad });
    g.text("untagged spend cannot be charged back or optimised", 240, 214, { size: 10, color: pal.muted });
  },
};

const budgetLadder: Scene = {
  title: "Budget alerts and graceful limits",
  caption: "Spend climbs toward the monthly budget. Alerts fire at half and four-fifths, and at the limit the platform degrades to a cheaper model instead of failing outright. Drag the spend to see each rung.",
  controls: [{ id: "s", kind: "range", label: "Spend % of budget", min: 0, max: 130, step: 5, initial: 85 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const s = g.v.s;
    const rungs: [number, string][] = [[50, "50%: notify the owner"], [80, "80%: alert with top cost drivers"], [100, "100%: switch to a cheaper model"], [120, "120%: pause non-critical jobs"]];
    bar(g, 40, 50, 400, 14, Math.min(1, s / 130), s >= 100 ? pal.bad : s >= 80 ? pal.accent : pal.ok);
    [50, 80, 100].forEach((m) => g.line(40 + (m / 130) * 400, 44, 40 + (m / 130) * 400, 70, pal.paper, 0.6, 1.2));
    rungs.forEach(([th, nm], k) => {
      const y = 100 + k * 28;
      const on = s >= th;
      g.dot(46, y, 5, on ? (th >= 100 ? pal.bad : pal.accent) : pal.line);
      g.text(nm, 62, y, { size: 11, align: "left", color: on ? pal.paper : pal.muted });
    });
    node(g, "gpu", 440, 150, { size: 26, color: s >= 100 ? pal.accent : pal.ok });
    g.text(s >= 100 ? "degraded gracefully: users still get answers" : "within budget", 240, 232, { size: 12, color: s >= 100 ? pal.accent : pal.ok });
  },
};

const tokenizeFlow: Scene = {
  title: "Tokenise before the model, restore after",
  caption: "Personal values are swapped for placeholders before the text leaves your boundary, so the model reasons about 'PERSON_1' and never sees the name. The mapping stays in a vault, and only the authorised reader gets the real values back.",
  controls: [{ id: "m", kind: "choice", label: "Handling", options: ["send raw", "tokenise + restore"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const tok = g.v.m === 1;
    node(g, "doc", 50, 70, { label: "ticket", size: 38, color: pal.blue });
    chip(g, 50, 120, "Anita Rao, anita@x.io", pal.bad, 8);
    if (tok) {
      node(g, "lock", 170, 70, { label: "tokenise", size: 34, color: pal.accent });
      node(g, "db", 170, 160, { label: "vault", size: 34, color: pal.violet });
      g.packet(76, 70, 148, 70, g.loop(1.6), pal.accent, 2.6);
      g.packet(170, 90, 170, 142, g.loop(1.6, 0.3), pal.violet, 2.4);
      chip(g, 290, 70, "<PERSON_1>, <EMAIL_1>", pal.ok, 8);
      g.packet(196, 70, 258, 70, g.loop(1.6, 0.5), pal.ok, 2.6);
    } else {
      chip(g, 290, 70, "Anita Rao, anita@x.io", pal.bad, 8);
      g.packet(76, 70, 250, 70, g.loop(1.6), pal.bad, 2.6);
    }
    g.orb("working", 400, 70, 40, pal.paper, 1);
    g.text("model / provider", 400, 100, { size: 9, color: pal.muted });
    g.text(tok ? "the model saw placeholders only; the vault restores names for the agent ✓" : "real personal data left your boundary ✕", 240, 222, { size: 12, color: tok ? pal.ok : pal.bad });
  },
};

const piiPaths: Scene = {
  title: "The forgotten places personal data lands",
  caption: "The main request is only one path. Logs, traces, caches, the vector index and evaluation exports can each keep raw personal data. Switch on redaction at every sink and the leaks go away.",
  controls: [{ id: "r", kind: "toggle", label: "Redact at every sink" }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const red = g.v.r === 1;
    node(g, "user", 40, 110, { label: "request", size: 34 });
    node(g, "lb", 130, 110, { label: "gateway", size: 32 });
    g.packet(62, 110, 106, 110, g.loop(1.4), pal.accent, 2.4);
    const sinks: [string, "db" | "doc" | "cache" | "gpu"][] = [["logs", "doc"], ["traces", "doc"], ["cache", "cache"], ["vector index", "db"], ["eval exports", "gpu"]];
    let leaks = 0;
    sinks.forEach(([nm, kind], k) => {
      const y = 36 + k * 44;
      const leak = !red;
      if (leak) leaks++;
      node(g, kind, 330, y, { label: nm, size: 26, color: leak ? pal.bad : pal.ok });
      g.packet(150, 106, 306, y, (g.t * 0.7 + k * 0.15) % 1, leak ? pal.bad : pal.ok, 2);
    });
    g.text(red ? "no raw personal data stored anywhere ✓" : `${leaks} places keep raw personal data ✕`, 240, 252, { size: 12, color: red ? pal.ok : pal.bad });
  },
};

const imageQueue: Scene = {
  title: "Generation jobs: fair queues, interactive first",
  caption: "Image jobs are slow, so they go on a durable queue instead of holding a request open. Interactive jobs jump ahead of bulk ones, and when the queue is too long the service sheds load with an honest wait estimate rather than letting waits grow without bound.",
  controls: [{ id: "p", kind: "toggle", label: "Interactive priority", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const prio = g.v.p === 1;
    node(g, "client", 40, 110, { label: "submit", size: 32 });
    node(g, "queue", 160, 70, { label: "bulk jobs", size: 40, fill: 1 });
    node(g, "queue", 160, 160, { label: "interactive", size: 40, fill: 0.2 });
    for (let k = 0; k < 3; k++) node(g, "gpu", 330, 50 + k * 50, { size: 28, active: true });
    g.packet(62, 106, 130, 76, g.loop(1.6), pal.blue, 2.4);
    g.packet(62, 114, 130, 156, g.loop(1.6, 0.3), pal.accent, 2.4);
    g.packet(190, 70, 306, 56 + (Math.floor(g.t) % 3) * 40, g.loop(prio ? 2.6 : 1.4), pal.blue, 2.4);
    g.packet(190, 160, 306, 56 + ((Math.floor(g.t) + 1) % 3) * 40, g.loop(prio ? 0.9 : 2.6, 0.2), pal.accent, 3);
    const wait = prio ? 4 : 70;
    g.text("interactive wait", 60, 232, { size: 10 });
    bar(g, 160, 227, 200, 8, wait / 80, prio ? pal.ok : pal.bad);
    g.text(`${wait} s`, 410, 232, { size: 11, color: pal.paper });
  },
};

const batchWindow: Scene = {
  title: "Batching image requests",
  caption: "Waiting a little lets the server group compatible requests into one pass through the GPU, which raises throughput. Wait too long and every user pays in latency. Slide the window to find the balance.",
  controls: [{ id: "w", kind: "range", label: "Batch window (ms)", min: 0, max: 400, step: 20, initial: 120 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const w = g.v.w;
    const batch = Math.min(8, 1 + Math.floor(w / 50));
    const thr = batch / (1 + (batch - 1) * 0.15);
    const lat = 4 + w / 100 + batch * 0.4;
    for (let k = 0; k < 8; k++) g.rect(40 + k * 30, 60, 24, 24, k < batch ? pal.accent : pal.line, k < batch ? 0.6 : 0.1, 4);
    g.text("requests grouped into one batch", 160, 50, { size: 9, color: pal.muted });
    node(g, "gpu", 340, 72, { size: 40, active: true });
    g.packet(250, 72, 316, 72, g.loop(1.2), pal.accent, 3);
    g.text("throughput", 40, 150, { size: 10 });
    bar(g, 130, 145, 260, 8, thr / 7, pal.ok);
    g.text(`${thr.toFixed(1)}x`, 430, 150, { size: 11, color: pal.paper });
    g.text("latency per image", 40, 182, { size: 10 });
    bar(g, 130, 177, 260, 8, lat / 10, lat > 7 ? pal.bad : pal.accent);
    g.text(`${lat.toFixed(1)} s`, 430, 182, { size: 11, color: pal.paper });
    g.text("bigger batches help the fleet and cost each user time", 240, 232, { size: 10, color: pal.muted });
  },
};

const modFunnel: Scene = {
  title: "The moderation funnel",
  caption: "Hash matches and rules take the first slice, fast classifiers take most of the rest, and only the uncertain remainder reaches the costly judge. Humans see the smallest, hardest set. Move the classifier's confident zone and the load shifts between stages.",
  controls: [{ id: "c", kind: "range", label: "Classifier confident zone %", min: 60, max: 98, step: 2, initial: 90 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const conf = g.v.c / 100;
    const total = 300;
    const hash = total * 0.04;
    const afterHash = total - hash;
    const toLlm = afterHash * (1 - conf);
    const toHuman = toLlm * 0.12;
    const stages: [string, number, string][] = [["all items", total, pal.line], ["hash + rules", afterHash, pal.blue], ["classifier uncertain", toLlm, pal.violet], ["human review", toHuman, pal.accent]];
    stages.forEach(([nm, v, col], k) => {
      const w = Math.max(20, (v / total) * 360);
      g.rect(240 - w / 2, 40 + k * 44, w, 32, col, 0.55, 6);
      g.text(`${nm}: ${fmt(v)}M`, 240, 56 + k * 44, { size: 10, color: pal.paper });
    });
    node(g, "gpu", 440, 130, { size: 22, color: pal.violet });
    g.text(`LLM judge handles ${fmt(toLlm)}M a day`, 240, 226, { size: 13, color: toLlm > 40 ? pal.bad : pal.ok });
    g.text("a more confident classifier means fewer expensive calls", 240, 252, { size: 10, color: pal.muted });
  },
};

const graduated: Scene = {
  title: "Graduated actions, not just keep or delete",
  caption: "Severity and confidence together choose the action. Clear severe violations are removed. Ambiguous low-severity items get a label or reduced reach and an appeal path. Context from the thread can move an item between rows.",
  controls: [{ id: "i", kind: "choice", label: "Item", options: ["clear threat", "ambiguous rudeness", "quoted slur in a news post"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const i = g.v.i;
    const actions = ["remove + suspend", "remove", "reduce reach + warn", "label only", "allow"];
    const pick = [0, 2, 4][i];
    chip(g, 240, 28, ["“I know where you live”", "“people like you should vanish”", "“the chant included [slur]”"][i], pal.accent, 10);
    actions.forEach((a, k) => {
      const y = 62 + k * 30;
      const on = k === pick;
      g.rect(80, y - 12, 240, 24, on ? pal.ok : pal.line, on ? 0.25 : 0.07, 6);
      g.frame(80, y - 12, 240, 24, on ? pal.ok : pal.line, on ? 1 : 0.4, 6, on ? 2 : 1);
      g.text(a, 92, y, { size: 11, align: "left", color: on ? pal.paper : pal.muted });
    });
    node(g, "shield", 400, 130, { size: 34, color: pal.ok });
    g.text(["severe and clear: act immediately", "ambiguous: limit reach and let a human confirm", "context shows reporting, not harassment"][i], 240, 232, { size: 11, color: pal.paper });
  },
};

const placeholders: Scene = {
  title: "Protecting placeholders in translation",
  caption: "Variables and tags are swapped for opaque tokens before translation, then restored and checked afterwards. Skip the protection and the translator may translate, reorder or drop a variable, breaking the interface.",
  controls: [{ id: "p", kind: "toggle", label: "Protect placeholders", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const on = g.v.p === 1;
    const { i, p } = g.stage([1.6, 1.6, 1.8]);
    chip(g, 240, 40, "Hello {name}, you have {count} new files", pal.accent, 11);
    g.orb("composing", 90, 130, 38, pal.paper, 1);
    g.text("translator", 90, 160, { size: 9, color: pal.muted });
    if (i >= 0) {
      chip(g, 270, 100, on ? "Hello ⟦1⟧, you have ⟦2⟧ new files" : "Hello {name}, you have {count} new files", pal.blue, 9);
      g.packet(120, 124, 200, 108, i === 0 ? p : 1, pal.accent, 2.6);
    }
    if (i >= 1) {
      chip(g, 270, 150, on ? "Hallo ⟦1⟧, du hast ⟦2⟧ neue Dateien" : "Hallo {Name}, du hast {Anzahl} neue Dateien", on ? pal.ok : pal.bad, 9);
      g.packet(120, 136, 200, 148, i === 1 ? p : 1, pal.accent, 2.6);
    }
    if (i === 2) chip(g, 240, 200, on ? "restored and verified: {name} {count} intact ✓" : "variables translated: the UI breaks ✕", on ? pal.ok : pal.bad, 11);
    g.text(["mark variables as opaque tokens", "translate the sentence around them", "restore tokens and validate each appears once"][i], 240, 250, { size: 11, color: pal.muted });
  },
};

const qeRouting: Scene = {
  title: "Quality estimation decides who reviews",
  caption: "Each translated segment gets an estimated quality score. High scores ship automatically, middling ones get a light review, low ones go to a linguist. Raise the auto-ship threshold and more content reaches humans.",
  controls: [{ id: "t", kind: "range", label: "Auto-ship above", min: 0.5, max: 0.95, step: 0.05, initial: 0.8 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const th = g.v.t;
    let auto = 0;
    let review = 0;
    for (let k = 0; k < 60; k++) {
      const q = 0.45 + g.rnd(k * 2.9 + 1) * 0.55;
      const r = q >= th ? 0 : q >= th - 0.2 ? 1 : 2;
      if (r === 0) auto++;
      else review++;
      g.rect(30 + (k % 20) * 21, 50 + Math.floor(k / 20) * 24, 17, 18, [pal.ok, pal.accent, pal.bad][r], 0.55, 3);
    }
    g.text("green: ships  ·  orange: light review  ·  red: full translation by a linguist", 240, 40, { size: 9, color: pal.muted });
    node(g, "user", 440, 170, { label: "linguists", size: 26 });
    g.text(`${auto} auto-shipped, ${review} reviewed by people`, 240, 180, { size: 13, color: pal.paper });
    g.text("always review legal, payments and high-traffic screens regardless", 240, 232, { size: 10, color: pal.muted });
  },
};

const keyframes: Scene = {
  title: "Key frames instead of every frame",
  caption: "A model describing every frame of a one-hour video would cost a fortune and repeat itself. Scene detection picks a handful of frames at the changes. The more aggressive the sampling, the cheaper it gets, until it starts to miss content.",
  controls: [{ id: "k", kind: "range", label: "Frames kept per minute", min: 1, max: 60, step: 1, initial: 4 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const k = g.v.k;
    const cost = (k * 60 * 0.002).toFixed(2);
    for (let f = 0; f < 60; f++) {
      const keep = f % Math.max(1, Math.round(60 / k)) === 0;
      const change = f % 12 === 0;
      g.rect(30 + (f % 30) * 14.3, 50 + Math.floor(f / 30) * 40, 11, 30, change ? pal.accent : pal.blue, keep ? 0.7 : 0.12, 2);
      if (keep) g.frame(30 + (f % 30) * 14.3 - 1, 49 + Math.floor(f / 30) * 40, 13, 32, pal.ok, 0.8, 2, 1);
    }
    g.text("orange = scene change, green outline = frame sent to the model", 240, 40, { size: 9, color: pal.muted });
    const missed = k < 5;
    g.text(`about $${cost} per hour of video`, 240, 160, { size: 14, color: pal.paper, bold: true });
    g.text(missed ? "too sparse: some scene changes are missed ✕" : "every scene change is covered ✓", 240, 192, { size: 12, color: missed ? pal.bad : pal.ok });
    node(g, "gpu", 456, 150, { size: 22 });
  },
};

const clipTimeline: Scene = {
  title: "Searching inside a video",
  caption: "The video is indexed as timestamped segments, each with transcript, on-screen text and a visual caption. A query lands on the segments where it matches, and the result opens the player at that moment.",
  controls: [{ id: "q", kind: "choice", label: "Query", options: ["refund exception policy", "pricing slide with the red chart"], initial: 0 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const q = g.v.q;
    const segs = 12;
    const hits = q === 0 ? [7, 10] : [3];
    for (let k = 0; k < segs; k++) {
      const hit = hits.includes(k);
      g.rect(30 + k * 35, 80, 32, 40, hit ? pal.ok : pal.line, hit ? 0.5 : 0.1, 5);
      if (hit) {
        g.frame(30 + k * 35, 80, 32, 40, pal.ok, 1, 5, 1.8);
        g.glow(46 + k * 35, 100, 24, pal.ok, 0.3);
        node(g, "doc", 46 + k * 35, 150, { size: 18, color: pal.ok });
        g.text(`${k * 5}:${["00", "10"][k % 2]}`, 46 + k * 35, 172, { size: 8, color: pal.ok });
      }
    }
    g.text("video timeline, split into searchable segments", 240, 60, { size: 9, color: pal.muted });
    g.text(q === 0 ? "matches transcript and slide text" : "matches the visual caption of a key frame", 240, 214, { size: 12, color: pal.paper });
    g.text("results open the player at the exact timestamp", 240, 244, { size: 10, color: pal.muted });
  },
};

const regionMap: Scene = {
  title: "Regions, home regions and failover",
  caption: "Each tenant has a home region where its data lives. When EU goes down, a tenant that allows it fails over to another region. A residency-locked tenant is not moved, so it gets a degraded mode instead of a policy violation.",
  controls: [
    { id: "d", kind: "toggle", label: "EU region down" },
    { id: "l", kind: "toggle", label: "EU tenant is residency-locked" },
  ],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const down = g.v.d === 1;
    const lock = g.v.l === 1;
    const regs: [number, number, string][] = [[90, 90, "EU"], [390, 90, "US"], [240, 190, "APAC"]];
    regs.forEach(([x, y, nm], k) => {
      const dead = down && k === 0;
      node(g, "cloud", x, y, { label: nm, size: 52, color: dead ? pal.bad : pal.ok, a: dead ? 0.5 : 1 });
      if (dead) g.text("✕", x, y, { size: 18, color: pal.bad });
    });
    node(g, "user", 90, 30, { label: "EU users", size: 22 });
    if (!down) g.packet(90, 40, 90, 64, g.loop(1.4), pal.ok, 2.6);
    else if (lock) {
      g.text("read-only mode, cached answers, no data moved", 90, 150, { size: 9, color: pal.accent });
      g.packet(90, 40, 90, 60, g.loop(1.2), pal.bad, 2.6);
    } else g.packet(90, 40, 360, 80, g.loop(2), pal.accent, 2.6);
    g.text(!down ? "traffic stays in the home region" : lock ? "degrades inside the geography ✓" : "fails over to the US region ✓", 240, 250, { size: 12, color: lock && down ? pal.accent : pal.ok });
  },
};

const regionCapacity: Scene = {
  title: "Model quota is per region",
  caption: "Each region has its own provider quota. When one region saturates, the gateway spills over to a region with headroom, but only for tenants whose policy allows it, and sheds low-priority work first.",
  controls: [{ id: "e", kind: "range", label: "EU load % of quota", min: 40, max: 160, step: 10, initial: 130 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const eu = g.v.e;
    const loads: [string, number][] = [["EU", eu], ["US", 55], ["APAC", 40]];
    let spill = Math.max(0, eu - 100);
    loads.forEach(([nm, l], k) => {
      const y = 60 + k * 46;
      const real = k === 0 ? Math.min(100, l) : Math.min(100, l + (k === 1 ? spill * 0.6 : spill * 0.4));
      node(g, "cloud", 50, y, { label: nm, size: 30 });
      bar(g, 110, y - 5, 260, 10, real / 100, real >= 100 ? pal.bad : pal.ok);
      g.text(`${Math.round(real)}%`, 410, y, { size: 11, color: pal.paper });
    });
    if (spill > 0) g.packet(70, 60, 70, 106, g.loop(1.4), pal.accent, 3);
    g.text(spill > 0 ? `${Math.round(spill)}% of EU load spilled to US and APAC (permitted tenants only)` : "every region within its own quota", 240, 224, { size: 11, color: spill > 0 ? pal.accent : pal.ok });
    g.text("low-priority batch is shed before interactive traffic", 240, 250, { size: 10, color: pal.muted });
  },
};

const levers: Scene = {
  title: "Cost per question, lever by lever",
  caption: "Start from the naive cost and switch levers on. Trimming context and caching the prefix come first because they are safest. Routing easy questions to a small model saves the most. Batching the nightly work trims the rest.",
  controls: [
    { id: "t", kind: "toggle", label: "Trim context + rerank" },
    { id: "c", kind: "toggle", label: "Prompt caching" },
    { id: "r", kind: "toggle", label: "Route easy to small model" },
    { id: "b", kind: "toggle", label: "Batch the offline work" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    let cost = 6;
    if (g.v.t === 1) cost *= 0.52;
    if (g.v.c === 1) cost *= 0.82;
    if (g.v.r === 1) cost *= 0.45;
    if (g.v.b === 1) cost *= 0.92;
    g.rect(40, 70, 400, 30, pal.line, 0.1, 6);
    g.rect(40, 70, (cost / 6) * 400, 30, cost > 3 ? pal.bad : cost > 1.5 ? pal.accent : pal.ok, 0.7, 6);
    g.text(`${cost.toFixed(1)} cents per question`, 240, 86, { size: 13, color: pal.paper, bold: true });
    node(g, "gpu", 456, 40, { size: 22 });
    g.text("naive cost: 6.0 cents", 40, 56, { size: 9, align: "left", color: pal.muted });
    g.text(`saved ${Math.round((1 - cost / 6) * 100)}% versus the naive design`, 240, 150, { size: 14, color: cost < 3 ? pal.ok : pal.paper });
    g.text("measure quality on the golden set after every lever", 240, 214, { size: 11, color: pal.muted });
  },
};

const escalation: Scene = {
  title: "When a cascade stops paying",
  caption: "The cheap model answers most requests and escalates the rest to the strong one, paying for both. If too many escalate, the cascade costs more than calling the strong model directly. Slide the escalation rate to find the break-even.",
  controls: [{ id: "e", kind: "range", label: "Escalation rate %", min: 0, max: 100, step: 5, initial: 30 }],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const e = g.v.e / 100;
    const small = 1;
    const strong = 10;
    const casc = small + e * strong;
    const x = (v: number) => 40 + v * 400;
    const y = (c: number) => 190 - (c / 12) * 130;
    g.line(40, y(strong), 440, y(strong), pal.blue, 0.8, 1.6);
    g.text("always strong model", 440, y(strong) - 8, { size: 9, color: pal.blue, align: "right" });
    let pv: [number, number] | null = null;
    for (let k = 0; k <= 20; k++) {
      const ee = k / 20;
      const px = x(ee);
      const py = y(small + ee * strong);
      if (pv) g.line(pv[0], pv[1], px, py, pal.accent, 1, 2.2);
      pv = [px, py];
    }
    g.dot(x(e), y(casc), 6, casc > strong ? pal.bad : pal.ok);
    g.text("cascade cost", 120, 160, { size: 9, color: pal.accent });
    g.text(casc > strong ? "cascade costs more than the strong model alone ✕" : `cascade saves ${Math.round((1 - casc / strong) * 100)}% versus the strong model`, 240, 224, { size: 12, color: casc > strong ? pal.bad : pal.ok });
    g.text("escalation rate →", 240, 208, { size: 9, color: pal.muted });
  },
};

const fallbackLadder: Scene = {
  title: "The fallback ladder",
  caption: "Each rung is a simpler but still useful behaviour. As the failure gets worse the system steps down one rung at a time. The rungs must each be tested and evaluated, and the user is told which one they are on.",
  controls: [{ id: "f", kind: "range", label: "Failure severity", min: 0, max: 4, step: 1, initial: 2 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const f = g.v.f;
    const rungs = ["primary model + full retrieval", "second provider, same features", "smaller model, keyword search only", "cached and templated answers", "clear 'unavailable' message"];
    rungs.forEach((r, k) => {
      const y = 44 + k * 38;
      const on = k === f;
      const col = [pal.ok, pal.ok, pal.accent, pal.accent, pal.bad][k];
      g.rect(60, y - 14, 300, 28, col, on ? 0.3 : 0.07, 7);
      g.frame(60, y - 14, 300, 28, col, on ? 1 : 0.35, 7, on ? 2 : 1);
      g.text(r, 72, y, { size: 11, align: "left", color: on ? pal.paper : pal.muted });
      if (k < 4) g.arrow(410, y + 6, 410, y + 24, pal.line, 0.5);
    });
    node(g, "user", 440, 44 + f * 38, { size: 22, color: pal.accent });
    g.text(f === 0 ? "full experience" : f < 3 ? "reduced but useful" : f === 3 ? "minimal, clearly labelled" : "honest error, nothing unsafe", 240, 246, { size: 12, color: f < 3 ? pal.ok : pal.accent });
  },
};

const retryBudget: Scene = {
  title: "Retry storms and retry budgets",
  caption: "A dependency slows down and every client retries, multiplying the load on exactly the thing that is struggling. A retry budget caps retries to a small share of traffic, so the dependency can recover.",
  controls: [{ id: "b", kind: "toggle", label: "Retry budget", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const bud = g.v.b === 1;
    const t = g.t % 12;
    const slow = t > 3 && t < 9;
    let pv: [number, number] | null = null;
    for (let k = 0; k <= 60; k++) {
      const tt = (k / 60) * Math.min(12, t);
      const s = tt > 3 && tt < 9;
      const load = 1 + (s ? (bud ? 0.1 : 2.2) : 0);
      const x = 40 + (k / 60) * 400;
      const y = 190 - (load / 3.5) * 130;
      if (pv) g.line(pv[0], pv[1], x, y, load > 2 ? pal.bad : pal.blue, 1, 2);
      pv = [x, y];
    }
    g.line(40, 190 - (1.5 / 3.5) * 130, 440, 190 - (1.5 / 3.5) * 130, pal.bad, 0.5, 1);
    g.text("capacity", 440, 190 - (1.5 / 3.5) * 130 - 8, { size: 9, color: pal.bad, align: "right" });
    node(g, "db", 456, 50, { size: 26, color: slow && !bud ? pal.bad : pal.blue });
    g.text(slow ? (bud ? "retries capped: the dependency recovers ✓" : "retries triple the load: it cannot recover ✕") : "healthy", 240, 222, { size: 12, color: slow ? (bud ? pal.ok : pal.bad) : pal.paper });
    g.text("load on the dependency over time", 240, 244, { size: 10, color: pal.muted });
  },
};

const goodputCurve: Scene = {
  title: "Goodput, not raw throughput",
  caption: "Adding concurrent requests raises throughput, but each user's latency climbs. The usable operating point is where latency still meets the target. Plan capacity at the goodput limit, not at the maximum throughput.",
  controls: [{ id: "c", kind: "range", label: "Concurrent requests", min: 1, max: 80, step: 1, initial: 40 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const c = g.v.c;
    const thr = (n: number) => 1 - Math.exp(-n / 28);
    const lat = (n: number) => 0.25 + (n / 80) ** 2 * 1.2;
    const slo = 1;
    const x = (n: number) => 40 + (n / 80) * 400;
    let pa: [number, number] | null = null;
    let pb: [number, number] | null = null;
    for (let n = 1; n <= 80; n++) {
      const a: [number, number] = [x(n), 190 - thr(n) * 130];
      const b: [number, number] = [x(n), 190 - (lat(n) / 1.6) * 130];
      if (pa && pb) {
        g.line(pa[0], pa[1], a[0], a[1], pal.ok, 1, 2);
        g.line(pb[0], pb[1], b[0], b[1], lat(n) > slo ? pal.bad : pal.blue, 1, 2);
      }
      pa = a;
      pb = b;
    }
    g.line(40, 190 - (slo / 1.6) * 130, 440, 190 - (slo / 1.6) * 130, pal.accent, 0.8, 1.3);
    g.text("latency target", 440, 190 - (slo / 1.6) * 130 - 8, { size: 9, color: pal.accent, align: "right" });
    g.line(x(c), 50, x(c), 192, pal.paper, 0.5, 1.2);
    g.text("throughput", 90, 56, { size: 9, color: pal.ok });
    g.text("latency", 160, 56, { size: 9, color: pal.blue });
    const ok = lat(c) <= slo;
    g.text(ok ? "meets the latency target: this counts as goodput" : "latency target missed: these requests are not goodput", 240, 226, { size: 11, color: ok ? pal.ok : pal.bad });
    node(g, "gpu", 456, 40, { size: 22 });
  },
};

const fleetSize: Scene = {
  title: "From forecast to number of nodes",
  caption: "Peak demand divided by per-node goodput gives the base count. Headroom covers bursts and deployments, and one extra node covers a failure. Improving per-node goodput with caching or quantization shrinks the whole fleet.",
  controls: [
    { id: "d", kind: "range", label: "Peak requests/s", min: 100, max: 800, step: 50, initial: 400 },
    { id: "n", kind: "range", label: "Goodput per node (req/s)", min: 20, max: 80, step: 5, initial: 45 },
  ],
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const base = Math.ceil(g.v.d / g.v.n);
    const head = Math.ceil(base * 1.25);
    const total = head + 1;
    for (let k = 0; k < Math.min(30, total); k++) {
      const kind = k < base ? pal.ok : k < head ? pal.accent : pal.violet;
      node(g, "server", 40 + (k % 15) * 28, 70 + Math.floor(k / 15) * 38, { size: 22, color: kind });
    }
    g.text("green: base need · orange: headroom · violet: spare for a failure", 240, 40, { size: 9, color: pal.muted });
    g.text(`${base} + headroom ${head - base} + spare 1 = ${total} nodes`, 240, 170, { size: 14, color: pal.paper, bold: true });
    g.text(`${total * 8} GPUs at 8 per node`, 240, 198, { size: 12, color: pal.accent });
    g.text("raise per-node goodput first, then buy hardware", 240, 232, { size: 10, color: pal.muted });
  },
};

export const MORE_AD_4: Record<string, Scene[]> = {
  [`${E}/designing-agent-identity-and-authorization`]: [threeWayAuth, narrowChain],
  [`${E}/designing-llm-cost-management-and-chargeback`]: [attribution, budgetLadder],
  [`${E}/designing-a-pii-safe-ai-pipeline`]: [tokenizeFlow, piiPaths],
  [`${M}/designing-an-image-generation-service`]: [imageQueue, batchWindow],
  [`${M}/designing-a-content-moderation-system-with-llms`]: [modFunnel, graduated],
  [`${M}/designing-a-translation-and-localization-pipeline`]: [placeholders, qeRouting],
  [`${M}/designing-a-video-summarization-and-clip-search-system`]: [keyframes, clipTimeline],
  [`${R}/designing-a-multi-region-llm-application`]: [regionMap, regionCapacity],
  [`${R}/designing-for-cost-at-scale-for-llm-products`]: [levers, escalation],
  [`${R}/designing-graceful-degradation-for-ai-features`]: [fallbackLadder, retryBudget],
  [`${R}/designing-capacity-planning-for-gpu-inference`]: [goodputCurve, fleetSize],
};
