import { SectionIcon } from "./SectionIcon";
import { DotPattern } from "./ui/dot-pattern";
import { Spotlight } from "./ui/spotlight";
import { sectionByKey, type SectionKey } from "@/lib/track-meta";

// Heading block shared by the three track pages: a coloured section badge, title and intro.
export function TrackHeader({
  section,
  title,
  accent,
  intro,
  lessons,
  modules,
}: {
  section: SectionKey;
  title: string;
  accent: string;
  intro: string;
  lessons: number;
  modules: number;
}) {
  const s = sectionByKey(section);
  return (
    <header style={{ "--h": s.hue } as React.CSSProperties} className="relative">
      <div aria-hidden className="pointer-events-none absolute -inset-x-6 -top-16 bottom-0 overflow-hidden">
        <DotPattern width={22} height={22} className="fill-paper-muted/20 [mask-image:radial-gradient(34rem_18rem_at_20%_20%,white,transparent)]" />
        <Spotlight className="-top-32 left-0 md:left-24" fill={`hsl(${s.hue} 85% 68%)`} />
      </div>
      <p className="hue-bg relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
        <SectionIcon name={s.icon} size={14} className="hue-text" />
        <span className="hue-text">{s.name}</span>
        <span className="text-paper-muted">
          {lessons} lessons &middot; {modules} modules
        </span>
      </p>
      <h1 className="relative mt-5 text-paper">
        {title}
        <br />
        <span className="hue-text italic">
          {accent}
          <span className="caret" aria-hidden />
        </span>
      </h1>
      <p className="relative mt-4 max-w-xl text-paper-muted">{intro}</p>
    </header>
  );
}
