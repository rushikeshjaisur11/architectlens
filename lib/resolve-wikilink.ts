import path from "node:path";
import { slugFromFilename } from "./slug";

export type ResolvedTarget =
  | { collection: "concepts"; track: "classical" | "ai"; slug: string }
  | { collection: "cases" | "studies" | "builds"; slug: string };

const PREFIX = "learning/systems-design/";

function dirname(vaultRelativePath: string): string {
  const parts = vaultRelativePath.split("/");
  return parts.slice(0, -1).join("/");
}

function fromParts(parts: string[]): ResolvedTarget | null {
  const [first, second, third, fourth] = parts;

  if (first === "classical" || first === "ai") {
    if (first === "ai" && second === "interview") {
      if (third !== "scenarios") return null; // ai/interview/*.md (non-scenario) is not a collection
      if (!fourth || fourth === "index") return null;
      return { collection: "cases", slug: slugFromFilename(fourth) };
    }
    if (!second || second === "index") return null;
    return { collection: "concepts", track: first, slug: slugFromFilename(second) };
  }

  if (first === "studies" || first === "builds") {
    if (!second || second === "index") return null;
    return { collection: first, slug: slugFromFilename(second) };
  }

  return null;
}

export function parseWikilinkTarget(raw: string, currentVaultRelativePath: string): ResolvedTarget | null {
  const cleaned = raw.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
  if (!cleaned) return null;

  // A path that starts with "learning/" but isn't under our systems-design
  // prefix points at a different part of the vault entirely — it must never
  // be treated as relative-to-current-folder, or it silently becomes a
  // nonsense route (e.g. "learning/data-eng/kafka/index" from within
  // "ai/x.md" would otherwise resolve as "/concepts/ai/learning").
  if (cleaned.startsWith("learning/") && !cleaned.startsWith(PREFIX)) return null;

  const rest = cleaned.startsWith(PREFIX)
    ? cleaned.slice(PREFIX.length)
    : path.posix.normalize([dirname(currentVaultRelativePath), cleaned].filter(Boolean).join("/"));

  return fromParts(rest.split("/"));
}

export function targetToHref(target: ResolvedTarget): string {
  if (target.collection === "concepts") return `/concepts/${target.track}/${target.slug}`;
  return `/${target.collection}/${target.slug}`;
}

export function isKnownTarget(target: ResolvedTarget, knownHrefs: ReadonlySet<string>): boolean {
  return knownHrefs.has(targetToHref(target));
}
