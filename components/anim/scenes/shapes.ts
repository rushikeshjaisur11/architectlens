import type { OrbState } from "thinking-orbs";
import type { G } from "../scene/types";

export type Kind =
  | "server" | "db" | "cache" | "queue" | "client" | "phone" | "user" | "lb"
  | "cloud" | "cdn" | "doc" | "gpu" | "shield" | "lock" | "model";

export type NodeOpts = {
  label?: string;
  size?: number;
  color?: string;
  a?: number;
  active?: boolean;
  fill?: number;
  state?: OrbState;
};

const PI = Math.PI;

export function inferKind(label: string): Kind {
  const s = label.toLowerCase();
  if (/cache|redis|memcache/.test(s)) return "cache";
  if (/queue|kafka|broker|topic|sqs|stream/.test(s)) return "queue";
  if (/balancer|\blb\b|gateway|router|proxy|ingress|nginx/.test(s)) return "lb";
  if (/cdn|edge/.test(s)) return "cdn";
  if (/region|cloud|zone|dc\b/.test(s)) return "cloud";
  if (/gpu|trainer/.test(s)) return "gpu";
  if (/model|agent|llm|judge|brain|planner|supervisor/.test(s)) return "model";
  if (/phone|mobile|device/.test(s)) return "phone";
  if (/user|rider|driver|customer|viewer|buyer|member/.test(s)) return "user";
  if (/client|browser|app\b|laptop|web\b|frontend/.test(s)) return "client";
  if (/lock|auth|secret|vault/.test(s)) return "lock";
  if (/shield|guard|firewall|filter/.test(s)) return "shield";
  if (/doc|file|page|object|blob/.test(s)) return "doc";
  if (/db|database|shard|replica|primary|follower|leader|store|storage|index|disk|lsm|table|warehouse|sql|postgres|ledger|bucket|tablet|partition|log$/.test(s)) return "db";
  return "server";
}

