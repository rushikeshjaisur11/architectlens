export type ResolvedTarget =
  | { collection: "concepts"; track: "classical" | "ai"; slug: string }
  | { collection: "cases" | "studies" | "builds"; slug: string };

const PREFIX = "learning/systems-design/";

function stripNumericPrefix(filename: string): string {
  return filename.replace(/^\d+-/, "").replace(/\.md$/, "");
}

function dirname(vaultRelativePath: string): string {
  const parts = vaultRelativePath.split("/");
  return parts.slice(0, -1).join("/");
}

function fromParts(parts: string[]): ResolvedTarget | null {
  const [first, second, third, fourth] = parts;

  if (first === "classical" || first === "ai") {
    if (first === "ai" && second === "interview" && third === "scenarios") {
      if (!fourth || fourth === "index") return null;
      return { collection: "cases", slug: stripNumericPrefix(fourth) };
    }
    if (!second || second === "index") return null;
    return { collection: "concepts", track: first, slug: stripNumericPrefix(second) };
  }

  if (first === "studies" || first === "builds") {
    if (!second || second === "index") return null;
    return { collection: first, slug: stripNumericPrefix(second) };
  }

  return null;
}

export function parseWikilinkTarget(raw: string, currentVaultRelativePath: string): ResolvedTarget | null {
  const cleaned = raw.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
  if (!cleaned) return null;

  const rest = cleaned.startsWith(PREFIX)
    ? cleaned.slice(PREFIX.length)
    : [dirname(currentVaultRelativePath), cleaned].filter(Boolean).join("/");

  return fromParts(rest.split("/"));
}

export function targetToHref(target: ResolvedTarget): string {
  if (target.collection === "concepts") return `/concepts/${target.track}/${target.slug}`;
  return `/${target.collection}/${target.slug}`;
}
