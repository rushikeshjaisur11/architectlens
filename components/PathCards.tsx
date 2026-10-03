"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SECTIONS } from "@/lib/track-meta";
import { readSet } from "@/lib/progress";
import { SectionIcon } from "./SectionIcon";
import { BlurFade } from "./ui/blur-fade";
import { onGlowMove } from "@/lib/glow";

export type PathStats = Record<string, { lessons: number; hours: number; modules: number }>;
export type PathOrder = Record<string, { key: string; title: string }[]>;

// Bento widths on a 6-column grid: wide, narrow / narrow, wide.
const SPANS = ["md:col-span-4", "md:col-span-2", "md:col-span-2", "md:col-span-4"];

// The four learning paths as distinct cards. Reading progress comes from this browser only.
export function PathCards({ stats, order }: { stats: PathStats; order: PathOrder }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setRead(readSet());
    sync();
    window.addEventListener("lessons:read", sync);
    return () => window.removeEventListener("lessons:read", sync);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-6">
      {SECTIONS.map((s, i) => {
        const st = stats[s.key];
        const done = st ? [...read].filter((k) => k.startsWith(`${s.key}/`)).length : 0;
        const next = (order[s.key] ?? []).find((l) => !read.has(l.key));
        return (
          <BlurFade key={s.key} delay={i * 0.1} className={`h-full ${SPANS[i % SPANS.length]}`}>
          <div
            onPointerMove={onGlowMove}
            style={{ "--h": s.hue } as React.CSSProperties}
            className="glow group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-ink-elevated p-6 transition duration-200 hover:-translate-y-0.5 hover:border-accent-dim hover:shadow-xl hover:shadow-black/10"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-70 blur-2xl"
              style={{ background: `radial-gradient(circle, hsl(${s.hue} 80% 60% / 0.28), transparent 70%)` }}
            />
            <span className="hue-bg relative flex h-11 w-11 items-center justify-center rounded-xl">
              <SectionIcon name={s.icon} size={22} className="hue-text" />
            </span>
            <h3 className="relative mt-5 text-xl font-semibold tracking-tight text-paper">
              <Link href={s.href} className="after:absolute after:inset-0 after:rounded-2xl">
                {s.name}
              </Link>
            </h3>
            <p className="relative mt-1.5 text-sm text-paper-muted">{s.tagline}</p>
            <ul className="relative mt-4 space-y-1.5 text-sm text-paper-muted">
              {s.audience.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <span className="hue-dot h-1 w-1 shrink-0 rounded-full" />
                  {a}
                </li>
              ))}
            </ul>
            <div className="relative mt-6 flex items-center justify-between border-t border-line-soft pt-4 text-xs text-paper-muted">
              <span>
                {st ? `${st.lessons} lessons · ${st.modules} modules · ${st.hours} h` : "Guides by language"}
              </span>
              {next ? (
                <Link
                  href={`/lessons/${next.key}`}
                  className="hue-text relative z-10 inline-flex min-w-0 max-w-[60%] items-center gap-1 font-medium hover:underline"
                >
                  <span className="truncate">
                    {done > 0 ? "Continue" : "Start"}: {next.title}
                  </span>
                  <ArrowRight size={13} className="shrink-0" />
                </Link>
              ) : (
                <span className="hue-text inline-flex items-center gap-1 font-medium">
                  Open <ArrowRight size={13} />
                </span>
              )}
            </div>
          </div>
          </BlurFade>
        );
      })}
    </div>
  );
}
