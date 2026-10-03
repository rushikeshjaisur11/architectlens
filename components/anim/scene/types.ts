import type { OrbState } from "thinking-orbs";

export type Control =
  | { id: string; kind: "button"; label: string }
  | { id: string; kind: "toggle"; label: string; initial?: boolean }
  | { id: string; kind: "choice"; label: string; options: string[]; initial?: number }
  | { id: string; kind: "range"; label: string; min: number; max: number; step: number; initial: number; unit?: string };

export type Pal = {
  ink: string;
  panel: string;
  line: string;
  paper: string;
  muted: string;
  accent: string;
  ok: string;
  bad: string;
  blue: string;
  violet: string;
  teal: string;
};

export type TextOpts = { size?: number; color?: string; a?: number; align?: CanvasTextAlign; bold?: boolean };

export interface G {
  c: CanvasRenderingContext2D;
  w: number;
  h: number;
  t: number;
  dt: number;
  dark: boolean;
  pal: Pal;
  v: Record<string, number>;
  clicks: Record<string, number>;
  seen: Record<string, number>;
  pressed(id: string): boolean;
  stage(durations: number[]): { i: number; p: number };
  loop(period: number, offset?: number): number;
  dot(x: number, y: number, r: number, color?: string, a?: number): void;
  glow(x: number, y: number, r: number, color?: string, a?: number): void;
  ring(x: number, y: number, r: number, color?: string, a?: number, lw?: number): void;
  line(x1: number, y1: number, x2: number, y2: number, color?: string, a?: number, lw?: number): void;
  arrow(x1: number, y1: number, x2: number, y2: number, color?: string, a?: number): void;
  rect(x: number, y: number, w: number, h: number, color?: string, a?: number, rad?: number): void;
  frame(x: number, y: number, w: number, h: number, color?: string, a?: number, rad?: number, lw?: number): void;
  text(s: string, x: number, y: number, o?: TextOpts): void;
  packet(ax: number, ay: number, bx: number, by: number, p: number, color?: string, r?: number): void;
  orb(state: OrbState, x: number, y: number, size: number, color?: string, speed?: number): void;
  mix(a: number, b: number, k: number): number;
  clamp(x: number, lo?: number, hi?: number): number;
  ease(k: number): number;
  rnd(seed: number): number;
}

export type Scene = {
  title: string;
  caption: string;
  aspect?: number;
  controls?: Control[];
  make: () => (g: G) => void;
};

export type SceneSet = Scene | Scene[];
