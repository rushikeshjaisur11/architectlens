"use client";

import { createElement, useEffect, useRef, type ReactNode } from "react";

// Fades and lifts its content in the first time it scrolls into view. Content already on screen, and
// people who prefer reduced motion, are left alone.
export function Reveal({
  children,
  delay = 0,
  as = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "li";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("reveal");
    el.style.transitionDelay = `${delay}ms`;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.setAttribute("data-in", "");
        io.disconnect();
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return createElement(as, { ref, className }, children);
}
