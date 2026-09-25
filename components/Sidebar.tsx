"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav-tree";

export function Sidebar({ groups, onSearchClick }: { groups: NavGroup[]; onSearchClick: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(heading: string) {
    setCollapsed((prev) => ({ ...prev, [heading]: !prev[heading] }));
  }

  return (
    <nav className="w-64 shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-900 p-4">
      <button
        type="button"
        onClick={onSearchClick}
        className="mb-6 w-full rounded border border-neutral-700 px-3 py-2 text-left text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
      >
        Search... <span className="float-right text-xs text-neutral-600">Ctrl+K</span>
      </button>

      {groups.map((group) => (
        <div key={group.heading} className="mb-4">
          <button
            type="button"
            onClick={() => toggle(group.heading)}
            className="mb-2 flex w-full items-center justify-between font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            <span>{group.heading}</span>
            <span className="flex items-center gap-2">
              <span className="normal-case text-neutral-600">{group.items.length}</span>
              <span>{collapsed[group.heading] ? "+" : "−"}</span>
            </span>
          </button>
          {!collapsed[group.heading] && group.items.length > 0 && (
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        active
                          ? "block rounded px-2 py-1 text-sm text-cyan-400 bg-neutral-800"
                          : "block rounded px-2 py-1 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
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
      ))}
    </nav>
  );
}
