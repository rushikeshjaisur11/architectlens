import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { lessons } from "#velite";
import { TRACKS } from "@/lib/tracks";
import { PathCards, type PathOrder, type PathStats } from "@/components/PathCards";

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
  const totalLessons = lessons.length;
  const totalHours = Math.round(lessons.reduce((sum, l) => sum + l.minutes, 0) / 60);

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(40rem 22rem at 15% 0%, hsl(232 80% 60% / 0.16), transparent 70%), radial-gradient(34rem 20rem at 85% 10%, hsl(268 80% 60% / 0.14), transparent 70%), radial-gradient(30rem 18rem at 60% 100%, hsl(172 75% 45% / 0.12), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-elevated/70 px-3 py-1.5 text-xs font-medium text-paper-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-hook" />
            Architecture education, grounded in current practice
          </p>
          <h1 className="display mt-6 max-w-3xl text-paper">
            Learn how modern systems are <span className="text-accent">designed and built.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper-muted">
            A structured library on system design and production AI systems. Start from first principles, move
            through the building blocks, and finish with complete designs you can reason about.
          </p>
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
              [String(totalLessons), "lessons"],
              [`${totalHours}+`, "hours of reading"],
              [String(TRACKS.length + 1), "learning paths"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-3xl font-semibold tracking-tight text-paper">{value}</dd>
                <dd className="mt-1 text-paper-muted">{label}</dd>
              </div>
            ))}
          </dl>
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
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-line bg-ink-elevated p-5">
                <span className="text-xs font-medium text-accent">Step {s.n}</span>
                <p className="mt-2 font-medium text-paper">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-paper">Made for focused learning</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <p className="font-medium text-paper">{p.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
