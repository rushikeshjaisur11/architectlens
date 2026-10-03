"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SECTIONS } from "@/lib/track-meta";
import { nextAfterLast, readSet } from "@/lib/progress";
import { SectionIcon } from "./SectionIcon";

export type PathStats = Record<string, { lessons: number; hours: number; modules: number }>;
export type PathOrder = Record<string, { key: string; title: string }[]>;

// The four learning paths as stops on one connected route. Reading progress comes from this browser only.
export function JourneyMap({ stats, order }: { stats: PathStats; order: PathOrder }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setRead(readSet());
    sync();
    window.addEventListener("lessons:read", sync);
    return () => window.removeEventListener("lessons:read", sync);
  }, []);

  return (
    <ol className="relative">
      {SECTIONS.map((s, i) => {
        const st = stats[s.key];
        const done = st ? [...read].filter((k) => k.startsWith(`${s.key}/`)).length : 0;
        const pct = st ? Math.round((done / st.lessons) * 100) : 0;
        const finished = st ? done >= st.lessons : false;
        const next = nextAfterLast(order[s.key] ?? [], read);
        const last = i === SECTIONS.length - 1;
        return (
          <li key={s.key} style={{ "--h": s.hue } as React.CSSProperties} className="relative grid grid-cols-[2.75rem_1fr] gap-4 sm:gap-6">
            {!last && <span aria-hidden className="absolute left-[1.375rem] top-11 -bottom-4 w-px -translate-x-1/2 bg-line" />}
            <span
              aria-hidden
              className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                finished
                  ? "hue-border hue-solid"
                  : done > 0
                    ? "hue-border hue-text bg-ink"
                    : "border-line bg-ink text-paper-muted"
              }`}
            >
              {finished ? <Check size={18} /> : i + 1}
            </span>
            <div className="group relative mb-4 rounded-2xl border border-line bg-ink-elevated p-5 transition duration-200 hue-hover hover:shadow-lg hover:shadow-black/5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="hue-bg hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex">
                  <SectionIcon name={s.icon} size={22} className="hue-text" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold tracking-tight text-paper">
                    <Link href={s.href} className="after:absolute after:inset-0 after:rounded-2xl">
                      {s.name}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-paper-muted">{s.tagline}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper-muted">
                    {s.audience.map((a) => (
                      <li key={a} className="flex items-center gap-2">
                        <span className="hue-dot h-1 w-1 shrink-0 rounded-full" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line-soft pt-4 text-xs text-paper-muted">
                <span>{st ? `${st.lessons} lessons · ${st.modules} modules · ${st.hours} h` : "Guides by language"}</span>
                {st && (
                  <span className="flex items-center gap-2" aria-label={`${pct}% read`}>
                    <span className="h-1 w-24 overflow-hidden rounded-full bg-line-soft">
                      <span className="hue-dot block h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </span>
                    {done}/{st.lessons}
                  </span>
                )}
                {next ? (
                  <Link
                    href={`/lessons/${next.key}`}
                    className="relative z-10 ml-auto inline-flex min-w-0 max-w-full items-center gap-1 hue-text font-medium hover:underline"
                  >
                    <span className="truncate">
                      {done > 0 ? "Continue" : "Start"}: {next.title}
                    </span>
                    <ArrowRight size={13} className="shrink-0" />
                  </Link>
                ) : (
                  <span className="hue-text ml-auto inline-flex items-center gap-1 font-medium">
                    Open <ArrowRight size={13} />
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
