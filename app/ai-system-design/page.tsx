import { lessons } from "#velite";
import { trackFromSlug } from "@/lib/tracks";
import { CurriculumGrid } from "@/components/CurriculumGrid";
import { TrackHub } from "@/components/TrackHub";

export default function AiSystemDesignPage() {
  const track = trackFromSlug("ai-system-design");
  const trackLessons = lessons.filter((l) => l.track.slug === track.slug);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <TrackHub active="ai-system-design" />
      <h1 className="text-4xl font-semibold leading-tight text-paper">
        Design AI products
        <br />
        <span className="text-accent">end to end.</span>
      </h1>
      <p className="mt-4 max-w-xl text-paper-muted">
        Interview-style design walkthroughs for AI systems — an enterprise RAG assistant, a support
        agent, an LLM gateway — each from requirements to scale, failure modes and cost, organized as{" "}
        {track.categories.length} modules.
      </p>

      <CurriculumGrid
        track={track}
        lessons={trackLessons.map(({ slug, title, shortTitle, summary, minutes, tags, banner, order, category }) => ({
          slug, title, shortTitle, summary, minutes, tags, banner, order, category,
        }))}
      />
    </main>
  );
}
