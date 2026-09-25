import { concepts, cases, studies, builds } from "#velite";

export type ContentIndexItem = { href: string; title: string; tags: string[] };

export function buildContentIndex(): ContentIndexItem[] {
  return [
    ...concepts.map((c) => ({ href: `/concepts/${c.track}/${c.slug}`, title: c.title, tags: c.tags })),
    ...cases.map((c) => ({ href: `/cases/${c.slug}`, title: c.title, tags: c.tags })),
    ...studies.map((s) => ({ href: `/studies/${s.slug}`, title: s.title, tags: s.tags })),
    ...builds.map((b) => ({ href: `/builds/${b.slug}`, title: b.title, tags: b.tags })),
  ];
}
