import { groupConceptsByTrack, sortByOrder } from "./content";

export type NavItem = { href: string; title: string };
export type NavGroup = { heading: string; items: NavItem[] };

type ConceptLike = { slug: string; title: string; track: "classical" | "ai"; order: number };
type OrderedLike = { slug: string; title: string; order: number };

function toNavItems<T extends { title: string }>(items: T[], hrefOf: (item: T) => string): NavItem[] {
  return items.map((item) => ({ href: hrefOf(item), title: item.title }));
}

export function buildNavTree(
  concepts: ConceptLike[],
  cases: OrderedLike[],
  studies: OrderedLike[],
  builds: OrderedLike[]
): NavGroup[] {
  const grouped = groupConceptsByTrack(concepts);

  const groups: NavGroup[] = [
    { heading: "Classical", items: toNavItems(grouped.classical, (c) => `/concepts/classical/${c.slug}`) },
    { heading: "AI", items: toNavItems(grouped.ai, (c) => `/concepts/ai/${c.slug}`) },
    { heading: "Cases", items: toNavItems(sortByOrder(cases), (c) => `/cases/${c.slug}`) },
    { heading: "Studies", items: toNavItems(sortByOrder(studies), (s) => `/studies/${s.slug}`) },
    { heading: "Builds", items: toNavItems(sortByOrder(builds), (b) => `/builds/${b.slug}`) },
  ];

  return groups.filter((g) => g.items.length > 0);
}
