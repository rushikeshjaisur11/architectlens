"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TRACKS } from "@/lib/tracks";

function activeTrackSlug(pathname: string): string {
  if (pathname.startsWith("/ai-systems") || pathname.startsWith("/lessons/ai-systems")) return "ai-systems";
  return "system-design";
}

export function TrackSwitcher({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const active = activeTrackSlug(pathname);
  const activeTrack = TRACKS.find((t) => t.slug === active) ?? TRACKS[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
          open
            ? "border-accent-dim bg-ink-elevated text-paper"
            : "border-line text-paper hover:border-accent-dim hover:bg-ink-elevated"
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        {activeTrack.name}
        <span className={`text-paper-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-line bg-ink-elevated shadow-xl shadow-black/40"
        >
          {TRACKS.map((track, i) => {
            const isActive = track.slug === active;
            return (
              <li key={track.slug} className={i > 0 ? "border-t border-line-soft" : ""}>
                <Link
                  href={track.slug === "system-design" ? "/" : `/${track.slug}`}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 transition-colors ${
                    isActive ? "bg-ink" : "hover:bg-ink"
                  }`}
                >
                  <span className="flex flex-col">
                    <span className={`font-mono text-sm ${isActive ? "text-accent" : "text-paper"}`}>
                      {track.name}
                    </span>
                    <span className="mt-0.5 font-mono text-[11px] text-paper-muted">
                      {track.categories.length} modules
                    </span>
                  </span>
                  {isActive && <span className="shrink-0 text-accent">✓</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
