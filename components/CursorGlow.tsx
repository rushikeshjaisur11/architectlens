"use client";

import { useEffect, useRef } from "react";

// Soft ring that trails the pointer and swells over links and buttons. The native cursor stays visible.
// Only on mouse-like devices and never with reduced motion.
export function CursorGlow() {
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ring.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let x = -100, y = -100, tx = -100, ty = -100, big = false, raf = 0;
    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x - 16}px, ${y - 16}px, 0) scale(${big ? 1.9 : 1})`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.1 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      big = !!(e.target as Element).closest?.("a, button, [role=button], [role=option], summary");
      el.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => (el.style.opacity = "0");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return (
    <div
      ref={ring}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] h-8 w-8 rounded-full border border-accent opacity-0 transition-opacity duration-200"
      style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", willChange: "transform" }}
    />
  );
}
