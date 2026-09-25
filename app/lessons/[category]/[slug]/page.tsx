import { notFound } from "next/navigation";
import { lessons } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";

export function generateStaticParams() {
  return lessons.map((l) => ({ category: l.category.slug, slug: l.slug }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const inCategory = lessons.filter((l) => l.category.slug === category);
  const lesson = findBySlug(inCategory, slug);
  if (!lesson) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs text-accent">
        {String(lesson.category.number).padStart(2, "0")} {lesson.category.name}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-paper">{lesson.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={lesson.tags} />
      </div>
      <article
        className="prose prose-invert mt-8 max-w-none prose-headings:text-paper prose-a:text-accent"
        dangerouslySetInnerHTML={{ __html: lesson.html }}
      />
      {lesson.sources.length > 0 && (
        <div className="mt-8 border-t border-line pt-4">
          <h3 className="font-mono text-xs text-paper-muted">Sources</h3>
          <ul className="mt-2 space-y-1 text-sm text-paper-muted">
            {lesson.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
