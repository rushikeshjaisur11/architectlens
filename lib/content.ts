export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function findBySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined {
  return items.find((item) => item.slug === slug);
}
