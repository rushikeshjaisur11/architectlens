import { lessons } from "#velite";
import { trackFromSlug } from "@/lib/tracks";
import { CurriculumGrid } from "@/components/CurriculumGrid";
import { TrackHeader } from "@/components/TrackHeader";

export const metadata = { title: "System Design", description: "Concepts, cases and complete designs for building large systems." };

export default function HomePage() {
  const track = trackFromSlug("system-design");
  const trackLessons = lessons.filter((l) => l.track.slug === track.slug);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <TrackHeader
        section="system-design"
        title="Learn system design"
        accent="from first principles."
        intro="The concepts, cases and complete designs that come up in real systems work, from data and caching to reliability and incidents."
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
