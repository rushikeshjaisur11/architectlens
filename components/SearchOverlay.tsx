"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse, { type FuseResult } from "fuse.js";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import type { ContentIndexItem } from "@/lib/search-index";
import { readSet } from "@/lib/progress";

const SUGGESTED_TAGS = ["rag", "caching", "consensus", "agents", "kafka", "eval"];

// Wrap matched ranges of the title in <mark>; indices come from Fuse (inclusive ends).
function Highlight({ text, result }: { text: string; result?: FuseResult<ContentIndexItem> }) {
  const ranges = result?.matches?.find((m) => m.key === "title")?.indices.filter(([a, b]) => b - a >= 2) ?? [];
  if (!ranges.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a < at) return;
    out.push(<Fragment key={`t${i}`}>{text.slice(at, a)}</Fragment>);
    out.push(
      <mark key={`m${i}`} className="bg-transparent text-accent">
        {text.slice(a, b + 1)}
      </mark>
    );
    at = b + 1;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

export function SearchOverlay({
  items,
  open,
  onClose,
}: {
  items: ContentIndexItem[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [beam, setBeam] = useState<"dark" | "light">("light");
  const listRef = useRef<HTMLUListElement>(null);
  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: [
          { name: "title", weight: 3 },
          { name: "tags", weight: 2 },
          { name: "summary", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        includeMatches: true,
      }),
    [items]
  );

  const q = query.trim();
  const found = useMemo(() => (q ? fuse.search(q).slice(0, 12) : []), [fuse, q]);

  // With no query, offer lessons the reader opened most recently, else the first lesson of each track.
  const suggestions = useMemo(() => {
    if (!open || q) return [];
    const read = readSet();
    const hits = items.filter((i) => read.has(i.href.replace("/lessons/", ""))).slice(-5).reverse();
    if (hits.length) return hits;
    const firsts = new Map<string, ContentIndexItem>();
    items.forEach((i) => firsts.has(i.track) || firsts.set(i.track, i));
    return [...firsts.values()];
  }, [open, q, items]);

  const rows: { item: ContentIndexItem; result?: FuseResult<ContentIndexItem> }[] = q
    ? found.map((r) => ({ item: r.item, result: r }))
    : suggestions.map((item) => ({ item }));

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    if (open) setBeam(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    else setQuery("");
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function go(item: ContentIndexItem) {
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && rows[active]) {
      e.preventDefault();
      go(rows[active].item);
    }
  }

  let lastTrack = "";
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <BorderBeam size="line" colorVariant="mono" theme={beam} strength={0.6} active={!q} className="w-full max-w-xl">
        <div
          role="dialog"
          aria-label="Search notes"
          className="w-full overflow-hidden rounded-xl border border-line bg-ink-elevated/95 shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
            <ThinkingOrb state="searching" size={20} theme={beam} />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="search-results"
              aria-activedescendant={rows[active] ? `search-row-${active}` : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search notes, concepts, tags"
              className="min-w-0 flex-1 bg-transparent text-base text-paper outline-none placeholder:text-paper-muted"
            />
            <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-paper-muted">Esc</kbd>
          </div>

          <ul id="search-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {rows.map(({ item, result }, i) => {
              const header = !q && item.track !== lastTrack ? item.track : null;
              lastTrack = item.track;
              return (
                <Fragment key={item.href}>
                  {header && (
                    <li role="presentation" className="px-2 pb-1 pt-2 font-mono text-[11px] text-paper-muted">
                      {header}
                    </li>
                  )}
                  <li
                    role="option"
                    id={`search-row-${i}`}
                    data-row={i}
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`cursor-pointer rounded-lg px-3 py-2 ${i === active ? "bg-ink" : ""}`}
                  >
                    <div className="text-sm text-paper">
                      <Highlight text={item.title} result={result} />
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-paper-muted">
                      {q ? `${item.track} · ` : ""}{item.module} · {item.minutes} min
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-paper-muted">{item.summary}</div>
                  </li>
                </Fragment>
              );
            })}
            {q && rows.length === 0 && (
              <li role="presentation" className="px-3 py-6 text-center text-sm text-paper-muted">
                <p>No notes match "{q}".</p>
                <p className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {SUGGESTED_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuery(t)}
                      className="rounded border border-line px-2 py-0.5 font-mono text-xs hover:border-accent-dim hover:text-paper"
                    >
                      {t}
                    </button>
                  ))}
                </p>
              </li>
            )}
          </ul>

          <div className="flex gap-4 border-t border-line-soft px-4 py-2 font-mono text-[11px] text-paper-muted">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        </div>
      </BorderBeam>
    </div>
  );
}
