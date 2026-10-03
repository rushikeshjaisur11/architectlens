"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimButton, AnimFrame } from "../AnimFrame";
import { useInView, useReducedMotion } from "../hooks";
import { LW, basePalette, makeG } from "./toolkit";
import type { Control, G, Scene } from "./types";

const STATIC_T = 5;

function initial(controls: Control[] = []): Record<string, number> {
  const v: Record<string, number> = {};
  for (const c of controls) {
    if (c.kind === "toggle") v[c.id] = c.initial ? 1 : 0;
    else if (c.kind === "choice") v[c.id] = c.initial ?? 0;
    else if (c.kind === "range") v[c.id] = c.initial;
  }
  return v;
}

function readPalette(el: HTMLElement) {
  const dark = document.documentElement.dataset.theme === "dark";
  const pal = basePalette(dark);
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: string) => {
    const value = css.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  };
  pal.ink = pick("--color-ink", pal.ink);
  pal.panel = pick("--color-ink-elevated", pal.panel);
  pal.line = pick("--color-line", pal.line);
  pal.paper = pick("--color-paper", pal.paper);
  pal.muted = pick("--color-paper-muted", pal.muted);
  pal.accent = pick("--color-accent", pal.accent);
  return { pal, dark };
}

export default function SceneCanvas({ scene }: { scene: Scene }) {
  const aspect = scene.aspect ?? 0.62;
  const LH = Math.round(LW * aspect);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inView = useInView(wrapRef);
  const reduced = useReducedMotion();
  const [vals, setVals] = useState(() => initial(scene.controls));
  const valsRef = useRef(vals);
  valsRef.current = vals;
  const [themeTick, setThemeTick] = useState(0);
  const gRef = useRef<G | null>(null);
  const drawRef = useRef<((g: G) => void) | null>(null);
  const clockRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    gRef.current = makeG(ctx, LH);
    drawRef.current = scene.make();
    clockRef.current = 0;
    return () => {
      gRef.current = null;
      drawRef.current = null;
    };
  }, [scene, LH]);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((n) => n + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const paint = useCallback(
    (t: number, dt: number) => {
      const canvas = canvasRef.current;
      const g = gRef.current;
      const draw = drawRef.current;
      if (!canvas || !g || !draw) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { pal, dark } = readPalette(canvas);
      g.t = t;
      g.dt = dt;
      g.v = valsRef.current;
      g.pal = pal;
      g.dark = dark;
      const k = canvas.width / LW;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.clearRect(0, 0, LW, LH);
      draw(g);
    },
    [LH],
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      if (canvas.width !== w) {
        canvas.width = w;
        canvas.height = Math.round(w * aspect);
      }
      if (reduced) paint(STATIC_T, 0);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [aspect, reduced, paint]);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      paint(STATIC_T, 0);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clockRef.current += dt;
      paint(clockRef.current, dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, paint]);

  useEffect(() => {
    if (reduced && inView) paint(STATIC_T, 0);
  }, [vals, themeTick, reduced, inView, paint]);

  const controls = useMemo(() => scene.controls ?? [], [scene]);

  const set = (id: string, value: number) => setVals((prev) => ({ ...prev, [id]: value }));
  const press = (id: string) => {
    const g = gRef.current;
    if (g) g.clicks[id] = (g.clicks[id] ?? 0) + 1;
    if (reduced) paint(STATIC_T, 0);
  };

  return (
    <AnimFrame title={scene.title} caption={scene.caption}>
      <div ref={wrapRef}>
        <canvas ref={canvasRef} role="img" aria-label={scene.title} className="block w-full" style={{ aspectRatio: `${LW} / ${LH}` }} />
      </div>
      {controls.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {controls.map((c) => {
            if (c.kind === "button") {
              return (
                <AnimButton key={c.id} onClick={() => press(c.id)}>
                  {c.label}
                </AnimButton>
              );
            }
            if (c.kind === "toggle") {
              return (
                <AnimButton key={c.id} active={vals[c.id] === 1} onClick={() => set(c.id, vals[c.id] === 1 ? 0 : 1)}>
                  {c.label}: {vals[c.id] === 1 ? "on" : "off"}
                </AnimButton>
              );
            }
            if (c.kind === "choice") {
              return (
                <span key={c.id} className="flex max-w-full flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs text-paper-muted">{c.label}</span>
                  {c.options.map((o, i) => (
                    <AnimButton key={o} active={vals[c.id] === i} onClick={() => set(c.id, i)}>
                      {o}
                    </AnimButton>
                  ))}
                </span>
              );
            }
            return (
              <label key={c.id} className="flex items-center gap-2 font-mono text-xs text-paper-muted">
                {c.label}
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={vals[c.id]}
                  onChange={(e) => set(c.id, Number(e.target.value))}
                  aria-label={c.label}
                  className="h-1.5 w-32 cursor-pointer"
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span className="min-w-[3rem] text-paper">
                  {vals[c.id]}
                  {c.unit ?? ""}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </AnimFrame>
  );
}
