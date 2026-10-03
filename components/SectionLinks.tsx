"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, activeSection } from "@/lib/track-meta";
import { SectionIcon } from "./SectionIcon";

// The four sections as a vertical list, used in the mobile drawer.
export function SectionLinks({ className = "" }: { className?: string }) {
  const active = activeSection(usePathname());
  return (
    <ul className={`space-y-1 ${className}`}>
      {SECTIONS.map((s) => (
        <li key={s.key}>
          <Link
            href={s.href}
            aria-current={s.key === active ? "page" : undefined}
            style={{ "--h": s.hue } as React.CSSProperties}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
              s.key === active ? "bg-ink" : "hover:bg-ink"
            }`}
          >
            <span className="hue-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <SectionIcon name={s.icon} size={16} className="hue-text" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-paper">{s.name}</span>
              <span className="block truncate text-xs text-paper-muted">{s.tagline}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
