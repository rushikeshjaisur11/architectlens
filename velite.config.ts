import { defineConfig, s } from "velite";
import path from "node:path";
import { VAULT_SYSTEMS_DESIGN_ROOT } from "./lib/vault-path";
import { remarkWikilinks } from "./lib/remark-wikilinks";
import { buildKnownHrefs } from "./lib/vault-index";
import { order } from "./lib/order";
import { slugFromFilename } from "./lib/slug";

const knownHrefs = buildKnownHrefs();

const sharedFields = {
  title: s.string(),
  tags: s.array(s.string()).default([]),
  maturity: s.string().optional(),
  confidence: s.string().optional(),
  related: s.array(s.string()).default([]),
  html: s.markdown({ remarkPlugins: [() => remarkWikilinks(knownHrefs)] }),
};

export default defineConfig({
  root: VAULT_SYSTEMS_DESIGN_ROOT,
  collections: {
    concepts: {
      name: "Concept",
      pattern: ["{classical,ai}/*.md", "!**/index.md"],
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
