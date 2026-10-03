import { notFound } from "next/navigation";
import { FRAMEWORKS } from "@/lib/frameworks";

export const dynamicParams = false;

export function generateStaticParams() {
  return FRAMEWORKS.map((f) => ({ slug: f.slug }));
}

export default async function FrameworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const framework = FRAMEWORKS.find((f) => f.slug === slug);
  if (!framework) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs text-accent">Frameworks · {framework.language}</p>
      <h1 className="mt-2 text-3xl font-semibold text-paper">{framework.name}</h1>
      <p className="mt-4 text-paper-muted">{framework.blurb}</p>
      <div className="mt-8 rounded-lg border border-line bg-ink-elevated p-5">
        <p className="font-mono text-sm text-paper">Coming soon</p>
        <p className="mt-2 text-sm text-paper-muted">
          Hands-on notes for {framework.name} will land here: how it models agents, tools and memory, how it
          compares with the patterns in the AI Systems track, and a worked example for each.
        </p>
      </div>
    </main>
  );
}
