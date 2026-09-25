"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TRACKS } from "@/lib/tracks";
import { ThemeToggle } from "./ThemeToggle";

function activeTrackSlug(pathname: string): string {
  if (pathname.startsWith("/ai-systems") || pathname.startsWith("/lessons/ai-systems")) return "ai-systems";
  return "system-design";
}

function categoryLabel(pathname: string): string | null {
  const match = /^\/lessons\/[^/]+\/([^/]+)\//.exec(pathname);
  if (!match) return null;
  return match[1]
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function TopBar({ onSearchClick }: { onSearchClick: () => void }) {
  const pathname = usePathname();
  const active = activeTrackSlug(pathname);
  const label = categoryLabel(pathname);

  return (
    <div className="flex h-12 items-center justify-between border-b border-line px-6">
      <nav className="flex items-center gap-3 font-mono text-xs text-paper-muted">
        <Link href="/" className="hover:text-paper">
          architectlens
        </Link>
        <span className="flex items-center gap-1">
          {TRACKS.map((track, i) => (
            <span key={track.slug} className="flex items-center gap-1">
              {i > 0 && <span>|</span>}
              <Link
                href={track.slug === "system-design" ? "/" : `/${track.slug}`}
                className={active === track.slug ? "text-accent" : "hover:text-paper"}
              >
                {track.name}
              </Link>
            </span>
          ))}
        </span>
        {label && (
          <>
            <span>/</span>
            <span className="text-paper">{label}</span>
          </>
        )}
      </nav>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSearchClick}
          className="rounded border border-line px-2 py-1 font-mono text-xs text-paper-muted hover:border-accent-dim hover:text-paper"
        >
          Search <span className="text-paper-muted">Ctrl+K</span>
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
