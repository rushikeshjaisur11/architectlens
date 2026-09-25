import type { Category } from "./categories";

export type Track = { slug: string; name: string; categories: Category[] };

const SYSTEM_DESIGN_CATEGORIES: Category[] = [
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

const AI_SYSTEMS_CATEGORIES: Category[] = [
  { number: 1, slug: "foundations-and-prompting", name: "Foundations and prompting" },
  { number: 2, slug: "context-and-rag", name: "Context and RAG" },
  { number: 3, slug: "retrieval-and-vector-search", name: "Retrieval and vector search" },
  { number: 4, slug: "model-serving-and-inference", name: "Model serving and inference" },
  { number: 5, slug: "agents-and-tool-use", name: "Agents and tool use" },
  { number: 6, slug: "evaluation-and-observability", name: "Evaluation and observability" },
  { number: 7, slug: "safety-and-guardrails", name: "Safety and guardrails" },
  { number: 8, slug: "cost-and-latency", name: "Cost and latency optimization" },
  { number: 9, slug: "fine-tuning-and-adaptation", name: "Fine-tuning and adaptation" },
  { number: 10, slug: "production-reliability", name: "Production reliability" },
];

export const TRACKS: Track[] = [
  { slug: "system-design", name: "System Design", categories: SYSTEM_DESIGN_CATEGORIES },
  { slug: "ai-systems", name: "AI Systems", categories: AI_SYSTEMS_CATEGORIES },
];

export function trackFromSlug(slug: string): Track {
  const track = TRACKS.find((t) => t.slug === slug);
  if (!track) throw new Error(`Unknown track: "${slug}"`);
  return track;
}
