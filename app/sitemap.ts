import type { MetadataRoute } from "next";
import { lessons } from "#velite";
import { SECTIONS } from "@/lib/track-meta";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", ...SECTIONS.map((s) => s.href), "/about", "/privacy", "/terms", "/licenses"];
  const lessonPages = lessons.map((l) => `/lessons/${l.track.slug}/${l.category.slug}/${l.slug}`);
  return [...pages, ...lessonPages].map((path) => ({ url: `${SITE_URL}${path}/` }));
}
