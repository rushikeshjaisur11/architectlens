import { ImageResponse } from "next/og";
import { lessons } from "#velite";
import { findBySlug } from "@/lib/content";
import { SITE_NAME } from "@/lib/site";
import { sectionByKey } from "@/lib/track-meta";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Lesson preview";

export function generateStaticParams() {
  return lessons.map((l) => ({ track: l.track.slug, category: l.category.slug, slug: l.slug }));
}

// Per-lesson share card: section colour, title, a clipped summary and the reading time.
export default async function Image({ params }: { params: Promise<{ track: string; category: string; slug: string }> }) {
  const { track, category, slug } = await params;
  const lesson = findBySlug(lessons.filter((l) => l.track.slug === track && l.category.slug === category), slug);
  const section = sectionByKey(track);
  const accent = `hsl(${section.hue} 85% 68%)`;
  const title = lesson?.title ?? SITE_NAME;
  const full = lesson?.summary ?? "";
  const summary = full.length > 150 ? `${full.slice(0, 150).replace(/\s+\S*$/, "")}…` : full;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          color: "#ededf0",
          padding: 72,
          borderTop: `10px solid ${accent}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, color: accent }}>
          <div style={{ width: 14, height: 14, borderRadius: 14, background: accent }} />
          {section.name}
          {lesson ? <span style={{ color: "#a3a3ad" }}>{`· ${lesson.minutes} min read`}</span> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: title.length > 60 ? 62 : 76, lineHeight: 1.1, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 30, lineHeight: 1.4, color: "#b8b8c2" }}>{summary}</div>
        </div>
        <div style={{ fontSize: 30, color: "#b8b8c2" }}>{SITE_NAME}</div>
      </div>
    ),
    size,
  );
}
