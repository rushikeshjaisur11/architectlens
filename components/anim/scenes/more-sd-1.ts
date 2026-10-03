import type { Scene } from "../scene/types";
import { bar, chip, fmt, hash32 } from "./kit";
import { node } from "./shapes";

const P = "system-design";

const capDomains: Scene = {
  title: "Which side would you pick?",
  caption: "Choose the kind of data. During a partition a bank must refuse a write rather than show two balances, while a like counter can accept both sides and merge later. The right answer depends on what a wrong read costs.",
  controls: [{ id: "d", kind: "choice", label: "Data", options: ["bank balance", "like counter", "shopping cart"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const d = g.v.d;
    const cp = d === 0;
    node(g, "db", 100, 100, { label: "replica A", color: pal.blue, size: 50, fill: 0.5 });
    node(g, "db", 380, 100, { label: "replica B", color: pal.blue, size: 50, fill: 0.5 });
    g.c.setLineDash([4, 5]);
    g.line(135, 100, 345, 100, pal.bad, 0.7, 1.4);
    g.c.setLineDash([]);
    g.text("✕ partition", 240, 90, { size: 11, color: pal.bad });
    node(g, "user", 100, 215, { label: "user 1", size: 30 });
    node(g, "user", 380, 215, { label: "user 2", size: 30 });
    g.packet(100, 195, 100, 130, g.loop(2), pal.accent, 3);
    g.packet(380, 195, 380, 130, g.loop(2, 0.5), pal.accent, 3);
    const what = ["balance −50", "like +1", "add item"][d];
    chip(g, 100, 160, what, cp ? pal.ok : pal.accent, 10);
    chip(g, 380, 160, cp ? "refused: unavailable" : what, cp ? pal.bad : pal.accent, 10);
    g.text(cp ? "CP: one side refuses, balances never diverge" : "AP: both accept, merge when the link heals", 240, 262, { size: 12, color: cp ? pal.ok : pal.accent });
    g.text(["wrong answer costs real money", "a briefly wrong count is harmless", "merge by taking the union of items"][d], 240, 284, { size: 10, color: pal.muted });
  },
};

const storageGrowth: Scene = {
  title: "Storage grows with time",
  caption: "Daily writes times retention gives total storage, and every replica multiplies it. Slide the years: the disks fill and the machine count jumps once one box can no longer hold the data.",
  controls: [{ id: "y", kind: "range", label: "Years retained", min: 1, max: 10, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const perDay = 0.5;
    const tb = perDay * 365 * g.v.y * 3;
    const disks = Math.max(1, Math.ceil(tb / 4));
    g.text("0.5 TB per day × 365 × years × 3 replicas", 240, 28, { size: 11, color: pal.muted });
    for (let k = 0; k < Math.min(24, disks); k++) {
      const x = 40 + (k % 12) * 36;
      const y = 80 + Math.floor(k / 12) * 56;
      node(g, "db", x, y, { size: 36, fill: k === disks - 1 ? (tb / 4) % 1 || 1 : 1, color: pal.blue });
    }
    if (disks > 24) g.text(`+${disks - 24} more`, 440, 135, { size: 11, color: pal.accent });
    g.text(`${fmt(tb)} TB`, 240, 210, { size: 20, color: pal.accent, bold: true });
    g.text(`${disks} disks of 4 TB`, 240, 238, { size: 12, color: pal.paper });
    g.text(disks > 8 ? "this needs a sharded store, not one machine" : "a single replicated cluster is enough", 240, 266, { size: 11, color: disks > 8 ? pal.bad : pal.ok });
  },
};

const redundancy: Scene = {
  title: "Redundancy and correlated failure",
  caption: "Each replica is 99% available. Independent replicas in parallel multiply the odds that all are down, so two give four nines. Put them in one rack with a shared power feed and a single failure takes them all out together.",
  controls: [
    { id: "n", kind: "range", label: "Replicas", min: 1, max: 4, step: 1, initial: 2 },
    { id: "c", kind: "toggle", label: "Shared rack (correlated)" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const corr = g.v.c === 1;
    const bucket = Math.floor(g.t * 1.2);
    const rackDown = g.rnd(bucket * 3.7 + 1) < 0.25;
    let up = 0;
    if (corr) g.frame(60, 56, 360, 100, rackDown ? pal.bad : pal.line, 1, 10, 1.4);
    for (let k = 0; k < n; k++) {
      const x = 240 + (k - (n - 1) / 2) * 80;
      const own = g.rnd(bucket * 5.1 + k * 2.3) < 0.25;
      const down = corr ? rackDown : own;
      if (!down) up++;
      node(g, "server", x, 106, { size: 44, color: down ? pal.bad : pal.ok, a: down ? 0.5 : 1, active: !down });
      if (down) g.text("✕", x, 106, { size: 20, color: pal.bad });
    }
    if (corr) g.text(rackDown ? "rack power lost" : "one rack, one power feed", 240, 72, { size: 10, color: rackDown ? pal.bad : pal.muted });
    const avail = corr ? 0.99 : 1 - 0.01 ** n;
    chip(g, 240, 196, up > 0 ? "service up" : "service down", up > 0 ? pal.ok : pal.bad, 13);
    g.text(`availability ${(avail * 100).toFixed(avail > 0.9999 ? 4 : 2)}%`, 240, 238, { size: 14, color: pal.paper, bold: true });
    g.text(corr ? "extra replicas in one failure domain add nothing" : "independent failures multiply: 1% × 1% = 0.01%", 240, 266, { size: 11, color: corr ? pal.bad : pal.ok });
  },
};

const requestBudget: Scene = {
  title: "A request's latency budget",
  caption: "Each hop adds its own delay and the total is what the user waits for. Toggle the cache and the cross-region database call and watch the milliseconds pile up along the path.",
  controls: [
    { id: "c", kind: "toggle", label: "Cache hit", initial: true },
    { id: "r", kind: "toggle", label: "DB in another region" },
  ],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hit = g.v.c === 1;
    const far = g.v.r === 1;
    const hops: [string, "client" | "cdn" | "lb" | "server" | "cache" | "db", number][] = [
      ["browser", "client", 0], ["CDN", "cdn", 20], ["balancer", "lb", 1], ["app", "server", 5], ["cache", "cache", 1],
    ];
    if (!hit) hops.push(["database", "db", far ? 90 : 8]);
    let tot = 0;
    const f = g.loop(5) * (hops.length + 0.4);
    hops.forEach(([nm, kind, ms], k) => {
      const x = 40 + k * (400 / (hops.length - 1));
      node(g, kind, x, 90, { label: nm, size: 34, color: k <= f ? pal.paper : pal.muted, a: k <= f ? 1 : 0.5 });
      if (k > 0 && k <= f) {
        tot += ms;
        g.text(`+${ms}`, x - 200 / (hops.length - 1) * 1, 58, { size: 10, color: ms > 30 ? pal.bad : pal.accent });
      }
      if (k < hops.length - 1) g.packet(x + 20, 90, x + 400 / (hops.length - 1) - 20, 90, g.clamp(f - k), pal.accent, 2.4);
    });
    const total = hops.reduce((a, h) => a + h[2], 0);
    g.text("response time", 80, 190, { size: 11 });
    bar(g, 150, 185, 250, 8, total / 140, total > 60 ? pal.bad : pal.ok);
    g.text(`${total} ms`, 440, 190, { size: 12, color: pal.paper });
    g.text(far && !hit ? "the cross-region hop dominates everything else" : hit ? "the cache removes the database from the path" : "local database adds a few ms", 240, 240, { size: 11, color: pal.muted });
    void tot;
  },
};

const readYourWrites: Scene = {
  title: "Read-your-writes in action",
  caption: "You change your name on the leader and refresh. A read that lands on a lagging follower shows the old name, and it feels like the save failed. Routing your own reads to the leader (or a fresh replica) fixes it.",
  controls: [{ id: "r", kind: "choice", label: "Read goes to", options: ["any replica", "leader after my write"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const mine = g.v.r === 1;
    const { i, p } = g.stage([1.8, 1.8, 2.4]);
    node(g, "user", 50, 120, { label: "you", size: 34 });
    node(g, "db", 220, 70, { label: "leader", color: pal.ok, size: 44 });
    node(g, "db", 380, 160, { label: "follower", color: pal.blue, size: 44 });
    const replicated = i >= 2;
    g.text(i >= 1 ? "name: Ana" : "name: Anu", 220, 112, { size: 10, color: pal.ok });
    g.text(replicated && p > 0.4 ? "name: Ana" : "name: Anu", 380, 202, { size: 10, color: replicated && p > 0.4 ? pal.ok : pal.bad });
    if (i === 0) g.packet(70, 118, 195, 80, p, pal.accent, 3);
    if (i === 1) g.packet(250, 82, 358, 150, g.clamp(p * 0.6), pal.violet, 2.4);
    if (i === 2) {
      const toLeader = mine;
      g.packet(70, 126, toLeader ? 195 : 356, toLeader ? 88 : 170, p, toLeader ? pal.ok : pal.bad, 3);
    }
    g.text(["you save the new name on the leader", "replication to the follower takes a moment", mine ? "your read goes to the leader: fresh ✓" : "your read hits the follower: stale ✕"][i], 240, 262, { size: 12, color: i === 2 ? (mine ? pal.ok : pal.bad) : pal.paper });
  },
};

const scaleCube: Scene = {
  title: "The scale cube: three ways to split",
  caption: "X clones the whole app behind a balancer. Y splits it by function into services. Z splits the data across shards. Pick an axis to see what each one actually multiplies.",
  controls: [{ id: "a", kind: "choice", label: "Axis", options: ["X: clone", "Y: split by function", "Z: shard the data"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const a = g.v.a;
    if (a === 0) {
      node(g, "lb", 60, 130, { label: "balancer", size: 40 });
      [0, 1, 2].forEach((k) => {
        node(g, "server", 220, 60 + k * 70, { label: `copy ${k + 1}`, size: 38, active: true });
        g.packet(80, 130, 200, 60 + k * 70, (g.t * 0.6 + k * 0.3) % 1, pal.accent, 2.6);
        g.packet(240, 60 + k * 70, 340, 130, (g.t * 0.6 + k * 0.3 + 0.5) % 1, pal.ok, 2.6);
      });
      node(g, "db", 380, 130, { label: "one database", size: 44, color: pal.bad });
      g.text("identical copies share one database", 240, 262, { size: 12, color: pal.paper });
    } else if (a === 1) {
      node(g, "lb", 50, 130, { label: "gateway", size: 36 });
      ["users", "orders", "search"].forEach((nm, k) => {
        node(g, "server", 200, 60 + k * 70, { label: nm, size: 36, active: true });
        node(g, "db", 340, 60 + k * 70, { size: 34, color: [pal.blue, pal.violet, pal.teal][k] });
        g.packet(70, 130, 180, 60 + k * 70, (g.t * 0.6 + k * 0.3) % 1, pal.accent, 2.6);
        g.packet(222, 60 + k * 70, 322, 60 + k * 70, (g.t * 0.6 + k * 0.3 + 0.4) % 1, pal.ok, 2.4);
      });
      g.text("each service owns its code and its data", 240, 262, { size: 12, color: pal.paper });
    } else {
      node(g, "lb", 60, 130, { label: "router", size: 40 });
      ["A–H", "I–P", "Q–Z"].forEach((nm, k) => {
        node(g, "db", 260, 60 + k * 70, { label: `shard ${nm}`, size: 40, color: [pal.blue, pal.violet, pal.teal][k], fill: 0.4 + 0.15 * k });
        g.packet(80, 130, 238, 60 + k * 70, (g.t * 0.6 + k * 0.3) % 1, pal.accent, 2.6);
      });
      g.text("same code everywhere, each shard holds a slice of rows", 240, 262, { size: 12, color: pal.paper });
    }
  },
};

const graphqlFetch: Scene = {
  title: "Over-fetching: what the client actually needs",
  caption: "A phone only needs a name and an avatar, but a fixed REST endpoint returns the whole user record. GraphQL lets the client name the fields, so fewer bytes cross the network.",
  controls: [{ id: "m", kind: "choice", label: "API style", options: ["REST /users/1", "GraphQL {name, avatar}"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const gql = g.v.m === 1;
    const fields = ["name", "avatar", "email", "address", "orders", "preferences", "history"];
    const need = [true, true, false, false, false, false, false];
    node(g, "phone", 50, 120, { label: "mobile app", size: 54 });
    node(g, "server", 410, 120, { label: "server", size: 50, active: true });
    g.packet(80, 110, 380, 110, g.loop(1.6), pal.accent, 3);
    g.text(gql ? "{ name avatar }" : "GET /users/1", 230, 94, { size: 10, color: pal.paper });
    fields.forEach((f, k) => {
      const x = 130 + (k % 4) * 62;
      const y = 150 + Math.floor(k / 4) * 28;
      const sent = gql ? need[k] : true;
      g.rect(x, y, 56, 22, sent ? (need[k] ? pal.ok : pal.bad) : pal.line, sent ? 0.28 : 0.06, 4);
      g.text(f, x + 28, y + 11, { size: 9, color: sent ? pal.paper : pal.muted, a: sent ? 1 : 0.5 });
    });
    const bytes = gql ? 0.4 : 4.2;
    g.text("payload", 80, 232, { size: 11 });
    bar(g, 130, 227, 250, 8, bytes / 4.2, gql ? pal.ok : pal.bad);
    g.text(`${bytes} KB`, 430, 232, { size: 12, color: pal.paper });
    g.text(gql ? "only the requested fields travel" : "red fields are sent but never shown", 240, 266, { size: 11, color: gql ? pal.ok : pal.bad });
  },
};

const retryMethods: Scene = {
  title: "Retrying PUT versus POST",
  caption: "The network drops the reply, so the client sends the same request three times. PUT says 'set it to this' and ends up in the same state. POST says 'create one' and leaves three orders unless it carries an idempotency key.",
  controls: [{ id: "m", kind: "choice", label: "Method", options: ["PUT /orders/7", "POST /orders", "POST + idempotency key"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    const sent = Math.min(3, Math.floor(g.loop(4.5) * 4));
    node(g, "client", 50, 110, { label: "client", size: 44 });
    node(g, "server", 220, 110, { label: "server", size: 44, active: true });
    for (let k = 0; k < sent; k++) g.packet(76, 100 + k * 8, 196, 100 + k * 8, g.clamp(g.loop(1.2) * 1.5), pal.accent, 2.6);
    const count = m === 1 ? sent : Math.min(1, sent);
    for (let k = 0; k < count; k++) node(g, "doc", 330 + (k % 3) * 44, 100, { size: 40, color: m === 1 ? pal.bad : pal.ok, label: k === 0 ? "orders" : undefined });
    g.text(m === 0 ? "same key, same state" : m === 1 ? "each POST makes a new order" : "server replays the stored result", 240, 200, { size: 12, color: pal.paper });
    chip(g, 240, 240, m === 1 && sent > 1 ? `${sent} orders created ✕` : "1 order ✓", m === 1 && sent > 1 ? pal.bad : pal.ok, 12);
  },
};

const cursorPaging: Scene = {
  title: "Offset versus cursor pagination",
  caption: "While you read page 1, a new item is inserted at the top. With offset paging page 2 now repeats the item you just saw. A cursor remembers the last item and continues after it, so nothing repeats or skips.",
  controls: [{ id: "m", kind: "choice", label: "Pagination", options: ["offset", "cursor"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const cur = g.v.m === 1;
    const { i, p } = g.stage([1.8, 1.8, 2.4]);
    const base = ["A", "B", "C", "D", "E", "F"];
    const list = i >= 1 ? ["NEW", ...base] : base;
    list.forEach((it, k) => {
      const y = 40 + k * 28;
      const page1 = i === 0 ? k < 3 : false;
      g.rect(30, y, 130, 22, it === "NEW" ? pal.accent : pal.blue, it === "NEW" ? 0.5 : 0.22, 4);
      g.text(it, 95, y + 11, { size: 11, color: pal.paper });
      g.text(String(k + 1), 20, y + 11, { size: 9, color: pal.muted });
      if (page1) g.frame(30, y, 130, 22, pal.ok, 1, 4, 1.4);
    });
    node(g, "phone", 360, 90, { label: "client", size: 56 });
    const page2 = cur ? ["D", "E", "F"] : ["C", "D", "E"];
    if (i === 2) {
      page2.forEach((it, k) => {
        const dup = !cur && it === "C";
        chip(g, 360, 150 + k * 26, it + (dup ? " (seen!)" : ""), dup ? pal.bad : pal.ok, 10);
      });
      g.packet(180, 80, 330, 90, p, pal.accent, 3);
    }
    g.text(["client reads page 1: A B C", "a new item is inserted at the top", cur ? "cursor after C returns D E F" : "offset 3 now returns C D E: C repeats"][i], 240, 262, { size: 12, color: i === 2 ? (cur ? pal.ok : pal.bad) : pal.paper });
  },
};

const gatewayPipeline: Scene = {
  title: "Inside the gateway: checks before routing",
  caption: "A request passes authentication, then rate limiting, then routing. Each gate can stop it early and cheaply. Send a bad token or a burst and see where it dies, so the backend only ever sees clean traffic.",
  controls: [{ id: "r", kind: "choice", label: "Request", options: ["valid", "bad token", "over the limit"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const r = g.v.r;
    const stopAt = r === 1 ? 1 : r === 2 ? 2 : 9;
    const stages = ["auth", "rate limit", "route"];
    node(g, "client", 36, 120, { label: "client", size: 38 });
    stages.forEach((s, k) => {
      const x = 130 + k * 100;
      node(g, k === 0 ? "lock" : k === 1 ? "shield" : "lb", x, 120, { label: s, size: 36, color: k + 1 === stopAt ? pal.bad : pal.paper });
    });
    node(g, "server", 440, 120, { label: "service", size: 38, active: stopAt === 9 });
    const f = g.loop(3.2) * 4;
    let x = 60 + f * 96;
    const stopX = stopAt === 9 ? 440 : 130 + (stopAt - 1) * 100 - 26;
    x = Math.min(x, stopX);
    g.dot(x, 120, 5, stopAt === 9 || x < stopX ? pal.accent : pal.bad);
    g.glow(x, 120, 14, stopAt === 9 || x < stopX ? pal.accent : pal.bad, 0.4);
    const msg = r === 0 ? "reaches the service" : r === 1 ? "401 returned at the auth gate" : "429 returned at the limiter";
    chip(g, 240, 220, msg, r === 0 ? pal.ok : pal.bad, 12);
    g.text("rejected requests never touch a backend", 240, 262, { size: 10, color: pal.muted });
  },
};

const sessionVsJwt: Scene = {
  title: "Sessions versus JWTs",
  caption: "A session id is a pointer, so every request looks it up in a store and logout is just deleting the row. A JWT carries its own claims and a signature the server checks locally, which saves the lookup but makes early revocation hard.",
  controls: [{ id: "m", kind: "choice", label: "Auth state", options: ["session cookie", "signed JWT"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const jwt = g.v.m === 1;
    node(g, "client", 50, 120, { label: "browser", size: 44 });
    node(g, "server", 220, 120, { label: "API", size: 44, active: true });
    g.packet(76, 112, 196, 112, g.loop(1.6), pal.accent, 3);
    chip(g, 135, 90, jwt ? "eyJhbGc… (token)" : "sid=9f3a", pal.accent, 10);
    if (jwt) {
      node(g, "lock", 360, 120, { label: "public key", size: 38, color: pal.ok });
      g.packet(244, 120, 340, 120, g.loop(1.6, 0.4), pal.ok, 2.4);
      g.text("verify signature locally", 300, 96, { size: 10, color: pal.ok });
      g.text("no lookup per request, revoke only at expiry", 240, 236, { size: 11, color: pal.paper });
      g.text("claims travel inside the token", 240, 262, { size: 10, color: pal.muted });
    } else {
      node(g, "db", 360, 120, { label: "session store", size: 44, color: pal.blue });
      g.packet(244, 112, 338, 112, g.loop(1.6, 0.3), pal.blue, 2.4);
      g.packet(338, 128, 244, 128, g.loop(1.6, 0.6), pal.ok, 2.4);
      g.text("one lookup per request", 300, 90, { size: 10, color: pal.blue });
      g.text("delete the row and the user is logged out at once", 240, 236, { size: 11, color: pal.paper });
      g.text("state lives on the server", 240, 262, { size: 10, color: pal.muted });
    }
  },
};

const pollVsHook: Scene = {
  title: "Polling versus webhooks",
  caption: "A long job finishes after eight seconds. Polling asks again and again, mostly getting 'not yet'. A webhook is one call from the server the moment the job is done. Count the requests each approach spends.",
  controls: [{ id: "m", kind: "choice", label: "Result delivery", options: ["polling", "webhook"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hook = g.v.m === 1;
    const T = 8;
    const t = g.t % (T + 3);
    node(g, "client", 50, 110, { label: "client", size: 44 });
    node(g, "server", 410, 110, { label: "job server", size: 44, active: t < T });
    let calls = 0;
    if (!hook) {
      for (let k = 1; k <= 7; k++) {
        if (t > k) {
          calls++;
          if (t - k < 0.6) g.packet(76, 100, 384, 100, (t - k) / 0.6, pal.accent, 2.4);
        }
      }
      if (t > T) g.packet(384, 120, 76, 120, g.clamp((t - T) / 0.8), pal.ok, 3);
    } else {
      calls = t > T ? 1 : 0;
      if (t > T) g.packet(384, 110, 76, 110, g.clamp((t - T) / 0.8), pal.ok, 3);
    }
    g.rect(130, 150, 220, 10, pal.line, 0.3, 5);
    g.rect(130, 150, 220 * g.clamp(t / T), 10, pal.blue, 0.8, 5);
    g.text("job progress", 240, 176, { size: 10, color: pal.muted });
    g.text(`${calls} request${calls === 1 ? "" : "s"} spent`, 240, 222, { size: 14, color: hook ? pal.ok : pal.accent, bold: true });
    g.text(hook ? "one callback, no wasted calls" : "most polls return 'not ready'", 240, 256, { size: 11, color: pal.muted });
  },
};

const updateAnomaly: Scene = {
  title: "The update anomaly",
  caption: "A customer moves house. In the normalised design the address lives in one row, so one update fixes every order. In the denormalised copy the address is repeated on each order and any row you miss keeps the old value.",
  controls: [{ id: "n", kind: "choice", label: "Design", options: ["normalised", "denormalised"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const norm = g.v.n === 0;
    const { i, p } = g.stage([1.8, 2.4, 2]);
    const upd = i >= 1;
    if (norm) {
      node(g, "doc", 110, 80, { label: "customer", size: 46, color: pal.blue });
      g.text(upd ? "Pune" : "Delhi", 110, 118, { size: 11, color: upd ? pal.ok : pal.paper });
      [0, 1, 2].forEach((k) => {
        node(g, "doc", 280 + k * 60, 80, { label: `order ${k + 1}`, size: 38, color: pal.violet });
        g.line(130, 80, 262 + k * 60, 80, pal.line, 0.5, 1);
      });
      g.text("orders point at the customer", 330, 120, { size: 10, color: pal.muted });
      if (i === 1) g.packet(60, 80, 90, 80, p, pal.accent, 3);
      chip(g, 240, 200, upd ? "one update, all orders correct ✓" : "address stored once", upd ? pal.ok : pal.blue, 11);
    } else {
      [0, 1, 2].forEach((k) => {
        const stale = upd && k === 2;
        node(g, "doc", 100 + k * 130, 90, { label: `order ${k + 1}`, size: 44, color: stale ? pal.bad : pal.violet });
        g.text(upd && !stale ? "Pune" : "Delhi", 100 + k * 130, 128, { size: 11, color: upd && !stale ? pal.ok : stale ? pal.bad : pal.paper });
      });
      if (i === 1) {
        g.packet(30, 90, 78, 90, p, pal.accent, 3);
        g.packet(30, 90, 208, 90, g.clamp(p * 1.4), pal.accent, 3);
      }
      chip(g, 240, 200, upd ? "order 3 missed: stale copy ✕" : "address copied onto each order", upd ? pal.bad : pal.violet, 11);
    }
    g.text(["customer lives in Delhi", "customer moves to Pune: update the data", "the data after the update"][i], 240, 250, { size: 12, color: pal.paper });
  },
};

const isolationAnomaly: Scene = {
  title: "What isolation levels allow",
  caption: "Transaction A reads a balance twice while transaction B commits a change between the reads. Read committed lets the second read differ. Repeatable read keeps A looking at its own snapshot, so both reads match.",
  controls: [{ id: "l", kind: "choice", label: "Isolation", options: ["read committed", "repeatable read"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const rr = g.v.l === 1;
    const { i, p } = g.stage([1.6, 1.6, 1.6, 2]);
    node(g, "db", 240, 56, { label: "balance", size: 40, color: pal.blue });
    g.text(i >= 2 ? "150" : "100", 240, 90, { size: 12, color: pal.accent });
    g.text("txn A", 80, 130, { size: 12, color: pal.ok });
    g.text("txn B", 80, 190, { size: 12, color: pal.violet });
    if (i === 0) chip(g, 200, 130, "A reads 100", pal.ok, 11);
    if (i >= 1) chip(g, 200, 130, "A read 100", pal.ok, 11, 0.6);
    if (i >= 1) chip(g, 200, 190, i === 1 ? "B updates to 150" : "B committed 150", pal.violet, 11);
    if (i >= 2) chip(g, 340, 130, rr ? "A reads 100 again" : "A reads 150", rr ? pal.ok : pal.bad, 11);
    if (i === 1) g.packet(210, 178, 240, 100, p, pal.violet, 3);
    g.text(["A starts and reads the balance", "B changes it and commits", rr ? "A's snapshot is unchanged ✓" : "same query, different answer ✕", rr ? "repeatable: no surprises inside a txn" : "non-repeatable read"][i], 240, 262, { size: 12, color: i >= 2 ? (rr ? pal.ok : pal.bad) : pal.paper });
  },
};

const indexLookup: Scene = {
  title: "Index lookup versus full scan",
  caption: "Without an index the database reads rows one by one until it finds the match. A B-tree index jumps down a few levels. Slide the table size: the scan cost grows with it, the index barely moves.",
  controls: [{ id: "n", kind: "range", label: "Rows 10^", min: 3, max: 8, step: 1, initial: 6 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const rows = 10 ** g.v.n;
    const depth = Math.max(2, Math.ceil(Math.log(rows) / Math.log(200)));
    node(g, "db", 70, 100, { label: "table", size: 56, fill: 0.8 });
    g.text("full scan", 250, 52, { size: 11, color: pal.bad });
    g.rect(150, 62, 230, 10, pal.line, 0.3, 5);
    g.rect(150, 62, 230 * ((g.t * 0.5) % 1), 10, pal.bad, 0.8, 5);
    g.text(`${fmt(rows)} rows read`, 440, 67, { size: 11, color: pal.paper });
    g.text("B-tree index", 250, 112, { size: 11, color: pal.ok });
    for (let l = 0; l < depth; l++) {
      const w = 26 + l * 22;
      g.rect(250 - w, 122 + l * 20, w * 2, 14, pal.ok, 0.25 + 0.15 * l, 4);
      if ((g.t * 3) % (depth + 1) > l) g.dot(250, 129 + l * 20, 3, pal.ok);
    }
    g.text(`${depth} pages read`, 440, 128, { size: 11, color: pal.paper });
    g.text(`${fmt(rows / depth)}x fewer reads`, 240, 262, { size: 13, color: pal.accent, bold: true });
  },
};

const planTree: Scene = {
  title: "Reading an execution plan",
  caption: "The planner picks a tree of operations and each node has a cost. Without an index it must scan the whole table and sort. With one it seeks the matching rows directly. Switch and compare the tree and the cost.",
  controls: [{ id: "i", kind: "choice", label: "Index on user_id", options: ["no index", "index"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ix = g.v.i === 1;
    const nodes = ix ? [["Return rows", 1], ["Sort (small)", 3], ["Index Scan", 8]] : [["Return rows", 1], ["Sort (large)", 540], ["Seq Scan on orders", 2200]];
    nodes.forEach(([nm, cost], k) => {
      const y = 60 + k * 62;
      const c = cost as number;
      g.rect(100, y, 220, 38, c > 500 ? pal.bad : pal.blue, 0.18, 8);
      g.frame(100, y, 220, 38, c > 500 ? pal.bad : pal.blue, 1, 8, 1.2);
      g.text(nm as string, 210, y + 19, { size: 12, color: pal.paper });
      if (k < 2) g.arrow(210, y + 40, 210, y + 60, pal.line, 0.9);
      bar(g, 340, y + 15, 100, 8, Math.min(1, c / 2200), c > 500 ? pal.bad : pal.ok);
      g.text(String(c), 465, y + 19, { size: 10, color: pal.muted });
    });
    g.packet(210, 200, 210, 70, g.loop(1.8), pal.accent, 3);
    node(g, "db", 50, 130, { size: 44, color: pal.blue });
    g.text(ix ? "total cost ~12" : "total cost ~2,741", 240, 262, { size: 13, color: ix ? pal.ok : pal.bad });
  },
};

const replicaRouting: Scene = {
  title: "Routing reads and writes",
  caption: "The pooler sends writes to the primary and spreads reads over replicas. Replicas lag a little, so a read right after a write can land on a replica that has not caught up. Pin that read to the primary to see your own change.",
  controls: [{ id: "p", kind: "toggle", label: "Pin read-after-write to primary" }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pin = g.v.p === 1;
    const { i, p } = g.stage([1.6, 1.6, 2.2]);
    node(g, "server", 50, 130, { label: "app", size: 42 });
    node(g, "lb", 170, 130, { label: "pooler", size: 38 });
    node(g, "db", 330, 70, { label: "primary", color: pal.ok, size: 44 });
    node(g, "db", 330, 190, { label: "replica", color: pal.blue, size: 44 });
    g.text(i >= 0 && i < 2 ? "v1" : "v2", 330, 120, { size: 10, color: pal.ok });
    g.text(i >= 2 && !pin && p < 0.8 ? "v1" : i >= 2 ? "v2" : "v1", 330, 240, { size: 10, color: i >= 2 && !pin ? pal.bad : pal.muted });
    if (i === 0) g.packet(70, 126, 150, 130, p, pal.accent, 3);
    if (i === 0) g.packet(190, 124, 306, 76, p, pal.accent, 3);
    if (i === 1) g.packet(354, 76, 354, 180, g.clamp(p * 0.5), pal.violet, 2.4);
    if (i === 2) {
      g.packet(70, 134, 150, 134, g.clamp(p * 2), pal.accent, 3);
      g.packet(190, 136, 306, pin ? 80 : 184, p, pin ? pal.ok : pal.bad, 3);
    }
    g.text(["write goes to the primary", "replication to the replica is still in flight", pin ? "read pinned to primary: sees v2 ✓" : "read hits the replica: sees old v1 ✕"][i], 240, 262, { size: 12, color: i === 2 ? (pin ? pal.ok : pal.bad) : pal.paper });
  },
};

const expandContract: Scene = {
  title: "Expand and contract migration",
  caption: "Rename a column without downtime in four safe steps: add the new column, write to both, backfill the old rows, move reads over, and only then drop the old one. Every step is compatible with the code running at that moment.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.8, 1.8, 1.8, 1.8, 1.8]);
    const steps = ["add new column", "dual write", "backfill", "switch reads", "drop old column"];
    node(g, "db", 130, 110, { size: 70, color: pal.blue });
    g.rect(166, 80, 50, 14, pal.violet, 0.5, 3);
    g.text("old", 191, 87, { size: 9, color: pal.paper });
    const hasNew = i >= 0;
    if (hasNew) {
      g.rect(166, 100, 50, 14, pal.ok, i === 2 ? 0.2 + 0.5 * p : i > 2 ? 0.7 : 0.2, 3);
      g.text("new", 191, 107, { size: 9, color: pal.paper });
    }
    if (i === 4) g.rect(166, 80, 50, 14, pal.ink, 0.9, 3);
    node(g, "server", 360, 70, { label: "app v2", size: 38, active: true });
    if (i >= 1) g.packet(336, 76, 220, 88, (g.t * 0.8) % 1, pal.violet, 2.6);
    if (i >= 1) g.packet(336, 82, 220, 108, (g.t * 0.8 + 0.3) % 1, pal.ok, 2.6);
    if (i >= 3) g.packet(220, 110, 336, 88, (g.t * 0.8) % 1, pal.ok, 2.6);
    steps.forEach((s, k) => chip(g, 240, 168 + 0 * k, "", pal.ink, 1, 0));
    steps.forEach((s, k) => {
      const x = 52 + k * 94;
      g.dot(x, 205, 5, k <= i ? pal.ok : pal.line);
      g.text(s, x, 225, { size: 9, color: k === i ? pal.paper : pal.muted });
      if (k < 4) g.line(x + 6, 205, x + 88, 205, k < i ? pal.ok : pal.line, 0.8, 1.5);
    });
    g.text("never a moment where running code breaks", 240, 268, { size: 11, color: pal.muted });
  },
};

const hotSequential: Scene = {
  title: "Range sharding and the hot shard",
  caption: "With range shards, new keys that increase over time all land in the last shard, which melts while the others idle. Hashing the key scatters the same writes evenly.",
  controls: [{ id: "m", kind: "choice", label: "Shard by", options: ["key range (sequential ids)", "hash of key"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const hash = g.v.m === 1;
    const load = [0, 0, 0, 0];
    for (let k = 0; k < 16; k++) {
      const id = Math.floor(g.t * 4) + k;
      const s = hash ? Math.floor(hash32(String(id)) * 4) : 3;
      load[s]++;
      const f = (g.t * 1.6 + k / 16) % 1;
      g.packet(30, 130, 90 + s * 100, 140, f, hash ? pal.accent : pal.bad, 2);
    }
    node(g, "client", 30, 130, { size: 30 });
    load.forEach((l, s) => {
      const hot = l > 8;
      node(g, "db", 90 + s * 100, 170, { label: `shard ${s + 1}`, size: 46, color: hot ? pal.bad : pal.blue, fill: Math.min(1, l / 12), active: l > 0 });
    });
    g.text(hash ? "writes spread across all four shards" : "every new id goes to the last shard", 240, 262, { size: 12, color: hash ? pal.ok : pal.bad });
    g.text(hash ? "trade-off: range scans now touch every shard" : "range queries stay cheap, writes do not", 240, 284, { size: 10, color: pal.muted });
  },
};

const nosqlModels: Scene = {
  title: "One question, three data models",
  caption: "Find a user's friends of friends. A document store keeps each user as a nested blob and needs several fetches. A wide-column table is keyed for fast lookups by user, and a graph database follows the edges directly.",
  controls: [{ id: "m", kind: "choice", label: "Model", options: ["document", "wide-column", "graph"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const m = g.v.m;
    if (m === 0) {
      [0, 1, 2].forEach((k) => {
        node(g, "doc", 90 + k * 150, 90, { label: ["user:ana", "user:raj", "user:mei"][k], size: 50, color: pal.violet });
        g.text('{friends:[…]}', 90 + k * 150, 132, { size: 9, color: pal.muted });
      });
      g.packet(90, 90, 240, 90, g.loop(1.6), pal.accent, 3);
      g.packet(240, 90, 390, 90, g.loop(1.6, 0.5), pal.accent, 3);
      g.text("one fetch per hop: the app joins in code", 240, 220, { size: 12, color: pal.paper });
    } else if (m === 1) {
      g.rect(60, 50, 360, 24, pal.blue, 0.2, 4);
      ["row key", "friend:raj", "friend:mei", "post:1"].forEach((c, k) => g.text(c, 100 + k * 92, 62, { size: 10, color: pal.paper }));
      for (let r = 0; r < 4; r++) {
        g.rect(60, 80 + r * 26, 360, 22, pal.line, r === 1 ? 0.35 : 0.12, 3);
        g.text(["ana", "raj", "mei", "lee"][r], 100, 91 + r * 26, { size: 10, color: pal.paper });
        for (let c = 1; c < 4; c++) if (g.rnd(r * 3 + c) > 0.35) g.dot(100 + c * 92, 91 + r * 26, 3, pal.teal);
      }
      g.text("fast by row key, fan-out reads still one per friend", 240, 220, { size: 12, color: pal.paper });
    } else {
      const pts: [number, number][] = [[240, 60], [130, 120], [350, 120], [70, 190], [190, 190], [300, 190], [410, 190]];
      const ed = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
      ed.forEach(([a, b], k) => {
        g.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], pal.line, 0.8, 1.3);
        g.packet(pts[a][0], pts[a][1], pts[b][0], pts[b][1], (g.t * 0.7 + k * 0.15) % 1, pal.accent, 2.4);
      });
      pts.forEach(([x, y], k) => {
        g.ring(x, y, 12, k === 0 ? pal.accent : k < 3 ? pal.ok : pal.blue, 1, 1.6);
        g.dot(x, y, 4, k === 0 ? pal.accent : k < 3 ? pal.ok : pal.blue);
      });
      g.text("edges are stored: friends of friends is a short walk", 240, 250, { size: 12, color: pal.paper });
    }
  },
};

const readRepair: Scene = {
  title: "Read repair",
  caption: "Three replicas hold a value but one missed the latest write. A read asks several replicas, compares versions, returns the newest and quietly pushes it to the stale replica, so reads heal the cluster over time.",
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.8, 1.8, 2]);
    const ys = [60, 130, 200];
    const vals = ["v2", "v2", i >= 3 ? "v2" : "v1"];
    ys.forEach((y, k) => {
      node(g, "db", 360, y, { label: `replica ${k + 1}`, size: 40, color: vals[k] === "v1" ? pal.bad : pal.blue });
      g.text(vals[k], 400, y - 4, { size: 12, color: vals[k] === "v1" ? pal.bad : pal.ok });
    });
    node(g, "client", 60, 130, { label: "client", size: 40 });
    if (i === 0) ys.forEach((y) => g.packet(86, 130, 330, y, p, pal.accent, 2.4));
    if (i === 1) ys.forEach((y, k) => g.packet(330, y, 86, 130, p, k === 2 ? pal.bad : pal.ok, 2.4));
    if (i === 2) g.packet(86, 130, 330, 200, p, pal.ok, 3);
    if (i === 3) g.glow(360, 200, 36, pal.ok, 0.3);
    g.text(["client reads from all three", "replies disagree: v2, v2, v1", "client writes v2 back to the stale replica", "replicas converged"][i], 240, 262, { size: 12, color: i === 3 ? pal.ok : pal.paper });
  },
};

const snowflake: Scene = {
  title: "Snowflake ids: time, machine, sequence",
  caption: "A 64-bit id is cut into three fields: milliseconds since an epoch, a machine number and a per-millisecond counter. Because time leads, ids sort roughly by creation, and no coordination is needed between machines.",
  aspect: 0.6,
  make: () => (g) => {
    const { pal } = g;
    const parts: [string, number, string][] = [["41 bits time", 41, pal.blue], ["10 bits machine", 10, pal.violet], ["12 bits sequence", 12, pal.accent]];
    let x = 24;
    const scale = 432 / 63;
    parts.forEach(([nm, bits, col]) => {
      const w = bits * scale;
      g.rect(x, 50, w - 2, 34, col, 0.3, 4);
      g.frame(x, 50, w - 2, 34, col, 1, 4, 1.3);
      g.text(nm, x + w / 2, 67, { size: 10, color: pal.paper });
      x += w;
    });
    g.text("sign bit 0", 12, 44, { size: 8, color: pal.muted, align: "left" });
    const ms = Math.floor(g.t * 3);
    [0, 1, 2].forEach((m) => {
      node(g, "server", 80 + m * 160, 150, { label: `machine ${m + 1}`, size: 34, active: true });
      const seq = (ms + m) % 7;
      const id = ((1000 + ms) * 4096 + m * 8 + seq).toString();
      chip(g, 80 + m * 160, 200, `…${id.slice(-7)}`, [pal.blue, pal.violet, pal.teal][m], 10);
      g.packet(80 + m * 160, 170, 80 + m * 160, 186, (g.t * 2 + m * 0.3) % 1, pal.accent, 2);
    });
    g.text("ids from every machine still sort by time", 240, 250, { size: 12, color: pal.paper });
  },
};

const ringAddNode: Scene = {
  title: "Adding a node: ring versus mod N",
  caption: "Twenty keys on three nodes, then a fourth node joins. With hash mod N almost every key changes owner. On a hash ring only the keys that now fall to the new node move.",
  controls: [{ id: "m", kind: "choice", label: "Placement", options: ["hash mod N", "consistent hash ring"], initial: 1 }],
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const ring = g.v.m === 1;
    const keys = 24;
    const added = (g.t % 6) > 3;
    const nodes0 = 3;
    const nodes1 = 4;
    const owner = (k: number, n: number) => {
      const h = hash32(`key${k}`);
      if (!ring) return Math.floor(h * n);
      const ps = Array.from({ length: n }, (_, i) => hash32(`node${i}`)).map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
      const hit = ps.find((q) => q.p >= h) ?? ps[0];
      return hit.i;
    };
    let moved = 0;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent];
    for (let k = 0; k < keys; k++) {
      const a = owner(k, nodes0);
      const b = owner(k, nodes1);
      if (a !== b) moved++;
      const own = added ? b : a;
      const x = 30 + (k % 12) * 36;
      const y = 40 + Math.floor(k / 12) * 28;
      g.rect(x, y, 30, 22, cols[own], 0.45, 4);
      if (added && a !== b) g.frame(x, y, 30, 22, pal.bad, 1, 4, 1.8);
    }
    for (let n = 0; n < (added ? 4 : 3); n++) node(g, "db", 70 + n * 110, 140, { label: `node ${n + 1}`, size: 38, color: cols[n] });
    g.text(added ? `${moved} of ${keys} keys moved (red)` : "three nodes", 240, 224, { size: 14, color: added ? (moved > 12 ? pal.bad : pal.ok) : pal.paper, bold: true });
    g.text(ring ? "only the new node's arc changes hands" : "changing N reshuffles almost everything", 240, 258, { size: 11, color: pal.muted });
  },
};

const saltKey: Scene = {
  title: "Salting a hot key",
  caption: "One celebrity key takes most of the traffic and overloads its shard. Appending a small random suffix spreads that key over several shards, and reads then gather the pieces.",
  controls: [{ id: "s", kind: "toggle", label: "Salt the hot key", initial: true }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const salt = g.v.s === 1;
    const load = [0, 0, 0, 0];
    for (let k = 0; k < 20; k++) {
      const f = (g.t * 1.4 + k / 20) % 1;
      const hot = g.rnd(Math.floor(g.t * 1.4 + k / 20) * 20 + k) < 0.8;
      const s = hot ? (salt ? Math.floor(g.rnd(k * 9.1 + Math.floor(g.t * 1.4) * 3) * 4) : 1) : Math.floor(g.rnd(k * 7.7) * 4);
      load[s]++;
      g.packet(30, 120, 90 + s * 100, 150, f, hot ? pal.bad : pal.blue, 2);
    }
    node(g, "user", 30, 120, { size: 30 });
    load.forEach((l, s) => node(g, "db", 90 + s * 100, 190, { label: `shard ${s + 1}`, size: 44, color: l > 9 ? pal.bad : pal.blue, fill: Math.min(1, l / 14), active: true }));
    g.text(salt ? "key#0, key#1, key#2, key#3 share the load" : "key 'celebrity' hashes to a single shard", 240, 262, { size: 12, color: salt ? pal.ok : pal.bad });
  },
};

const invalidation: Scene = {
  title: "Stale cache after a write",
  caption: "The database row changes, but the cache still holds the old value. A TTL fixes it eventually, and deleting the cache key on write fixes it at once. Pick a policy and watch how long readers see stale data.",
  controls: [{ id: "p", kind: "choice", label: "Invalidation", options: ["none", "TTL 5 s", "delete on write"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const pol = g.v.p;
    const t = g.t % 9;
    const written = t > 2;
    const cacheFresh = pol === 2 ? t > 2.4 : pol === 1 ? t > 7 : false;
    node(g, "client", 40, 120, { label: "reader", size: 38 });
    node(g, "cache", 190, 120, { label: "cache", size: 44, active: true });
    node(g, "db", 340, 120, { label: "database", size: 44, color: pal.blue });
    g.text(written ? "v2" : "v1", 340, 158, { size: 12, color: pal.ok });
    const cv = pol === 2 && t > 2 && t < 2.4 ? "—" : cacheFresh ? "v2" : "v1";
    g.text(cv, 190, 158, { size: 12, color: cv === "v1" && written ? pal.bad : pal.ok });
    g.packet(60, 118, 164, 118, (g.t * 1.2) % 1, pal.accent, 2.6);
    if (written && t < 3) g.packet(340, 90, 340, 70, 0.5, pal.accent, 3);
    const stale = written && cv === "v1";
    chip(g, 240, 214, stale ? "readers see stale v1" : "readers see v2", stale ? pal.bad : pal.ok, 12);
    g.text(pol === 0 ? "no invalidation: stale until eviction" : pol === 1 ? "stale until the TTL expires" : "the write removes the cache key", 240, 262, { size: 11, color: pal.muted });
  },
};

const evictionPolicy: Scene = {
  title: "LRU versus LFU eviction",
  caption: "The cache holds four items. A scan of one-off keys arrives between hits on a popular item. LRU lets the scan push the popular key out, while LFU remembers it was used often and keeps it.",
  controls: [{ id: "p", kind: "choice", label: "Policy", options: ["LRU", "LFU"], initial: 0 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const lfu = g.v.p === 1;
    const seq = ["A", "A", "A", "B", "C", "D", "E", "F", "A"];
    const step = Math.min(seq.length, Math.floor((g.t % 12) * 1.1));
    const cache: string[] = [];
    const freq: Record<string, number> = {};
    const last: Record<string, number> = {};
    let hit = false;
    seq.slice(0, step).forEach((k, idx) => {
      freq[k] = (freq[k] ?? 0) + 1;
      last[k] = idx;
      hit = cache.includes(k);
      if (!hit) {
        if (cache.length === 4) {
          const v = cache.reduce((a, b) => (lfu ? (freq[a] < freq[b] || (freq[a] === freq[b] && last[a] < last[b]) ? a : b) : last[a] < last[b] ? a : b));
          cache.splice(cache.indexOf(v), 1);
        }
        cache.push(k);
      }
    });
    node(g, "cache", 60, 100, { label: "cache (4)", size: 40, active: true });
    for (let s = 0; s < 4; s++) {
      g.rect(130 + s * 66, 80, 58, 40, cache[s] ? pal.blue : pal.line, cache[s] ? 0.3 : 0.1, 6);
      if (cache[s]) g.text(`${cache[s]} ×${freq[cache[s]] ?? 0}`, 159 + s * 66, 100, { size: 12, color: cache[s] === "A" ? pal.accent : pal.paper });
    }
    seq.forEach((k, idx) => {
      const x = 40 + idx * 46;
      g.rect(x, 170, 38, 24, idx < step ? pal.accent : pal.line, idx < step ? 0.3 : 0.1, 4);
      g.text(k, x + 19, 182, { size: 11, color: pal.paper });
    });
    g.text("request stream", 240, 152, { size: 10, color: pal.muted });
    const final = step === seq.length;
    g.text(final ? (cache.includes("A") ? "A survived the scan: hit ✓" : "A was evicted by the scan: miss ✕") : "…", 240, 238, { size: 13, color: final ? (cache.includes("A") ? pal.ok : pal.bad) : pal.muted });
  },
};

const cacheTiers: Scene = {
  title: "Where does the request stop?",
  caption: "A request tries the browser cache, then the CDN, then a regional shield, and only then the origin. A very popular object is answered at the first tier, a rare one travels all the way to the origin.",
  controls: [{ id: "p", kind: "range", label: "Popularity", min: 0, max: 3, step: 1, initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const stop = 3 - g.v.p;
    const tiers: [string, "client" | "cdn" | "cloud" | "db"][] = [["browser", "client"], ["CDN edge", "cdn"], ["shield", "cloud"], ["origin", "db"]];
    tiers.forEach(([nm, kind], k) => {
      const x = 50 + k * 125;
      node(g, kind, x, 110, { label: nm, size: 40, color: k === stop ? pal.ok : pal.paper, a: k <= stop ? 1 : 0.35 });
      if (k < 3) g.arrow(x + 24, 110, x + 100, 110, pal.line, k < stop ? 0.9 : 0.3);
    });
    const f = g.loop(3) * 4;
    const x = Math.min(50 + f * 125, 50 + stop * 125);
    g.dot(x, 110, 5, pal.accent);
    g.glow(x, 110, 14, pal.accent, 0.4);
    const lat = [1, 15, 40, 120][stop];
    g.text(`answered by the ${tiers[stop][0]}`, 240, 190, { size: 13, color: pal.ok });
    g.text("latency", 90, 236, { size: 11 });
    bar(g, 140, 231, 260, 8, lat / 120, stop === 3 ? pal.bad : pal.ok);
    g.text(`~${lat} ms`, 440, 236, { size: 12, color: pal.paper });
  },
};

const hitRatio: Scene = {
  title: "Why hit ratio matters so much",
  caption: "Average latency is hit ratio times cache time plus miss ratio times database time. Slide the hit ratio from 80% to 99% and the database load collapses while the average latency approaches the cache's.",
  controls: [{ id: "h", kind: "range", label: "Hit ratio %", min: 50, max: 99, step: 1, initial: 90 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const h = g.v.h / 100;
    const avg = h * 1 + (1 - h) * 40;
    const rps = 10000;
    node(g, "cache", 150, 90, { label: "cache 1 ms", size: 44, active: true });
    node(g, "db", 340, 90, { label: "database 40 ms", size: 44, color: pal.blue, fill: Math.min(1, (1 - h) * 3) });
    for (let k = 0; k < 8; k++) {
      const f = (g.t * 0.8 + k / 8) % 1;
      const miss = g.rnd(k * 3.1 + Math.floor(g.t * 0.8 + k / 8)) > h;
      g.packet(40, 90, 124, 90, f, pal.accent, 2.4);
      if (miss) g.packet(176, 90, 314, 90, f, pal.bad, 2.4);
    }
    g.text("average latency", 80, 190, { size: 11 });
    bar(g, 150, 185, 250, 8, avg / 40, avg > 8 ? pal.bad : pal.ok);
    g.text(`${avg.toFixed(1)} ms`, 440, 190, { size: 12, color: pal.paper });
    g.text("database load", 80, 218, { size: 11 });
    bar(g, 150, 213, 250, 8, 1 - h, (1 - h) > 0.1 ? pal.bad : pal.ok);
    g.text(`${fmt((1 - h) * rps)} req/s`, 440, 218, { size: 12, color: pal.paper });
    g.text("each extra point of hit ratio cuts misses sharply", 240, 264, { size: 10, color: pal.muted });
  },
};

const hashSlots: Scene = {
  title: "Redis Cluster hash slots",
  caption: "Keys map to one of 16,384 slots and each node owns a range of slots. Adding a node moves whole slots to it, not individual keys, which makes resharding a controlled, incremental operation.",
  controls: [{ id: "n", kind: "range", label: "Nodes", min: 3, max: 6, step: 1, initial: 3 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const n = g.v.n;
    const cols = [pal.blue, pal.violet, pal.teal, pal.accent, pal.ok, pal.bad];
    const cells = 48;
    for (let k = 0; k < cells; k++) {
      const x = 24 + (k % 24) * 18;
      const y = 40 + Math.floor(k / 24) * 22;
      const own = Math.floor((k / cells) * n);
      g.rect(x, y, 15, 18, cols[own], 0.5, 3);
    }
    g.text("16,384 slots (48 shown)", 240, 28, { size: 10, color: pal.muted });
    for (let k = 0; k < n; k++) {
      const x = 240 + (k - (n - 1) / 2) * 76;
      node(g, "cache", x, 140, { label: `node ${k + 1}`, size: 38, color: cols[k], active: true });
      g.text(`${Math.round(16384 / n)} slots`, x, 182, { size: 9, color: pal.muted });
    }
    const keyslot = Math.floor(hash32(`user:${Math.floor(g.t / 2)}`) * 16384);
    const own = Math.floor((keyslot / 16384) * n);
    g.text(`key → slot ${keyslot} → node ${own + 1}`, 240, 232, { size: 12, color: pal.paper });
    g.packet(40, 120, 240 + (own - (n - 1) / 2) * 76 - 24, 134, (g.t * 0.8) % 1, pal.accent, 3);
    g.text("adding a node migrates slots, not single keys", 240, 266, { size: 11, color: pal.muted });
  },
};

const quorum: Scene = {
  title: "Quorum: why a majority",
  caption: "A cluster of five can only commit while a majority, three nodes, can talk to each other. Knock nodes out one at a time: with two down it still works, with three down it stops rather than risk two leaders.",
  controls: [{ id: "d", kind: "range", label: "Nodes down", min: 0, max: 4, step: 1, initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const down = g.v.d;
    const up = 5 - down;
    const ok = up >= 3;
    for (let k = 0; k < 5; k++) {
      const x = 60 + k * 90;
      const dead = k >= up;
      node(g, "server", x, 100, { label: k === 0 && !dead ? "leader" : `node ${k + 1}`, size: 42, color: dead ? pal.bad : pal.ok, a: dead ? 0.4 : 1, active: !dead });
      if (dead) g.text("✕", x, 100, { size: 18, color: pal.bad });
    }
    if (ok) for (let k = 1; k < up; k++) g.packet(60, 140, 60 + k * 90, 140, (g.t * 0.8 + k * 0.2) % 1, pal.accent, 2.4);
    g.text(`${up} of 5 reachable, majority needs 3`, 240, 200, { size: 13, color: pal.paper });
    chip(g, 240, 238, ok ? "writes commit ✓" : "no quorum: writes refused", ok ? pal.ok : pal.bad, 12);
  },
};

const lockTtl: Scene = {
  title: "A lock whose TTL is too short",
  caption: "The lock expires after ten seconds but the job takes fourteen. At second ten another worker legitimately gets the lock while the first is still working, so both run at once. Pick a longer TTL or renew while working.",
  controls: [{ id: "t", kind: "range", label: "Lock TTL (s)", min: 6, max: 20, step: 2, initial: 10 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const ttl = g.v.t;
    const job = 14;
    const t = (g.t * 2) % 26;
    const x0 = 60;
    const sc = 360 / 26;
    g.text("worker A", 30, 80, { size: 10, color: pal.ok, align: "left" });
    g.rect(x0, 70, Math.min(t, job) * sc, 20, pal.ok, 0.6, 4);
    g.text("lock lease", 30, 130, { size: 10, color: pal.accent, align: "left" });
    g.rect(x0, 120, Math.min(t, ttl) * sc, 20, pal.accent, 0.6, 4);
    const overlap = ttl < job;
    g.text("worker B", 30, 180, { size: 10, color: pal.violet, align: "left" });
    if (t > ttl) g.rect(x0 + ttl * sc, 170, Math.min(t - ttl, job) * sc, 20, overlap ? pal.bad : pal.violet, 0.6, 4);
    if (overlap) g.rect(x0 + ttl * sc, 60, (job - ttl) * sc, 140, pal.bad, 0.12, 0);
    g.line(x0 + ttl * sc, 56, x0 + ttl * sc, 204, pal.accent, 0.8, 1.4);
    g.text(overlap ? `both run for ${job - ttl} s: not exclusive ✕` : "A finishes before the lease ends ✓", 240, 236, { size: 12, color: overlap ? pal.bad : pal.ok });
    node(g, "lock", 450, 130, { size: 30, color: pal.accent });
  },
};

const gossip: Scene = {
  title: "Gossip spreading a failure",
  caption: "Each round, every node tells a couple of random peers what it knows. When one node stops answering, the suspicion spreads like a rumour and the whole cluster knows within a few rounds, with no central coordinator.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const n = 10;
    const round = Math.floor(g.t * 1.2) % 9;
    const informed = Math.min(n - 1, 1 + Math.floor(Math.pow(2, round * 0.55)));
    const cx = 240;
    const cy = 130;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + 110 * Math.cos(a);
      const y = cy + 90 * Math.sin(a);
      const dead = k === 0;
      const knows = !dead && k < informed;
      node(g, "server", x, y, { size: 30, color: dead ? pal.bad : knows ? pal.accent : pal.blue, a: dead ? 0.5 : 1 });
      if (dead) g.text("✕", x, y, { size: 16, color: pal.bad });
      if (knows) {
        const b = (((k + 3) % n) / n) * Math.PI * 2 - Math.PI / 2;
        g.packet(x, y, cx + 110 * Math.cos(b), cy + 90 * Math.sin(b), (g.t * 1.2) % 1, pal.accent, 2);
      }
    }
    g.text(`round ${round + 1}: ${Math.min(n - 1, informed)} of ${n - 1} nodes know node 1 is down`, 240, 252, { size: 12, color: pal.paper });
    g.text("spread grows exponentially, no coordinator needed", 240, 276, { size: 10, color: pal.muted });
  },
};

const raftLog: Scene = {
  title: "Raft log replication",
  caption: "The leader appends an entry to its log, sends it to the followers and counts acknowledgements. Once a majority has stored it, the entry is committed and applied, and followers learn the commit index on the next message.",
  aspect: 0.64,
  make: () => (g) => {
    const { pal } = g;
    const { i, p } = g.stage([1.6, 1.8, 1.6, 2]);
    const rows = ["leader", "follower 1", "follower 2"];
    rows.forEach((nm, k) => {
      const y = 60 + k * 62;
      node(g, "server", 50, y, { label: "", size: 30, active: k === 0 });
      g.text(nm, 50, y + 30, { size: 9, color: pal.muted });
      for (let s = 0; s < 5; s++) {
        const has = s < 3 || (s === 3 && (k === 0 ? i >= 0 : k === 1 ? i >= 1 : i >= 2));
        const committed = s === 3 && i >= 3;
        g.rect(110 + s * 56, y - 16, 50, 32, has ? (committed ? pal.ok : pal.blue) : pal.line, has ? 0.4 : 0.08, 5);
        if (has) g.text(s === 3 ? "x=7" : `e${s + 1}`, 135 + s * 56, y, { size: 11, color: pal.paper });
      }
    });
    if (i === 1) {
      g.packet(80, 66, 108, 126, p, pal.accent, 3);
      g.packet(80, 66, 108, 188, g.clamp(p * 0.8), pal.accent, 3);
    }
    if (i === 2) g.packet(108, 188, 80, 70, p, pal.ok, 3);
    g.text(["leader appends x=7 to its log", "replicates to the followers", "a follower acknowledges: that is a majority (2 of 3)", "committed and applied"][i], 240, 262, { size: 12, color: i === 3 ? pal.ok : pal.paper });
  },
};

const sagaCompensate: Scene = {
  title: "Saga compensation",
  caption: "A saga runs local steps in order. If step 3 fails, the earlier steps are undone by their compensating actions in reverse. Choose where it fails and watch the rollback walk backwards.",
  controls: [{ id: "f", kind: "choice", label: "Fails at", options: ["never (success)", "payment", "shipping"], initial: 2 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const fail = g.v.f === 0 ? 9 : g.v.f === 1 ? 1 : 2;
    const steps = ["reserve stock", "charge payment", "book shipping"];
    const comp = ["release stock", "refund", "cancel booking"];
    const total = fail === 9 ? 3 : fail + 1 + fail;
    const pos = (g.t * 1.2) % (total + 1.5);
    steps.forEach((s, k) => {
      const x = 90 + k * 150;
      const y = 80;
      const ran = pos > k + 0.3;
      const failed = k === fail && pos > k + 0.3;
      const undone = fail !== 9 && k < fail && pos > fail + 1 + (fail - 1 - k) + 0.3;
      const col = failed ? pal.bad : undone ? pal.accent : ran ? pal.ok : pal.line;
      g.rect(x - 62, y - 24, 124, 48, col, 0.2, 8);
      g.frame(x - 62, y - 24, 124, 48, col, 1, 8, 1.4);
      g.text(s, x, y - 5, { size: 11, color: pal.paper });
      g.text(failed ? "failed ✕" : undone ? comp[k] : ran ? "done ✓" : "", x, y + 12, { size: 10, color: failed ? pal.bad : undone ? pal.accent : pal.ok });
      if (k < 2) g.arrow(x + 64, y, x + 86, y, pal.line, 0.8);
    });
    g.orb(pos > fail + 1 && fail !== 9 ? "shaping" : "working", 240, 170, 36, pal.paper, 1);
    g.text(fail === 9 ? "all steps committed" : "compensations run in reverse order", 240, 238, { size: 12, color: fail === 9 ? pal.ok : pal.accent });
    g.text("no global lock, but intermediate states are visible", 240, 266, { size: 10, color: pal.muted });
  },
};

const vectorClocks: Scene = {
  title: "Vector clocks: concurrent or ordered?",
  caption: "Each process keeps a counter per process and sends it with messages. If one vector is at least as large everywhere, that event happened before. If neither dominates, the two events were concurrent and need merging.",
  controls: [{ id: "s", kind: "choice", label: "Scenario", options: ["B saw A's write first", "A and B wrote independently"], initial: 1 }],
  aspect: 0.62,
  make: () => (g) => {
    const { pal } = g;
    const conc = g.v.s === 1;
    const { i, p } = g.stage([1.8, 1.8, 2.2]);
    node(g, "server", 60, 70, { label: "", size: 28 });
    node(g, "server", 60, 170, { label: "", size: 28 });
    g.text("A", 100, 70, { size: 12, color: pal.blue });
    g.text("B", 100, 170, { size: 12, color: pal.violet });
    g.line(120, 70, 440, 70, pal.line, 0.6, 1.2);
    g.line(120, 170, 440, 170, pal.line, 0.6, 1.2);
    const a = [1, 0];
    const b = conc ? [0, 1] : [1, 1];
    if (i >= 0) chip(g, 190, 70, "A writes [1,0]", pal.blue, 10);
    if (!conc && i >= 1) g.packet(190, 82, 270, 158, i === 1 ? p : 1, pal.accent, 3);
    if (i >= 1) chip(g, 270, 170, `B writes [${b[0]},${b[1]}]`, pal.violet, 10);
    const dom = !conc;
    if (i >= 2) {
      chip(g, 240, 120, dom ? "[1,0] ≤ [1,1]: ordered ✓" : "neither dominates: concurrent", dom ? pal.ok : pal.bad, 11);
      g.text(dom ? "keep B's value, it is newer" : "conflict: keep both and merge", 240, 232, { size: 12, color: dom ? pal.ok : pal.bad });
    }
    void a;
  },
};

export const MORE_SD_1: Record<string, Scene[]> = {
  [`${P}/foundations/cap-theorem`]: [capDomains],
  [`${P}/foundations/back-of-envelope-estimation`]: [storageGrowth],
  [`${P}/foundations/availability-and-the-nines`]: [redundancy],
  [`${P}/foundations/latency-numbers-every-engineer-should-know`]: [requestBudget],
  [`${P}/foundations/consistency-models-overview`]: [readYourWrites],
  [`${P}/foundations/vertical-vs-horizontal-scaling-tradeoffs`]: [scaleCube],
  [`${P}/apis-services-protocols/rest-vs-grpc-vs-graphql`]: [graphqlFetch],
  [`${P}/apis-services-protocols/idempotency-and-api-design`]: [retryMethods],
  [`${P}/apis-services-protocols/pagination-versioning-and-webhooks`]: [cursorPaging],
  [`${P}/apis-services-protocols/api-gateway-patterns-and-edge-rate-limiting`]: [gatewayPipeline],
  [`${P}/apis-services-protocols/authn-authz-patterns`]: [sessionVsJwt],
  [`${P}/apis-services-protocols/long-running-operations-and-async-api-design`]: [pollVsHook],
  [`${P}/data-modeling-and-sql/normalization-and-denormalization`]: [updateAnomaly],
  [`${P}/data-modeling-and-sql/acid-transactions-and-isolation-levels`]: [isolationAnomaly],
  [`${P}/data-modeling-and-sql/indexing-strategies`]: [indexLookup],
  [`${P}/data-modeling-and-sql/query-optimization-and-execution-plans`]: [planTree],
  [`${P}/data-modeling-and-sql/connection-pooling-and-read-replicas`]: [replicaRouting],
  [`${P}/data-modeling-and-sql/schema-migration-strategies-at-scale`]: [expandContract],
  [`${P}/nosql-partitioning-and-ids/sharding-strategies`]: [hotSequential],
  [`${P}/nosql-partitioning-and-ids/nosql-data-models-document-vs-columnar-vs-graph`]: [nosqlModels],
  [`${P}/nosql-partitioning-and-ids/eventual-consistency-in-practice`]: [readRepair],
  [`${P}/nosql-partitioning-and-ids/distributed-id-generation`]: [snowflake],
  [`${P}/nosql-partitioning-and-ids/consistent-hashing-in-depth`]: [ringAddNode],
  [`${P}/nosql-partitioning-and-ids/hot-partition-mitigation-and-rebalancing`]: [saltKey],
  [`${P}/caching-and-fast-reads/caching-strategies-and-invalidation`]: [invalidation],
  [`${P}/caching-and-fast-reads/cache-eviction-and-thundering-herd`]: [evictionPolicy],
  [`${P}/caching-and-fast-reads/multi-level-caching-and-cdn-hierarchies`]: [cacheTiers],
  [`${P}/caching-and-fast-reads/cache-aside-write-through-write-behind`]: [hitRatio],
  [`${P}/caching-and-fast-reads/distributed-cache-coherence`]: [hashSlots],
  [`${P}/distributed-coordination/consensus-and-leader-election`]: [quorum],
  [`${P}/distributed-coordination/distributed-locks`]: [lockTtl],
  [`${P}/distributed-coordination/gossip-protocols-and-failure-detection`]: [gossip],
  [`${P}/distributed-coordination/raft-vs-paxos-walkthrough`]: [raftLog],
  [`${P}/distributed-coordination/distributed-transactions-2pc-saga`]: [sagaCompensate],
  [`${P}/distributed-coordination/clock-synchronization`]: [vectorClocks],
};
