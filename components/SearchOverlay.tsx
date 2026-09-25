"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { ContentIndexItem } from "@/lib/search-index";

export function SearchOverlay({
  items,
  open,
  onClose,
}: {
  items: ContentIndexItem[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const fuse = useMemo(() => new Fuse(items, { keys: ["title", "tags"], threshold: 0.35 }), [items]);
  const results = query.trim() ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/80 pt-24">
      <div className="w-full max-w-lg rounded border border-line bg-ink-elevated p-4 shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search architectlens..."
          className="w-full rounded border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-accent-dim"
        />
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {results.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className="block rounded px-2 py-1 text-sm text-paper-muted hover:bg-ink hover:text-paper"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
