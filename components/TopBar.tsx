"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, Search } from "lucide-react";
import { SECTIONS, activeSection } from "@/lib/track-meta";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { AccountMenu } from "./AccountMenu";

export function TopBar({
  onSearchClick,
  onMenuClick,
  onToggleContents,
  contentsOpen,
  showContents,
  hidden = false,
}: {
  onSearchClick: () => void;
  onMenuClick: () => void;
  onToggleContents: () => void;
  contentsOpen: boolean;
  showContents: boolean;
  hidden?: boolean;
}) {
  const active = activeSection(usePathname());
  const quiet =
    "items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-paper-muted transition-colors hover:border-accent-dim hover:text-paper";

  return (
    <header
      inert={hidden}
      style={{ marginTop: hidden ? "-3.5rem" : 0 }}
      className="relative z-20 flex h-14 shrink-0 transition-[margin] duration-200 items-center gap-3 border-b border-line bg-ink/70 px-3 backdrop-blur-xl backdrop-saturate-150 motion-reduce:transition-none sm:px-5">
      <button type="button" onClick={onMenuClick} aria-label="Open menu" className={`${quiet} inline-flex px-2.5 lg:hidden`}>
        <Menu size={16} />
      </button>

      <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="architectlens home">
        <Logo size={26} />
        <span className="text-[15px] font-semibold tracking-tight text-paper">architectlens</span>
      </Link>

      <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 lg:flex">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            aria-current={s.key === active ? "page" : undefined}
            style={{ "--h": s.hue } as React.CSSProperties}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
              s.key === active ? "bg-ink-elevated font-medium text-paper shadow-sm ring-1 ring-line" : "text-paper-muted hover:text-paper"
            }`}
          >
            <span className="hue-dot h-1.5 w-1.5 rounded-full" />
            {s.name}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showContents && (
          <button
            type="button"
            onClick={onToggleContents}
            aria-pressed={contentsOpen}
            aria-label="Toggle contents"
            className={`${quiet} hidden lg:inline-flex ${contentsOpen ? "border-accent-dim text-paper" : ""}`}
          >
            <PanelLeft size={15} />
            <span className="hidden xl:inline">Contents</span>
          </button>
        )}
        <button type="button" onClick={onSearchClick} aria-label="Search" className={`${quiet} inline-flex xl:w-56`}>
          <Search size={15} />
          <span className="hidden flex-1 text-left xl:inline">Search notes</span>
          <kbd className="hidden rounded border border-line-soft px-1 text-xs xl:inline">/</kbd>
        </button>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}
