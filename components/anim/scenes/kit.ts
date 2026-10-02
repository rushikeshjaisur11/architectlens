import type { OrbState } from "thinking-orbs";
import type { G } from "../scene/types";

export function chip(g: G, x: number, y: number, s: string, color?: string, size = 11, a = 1): void {
  const w = s.length * size * 0.62 + 12;
  g.rect(x - w / 2, y - size * 0.95, w, size * 1.9, g.pal.ink, 0.85 * a, 4);
  g.frame(x - w / 2, y - size * 0.95, w, size * 1.9, color ?? g.pal.line, a, 4, 1);
  g.text(s, x, y + 0.5, { size, color: color ?? g.pal.paper, a });
}

export function server(g: G, x: number, y: number, label: string, o: { state?: OrbState; color?: string; a?: number; size?: number; ring?: string } = {}): void {
  const size = o.size ?? 46;
  const a = o.a ?? 1;
  g.glow(x, y, size * 0.9, o.ring ?? o.color ?? g.pal.accent, 0.12 * a);
  g.ring(x, y, size * 0.52, o.ring ?? g.pal.line, a, 1.2);
  g.orb(o.state ?? "breathing", x, y, size, o.color ?? g.pal.paper, 1);
  g.text(label, x, y + size * 0.78, { size: 11, color: g.pal.muted, a });
}

export function db(g: G, x: number, y: number, w = 34, h = 40, color?: string, a = 1): void {
  const col = color ?? g.pal.line;
  const c = g.c;
  c.globalAlpha = a;
  c.strokeStyle = col;
  c.lineWidth = 1.3;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.ellipse(x, y - h / 2 + (k * h) / 2.2, w / 2, 5, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(x - w / 2, y - h / 2);
  c.lineTo(x - w / 2, y + h / 2 - 6);
  c.moveTo(x + w / 2, y - h / 2);
  c.lineTo(x + w / 2, y + h / 2 - 6);
  c.stroke();
  c.globalAlpha = 1;
}

export function ptOnCircle(i: number, n: number, cx: number, cy: number, r: number, rot = -Math.PI / 2): [number, number] {
  const a = rot + (i / n) * Math.PI * 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function bar(g: G, x: number, y: number, w: number, h: number, frac: number, color?: string): void {
  g.rect(x, y, w, h, g.pal.line, 0.5, h / 2);
  if (frac > 0) g.rect(x, y, Math.max(h, w * Math.min(1, frac)), h, color ?? g.pal.accent, 1, h / 2);
}

export function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}

export function hash32(s: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function arcStroke(g: G, x: number, y: number, r: number, a0: number, a1: number, color: string, lw = 4, alpha = 1): void {
  if (a1 <= a0) return;
  const c = g.c;
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineCap = "round";
  c.beginPath();
  c.arc(x, y, r, a0, a1);
  c.stroke();
  c.lineCap = "butt";
  c.globalAlpha = 1;
}
