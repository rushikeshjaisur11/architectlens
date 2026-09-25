import { sortByOrder } from "./content";
import type { Track } from "./tracks";

export type NavItem = { href: string; title: string };
export type NavGroup = { heading: string; items: NavItem[] };

type LessonLike = {
  slug: string;
  title: string;
  shortTitle: string;
  order: number;
  category: { number: number; slug: string; name: string };
};

export function buildNavTree(lessons: LessonLike[], track: Track): NavGroup[] {
  return track.categories.map((category) => {
    const inCategory = sortByOrder(lessons.filter((l) => l.category.number === category.number));
    return {
      heading: `${String(category.number).padStart(2, "0")} ${category.name}`,
      items: inCategory.map((l) => ({
        href: `/lessons/${track.slug}/${category.slug}/${l.slug}`,
        title: l.shortTitle,
      })),
    };
  });
}
