import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lessons } from "#velite";
import { TRACKS } from "@/lib/tracks";
import { PathCards, type PathOrder, type PathStats } from "@/components/PathCards";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotPattern } from "@/components/ui/dot-pattern";
import { NumberTicker } from "@/components/ui/number-ticker";
import { TextEffect } from "@/components/ui/text-effect";
import { TypedWords } from "@/components/TypedWords";
import { TileBanner } from "@/components/TileBanner";

const STEPS = [
  { n: "1", title: "System Design", text: "Learn the foundations: data, scaling, consistency and failure." },
  { n: "2", title: "AI Systems", text: "Learn the building blocks: models, retrieval, agents, evals and safety." },
  { n: "3", title: "AI System Design", text: "Put it together: full designs for AI products and platforms." },
  { n: "4", title: "Frameworks", text: "Go hands-on with agent frameworks, mapped back to the patterns." },
];

const PILLARS = [
  { title: "Built for reading", text: "Light, dark and e-reader themes, adjustable text size, and a layout that stays out of the way." },
  { title: "Sourced, not guessed", text: "Every note lists its references. Sections on current practice are dated, and unverified claims are labelled." },
  { title: "See how it works", text: "Notes pair the explanation with a diagram of the idea, and many include an interactive animation." },
];

export default function LandingPage() {
  const stats: PathStats = Object.fromEntries(
    TRACKS.map((t) => {
      const own = lessons.filter((l) => l.track.slug === t.slug);
      const minutes = own.reduce((sum, l) => sum + l.minutes, 0);
      return [t.slug, { lessons: own.length, modules: t.categories.length, hours: Math.max(1, Math.round(minutes / 60)) }];
    }),
  );
  const order: PathOrder = Object.fromEntries(
    TRACKS.map((t) => [
      t.slug,
      lessons
        .filter((l) => l.track.slug === t.slug)
        .sort((a, b) => a.category.number - b.category.number || a.order - b.order)
        .map((l) => ({ key: `${t.slug}/${l.category.slug}/${l.slug}`, title: l.shortTitle })),
    ]),
  );
  const preview = lessons.find((l) => /raft vs\.? paxos/i.test(l.title)) ?? lessons[0];
  const totalLessons = lessons.length;
  const totalHours = Math.round(lessons.reduce((sum, l) => sum + l.minutes, 0) / 60);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line-soft">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <DotPattern
            width={22}
            height={22}
            cr={1}
            className="fill-paper-muted/25 [mask-image:radial-gradient(48rem_26rem_at_30%_30%,white,transparent)]"
          />
        </div>
        <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-elevated/70 px-3 py-1.5 text-xs font-medium text-paper-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-hook" />
            Architecture education, grounded in current practice
          </p>
          <h1 className="display mt-6 max-w-4xl text-paper">
            <span className="sr-only">Learn how modern systems are designed, scaled, secured and operated.</span>
            <span aria-hidden>
              Learn how modern systems are
              <br />
              <TypedWords words={["designed", "scaled", "secured", "operated"]} className="italic text-accent" />
            </span>
          </h1>
          <TextEffect
            as="p"
            per="word"
            preset="fade-in-blur"
            speedReveal={1.6}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-paper-muted"
          >
            A structured library on system design and production AI systems. Start from first principles, move through the building blocks, and finish with complete designs you can reason about.
          </TextEffect>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/system-design"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:brightness-110"
            >
              Start with System Design <ArrowRight size={15} />
            </Link>
            <Link
              href="/ai-systems"
              className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:border-accent-dim"
            >
              Explore AI Systems
            </Link>
          </div>
          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 text-sm">
            {[
              [totalLessons, "lessons", ""],
              [totalHours, "hours of reading", "+"],
              [TRACKS.length + 1, "learning paths", ""],
            ].map(([value, label, suffix]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-3xl font-semibold tracking-tight text-paper">
                  <NumberTicker value={Number(value)} className="text-paper dark:text-paper" />
                  {suffix}
                </dd>
                <dd className="mt-1 text-paper-muted">{label}</dd>
              </div>
            ))}
          </dl>
          </div>
          {preview && (
            <Link
              href={`/lessons/${preview.track.slug}/${preview.category.slug}/${preview.slug}`}
              className="group block overflow-hidden rounded-2xl border border-line bg-ink-elevated shadow-2xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-accent-dim"
              aria-label={`Open lesson: ${preview.title}`}
            >
              <div className="flex items-center gap-1.5 border-b border-line-soft px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="ml-3 truncate font-mono text-xs text-paper-muted">{preview.category.name}</span>
              </div>
              <div className="h-0.5 w-2/5 bg-hook" aria-hidden />
              <div className="p-5">
                <div className="banner-bg h-36 overflow-hidden rounded-lg border border-line">
                  <TileBanner title={preview.title} tags={preview.tags.join(" ")} spec={preview.banner} hover />
                </div>
                <h2 className="mt-5 font-display text-3xl leading-tight text-paper">{preview.title}</h2>
                <p className="mt-1 font-mono text-xs text-paper-muted">{preview.minutes} min read</p>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-paper-muted">{preview.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Read this lesson <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-paper">Choose your path</h2>
        <p className="mt-2 max-w-2xl text-paper-muted">
          Four separate paths. Each has its own modules and can be read on its own, or in order.
        </p>
        <div className="mt-8">
          <PathCards stats={stats} order={order} />
        </div>
      </section>

      <section className="border-y border-line-soft bg-ink-elevated/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-paper">How the paths fit together</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n}>
              <BlurFade inView delay={i * 0.1} className="h-full rounded-xl border border-line bg-ink-elevated p-5">
                <span className="text-xs font-medium text-accent">Step {s.n}</span>
                <p className="mt-2 font-medium text-paper">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">{s.text}</p>
              </BlurFade>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-paper">Made for focused learning</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <BlurFade inView key={p.title} delay={i * 0.1} className="rounded-2xl border border-line bg-ink-elevated p-6">
              <p className="font-medium text-paper">{p.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">{p.text}</p>
            </BlurFade>
          ))}
        </div>
      </section>
    </main>
  );
}
