"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { TrackSwitcher } from "./TrackSwitcher";

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
        <nav className="flex min-w-0 items-center gap-3 font-mono text-xs text-paper-muted">
          <Link href="/" className="hidden shrink-0 hover:text-paper sm:inline">
            architectlens
          </Link>
          <TrackSwitcher className="shrink-0" />
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
