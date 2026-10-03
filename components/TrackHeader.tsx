import { SectionIcon } from "./SectionIcon";
import { sectionByKey, type SectionKey } from "@/lib/track-meta";

// Heading block shared by the three track pages: a coloured section badge, title and intro.
export function TrackHeader({
  section,
  title,
  accent,
  intro,
  lessons,
  modules,
  meta,
}: {
  section: SectionKey;
  title: string;
  accent: string;
  intro: string;
  lessons?: number;
  modules?: number;
  meta?: string;
}) {
  const s = sectionByKey(section);
  return (
    <header style={{ "--h": s.hue } as React.CSSProperties} className="relative">
      <p className="hue-bg relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
        <SectionIcon name={s.icon} size={14} className="hue-text" />
        <span className="hue-text">{s.name}</span>
        <span className="text-paper-muted">
          {meta ?? `${lessons} lessons · ${modules} modules`}
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
