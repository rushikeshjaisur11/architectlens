"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav-tree";
import { ThemeToggle } from "./ThemeToggle";

function splitHeading(heading: string): [string, string] {
  const spaceIndex = heading.indexOf(" ");
  return [heading.slice(0, spaceIndex), heading.slice(spaceIndex + 1)];
}

export function Sidebar({ groups, onSearchClick }: { groups: NavGroup[]; onSearchClick: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(heading: string) {
    setCollapsed((prev) => ({ ...prev, [heading]: !prev[heading] }));
  }

  return (
    <nav className="flex w-72 shrink-0 flex-col border-r border-line bg-ink-elevated">
      <div className="flex items-center justify-between border-b border-line p-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-paper">architectlens</span>
        <ThemeToggle />
      </div>

      <button
        type="button"
        onClick={onSearchClick}
        className="mx-4 mt-4 rounded border border-line px-3 py-2 text-left text-sm text-paper-muted hover:border-accent-dim hover:text-paper"
      >
        Search <span className="float-right font-mono text-xs text-paper-muted">Ctrl+K</span>
      </button>

      <div className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => {
          const [number, name] = splitHeading(group.heading);
          const hasItems = group.items.length > 0;
          return (
            <div key={group.heading} className="mb-1">
              <button
                type="button"
                onClick={() => hasItems && toggle(group.heading)}
                disabled={!hasItems}
                className="flex w-full items-center gap-2 rounded px-1 py-2 text-left disabled:cursor-default"
              >
                <span className="font-mono text-xs text-accent">{number}</span>
                <span className="flex-1 text-sm text-paper-muted">{name}</span>
                <span className="font-mono text-xs text-paper-muted">{group.items.length}</span>
                {hasItems && (
                  <span className="font-mono text-xs text-paper-muted">
                    {collapsed[group.heading] ? "+" : "−"}
                  </span>
                )}
              </button>
              {hasItems && !collapsed[group.heading] && (
                <ul className="ml-6 space-y-1 border-l border-line-soft pl-3">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={
                            active
                              ? "block rounded px-2 py-1 text-sm text-accent"
                              : "block rounded px-2 py-1 text-sm text-paper-muted hover:text-paper"
                          }
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
