"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SECTIONS } from "@/lib/track-meta";
import { readSet } from "@/lib/progress";
import { SectionIcon } from "./SectionIcon";

export type PathStats = Record<string, { lessons: number; hours: number; modules: number }>;

// The four learning paths as distinct cards. Reading progress comes from this browser only.
export function PathCards({ stats }: { stats: PathStats }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setRead(readSet());
    sync();
    window.addEventListener("lessons:read", sync);
    return () => window.removeEventListener("lessons:read", sync);
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SECTIONS.map((s) => {
        const st = stats[s.key];
        const done = st ? [...read].filter((k) => k.startsWith(`${s.key}/`)).length : 0;
        return (
          <Link
            key={s.key}
            href={s.href}
            style={{ "--h": s.hue } as React.CSSProperties}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-elevated p-6 transition duration-200 hover:-translate-y-0.5 hover:border-accent-dim hover:shadow-xl hover:shadow-black/10"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-70 blur-2xl"
              style={{ background: `radial-gradient(circle, hsl(${s.hue} 80% 60% / 0.28), transparent 70%)` }}
            />
            <span className="hue-bg relative flex h-11 w-11 items-center justify-center rounded-xl">
              <SectionIcon name={s.icon} size={22} className="hue-text" />
            </span>
            <h3 className="relative mt-5 text-xl font-semibold tracking-tight text-paper">{s.name}</h3>
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
              <span className="hue-text inline-flex items-center gap-1 font-medium">
                {done > 0 ? `Continue (${done}/${st?.lessons})` : "Start"}
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
