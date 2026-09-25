import { lessons } from "#velite";
import { trackFromSlug } from "@/lib/tracks";
import { CurriculumGrid } from "@/components/CurriculumGrid";

export default function AiSystemsPage() {
  const track = trackFromSlug("ai-systems");
  const trackLessons = lessons.filter((l) => l.track.slug === track.slug);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-semibold leading-tight text-paper">
        Learn AI systems
        <br />
        <span className="font-mono text-accent">from the ground up.</span>
      </h1>
      <p className="mt-4 max-w-xl text-paper-muted">
        A self-paced curriculum on building production AI systems — prompting, retrieval,
        serving, agents, evals, and everything that breaks in between —
        organized as {track.categories.length} focused modules.
      </p>
      <p className="mt-6 font-mono text-xs text-paper-muted">
        {trackLessons.length} lesson{trackLessons.length === 1 ? "" : "s"} across{" "}
        {track.categories.length} modules
      </p>

      <CurriculumGrid track={track} lessons={trackLessons} />
    </main>
  );
}
