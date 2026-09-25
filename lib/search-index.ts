import { lessons } from "#velite";

export type ContentIndexItem = { href: string; title: string; tags: string[] };

export function buildContentIndex(): ContentIndexItem[] {
  return lessons.map((l) => ({
    href: `/lessons/${l.category.slug}/${l.slug}`,
    title: l.title,
    tags: l.tags,
  }));
}
