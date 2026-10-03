import { notFound } from "next/navigation";
import { lessons } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";
import { LessonAnimations } from "@/components/anim/LessonAnimations";
import { LessonBanner, LessonPager, LessonTopNav, OnThisPage, ReadingProgress, SectionControls } from "@/components/LessonChrome";
import { trackFromSlug } from "@/lib/tracks";

export function generateStaticParams() {
  return lessons.map((l) => ({ track: l.track.slug, category: l.category.slug, slug: l.slug }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ track: string; category: string; slug: string }>;
}) {
  const { track, category, slug } = await params;
  const inCategory = lessons.filter((l) => l.track.slug === track && l.category.slug === category);
  const lesson = findBySlug(inCategory, slug);
  if (!lesson) notFound();

  const trackLessons = lessons
    .filter((l) => l.track.slug === track)
    .sort((a, b) => a.category.number - b.category.number || a.order - b.order);
  const at = trackLessons.findIndex((l) => l.category.slug === category && l.slug === slug);
  const href = (l: (typeof lessons)[number]) => `/lessons/${l.track.slug}/${l.category.slug}/${l.slug}`;
  const prev = trackLessons[at - 1];
  const next = trackLessons[at + 1];
  const trackName = trackFromSlug(track).name;
  const trackHref = track === "system-design" ? "/" : `/${track}`;
  const moduleHref = `${trackHref === "/" ? "" : trackHref}/#m-${category}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <ReadingProgress lessonKey={`${track}/${category}/${slug}`} />
      <LessonTopNav trackName={trackName} trackHref={trackHref} moduleName={lesson.category.name}
        moduleHref={moduleHref}
        prevHref={prev && href(prev)}
        nextHref={next && href(next)}
      />
      <LessonBanner title={lesson.title} tags={lesson.tags.join(" ")} spec={lesson.banner} />
      <h1 className="mt-6 text-2xl font-semibold text-paper sm:text-3xl">{lesson.title}</h1>
      <p className="mt-2 font-mono text-xs text-paper-muted">
        {lesson.category.name} &middot; {lesson.minutes} min read
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <MetaPanel tags={lesson.tags} />
        <SectionControls />
      </div>
      <OnThisPage />
      <article
        data-lesson-body
        className="prose mt-8 max-w-[72ch]"
        dangerouslySetInnerHTML={{ __html: lesson.html }}
      />
      <LessonAnimations key={`${track}/${category}/${slug}`} lessonKey={`${track}/${category}/${slug}`} />
      {lesson.sources.length > 0 && (
        <details className="group mt-10 rounded-xl border border-line-soft bg-ink-elevated/40 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-paper-muted marker:hidden hover:text-paper">
            <span>Sources and references ({lesson.sources.length})</span>
            <span aria-hidden className="text-xs transition-transform group-open:rotate-180">&#9662;</span>
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-paper-muted marker:text-paper-muted/60">
            {lesson.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ol>
        </details>
      )}
      <LessonPager
        prev={prev && { href: href(prev), title: prev.shortTitle }}
        next={next && { href: href(next), title: next.shortTitle, summary: next.summary }}
      />
    </main>
  );
}
