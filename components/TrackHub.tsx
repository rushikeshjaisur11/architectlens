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
    <div className="mb-10 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {cards.map((c) => {
        const isActive = c.key === active;
        return (
          <Link
            key={c.key}
            href={c.href}
            className={`group rounded-lg border p-3 sm:p-4 transition-colors ${
              isActive ? "border-accent-dim bg-ink-elevated" : "border-line hover:border-accent-dim hover:bg-ink-elevated"
            }`}
          >
            <p className={`font-mono text-sm ${isActive ? "text-accent" : "text-paper group-hover:text-accent"}`}>{c.name}</p>
            <p className="mt-1.5 hidden text-xs leading-relaxed sm:block text-paper-muted">{c.blurb}</p>
            <p className="mt-3 font-mono text-[11px] text-paper-muted">{c.meta}</p>
          </Link>
        );
      })}
    </div>
  );
}
