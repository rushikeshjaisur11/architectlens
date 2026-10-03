export type Framework = { slug: string; name: string; language: string; blurb: string; status: "soon" | "live" };

// Framework guides, grouped by language in the menu. Add an entry here and a page appears for it.
export const FRAMEWORKS: Framework[] = [
  { slug: "google-adk", name: "Google ADK", language: "Python", blurb: "Google's Agent Development Kit for building and deploying agents.", status: "soon" },
];

export function frameworksByLanguage(): [string, Framework[]][] {
  const out = new Map<string, Framework[]>();
  for (const f of FRAMEWORKS) out.set(f.language, [...(out.get(f.language) ?? []), f]);
  return [...out.entries()];
}
