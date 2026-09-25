import Link from "next/link";
import { lessons } from "#velite";
import { CATEGORIES } from "@/lib/categories";
import { sortByOrder } from "@/lib/content";

function lessonLabel(count: number): string {
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

export default function HomePage() {
  const counts = new Map<number, number>();
  for (const lesson of lessons) {
    counts.set(lesson.category.number, (counts.get(lesson.category.number) ?? 0) + 1);
  }
  const totalLessons = lessons.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold leading-tight text-paper">
        Learn system design
        <br />
        <span className="font-mono text-accent">from first principles.</span>
      </h1>
      <p className="mt-4 max-w-xl text-paper-muted">
        A self-paced curriculum covering the concepts, cases, and builds that come up in real
        systems work — organized as 18 focused modules.
      </p>
      <p className="mt-6 font-mono text-xs text-paper-muted">
        {totalLessons} lesson{totalLessons === 1 ? "" : "s"} across {CATEGORIES.length} modules
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const count = counts.get(category.number) ?? 0;
          const number = String(category.number).padStart(2, "0");

          const body = (
            <>
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs text-accent">{number}</span>
                {count > 0 && <span className="text-paper-muted">&rarr;</span>}
              </div>
              <h2 className="mt-2 text-base font-medium text-paper">{category.name}</h2>
              <p className="mt-2 font-mono text-xs text-paper-muted">{lessonLabel(count)}</p>
            </>
          );

          if (count === 0) {
            return (
              <div key={category.number} className="rounded border border-line-soft p-5 opacity-60">
                {body}
              </div>
            );
          }

          const firstLesson = sortByOrder(lessons.filter((l) => l.category.number === category.number))[0];

          return (
            <Link
              key={category.number}
              href={`/lessons/${category.slug}/${firstLesson.slug}`}
              className="block rounded border border-line p-5 transition-colors hover:border-accent-dim"
            >
              {body}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
