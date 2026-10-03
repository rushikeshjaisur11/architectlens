"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { frameworksByLanguage } from "@/lib/frameworks";

export function FrameworksMenu({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = pathname.startsWith("/frameworks");

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
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
          open || active
            ? "border-accent-dim bg-ink-elevated text-paper"
            : "border-line text-paper hover:border-accent-dim hover:bg-ink-elevated"
        }`}
      >
        Frameworks
        <span className={`text-paper-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-line bg-ink-elevated shadow-xl shadow-black/40"
        >
          {frameworksByLanguage().map(([language, items], g) => (
            <div key={language} className={g > 0 ? "border-t border-line-soft" : ""}>
              <p className="px-3 pt-2.5 font-mono text-[11px] uppercase tracking-wide text-paper-muted">{language}</p>
              {items.map((f) => (
                <Link
                  key={f.slug}
                  href={`/frameworks/${f.slug}`}
                  role="menuitem"
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-ink"
                >
                  <span className="font-mono text-sm text-paper">{f.name}</span>
                  {f.status === "soon" && (
                    <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-paper-muted">soon</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
