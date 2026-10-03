"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { SECTIONS, type SectionKey } from "@/lib/track-meta";
import { hslToHex } from "@/lib/color";

const GAP = 26;
const POINTER_R = 170;
const WAVE_MS = 11000;
const ORB_MIN_WIDTH = 1100;

const STATES: Record<SectionKey, OrbState> = {
  "system-design": "connecting",
  "ai-systems": "working",
  "ai-system-design": "weaving",
  frameworks: "shaping",
};
// Home: one orb per section on two tidy side rails, joined by the journey line.
const HOME_POS: Record<SectionKey, [number, number]> = {
  "system-design": [0.075, 0.3],
  "ai-systems": [0.075, 0.72],
  "ai-system-design": [0.925, 0.3],
  frameworks: [0.925, 0.72],
};
const ROUTE: SectionKey[] = ["system-design", "ai-systems", "frameworks", "ai-system-design"];
// Inside a section the orb rides a hairline rail in the right margin, sliding down as the reader scrolls.
const RAIL_X = 0.94;
const RAIL_FROM = 0.16;
const RAIL_SPAN = 0.62;

export type AmbientMode = "home" | "plain" | SectionKey;

function cssColor(name: string, fallback: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  const n = parseInt(m ? m[1] : fallback, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Page-wide ambient layer behind everything: a dot field that brightens near the pointer and under a slow wave,
// drifts a little slower than the page as you scroll, plus the section orbs. Decorative: no pointer events.
// `calm` (lessons) drops the wave so long reading stays quiet.
export function AmbientGrid({ mode, calm, scrollRef }: { mode: AmbientMode; calm: boolean; scrollRef: RefObject<HTMLElement | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const orbEls = useRef<(HTMLDivElement | null)[]>([]);
  const [dark, setDark] = useState(true);
  const [wide, setWide] = useState(false);
  const orbs = SECTIONS.filter((s) => mode === "home" || s.key === mode).map((s) => ({ section: s, state: STATES[s.key] }));
  const live = useRef({ mode, calm, orbs });
  live.current = { mode, calm, orbs };

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(["dark", "black"].includes(root.dataset.theme ?? ""));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    const scroller = scrollRef.current;
    if (!el || !cv || !scroller) return;
    const ctx = cv.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let progress = 0;
    let scrollTop = 0;
    const pointer = { x: -999, y: -999, on: false };
    let base = cssColor("--color-paper-muted", "888888");
    let hot = cssColor("--color-accent", "0550ae");

    function place() {
      const { mode: m, orbs: list } = live.current;
      list.forEach((o, i) => {
        const node = orbEls.current[i];
        if (!node) return;
        if (m === "home") {
          const [x, y] = HOME_POS[o.section.key];
          node.style.left = `${x * 100}%`;
          node.style.top = `${y * 100}%`;
        } else {
          node.style.left = `${RAIL_X * 100}%`;
          node.style.top = `${(RAIL_FROM + RAIL_SPAN * progress) * 100}%`;
        }
      });
    }

    function onScroll() {
      scrollTop = scroller!.scrollTop;
      const max = scroller!.scrollHeight - scroller!.clientHeight;
      progress = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      place();
      if (still) draw(performance.now());
    }

    function resize() {
      const r = el!.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      cv!.width = Math.round(w * dpr);
      cv!.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = cssColor("--color-paper-muted", "888888");
      hot = cssColor("--color-accent", "0550ae");
      setWide(w >= ORB_MIN_WIDTH);
      onScroll();
      draw(performance.now());
    }

    function draw(now: number) {
      const { mode: m, calm: quiet, orbs: list } = live.current;
      ctx.clearRect(0, 0, w, h);
      const wave = still || quiet ? -1 : ((now % WAVE_MS) / WAVE_MS) * (w + h + 400) - 200;
      const offset = (scrollTop * 0.3) % GAP;
      const rest = quiet ? 0.13 : 0.2;
      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 2;
      for (let i = 0; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * GAP + ((j & 1) * GAP) / 2;
          const y = j * GAP - offset + GAP;
          let k = 0;
          if (pointer.on) {
            const d = Math.hypot(x - pointer.x, y - pointer.y);
            if (d < POINTER_R) k = Math.max(k, (1 - d / POINTER_R) ** 2 * (quiet ? 0.6 : 1));
          }
          if (wave >= 0) {
            const d = Math.abs(x + y - wave);
            if (d < 90) k = Math.max(k, (1 - d / 90) ** 2 * 0.55);
          }
          const rgb = k > 0.02 ? hot : base;
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${rest + k * 0.7})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + k * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (w < ORB_MIN_WIDTH) return;
      if (m === "home" && list.length > 1) {
        const pts = list.map((o) => [HOME_POS[o.section.key][0] * w, HOME_POS[o.section.key][1] * h]);
        const order = ROUTE.map((k) => list.findIndex((o) => o.section.key === k));
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 7]);
        order.slice(0, -1).forEach((a, n) => {
          const b = order[n + 1];
          const g = ctx.createLinearGradient(pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
          g.addColorStop(0, `rgba(${hot[0]},${hot[1]},${hot[2]},0)`);
          g.addColorStop(0.5, `rgba(${hot[0]},${hot[1]},${hot[2]},0.35)`);
          g.addColorStop(1, `rgba(${hot[0]},${hot[1]},${hot[2]},0)`);
          ctx.strokeStyle = g;
          ctx.beginPath();
          ctx.moveTo(pts[a][0], pts[a][1]);
          ctx.lineTo(pts[b][0], pts[b][1]);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      } else if (m !== "home" && m !== "plain") {
        // Hairline rail: faint full track, solid accent up to the reader's position, small caps at both ends.
        const x = RAIL_X * w;
        const top = RAIL_FROM * h;
        const bottom = (RAIL_FROM + RAIL_SPAN) * h;
        const here = top + (bottom - top) * progress;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},0.28)`;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${hot[0]},${hot[1]},${hot[2]},0.75)`;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, here);
        ctx.stroke();
        ctx.fillStyle = `rgba(${hot[0]},${hot[1]},${hot[2]},0.75)`;
        for (const y of [top, bottom]) {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function loop(now: number) {
      if (!document.hidden) draw(now);
      raf = requestAnimationFrame(loop);
    }
    function move(e: PointerEvent) {
      const r = el!.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = true;
    }
    const leave = () => (pointer.on = false);

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const themeObs = new MutationObserver(resize);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-section"] });
    if (!still) {
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerleave", leave);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObs.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, [scrollRef]);

  // The layer stays mounted across routes: re-place the orbs when the page mode changes or they first appear.
  useEffect(() => {
    scrollRef.current?.dispatchEvent(new Event("scroll"));
  }, [mode, wide, scrollRef]);

  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_90%_95%_at_50%_45%,black_45%,transparent_100%)]"
      />
      {wide &&
        orbs.map(({ section: s, state }, i) => (
          <div
            key={s.key}
            ref={(n) => {
              orbEls.current[i] = n;
            }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 opacity-90 transition-[top] duration-300 ease-out"
          >
            <ThinkingOrb state={state} size={64} theme={dark ? "dark" : "light"} color={hslToHex(s.hue, dark ? 65 : 60, dark ? 70 : 40)} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-muted">{s.name}</span>
          </div>
        ))}
    </div>
  );
}
