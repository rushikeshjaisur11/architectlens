import Link from "next/link";
import { lessons } from "#velite";
import { CATEGORIES } from "@/lib/categories";

export default function HomePage() {
  const counts = new Map<number, number>();
  for (const lesson of lessons) {
    counts.set(lesson.category.number, (counts.get(lesson.category.number) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-neutral-100">architectlens</h1>
      <p className="mt-2 text-neutral-400">System design, learned from first principles.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((category) => {
          const count = counts.get(category.number) ?? 0;
          const label = `${String(category.number).padStart(2, "0")} ${category.name}`;

          if (count === 0) {
            return (
              <div key={category.number} className="rounded-lg border border-neutral-800 p-6 opacity-50">
                <h2 className="text-lg font-semibold text-neutral-100">{label}</h2>
                <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">{count} lessons</p>
              </div>
            );
          }

          const firstLesson = lessons
            .filter((l) => l.category.number === category.number)
            .sort((a, b) => a.order - b.order)[0];

          return (
            <Link
              key={category.number}
              href={`/lessons/${category.slug}/${firstLesson.slug}`}
              className="block rounded-lg border border-neutral-800 p-6 hover:border-neutral-600 transition-colors"
            >
              <h2 className="text-lg font-semibold text-neutral-100">{label}</h2>
              <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">{count} lessons</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
