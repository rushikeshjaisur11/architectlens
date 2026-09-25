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

export function TopBar({
  onSearchClick,
  onMenuClick,
  onToggleSidebar,
  sidebarCollapsed,
}: {
  onSearchClick: () => void;
  onMenuClick: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}) {
  const pathname = usePathname();
  const active = activeTrackSlug(pathname);
  const label = categoryLabel(pathname);

  return (
    <div className="flex h-12 items-center justify-between gap-2 border-b border-line px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="shrink-0 rounded border border-line px-2 py-1 font-mono text-xs text-paper-muted hover:border-accent-dim hover:text-paper lg:hidden"
        >
          ☰
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          className="hidden shrink-0 rounded border border-line px-2 py-1 font-mono text-xs text-paper-muted hover:border-accent-dim hover:text-paper lg:inline-flex"
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto font-mono text-xs text-paper-muted">
          <Link href="/" className="shrink-0 hover:text-paper">
            architectlens
          </Link>
          <span className="flex shrink-0 items-center gap-1">
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
              <span className="hidden sm:inline">/</span>
              <span className="hidden shrink-0 text-paper sm:inline">{label}</span>
            </>
          )}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Search"
          className="rounded border border-line px-2 py-1 font-mono text-xs text-paper-muted hover:border-accent-dim hover:text-paper"
        >
          <span className="hidden sm:inline">
            Search <span className="text-paper-muted">Ctrl+K</span>
          </span>
          <span className="sm:hidden">🔍</span>
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
