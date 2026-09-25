export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function groupConceptsByTrack<T extends { track: "classical" | "ai" }>(
  concepts: T[]
): Record<"classical" | "ai", T[]> {
  return {
    classical: sortByOrder(concepts.filter((c) => c.track === "classical") as (T & { order: number })[]),
    ai: sortByOrder(concepts.filter((c) => c.track === "ai") as (T & { order: number })[]),
  } as Record<"classical" | "ai", T[]>;
}

export function findBySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined {
  return items.find((item) => item.slug === slug);
}

export function findConceptBySlug<T extends { slug: string; track: string }>(
  concepts: T[],
  track: string,
  slug: string
): T | undefined {
  return concepts.find((c) => c.track === track && c.slug === slug);
}
