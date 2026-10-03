"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sortByOrder } from "@/lib/content";
import type { Track } from "@/lib/tracks";
import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { TileBanner } from "./TileBanner";
import { readSet } from "@/lib/progress";
import type { BannerSpec } from "@/lib/banner-kinds";

export type LessonTile = {
  slug: string;
  title: string;
  shortTitle: string;
  summary: string;
  minutes: number;
  tags: string[];
  banner?: BannerSpec;
  order: number;
  category: { number: number; slug: string; name: string };
};

function Tile({ lesson: l, href, label, read, hue }: { lesson: LessonTile; href: string; label: string; read: boolean; hue: number }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-ink-elevated/40 transition duration-200 hover:-translate-y-0.5 hover:border-accent-dim hover:bg-ink-elevated hover:shadow-lg hover:shadow-black/10"
    >
      <div
        className="banner-bg relative h-32 border-b border-line-soft"
        style={{ backgroundImage: `radial-gradient(ellipse at 20% 0%, hsl(${hue} 75% 60% / 0.18), transparent 65%)` }}
      >
        <TileBanner title={l.title} tags={l.tags.join(" ")} hover={hover} spec={l.banner} />
        {read && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-hook bg-ink px-2 py-0.5 font-mono text-[10px] text-hook">
            <Check size={10} /> read
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="font-mono text-[11px] text-paper-muted">
          {label} · {l.minutes} min
        </span>
        <h3 className="mt-1 text-sm font-medium leading-snug text-paper group-hover:text-accent">{l.shortTitle}</h3>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-paper-muted">{l.summary}</p>
      </div>
    </Link>
  );
}

const ctl =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 font-mono text-xs text-paper-muted transition-colors hover:border-accent-dim hover:text-paper";

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = new Set<string>(JSON.parse(localStorage.getItem("collapsed-modules-v1") ?? "[]"));
      const target = window.location.hash.replace(/^#m-/, "");
      saved.delete(target);
      setCollapsed(saved);
      if (target) requestAnimationFrame(() => document.getElementById(`m-${target}`)?.scrollIntoView());
    } catch {
      // storage unavailable: every module starts open
    }
  }, []);
  function setFolded(next: Set<string>) {
    setCollapsed(next);
    try {
      localStorage.setItem("collapsed-modules-v1", JSON.stringify([...next]));
    } catch {
      // folding still works for this page view
    }
  }
  const allFolded = collapsed.size >= track.categories.length;
  const readCount = lessons.filter((l) => done.has(`${track.slug}/${l.category.slug}/${l.slug}`)).length;

  const nextUnread = sortByOrder(lessons)
    .sort((a, b) => a.category.number - b.category.number)
    .find((l) => !done.has(`${track.slug}/${l.category.slug}/${l.slug}`));

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
          <div className="h-full rounded-full bg-hook transition-all" style={{ width: `${lessons.length ? (readCount / lessons.length) * 100 : 0}%` }} />
        </div>
        {readCount > 0 && nextUnread && (
          <Link
            href={`/lessons/${track.slug}/${nextUnread.category.slug}/${nextUnread.slug}`}
            className="max-w-[55%] shrink-0 truncate rounded-full bg-hook px-3.5 py-1.5 font-medium text-ink shadow-sm transition hover:brightness-110"
          >
            Continue: {nextUnread.shortTitle}
          </Link>
        )}
      </div>
      <div className="sticky top-0 z-10 -mx-2 mb-6 space-y-3 bg-ink/95 px-2 py-3 backdrop-blur">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${lessons.length} lessons`}
            aria-label="Filter lessons"
            className="min-w-0 flex-1 rounded-lg border border-line bg-ink-elevated px-4 py-2 text-sm text-paper placeholder:text-paper-muted focus:border-accent-dim focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setAllTags(!allTags)}
            aria-expanded={allTags}
            className={`${ctl} ${tag ? "border-accent text-accent" : ""}`}
          >
            {tag ? `Topic: ${tag}` : "Topics"}
          </button>
          <button type="button" onClick={() => setFolded(allFolded ? new Set() : new Set(track.categories.map((x) => x.slug)))} className={ctl}>
            {allFolded ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
            <span className="hidden sm:inline">{allFolded ? "Expand all" : "Collapse all"}</span>
          </button>
        </div>
        {allTags && (
          <div className="flex flex-wrap gap-2">
            {topTags.map((t) => (
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
          </div>
        )}
      </div>

      {visible.length === 0 && <p className="text-sm text-paper-muted">No lessons match. Clear the filter.</p>}

      <div className="space-y-8">
        {track.categories.map((category) => {
          const items = sortByOrder(visible.filter((l) => l.category.number === category.number));
          if (items.length === 0) return null;
          const number = String(category.number).padStart(2, "0");
          const hue = 215 + ((category.number * 23) % 65);
          const isDone = (l: LessonTile) => done.has(`${track.slug}/${category.slug}/${l.slug}`);
          const finished = items.filter(isDone).length;
          const minutesLeft = items.filter((l) => !isDone(l)).reduce((sum, l) => sum + l.minutes, 0);
          // While filtering, matches stay visible even inside a folded module.
          const open = !collapsed.has(category.slug) || !!q || !!tag;
          const toggle = () => {
            const next = new Set(collapsed);
            if (next.has(category.slug)) next.delete(category.slug);
            else next.add(category.slug);
            setFolded(next);
          };
          return (
            <section key={category.number} id={`m-${category.slug}`} className="scroll-mt-32">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={`grid-${category.slug}`}
                className="group mb-4 flex w-full items-center gap-3 border-b border-line-soft pb-2 text-left"
              >
                <span className="font-mono text-xs text-accent">{number}</span>
                <h2 className="text-lg font-medium text-paper group-hover:text-accent">{category.name}</h2>
                <span className="ml-auto hidden font-mono text-xs text-paper-muted sm:inline">
                  {finished === items.length ? "completed" : `${minutesLeft} min left`}
                </span>
                <span className="inline-flex items-center gap-2 font-mono text-xs text-paper-muted">
                  {finished === items.length ? <Check size={13} className="text-hook" /> : null}
                  {finished}/{items.length}
                  <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-line-soft sm:block" aria-hidden>
                    <span className="block h-full bg-hook" style={{ width: `${(finished / items.length) * 100}%` }} />
                  </span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-paper-muted transition-transform ${open ? "" : "-rotate-90"}`} />
              </button>
              <div id={`grid-${category.slug}`} hidden={!open} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l, i) => (
                  <Tile
                    key={l.slug}
                    lesson={l}
                    href={`/lessons/${track.slug}/${category.slug}/${l.slug}`}
                    label={`${number}.${String(i + 1).padStart(2, "0")}`}
                    read={done.has(`${track.slug}/${category.slug}/${l.slug}`)}
                    hue={hue}
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
