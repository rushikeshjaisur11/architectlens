import { defineConfig, s } from "velite";
import { CONTENT_ROOT } from "./lib/content-root";
import { categoryFromFolderName } from "./lib/categories";
import { resolveShortTitle } from "./lib/short-title";
import { order } from "./lib/order";
import { slugFromFilename } from "./lib/slug";

const seenLessonKeys = new Set<string>();

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
          const slug = slugFromFilename(filename);

          const key = `${category.slug}/${slug}`;
          if (seenLessonKeys.has(key)) {
            throw new Error(`Duplicate lesson slug "${slug}" in category "${category.slug}" (from ${data.path})`);
          }
          seenLessonKeys.add(key);

          return {
            ...data,
            shortTitle: resolveShortTitle(data.title, data.short_title),
            category,
            order: order(filename),
            slug,
          };
        }),
    },
  },
});
