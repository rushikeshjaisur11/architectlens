import Link from "next/link";
import { lessons } from "#velite";
import { TRACKS } from "@/lib/tracks";
import { FRAMEWORKS } from "@/lib/frameworks";

const BLURBS: Record<string, string> = {
  "system-design": "Classic distributed-systems concepts, designs and case studies.",
  "ai-systems": "Prompting, retrieval, serving, agents, evals and reliability.",
  "ai-system-design": "End-to-end design walkthroughs for AI products and platforms.",
};

export function TrackHub({ active }: { active?: string }) {
  const cards = [
    ...TRACKS.map((t) => ({
      key: t.slug,
      href: t.slug === "system-design" ? "/" : `/${t.slug}`,
      name: t.name,
      blurb: BLURBS[t.slug] ?? "",
      meta: `${lessons.filter((l) => l.track.slug === t.slug).length} lessons · ${t.categories.length} modules`,
    })),
    {
      key: "frameworks",
      href: "/frameworks",
      name: "Frameworks",
      blurb: "Hands-on guides for agent and AI frameworks, by language.",
      meta: `${FRAMEWORKS.length} framework${FRAMEWORKS.length === 1 ? "" : "s"} · coming soon`,
    },
  ];

  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="Tracks">
      {cards.map((c) => {
        const isActive = c.key === active;
        return (
          <Link
            key={c.key}
            href={c.href}
            title={c.blurb}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors ${
              isActive ? "border-accent-dim bg-ink-elevated text-accent" : "border-line text-paper-muted hover:border-accent-dim hover:text-paper"
            }`}
          >
            {c.name} <span className="text-paper-muted">{c.meta.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
