"use client";

import { useEffect, useRef } from "react";
import { basePalette, makeG } from "./anim/scene/toolkit";
import { BANNER_H, BANNER_W, drawBanner, motifFor } from "./anim/scenes/banner";

// Concept banner for a tile: a small labelled diagram of the topic. Static until hovered.
export function TileBanner({ title, tags = "", hover }: { title: string; tags?: string; hover: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const motif = motifFor(title, tags);
    const g = makeG(ctx, BANNER_H);
    g.w = BANNER_W;
    g.t = 2.1;
    let raf = 0;
    let visible = false;
    let last = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w) return;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const light = document.documentElement.dataset.theme !== "dark";
      g.dark = !light;
      g.pal = basePalette(!light);
      const s = Math.min(w / BANNER_W, h / BANNER_H);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w - BANNER_W * s) / 2, dpr * (h - BANNER_H * s) / 2);
      ctx.clearRect(-w, -h, w * 3, h * 3);
      drawBanner(g, motif);
    };

    const loop = (now: number) => {
      if (hoverRef.current) {
        g.dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        g.t += g.dt;
        last = now;
        draw();
        raf = visible ? requestAnimationFrame(loop) : 0;
      } else {
        last = 0;
        raf = 0;
      }
    };
    const timer = setInterval(() => {
      if (hoverRef.current && visible && !raf) raf = requestAnimationFrame(loop);
    }, 100);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) draw();
    });
    io.observe(canvas);
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [title, tags]);

  return <canvas ref={ref} aria-hidden className="h-full w-full" />;
}
