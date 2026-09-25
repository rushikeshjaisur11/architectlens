import { defineConfig, s } from "velite";
import { CONTENT_ROOT } from "./lib/content-root";
import { categoryFromFolderName } from "./lib/categories";
import { resolveShortTitle } from "./lib/short-title";
import { order } from "./lib/order";
import { slugFromFilename } from "./lib/slug";

export default defineConfig({
  root: CONTENT_ROOT,
  collections: {
    lessons: {
      name: "Lesson",
      pattern: "*/*.md",
      schema: s
        .object({
          title: s.string(),
          short_title: s.string().optional(),
          tags: s.array(s.string()).default([]),
          sources: s.array(s.string()).default([]),
          html: s.markdown(),
          path: s.path(),
        })
        .transform((data) => {
          const [folderName, filename] = data.path.split("/");
          const category = categoryFromFolderName(folderName);
          return {
            ...data,
            shortTitle: resolveShortTitle(data.title, data.short_title),
            category,
            order: order(filename),
            slug: slugFromFilename(filename),
          };
        }),
    },
  },
});
