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
      <h1 className="text-2xl font-bold">{lesson.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={lesson.tags} />
      </div>
      <article className="prose prose-invert mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: lesson.html }} />
      {lesson.sources.length > 0 && (
        <div className="mt-8 border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-medium text-neutral-200">Sources</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-400">
            {lesson.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
