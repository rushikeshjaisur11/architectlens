import { lessons } from "#velite";
import { trackFromSlug } from "@/lib/tracks";
import { CurriculumGrid } from "@/components/CurriculumGrid";
import { TrackHeader } from "@/components/TrackHeader";

export const metadata = { title: "AI Systems", description: "The building blocks of production AI: prompting, retrieval, serving, agents, evals and safety." };

export default function AiSystemsPage() {
  const track = trackFromSlug("ai-systems");
  const trackLessons = lessons.filter((l) => l.track.slug === track.slug);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <TrackHeader
        section="ai-systems"
        title="Learn AI systems"
        accent="from the ground up."
        intro="The building blocks of production AI: prompting, retrieval, serving, agents, evals, safety and everything that breaks in between."
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
