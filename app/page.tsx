import { lessons } from "#velite";
import { trackFromSlug } from "@/lib/tracks";
import { CurriculumGrid } from "@/components/CurriculumGrid";
import { TrackHub } from "@/components/TrackHub";

export default function HomePage() {
  const track = trackFromSlug("system-design");
  const trackLessons = lessons.filter((l) => l.track.slug === track.slug);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <TrackHub active="system-design" />
      <h1 className="text-4xl font-semibold leading-tight text-paper">
        Learn system design
        <br />
        <span className="font-mono text-accent">from first principles.</span>
      </h1>
      <p className="mt-4 max-w-xl text-paper-muted">
        A self-paced curriculum covering the concepts, cases, and builds that come up in real
        systems work — organized as {track.categories.length} focused modules.
      </p>
      <p className="mt-6 font-mono text-xs text-paper-muted">
        {trackLessons.length} lesson{trackLessons.length === 1 ? "" : "s"} across{" "}
        {track.categories.length} modules
      </p>

      <CurriculumGrid track={track} lessons={trackLessons} />
    </main>
  );
}
