import { FRAMEWORK_SECTIONS, frameworksByLanguage } from "@/lib/frameworks";
import { TileGrid } from "@/components/FrameworkSections";
import { TrackHeader } from "@/components/TrackHeader";

export const metadata = { title: "Frameworks", description: "Hands-on guides for agent and AI frameworks, grouped by language." };

export default function FrameworksIndexPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <TrackHeader
        section="frameworks"
        title="Learn agent frameworks"
        accent="by building with them."
        intro="Hands-on guides for agent and AI frameworks, grouped by language. Each one maps the framework's concepts back to the patterns taught in the other tracks."
        meta={`${frameworksByLanguage().reduce((n, [, items]) => n + items.length, 0)} frameworks`}
      />
      {frameworksByLanguage().map(([language, items]) => (
        <section key={language} className="mt-10">
          <h2 className="eyebrow !font-sans !text-xs">{language}</h2>
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
