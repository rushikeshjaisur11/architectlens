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

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-paper">architectlens</h1>
      <p className="mt-2 text-paper-muted">System design, learned from first principles.</p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((category) => {
          const count = counts.get(category.number) ?? 0;
          const number = String(category.number).padStart(2, "0");

          const body = (
            <>
              <span className="font-mono text-xs text-accent">{number}</span>
              <h2 className="mt-1 text-base font-medium text-paper">{category.name}</h2>
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
