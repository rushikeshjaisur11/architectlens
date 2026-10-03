"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sortByOrder } from "@/lib/content";
import type { Track } from "@/lib/tracks";
import { Check } from "lucide-react";
import { TileBanner } from "./TileBanner";
import { readSet } from "@/lib/progress";

export type LessonTile = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  minutes: number;
  tags: string[];
  order: number;
  category: { number: number; slug: string; name: string };
};

function Tile({ lesson: l, href, label, read }: { lesson: LessonTile; href: string; label: string; read: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="group flex flex-col overflow-hidden rounded-lg border border-line transition-colors hover:border-accent-dim hover:bg-ink-elevated"
    >
      <div className="banner-bg relative h-24 border-b border-line-soft">
        <TileBanner title={l.title} tags={l.tags.join(" ")} hover={hover} />
        {read && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-accent-dim bg-ink px-2 py-0.5 font-mono text-[10px] text-accent">
            <Check size={10} /> read
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="font-mono text-[11px] text-paper-muted">
          {label} · {l.minutes} min
        </span>
        <h3 className="mt-1 text-sm font-medium leading-snug text-paper group-hover:text-accent">{l.shortTitle}</h3>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-paper-muted">{l.summary}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {l.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded border border-line-soft px-1.5 py-0.5 font-mono text-[10px] text-paper-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function CurriculumGrid({ track, lessons }: { track: Track; lessons: LessonTile[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setDone(readSet());
    sync();
    window.addEventListener("lessons:read", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lessons:read", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const readCount = lessons.filter((l) => done.has(`${track.slug}/${l.category.slug}/${l.slug}`)).length;

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lessons) for (const t of l.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([t]) => t);
  }, [lessons]);

  const q = query.trim().toLowerCase();
  const visible = lessons.filter(
    (l) =>
      (!tag || l.tags.includes(tag)) &&
      (!q || `${l.title} ${l.summary} ${l.tags.join(" ")}`.toLowerCase().includes(q)),
  );

  return (
    <div className="mt-10">
      <div className="mb-4 flex items-center gap-3 font-mono text-xs text-paper-muted">
        <span>
          {readCount} of {lessons.length} read
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={readCount}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${lessons.length ? (readCount / lessons.length) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="sticky top-0 z-10 -mx-2 mb-8 space-y-3 bg-ink/95 px-2 py-3 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${lessons.length} lessons by title, topic or keyword…`}
          aria-label="Filter lessons"
          className="w-full rounded-lg border border-line bg-ink-elevated px-4 py-2.5 text-sm text-paper placeholder:text-paper-muted focus:border-accent-dim focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {(allTags ? topTags : topTags.slice(0, 8)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${
                tag === t ? "border-accent bg-ink-elevated text-accent" : "border-line text-paper-muted hover:border-accent-dim hover:text-paper"
              }`}
            >
              {t}
            </button>
          ))}
          {topTags.length > 8 && (
            <button
              type="button"
              onClick={() => setAllTags(!allTags)}
              className="rounded-full border border-dashed border-line px-3 py-1 font-mono text-[11px] text-paper-muted hover:border-accent-dim hover:text-paper"
            >
              {allTags ? "Show fewer" : `+${topTags.length - 8} more`}
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 && <p className="text-sm text-paper-muted">No lessons match. Clear the filter.</p>}

      <div className="space-y-12">
        {track.categories.map((category) => {
          const items = sortByOrder(visible.filter((l) => l.category.number === category.number));
          if (items.length === 0) return null;
          const number = String(category.number).padStart(2, "0");
          return (
            <section key={category.number} id={`m-${category.slug}`}>
              <div className="mb-4 flex items-baseline gap-3 border-b border-line-soft pb-2">
                <span className="font-mono text-xs text-accent">{number}</span>
                <h2 className="text-lg font-medium text-paper">{category.name}</h2>
                <span className="ml-auto font-mono text-xs text-paper-muted">
                  {items.filter((l) => done.has(`${track.slug}/${category.slug}/${l.slug}`)).length}/{items.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l, i) => (
                  <Tile
                    key={l.slug}
                    lesson={l}
                    href={`/lessons/${track.slug}/${category.slug}/${l.slug}`}
                    label={`${number}.${String(i + 1).padStart(2, "0")}`}
                    read={done.has(`${track.slug}/${category.slug}/${l.slug}`)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