function paint(g: G, color: string, a: number, fillA = 0.14): void {
  const c = g.c;
  c.globalAlpha = a * fillA;
  c.fillStyle = color;
  c.fill();
  c.globalAlpha = a;
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.stroke();
  c.globalAlpha = 1;
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  const c = g.c;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

function strokeOnly(g: G, color: string, a: number, lw = 1.2): void {
  g.c.globalAlpha = a;
  g.c.strokeStyle = color;
  g.c.lineWidth = lw;
  g.c.stroke();
  g.c.globalAlpha = 1;
}

export function node(g: G, kind: Kind, x: number, y: number, o: NodeOpts = {}): void {
  const s = o.size ?? 44;
  const a = o.a ?? 1;
  const col = o.color ?? g.pal.paper;
  const c = g.c;
  const muted = g.pal.muted;
  if (o.active) g.glow(x, y, s * 0.85, col, 0.14 * a);
  switch (kind) {
    case "model":
      g.orb(o.state ?? "breathing", x, y, s, col, 1);
      g.ring(x, y, s * 0.52, g.pal.line, a, 1.2);
      break;
    case "server": {
      const w = s * 0.92;
      const h = s * 0.92;
      rr(g, x - w / 2, y - h / 2, w, h, 6);
      paint(g, col, a);
      for (let i = 0; i < 3; i++) {
        const sy = y - h / 2 + h * 0.12 + i * h * 0.29;
        rr(g, x - w * 0.4, sy, w * 0.8, h * 0.2, 3);
        strokeOnly(g, col, a * 0.55, 1);
        const on = o.active ? Math.sin(g.t * 6 + i * 2) > -0.2 : true;
        g.dot(x - w * 0.28, sy + h * 0.1, 1.8, on ? g.pal.ok : muted, a);
        g.line(x + w * 0.0, sy + h * 0.1, x + w * 0.3, sy + h * 0.1, col, a * 0.5, 1);
      }
      break;
    }
    case "db": {
      const w = s * 0.86;
      const h = s * 1.0;
      const ry = s * 0.15;
      const top = y - h / 2 + ry;
      const bot = y + h / 2 - ry;
      c.beginPath();
      c.moveTo(x - w / 2, top);
      c.lineTo(x - w / 2, bot);
      c.ellipse(x, bot, w / 2, ry, 0, PI, 0, true);
      c.lineTo(x + w / 2, top);
      c.ellipse(x, top, w / 2, ry, 0, 0, PI * 2);
      paint(g, col, a);
      if (o.fill !== undefined && o.fill > 0) {
        const fh = (bot - top) * Math.min(1, o.fill);
        c.save();
        c.beginPath();
        c.rect(x - w / 2, bot - fh, w, fh + ry);
        c.clip();
        c.beginPath();
        c.moveTo(x - w / 2, top);
        c.lineTo(x - w / 2, bot);
        c.ellipse(x, bot, w / 2, ry, 0, PI, 0, true);
        c.lineTo(x + w / 2, top);
        c.closePath();
        c.globalAlpha = a * 0.5;
        c.fillStyle = g.pal.accent;
        c.fill();
        c.restore();
        c.globalAlpha = 1;
      }
      for (let i = 1; i <= 2; i++) {
        const by = top + ((bot - top) * i) / 3;
        c.beginPath();
        c.ellipse(x, by, w / 2, ry, 0, 0, PI);
        strokeOnly(g, col, a * 0.6, 1.1);
      }
      if (o.active) g.dot(x + w * 0.28, bot - ry * 0.2, 2, g.pal.ok, a);
      break;
    }
    case "cache": {
      const w = s * 0.7;
      rr(g, x - w / 2, y - w / 2, w, w, 5);
      paint(g, col, a);
      for (let i = 0; i < 3; i++) {
        const p = y - w / 2 + w * (0.25 + i * 0.25);
        g.line(x - w / 2 - 6, p, x - w / 2, p, col, a * 0.7, 1.4);
        g.line(x + w / 2, p, x + w / 2 + 6, p, col, a * 0.7, 1.4);
      }
      c.beginPath();
      c.moveTo(x + w * 0.06, y - w * 0.3);
      c.lineTo(x - w * 0.16, y + w * 0.04);
      c.lineTo(x + w * 0.02, y + w * 0.04);
      c.lineTo(x - w * 0.06, y + w * 0.3);
      c.lineTo(x + w * 0.17, y - w * 0.06);
      c.lineTo(x - w * 0.01, y - w * 0.06);
      c.closePath();
      c.globalAlpha = a * (o.active ? 0.9 : 0.55);
      c.fillStyle = g.pal.accent;
      c.fill();
      c.globalAlpha = 1;
      break;
    }
    case "queue": {
      const w = s * 1.35;
      const h = s * 0.5;
      rr(g, x - w / 2, y - h / 2, w, h, h / 2);
      paint(g, col, a);
      const n = 4;
      const filled = Math.round((o.fill ?? 0.5) * n);
      for (let i = 0; i < n; i++) {
        const ix = x - w / 2 + h * 0.5 + i * ((w - h) / n);
        rr(g, ix, y - h * 0.26, (w - h) / n - 3, h * 0.52, 3);
        const on = i >= n - filled;
        c.globalAlpha = a * (on ? 0.7 : 0.15);
        c.fillStyle = on ? g.pal.accent : col;
        c.fill();
        c.globalAlpha = 1;
      }
      g.arrow(x + w / 2 + 2, y, x + w / 2 + 12, y, col, a * 0.7);
      break;
    }
    case "client": {
      const w = s * 0.95;
      const h = s * 0.6;
      rr(g, x - w / 2, y - h / 2 - s * 0.08, w, h, 4);
      paint(g, col, a);
      c.beginPath();
      c.moveTo(x - w * 0.62, y + h / 2 - s * 0.02);
      c.lineTo(x + w * 0.62, y + h / 2 - s * 0.02);
      strokeOnly(g, col, a, 2);
      g.line(x - w * 0.3, y - h * 0.3, x + w * 0.3, y - h * 0.3, col, a * 0.5, 1);
      g.line(x - w * 0.3, y - h * 0.08, x + w * 0.1, y - h * 0.08, col, a * 0.5, 1);
      break;
    }
    case "phone": {
      const w = s * 0.52;
      const h = s * 0.92;
      rr(g, x - w / 2, y - h / 2, w, h, 6);
      paint(g, col, a);
      g.line(x - w * 0.15, y - h / 2 + 5, x + w * 0.15, y - h / 2 + 5, col, a * 0.6, 1.2);
      g.dot(x, y + h / 2 - 5, 1.6, col, a * 0.7);
      break;
    }
    case "user": {
      c.beginPath();
      c.arc(x, y - s * 0.2, s * 0.17, 0, PI * 2);
      paint(g, col, a, 0.2);
      c.beginPath();
      c.ellipse(x, y + s * 0.42, s * 0.32, s * 0.3, 0, PI, PI * 2);
      c.closePath();
      paint(g, col, a, 0.2);
      break;
    }
    case "lb": {
      const r = s * 0.48;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = PI / 6 + (i * PI) / 3;
        const px = x + r * Math.cos(ang);
        const py = y + r * Math.sin(ang);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      paint(g, col, a);
      g.line(x - r * 0.55, y, x, y, col, a, 1.4);
      g.line(x, y, x + r * 0.5, y - r * 0.42, col, a, 1.4);
      g.line(x, y, x + r * 0.5, y, col, a, 1.4);
      g.line(x, y, x + r * 0.5, y + r * 0.42, col, a, 1.4);
      break;
    }
    case "cloud": {
      c.beginPath();
      c.moveTo(x - 0.3 * s, y + 0.22 * s);
      c.arc(x - 0.3 * s, y + 0.06 * s, 0.16 * s, 0.5 * PI, 1.5 * PI);
      c.arc(x - 0.07 * s, y - 0.08 * s, 0.22 * s, PI, 1.85 * PI);
      c.arc(x + 0.22 * s, y + 0.02 * s, 0.18 * s, 1.6 * PI, 0.5 * PI);
      c.closePath();
      paint(g, col, a);
      break;
    }
    case "cdn": {
      const r = s * 0.44;
      c.beginPath();
      c.arc(x, y, r, 0, PI * 2);
      paint(g, col, a);
      c.beginPath();
      c.ellipse(x, y, r * 0.42, r, 0, 0, PI * 2);
      strokeOnly(g, col, a * 0.6, 1);
      g.line(x - r, y, x + r, y, col, a * 0.6, 1);
      g.line(x - r * 0.86, y - r * 0.5, x + r * 0.86, y - r * 0.5, col, a * 0.4, 1);
      g.line(x - r * 0.86, y + r * 0.5, x + r * 0.86, y + r * 0.5, col, a * 0.4, 1);
      break;
    }
    case "doc": {
      const w = s * 0.62;
      const h = s * 0.82;
      const f = w * 0.3;
      c.beginPath();
      c.moveTo(x - w / 2, y - h / 2);
      c.lineTo(x + w / 2 - f, y - h / 2);
      c.lineTo(x + w / 2, y - h / 2 + f);
      c.lineTo(x + w / 2, y + h / 2);
      c.lineTo(x - w / 2, y + h / 2);
      c.closePath();
      paint(g, col, a);
      for (let i = 0; i < 3; i++) g.line(x - w * 0.3, y - h * 0.1 + i * h * 0.17, x + w * 0.3, y - h * 0.1 + i * h * 0.17, col, a * 0.55, 1.2);
      break;
    }
    case "gpu": {
      const w = s * 0.95;
      const h = s * 0.62;
      rr(g, x - w / 2, y - h / 2, w, h, 5);
      paint(g, col, a);
      for (let i = 0; i < 4; i++) g.line(x - w * 0.36 + i * w * 0.24, y + h / 2, x - w * 0.36 + i * w * 0.24, y + h / 2 + 5, col, a * 0.7, 1.4);
      const fr = h * 0.3;
      g.ring(x, y, fr, col, a * 0.8, 1.2);
      for (let i = 0; i < 3; i++) {
        const ang = g.t * (o.active ? 5 : 1) + (i * 2 * PI) / 3;
        g.line(x, y, x + fr * Math.cos(ang), y + fr * Math.sin(ang), col, a * 0.8, 1.4);
      }
      break;
    }
    case "shield": {
      c.beginPath();
      c.moveTo(x, y - s * 0.46);
      c.lineTo(x + s * 0.36, y - s * 0.3);
      c.lineTo(x + s * 0.34, y + s * 0.08);
      c.quadraticCurveTo(x + s * 0.28, y + s * 0.36, x, y + s * 0.5);
      c.quadraticCurveTo(x - s * 0.28, y + s * 0.36, x - s * 0.34, y + s * 0.08);
      c.lineTo(x - s * 0.36, y - s * 0.3);
      c.closePath();
      paint(g, col, a, 0.2);
      break;
    }
    case "lock": {
      const w = s * 0.6;
      const h = s * 0.46;
      rr(g, x - w / 2, y - h * 0.1, w, h, 5);
      paint(g, col, a, 0.2);
      c.beginPath();
      c.arc(x, y - h * 0.1, w * 0.3, PI, 0);
      strokeOnly(g, col, a, 1.6);
      g.dot(x, y + h * 0.12, 2.4, col, a);
      break;
    }
  }
  if (o.label) g.text(o.label, x, y + s * (kind === "queue" || kind === "client" || kind === "doc" ? 0.62 : 0.68), { size: 11, color: muted, a });
}
