import fs from "node:fs";
import path from "node:path";
import { VAULT_SYSTEMS_DESIGN_ROOT } from "./vault-path";
import { slugFromFilename } from "./slug";

function markdownFilesExcludingIndex(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "index.md");
}

export function buildKnownHrefs(): Set<string> {
  const hrefs = new Set<string>();

  for (const track of ["classical", "ai"] as const) {
    for (const file of markdownFilesExcludingIndex(path.join(VAULT_SYSTEMS_DESIGN_ROOT, track))) {
      hrefs.add(`/concepts/${track}/${slugFromFilename(file)}`);
    }
  }

  for (const file of markdownFilesExcludingIndex(
    path.join(VAULT_SYSTEMS_DESIGN_ROOT, "ai", "interview", "scenarios")
  )) {
    hrefs.add(`/cases/${slugFromFilename(file)}`);
  }

  for (const collection of ["studies", "builds"] as const) {
    for (const file of markdownFilesExcludingIndex(path.join(VAULT_SYSTEMS_DESIGN_ROOT, collection))) {
      hrefs.add(`/${collection}/${slugFromFilename(file)}`);
    }
  }

  return hrefs;
}
