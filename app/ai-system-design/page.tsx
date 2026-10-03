import { lessons } from "#velite";
import { trackFromSlug } from "@/lib/tracks";
import { CurriculumGrid } from "@/components/CurriculumGrid";
import { TrackHeader } from "@/components/TrackHeader";

export const metadata = { title: "AI System Design", description: "End-to-end designs for AI products and platforms." };

export default function AiSystemDesignPage() {
  const track = trackFromSlug("ai-system-design");
  const trackLessons = lessons.filter((l) => l.track.slug === track.slug);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <TrackHeader
        section="ai-system-design"
        title="Design AI products"
        accent="end to end."
        intro="Complete designs for AI products and platforms: assistants, search, agent platforms, enterprise controls and industry solutions."
        lessons={trackLessons.length}
        modules={track.categories.length}
      />

      <CurriculumGrid
        track={track}
        lessons={trackLessons.map(({ slug, title, shortTitle, summary, minutes, tags, banner, order, category }) => ({
          slug, title, shortTitle, summary, minutes, tags, banner, order, category,
        }))}
      />
    </main>
  );
}
