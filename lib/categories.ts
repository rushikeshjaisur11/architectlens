export type Category = { number: number; slug: string; name: string };

export const CATEGORIES: Category[] = [
  { number: 1, slug: "foundations", name: "Foundations" },
  { number: 2, slug: "apis-services-protocols", name: "APIs, services and protocols" },
  { number: 3, slug: "data-modeling-and-sql", name: "Data modeling and SQL" },
  { number: 4, slug: "nosql-partitioning-and-ids", name: "NoSQL, partitioning and IDs" },
  { number: 5, slug: "caching-and-fast-reads", name: "Caching and fast reads" },
  { number: 6, slug: "distributed-coordination", name: "Distributed coordination" },
  { number: 7, slug: "storage-engines", name: "Storage engines" },
  { number: 8, slug: "async-work-and-streams", name: "Async work and streams" },
  { number: 9, slug: "search-and-retrieval", name: "Search and retrieval" },
  { number: 10, slug: "analytics-and-sketches", name: "Analytics and sketches" },
  { number: 11, slug: "realtime-social-and-feeds", name: "Realtime, social and feeds" },
  { number: 12, slug: "geo-matching-and-recs", name: "Geo, matching and recs" },
  { number: 13, slug: "media-files-and-cdn", name: "Media, files and CDN" },
  { number: 14, slug: "reliability-and-operations", name: "Reliability and operations" },
  { number: 15, slug: "service-and-data-designs", name: "Service and data designs" },
  { number: 16, slug: "product-designs", name: "Product designs" },
  { number: 17, slug: "media-and-operations-designs", name: "Media and operations designs" },
  { number: 18, slug: "engineering-case-studies", name: "Engineering case studies" },
];

export function categoryFromFolderName(folderName: string): Category {
  const match = /^(\d{2})-(.+)$/.exec(folderName);
  if (!match) throw new Error(`Invalid category folder name: "${folderName}"`);

  const number = Number(match[1]);
  const category = CATEGORIES.find((c) => c.number === number);
  if (!category) throw new Error(`Unknown category number ${number} in folder "${folderName}"`);

  const expected = `${String(category.number).padStart(2, "0")}-${category.slug}`;
  if (folderName !== expected) {
    throw new Error(`Folder "${folderName}" doesn't match category ${number}'s expected name "${expected}"`);
  }

  return category;
}
