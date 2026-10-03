import { FRAMEWORK_SECTIONS, frameworksByLanguage } from "@/lib/frameworks";
import { TileGrid } from "@/components/FrameworkSections";

export default function FrameworksIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold text-paper">Frameworks</h1>
      <p className="mt-3 text-paper-muted">
        Hands-on guides for agent and AI frameworks, grouped by language. Each one maps the framework&apos;s
        concepts back to the patterns taught in the other tracks.
      </p>
      {frameworksByLanguage().map(([language, items]) => (
        <section key={language} className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wide text-paper-muted">{language}</h2>
          <div className="mt-3">
            <TileGrid
              tiles={items.map((f) => ({
                href: `/frameworks/${f.slug}`,
                name: f.name,
                blurb: `${f.blurb} ${FRAMEWORK_SECTIONS.length} sections.`,
                hint: `${f.name} agent workflow`,
                soon: f.status === "soon",
              }))}
            />
          </div>
        </section>
      ))}
    </main>
  );
}
