import { MODE_FRAMES, resolvePreset, type OrbState } from "thinking-orbs";
import type { G, Pal, TextOpts } from "./types";

export const LW = 480;

const DARK: Pal = { ink: "#09090b", panel: "#131316", line: "#3a3a42", paper: "#ededf0", muted: "#b8b8c2", accent: "#f0b04a", ok: "#7bd88f", bad: "#ff6b6b", blue: "#4cc9f0", violet: "#c792ea", teal: "#5eead4" };
const LIGHT: Pal = { ink: "#f7f8fb", panel: "#ffffff", line: "#c3cbdd", paper: "#12172b", muted: "#38425a", accent: "#b45309", ok: "#2f9e57", bad: "#d6453d", blue: "#1783b4", violet: "#8a55c9", teal: "#0f9488" };

export function basePalette(dark: boolean): Pal {
  return { ...(dark ? DARK : LIGHT) };
}

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Canvas text uses the site's mono face; next/font publishes its hashed family name as a CSS variable.
let fontCache = "";
function font() {
  if (!fontCache && typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--font-mono-body").trim();
    if (v) fontCache = `${v}, ui-monospace, Menlo, Consolas, monospace`;
  }
  return fontCache || "ui-monospace, Menlo, Consolas, monospace";
}

export function makeG(c: CanvasRenderingContext2D, h: number): G {
  const g: G = {
    c,
    w: LW,
    h,
    t: 0,
    dt: 0,
    dark: true,
    pal: basePalette(true),
    v: {},
    clicks: {},
    seen: {},
    pressed(id) {
      const now = g.clicks[id] ?? 0;
      const was = g.seen[id] ?? 0;
      g.seen[id] = now;
      return now > was;
    },
    stage(durations) {
      const total = durations.reduce((a, b) => a + b, 0);
      let t = g.t % total;
      for (let i = 0; i < durations.length; i++) {
        if (t < durations[i]) return { i, p: t / durations[i] };
        t -= durations[i];
      }
      return { i: durations.length - 1, p: 1 };
    },
    loop(period, offset = 0) {
      return ((((g.t + offset) % period) + period) % period) / period;
    },
    dot(x, y, r, color, a = 1) {
      c.globalAlpha = a;
      c.fillStyle = color ?? g.pal.accent;
      c.beginPath();
      c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    },
    glow(x, y, r, color, a = 0.5) {
      const [R, G, B] = rgb(color ?? g.pal.accent);
      const grad = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
      grad.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
      c.fill();
    },
    ring(x, y, r, color, a = 1, lw = 1.2) {
      c.globalAlpha = a;
      c.strokeStyle = color ?? g.pal.line;
      c.lineWidth = lw;
      c.beginPath();
      c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    },
    line(x1, y1, x2, y2, color, a = 1, lw = 1) {
      c.globalAlpha = a;
      c.strokeStyle = color ?? g.pal.line;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.globalAlpha = 1;
    },
    arrow(x1, y1, x2, y2, color, a = 1) {
      g.line(x1, y1, x2, y2, color, a, 1.2);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      c.globalAlpha = a;
      c.fillStyle = color ?? g.pal.muted;
      c.beginPath();
      c.moveTo(x2, y2);
      c.lineTo(x2 - 7 * Math.cos(ang - 0.4), y2 - 7 * Math.sin(ang - 0.4));
      c.lineTo(x2 - 7 * Math.cos(ang + 0.4), y2 - 7 * Math.sin(ang + 0.4));
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
    },
    rect(x, y, w, hh, color, a = 1, rad = 4) {
      c.globalAlpha = a;
      c.fillStyle = color ?? g.pal.panel;
      c.beginPath();
      c.roundRect(x, y, w, hh, rad);
      c.fill();
      c.globalAlpha = 1;
    },
    frame(x, y, w, hh, color, a = 1, rad = 4, lw = 1.2) {
      c.globalAlpha = a;
      c.strokeStyle = color ?? g.pal.line;
      c.lineWidth = lw;
      c.beginPath();
      c.roundRect(x, y, w, hh, rad);
      c.stroke();
      c.globalAlpha = 1;
    },
    text(s, x, y, o: TextOpts = {}) {
      c.globalAlpha = o.a ?? 1;
      c.fillStyle = o.color ?? g.pal.muted;
      c.font = `${o.bold ? 600 : 400} ${o.size ?? 12}px ${font()}`;
      c.textAlign = o.align ?? "center";
      c.textBaseline = "middle";
      c.fillText(s, x, y);
      c.globalAlpha = 1;
    },
    packet(ax, ay, bx, by, p, color, r = 3) {
      const col = color ?? g.pal.accent;
      for (let k = 5; k >= 0; k--) {
        const pp = p - k * 0.04;
        if (pp < 0 || pp > 1) continue;
        g.dot(g.mix(ax, bx, pp), g.mix(ay, by, pp), r * (1 - k * 0.12), col, k === 0 ? 1 : 0.5 - k * 0.07);
      }
      if (p >= 0 && p <= 1) g.glow(g.mix(ax, bx, p), g.mix(ay, by, p), r * 4, col, 0.35);
    },
    orb(state: OrbState, x, y, size, color, speed = 1) {
      const preset = resolvePreset(state, 64);
      const frame = MODE_FRAMES[preset.mode](64, g.t * preset.speed * speed, preset.opts);
      const tint = color ?? g.pal.paper;
      const k = size / 64;
      for (const l of frame.lines) {
        c.globalAlpha = Math.max(0, Math.min(1, (1 - l.white) * (l.a ?? 1)));
        c.strokeStyle = tint;
        c.lineWidth = Math.max(0.4, l.w * k);
        c.beginPath();
        c.moveTo(x + (l.x1 - 32) * k, y + (l.y1 - 32) * k);
        c.lineTo(x + (l.x2 - 32) * k, y + (l.y2 - 32) * k);
        c.stroke();
      }
      c.fillStyle = tint;
      for (const d of frame.dots) {
        c.globalAlpha = Math.max(0, Math.min(1, (1 - d.white) * (d.a ?? 1)));
        c.beginPath();
        c.arc(x + (d.x - 32) * k, y + (d.y - 32) * k, Math.max(0.3, d.r * k), 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    },
    mix: (a, b, k) => a + (b - a) * k,
    clamp: (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x)),
    ease: (k) => {
      const x = Math.min(1, Math.max(0, k));
      return x * x * (3 - 2 * x);
    },
    rnd: (seed) => {
      const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    },
  };
  return g;
}
