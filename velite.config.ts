import { defineConfig, s } from "velite";
import path from "node:path";
import { VAULT_SYSTEMS_DESIGN_ROOT } from "./lib/vault-path";
import { remarkWikilinks } from "./lib/remark-wikilinks";

function order(filename: string): number {
  const match = /^(\d+)-/.exec(filename);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function slugFromFilename(filename: string): string {
  return filename.replace(/^\d+-/, "").replace(/\.md$/, "");
}

const sharedFields = {
  title: s.string(),
  tags: s.array(s.string()).default([]),
  maturity: s.string().optional(),
  confidence: s.string().optional(),
  related: s.array(s.string()).default([]),
  html: s.markdown({ remarkPlugins: [remarkWikilinks] }),
};

export default defineConfig({
  root: VAULT_SYSTEMS_DESIGN_ROOT,
  collections: {
    concepts: {
      name: "Concept",
      pattern: "{classical,ai}/*.md",
      schema: s
        .object({
          ...sharedFields,
          path: s.path(),
        })
        .transform((data) => {
          const track = data.path.split("/")[0] as "classical" | "ai";
          const filename = path.basename(data.path);
          return { ...data, track, order: order(filename), slug: slugFromFilename(filename) };
        }),
    },
    cases: {
      name: "Case",
      pattern: "ai/interview/scenarios/*.md",
      schema: s.object({ ...sharedFields, path: s.path() }).transform((data) => {
        const filename = path.basename(data.path);
        return { ...data, order: order(filename), slug: slugFromFilename(filename) };
      }),
    },
    studies: {
      name: "Study",
      pattern: "studies/*.md",
      schema: s.object({ ...sharedFields, path: s.path() }).transform((data) => {
        const filename = path.basename(data.path);
        return { ...data, order: order(filename), slug: slugFromFilename(filename) };
      }),
    },
    builds: {
      name: "Build",
      pattern: "builds/*.md",
      schema: s.object({ ...sharedFields, path: s.path() }).transform((data) => {
        const filename = path.basename(data.path);
        return { ...data, order: order(filename), slug: slugFromFilename(filename) };
      }),
    },
  },
});
