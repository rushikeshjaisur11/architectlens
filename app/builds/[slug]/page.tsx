import { notFound } from "next/navigation";
import { builds } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";

export function generateStaticParams() {
  return builds.map((b) => ({ slug: b.slug }));
}

export default async function BuildPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = findBySlug(builds, slug);
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{item.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={item.tags} maturity={item.maturity} confidence={item.confidence} />
      </div>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: item.html }} />
    </main>
  );
}
