"use client";

import { useState } from "react";
import Link from "next/link";
import { sortByOrder } from "@/lib/content";
import type { Track } from "@/lib/tracks";

type LessonLike = {
  slug: string;
  shortTitle: string;
  order: number;
  category: { number: number; slug: string; name: string };
};

function lessonLabel(count: number): string {
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

export function CurriculumGrid({ track, lessons }: { track: Track; lessons: LessonLike[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const counts = new Map<number, number>();
  for (const lesson of lessons) {
    counts.set(lesson.category.number, (counts.get(lesson.category.number) ?? 0) + 1);
  }

  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {track.categories.map((category) => {
        const count = counts.get(category.number) ?? 0;
        const number = String(category.number).padStart(2, "0");
        const isOpen = expanded === category.number;

        const header = (
          <>
            <div className="flex items-start justify-between">
              <span className="font-mono text-xs text-accent">{number}</span>
              {count > 0 && (
                <span
                  className={`text-paper-muted transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                >
                  &rarr;
                </span>
              )}
            </div>
            <h2 className="mt-2 text-base font-medium text-paper">{category.name}</h2>
            <p className="mt-2 font-mono text-xs text-paper-muted">{lessonLabel(count)}</p>
          </>
        );

        if (count === 0) {
          return (
            <div key={category.number} className="rounded-lg border border-line-soft p-5 opacity-60">
              {header}
            </div>
          );
        }

        const categoryLessons = sortByOrder(lessons.filter((l) => l.category.number === category.number));

        return (
          <div
            key={category.number}
            className={`rounded-lg border p-5 transition-colors ${
              isOpen ? "border-accent-dim bg-ink-elevated/60" : "border-line hover:border-accent-dim"
            }`}
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : category.number)}
              className="block w-full text-left"
              aria-expanded={isOpen}
            >
              {header}
            </button>
            {isOpen && (
              <ul className="mt-4 space-y-1 border-t border-line-soft pt-3">
                {categoryLessons.map((lesson) => (
                  <li key={lesson.slug}>
                    <Link
                      href={`/lessons/${track.slug}/${category.slug}/${lesson.slug}`}
                      className="block rounded px-2 py-1.5 text-sm text-paper-muted transition-colors hover:bg-ink hover:text-paper"
                    >
                      {lesson.shortTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
