"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { nextAfterLast, readSet } from "@/lib/progress";
import { sectionByKey } from "@/lib/track-meta";
import { SectionIcon } from "./SectionIcon";
import type { PathOrder } from "./PathCards";

// For returning readers the landing page opens on the next lesson, so a concept is one click from home.
export function WelcomeBack({ order }: { order: PathOrder }) {
  const [pick, setPick] = useState<{ key: string; title: string; track: string; last: string } | null>(null);
  useEffect(() => {
    const read = readSet();
    const lastKey = [...read].pop();
    if (!lastKey) return;
    const track = lastKey.split("/")[0];
    const list = order[track] ?? [];
    const next = nextAfterLast(list, read);
    if (!next) return;
    setPick({ ...next, track, last: list.find((l) => l.key === lastKey)?.title ?? "" });
  }, [order]);
  if (!pick) return null;
  const s = sectionByKey(pick.track);
  return (
    <section className="returning-only mx-auto max-w-5xl px-6 pt-12">
      <Link
        href={`/lessons/${pick.key}`}
        style={{ "--h": s.hue } as React.CSSProperties}
        className="glow group flex flex-col gap-4 rounded-2xl border border-line bg-ink-elevated p-6 transition-colors hover:border-accent-dim sm:flex-row sm:items-center sm:p-8"
      >
        <span className="hue-bg flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <SectionIcon name={s.icon} size={24} className="hue-text" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="eyebrow">Welcome back &middot; {s.name}</span>
          <span className="mt-1 block font-display text-3xl leading-tight text-paper sm:text-4xl">{pick.title}</span>
          {pick.last && <span className="mt-1.5 block text-sm text-paper-muted">Up next after &ldquo;{pick.last}&rdquo;</span>}
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-hook px-5 py-2.5 text-sm font-medium text-ink">
          Continue reading <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </section>
  );
}
