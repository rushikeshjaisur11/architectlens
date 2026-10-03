import { lessons } from "#velite";

export type ContentIndexItem = {
  href: string;
  title: string;
  tags: string[];
  track: string;
  module: string;
  minutes: number;
  summary: string;
};

export function buildContentIndex(): ContentIndexItem[] {
  return lessons.map((l) => ({
    href: `/lessons/${l.track.slug}/${l.category.slug}/${l.slug}`,
    title: l.title,
    tags: l.tags,
    track: l.track.name,
    module: l.category.name,
    minutes: l.minutes,
    summary: l.summary.length > 140 ? `${l.summary.slice(0, 137)}...` : l.summary,
  }));
}
