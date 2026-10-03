import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SECTIONS } from "@/lib/track-meta";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-paper">
        This page <span className="italic text-accent">wandered off.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-paper-muted">
        The link may be old or mistyped. Press <kbd className="rounded border border-line px-1.5 font-mono text-xs">/</kbd> to
        search the notes, or pick a path.
      </p>
      <div className="mt-10 grid gap-3 text-left sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            style={{ "--h": s.hue } as React.CSSProperties}
            className="group flex items-center gap-3 rounded-xl border border-line bg-ink-elevated p-4 transition-colors hover:border-accent-dim"
          >
            <span className="hue-dot h-2 w-2 rounded-full" />
            <span className="font-medium text-paper">{s.name}</span>
            <ArrowRight size={15} className="ml-auto text-paper-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </main>
  );
}
