import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { SCENES } from "../components/anim/scenes";
import { LW, basePalette, makeG } from "../components/anim/scene/toolkit";
import type { Control, Scene } from "../components/anim/scene/types";

const DRAWING = new Set(["fill", "stroke", "fillText", "strokeText"]);

function variants(controls: Control[] = []): Record<string, number>[] {
  const base: Record<string, number> = {};
  for (const c of controls) {
    if (c.kind === "toggle") base[c.id] = c.initial ? 1 : 0;
    else if (c.kind === "choice") base[c.id] = c.initial ?? 0;
    else if (c.kind === "range") base[c.id] = c.initial;
  }
  const out = [base];
  for (const c of controls) {
    if (c.kind === "toggle") out.push({ ...base, [c.id]: base[c.id] === 1 ? 0 : 1 });
    if (c.kind === "choice") c.options.forEach((_, i) => out.push({ ...base, [c.id]: i }));
    if (c.kind === "range") out.push({ ...base, [c.id]: c.min }, { ...base, [c.id]: c.max });
  }
  return out;
}

function render(scene: Scene, dark: boolean, preview?: string) {
  const h = Math.round(LW * (scene.aspect ?? 0.62));
  const canvas = createCanvas(LW * 2, h * 2);
  const raw = canvas.getContext("2d");
  const bad: string[] = [];
  let draws = 0;
  const guard = new Proxy(raw, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (DRAWING.has(String(prop))) draws++;
        let skip = false;
        for (const a of args) {
          if (typeof a === "number" && !Number.isFinite(a)) {
            bad.push(`${String(prop)}(${args.join(",")})`);
            skip = true;
          }
        }
        if (skip) return undefined;
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
  }) as unknown as CanvasRenderingContext2D;

  const g = makeG(guard, h);
  g.dark = dark;
  g.pal = basePalette(dark);
  const draw = scene.make();
  const sets = variants(scene.controls);
  for (const v of sets) {
    g.v = v;
    for (const control of scene.controls ?? []) if (control.kind === "button") g.clicks[control.id] = (g.clicks[control.id] ?? 0) + 1;
    for (const t of [0.4, 1.7, 3.1, 4.6, 6.2, 8.8, 13.3]) {
      g.t = t;
      g.dt = 0.016;
      guard.setTransform(2, 0, 0, 2, 0, 0);
      guard.clearRect(0, 0, LW, h);
      draw(g);
    }
  }
  if (preview) {
    g.v = sets[0];
    const fresh = scene.make();
    guard.setTransform(2, 0, 0, 2, 0, 0);
    for (let t = 0; t <= 4.2; t += 1 / 15) {
      g.t = t;
      g.dt = 1 / 15;
      guard.clearRect(0, 0, LW, h);
      guard.fillStyle = dark ? "#0d1321" : "#eef1f6";
      guard.fillRect(0, 0, LW, h);
      fresh(g);
    }
    fs.mkdirSync(path.dirname(preview), { recursive: true });
    fs.writeFileSync(preview, canvas.toBuffer("image/png"));
  }
  return { bad, draws };
}

describe("scenes", () => {
  const previews = process.env.SCENE_PREVIEW ? path.resolve(__dirname, "../.scene-previews") : "";

  for (const [key, scene, n] of Object.entries(SCENES).flatMap(([k, list]) => list.map((sc, i) => [k, sc, i] as const))) {
    it(`${key} #${n + 1} draws cleanly in both themes`, () => {
      const dark = render(scene, true, previews ? path.join(previews, `${key.replace(/\//g, "__")}${n ? `__${n + 1}` : ""}.png`) : undefined);
      const light = render(scene, false);
      expect(dark.bad).toEqual([]);
      expect(light.bad).toEqual([]);
      expect(dark.draws).toBeGreaterThan(40);
    }, 60000);
  }
});
