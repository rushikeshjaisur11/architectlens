import Link from "next/link";
import { notFound } from "next/navigation";
import { FRAMEWORKS, FRAMEWORK_SECTIONS } from "@/lib/frameworks";

export const dynamicParams = false;

export function generateStaticParams() {
  return FRAMEWORKS.flatMap((f) => FRAMEWORK_SECTIONS.map((s) => ({ slug: f.slug, section: s.slug })));
}

export default async function FrameworkSectionPage({ params }: { params: Promise<{ slug: string; section: string }> }) {
  const { slug, section: sectionSlug } = await params;
  const framework = FRAMEWORKS.find((f) => f.slug === slug);
  const section = FRAMEWORK_SECTIONS.find((s) => s.slug === sectionSlug);
  if (!framework || !section) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="font-mono text-xs text-paper-muted">
        <Link href="/frameworks" className="hover:text-paper">Frameworks</Link> /{" "}
        <Link href={`/frameworks/${framework.slug}`} className="hover:text-paper">{framework.name}</Link> /{" "}
        <span className="text-accent">{section.name}</span>
      </p>
      <h1 className="mt-2 text-paper">{framework.name}: {section.name}</h1>
      <p className="mt-3 text-paper-muted">{section.blurb}</p>
      <div className="mt-8 rounded-lg border border-line bg-ink-elevated p-5">
        <p className="font-mono text-sm text-paper">Coming soon</p>
        <p className="mt-2 text-sm text-paper-muted">Notes for this section will land here.</p>
      </div>
    </main>
  );
}
