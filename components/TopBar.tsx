"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { TrackSwitcher } from "./TrackSwitcher";
import { FrameworksMenu } from "./FrameworksMenu";

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
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-visible">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="shrink-0 rounded border border-line px-2 py-1 font-mono text-xs text-paper-muted hover:border-accent-dim hover:text-paper lg:hidden"
        >
          <Menu size={14} />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          className="hidden shrink-0 rounded border border-line px-2 py-1 font-mono text-xs text-paper-muted hover:border-accent-dim hover:text-paper lg:inline-flex"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <nav className="flex min-w-0 items-center gap-2 sm:gap-3 font-mono text-xs text-paper-muted">
          <Link href="/" className="hidden shrink-0 hover:text-paper sm:inline">
            architectlens
          </Link>
          <TrackSwitcher className="shrink-0" />
          <FrameworksMenu className="shrink-0" />
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
          className="inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 font-mono text-xs text-paper-muted transition-colors hover:border-accent-dim hover:text-paper sm:w-52"
        >
          <Search size={14} />
          <span className="hidden flex-1 text-left sm:inline">Search notes</span>
          <kbd className="hidden rounded border border-line-soft px-1 text-[11px] sm:inline">/</kbd>
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
