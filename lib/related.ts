import { parseWikilinkTarget, targetToHref } from "./resolve-wikilink";

export function resolveRelated(
  rawList: string[],
  currentVaultRelativePath: string,
  items: { href: string; title: string }[]
): { href: string; title: string }[] {
  const titleByHref = new Map(items.map((i) => [i.href, i.title]));
  const seen = new Set<string>();
  const result: { href: string; title: string }[] = [];

  for (const raw of rawList) {
    const target = parseWikilinkTarget(raw, currentVaultRelativePath);
    if (!target) continue;

    const href = targetToHref(target);
    const title = titleByHref.get(href);
    if (!title || seen.has(href)) continue;

    seen.add(href);
    result.push({ href, title });
  }

  return result;
}
