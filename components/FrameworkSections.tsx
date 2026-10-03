"use client";

import { useState } from "react";
import Link from "next/link";
import { TileBanner } from "./TileBanner";

export type SectionTile = { href: string; name: string; blurb: string; hint: string; soon?: boolean };

function Tile({ t }: { t: SectionTile }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={t.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="group flex flex-col overflow-hidden rounded-lg border border-line transition-colors hover:border-accent-dim hover:bg-ink-elevated"
    >
      <div className="banner-bg relative h-28 border-b border-line-soft">
        <TileBanner title={t.hint} hover={hover} />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-paper group-hover:text-accent">{t.name}</h3>
          {t.soon && <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-paper-muted">soon</span>}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-paper-muted">{t.blurb}</p>
      </div>
    </Link>
  );
}

export function TileGrid({ tiles }: { tiles: SectionTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <Tile key={t.href} t={t} />
      ))}
    </div>
  );
}
