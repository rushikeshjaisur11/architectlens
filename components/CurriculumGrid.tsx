import Link from "next/link";
import { sortByOrder } from "@/lib/content";
import type { Track } from "@/lib/tracks";

type LessonLike = {
  slug: string;
  order: number;
  category: { number: number; slug: string; name: string };
};

function lessonLabel(count: number): string {
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

export function CurriculumGrid({ track, lessons }: { track: Track; lessons: LessonLike[] }) {
  const counts = new Map<number, number>();
  for (const lesson of lessons) {
    counts.set(lesson.category.number, (counts.get(lesson.category.number) ?? 0) + 1);
  }

  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {track.categories.map((category) => {
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
            href={`/lessons/${track.slug}/${category.slug}/${firstLesson.slug}`}
            className="block rounded border border-line p-5 transition-colors hover:border-accent-dim"
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
