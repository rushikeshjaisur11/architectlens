"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav-tree";

function splitHeading(heading: string): [string, string] {
  const spaceIndex = heading.indexOf(" ");
  return [heading.slice(0, spaceIndex), heading.slice(spaceIndex + 1)];
}

export function Sidebar({
  groups,
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
}: {
  groups: NavGroup[];
  mobileOpen: boolean;
  desktopCollapsed: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(heading: string) {
    setCollapsed((prev) => ({ ...prev, [heading]: !prev[heading] }));
  }

  return (
    <nav
      className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-ink-elevated p-4 transition-all duration-200 lg:static lg:translate-x-0 ${
        mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full"
      } lg:flex ${desktopCollapsed ? "lg:w-0 lg:border-0 lg:p-0 lg:overflow-hidden" : "lg:w-72"}`}
    >
      <button
        type="button"
        onClick={onCloseMobile}
        className="mb-2 self-end rounded px-2 py-1 font-mono text-xs text-paper-muted hover:text-paper lg:hidden"
      >
        Close ✕
      </button>
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
    </nav>
  );
}
