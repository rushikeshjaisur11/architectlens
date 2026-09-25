import { notFound } from "next/navigation";
import { concepts } from "#velite";
import { findConceptBySlug } from "@/lib/content";
import { resolveRelated } from "@/lib/related";
import { buildContentIndex } from "@/lib/search-index";
import { MetaPanel } from "@/components/MetaPanel";
import { RelatedPanel } from "@/components/RelatedPanel";

export function generateStaticParams() {
  return concepts.map((c) => ({ track: c.track, slug: c.slug }));
}

export default async function ConceptPage({
  params,
}: {
  params: Promise<{ track: string; slug: string }>;
}) {
  const { track, slug } = await params;
  const concept = findConceptBySlug(concepts, track, slug);
  if (!concept) notFound();

  const related = resolveRelated(concept.related, concept.path, buildContentIndex());

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{concept.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={concept.tags} maturity={concept.maturity} confidence={concept.confidence} />
      </div>
      <article className="prose prose-invert mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: concept.html }} />
      <RelatedPanel items={related} />
    </main>
  );
}
