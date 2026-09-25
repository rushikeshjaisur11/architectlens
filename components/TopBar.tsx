"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

function pathLabel(pathname: string): string | null {
  if (pathname === "/") return null;
  const match = /^\/lessons\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  return match[1]
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function TopBar({ onSearchClick }: { onSearchClick: () => void }) {
  const pathname = usePathname();
  const categoryLabel = pathLabel(pathname);

  return (
    <div className="flex h-12 items-center justify-between border-b border-line px-6">
      <nav className="flex items-center gap-2 font-mono text-xs text-paper-muted">
        <Link href="/" className="hover:text-paper">
          architectlens
        </Link>
        {categoryLabel && (
          <>
            <span>/</span>
            <span className="text-paper">{categoryLabel}</span>
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
