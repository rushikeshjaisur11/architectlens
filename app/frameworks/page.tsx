import Link from "next/link";
import { frameworksByLanguage } from "@/lib/frameworks";

export default function FrameworksIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-paper">Frameworks</h1>
      <p className="mt-3 text-paper-muted">
        Hands-on guides for agent and AI frameworks, grouped by language. Each one maps the framework&apos;s
        concepts back to the patterns taught in the other tracks.
      </p>
      {frameworksByLanguage().map(([language, items]) => (
        <section key={language} className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-paper-muted">{language}</h2>
          <ul className="mt-3 grid gap-3">
            {items.map((f) => (
              <li key={f.slug}>
                <Link href={`/frameworks/${f.slug}`} className="flex items-start justify-between gap-4 rounded-lg border border-line p-4 transition-colors hover:border-accent-dim hover:bg-ink-elevated">
                  <span>
                    <span className="font-mono text-sm text-paper">{f.name}</span>
                    <span className="mt-1 block text-xs text-paper-muted">{f.blurb}</span>
                  </span>
                  {f.status === "soon" && (
                    <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-paper-muted">soon</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
