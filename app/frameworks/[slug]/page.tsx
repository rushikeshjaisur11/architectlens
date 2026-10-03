import Link from "next/link";
import { notFound } from "next/navigation";
import { FRAMEWORKS, FRAMEWORK_SECTIONS } from "@/lib/frameworks";
import { TileGrid } from "@/components/FrameworkSections";

export const dynamicParams = false;

export function generateStaticParams() {
  return FRAMEWORKS.map((f) => ({ slug: f.slug }));
}

export default async function FrameworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const framework = FRAMEWORKS.find((f) => f.slug === slug);
  if (!framework) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="font-mono text-xs text-paper-muted">
        <Link href="/frameworks" className="hover:text-paper">Frameworks</Link> / <span className="text-accent">{framework.language}</span>
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-paper">{framework.name}</h1>
      <p className="mt-3 max-w-2xl text-paper-muted">{framework.blurb}</p>
      <h2 className="mt-10 mb-4 font-mono text-xs uppercase tracking-wide text-paper-muted">Sections</h2>
      <TileGrid
        tiles={FRAMEWORK_SECTIONS.map((s) => ({
          href: `/frameworks/${framework.slug}/${s.slug}`,
          name: s.name,
          blurb: s.blurb,
          hint: s.art,
          soon: framework.status === "soon",
        }))}
      />
    </main>
  );
}
