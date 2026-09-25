import { sortByOrder } from "./content";
import { CATEGORIES } from "./categories";

export type NavItem = { href: string; title: string };
export type NavGroup = { heading: string; items: NavItem[] };

type LessonLike = {
  slug: string;
  title: string;
  shortTitle: string;
  order: number;
  category: { number: number; slug: string; name: string };
};

export function buildNavTree(lessons: LessonLike[]): NavGroup[] {
  return CATEGORIES.map((category) => {
    const inCategory = sortByOrder(lessons.filter((l) => l.category.number === category.number));
    return {
      heading: `${String(category.number).padStart(2, "0")} ${category.name}`,
      items: inCategory.map((l) => ({
        href: `/lessons/${category.slug}/${l.slug}`,
        title: l.shortTitle,
      })),
    };
  });
}
