import { defineConfig, s } from "velite";
import { CONTENT_ROOT } from "./lib/content-root";
import { categoryFromFolderName } from "./lib/categories";
import { trackFromSlug } from "./lib/tracks";
import { resolveShortTitle } from "./lib/short-title";
import { order } from "./lib/order";
import { slugFromFilename } from "./lib/slug";
import { BANNER_KINDS } from "./lib/banner-kinds";
import { readingMinutes, summarize } from "./lib/summary";

const seenLessonKeys = new Set<string>();

export default defineConfig({
  root: CONTENT_ROOT,
  collections: {
    lessons: {
      name: "Lesson",
      pattern: "*/*/*.md",
      schema: s
        .object({
          title: s.string(),
          short_title: s.string().optional(),
          tags: s.array(s.string()).default([]),
          sources: s.array(s.string()).default([]),
          banner: s
            .object({
              layout: s.enum(["line", "loop", "fan"]),
              nodes: s.array(s.tuple([s.enum(BANNER_KINDS), s.string().max(18)])).min(2).max(5),
            })
            .optional(),
          html: s.markdown(),
          raw: s.raw(),
          path: s.path(),
        })
        .transform(({ raw, ...data }) => {
          const [trackSlug, folderName, filename] = data.path.split("/");
          const track = trackFromSlug(trackSlug);
          const category = categoryFromFolderName(track.categories, folderName);
          const slug = slugFromFilename(filename);

          const key = `${trackSlug}/${category.slug}/${slug}`;
          if (seenLessonKeys.has(key)) {
            throw new Error(`Duplicate lesson slug "${slug}" in ${trackSlug}/${category.slug} (from ${data.path})`);
          }
          seenLessonKeys.add(key);

          return {
            ...data,
            summary: summarize(raw),
            minutes: readingMinutes(raw),
            shortTitle: resolveShortTitle(data.title, data.short_title),
            track: { slug: track.slug, name: track.name },
            category,
            order: order(filename),
            slug,
          };
        }),
    },
  },
});
