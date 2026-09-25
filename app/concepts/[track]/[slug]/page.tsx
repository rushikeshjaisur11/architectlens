import { notFound } from "next/navigation";
import { concepts } from "#velite";
import { findConceptBySlug } from "@/lib/content";
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

  const related = (concept.related as string[])
    .map((raw) => concepts.find((c) => raw.includes(c.slug)))
    .filter((c): c is (typeof concepts)[number] => Boolean(c))
    .map((c) => ({ href: `/concepts/${c.track}/${c.slug}`, title: c.title }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{concept.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={concept.tags} maturity={concept.maturity} confidence={concept.confidence} />
      </div>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: concept.html }} />
      <RelatedPanel items={related} />
    </main>
  );
}
