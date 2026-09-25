"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { ContentIndexItem } from "@/lib/search-index";

export function SearchOverlay({ items }: { items: ContentIndexItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const fuse = useMemo(() => new Fuse(items, { keys: ["title", "tags"], threshold: 0.35 }), [items]);
  const results = query.trim() ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search architectlens..."
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none"
        />
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {results.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)} className="block rounded px-2 py-1 text-sm hover:bg-neutral-100">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
