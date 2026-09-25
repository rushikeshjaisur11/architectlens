# Original Content Pipeline + Fanout-Style Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vault-sourced content pipeline (Velite reading an external Obsidian vault, wikilink resolution, four collections) with a single `lessons` collection reading original content from `content/system-design/` inside this repo, organized into 18 fanout-style numbered categories, with the sidebar/landing page always showing all 18 categories even before any lesson is written.

**Architecture:** A static 18-entry category lookup table (`lib/categories.ts`) is the single source of truth for category numbers/slugs/names. Velite reads `content/system-design/<NN-category-slug>/<NN-lesson-slug>.md`, deriving each lesson's category from its folder name via that table. The nav tree and landing page iterate the fixed 18-category list (not the lessons themselves) so empty categories still render. The old wikilink/vault machinery is deleted outright since new content uses plain Markdown links.

**Tech Stack:** Next.js 15 App Router, TypeScript, Velite, Vitest, Tailwind CSS v4 (unchanged from prior work).

**Spec:** `docs/superpowers/specs/2026-09-25-original-content-taxonomy-design.md`

## Global Constraints

- Content lives at `content/system-design/` inside this repo, never the external `llm-wiki-memory` vault (spec: Purpose).
- New content uses plain Markdown links; no wikilink resolver is reintroduced (spec: Purpose).
- All 18 categories are always shown, including ones with zero lessons — never omitted (spec: Sidebar, Landing page — corrected in spec self-review).
- No fanout branding, copy, pricing, sign-in, "Pro" locks, or progress tracking is reproduced — only the structural pattern (spec: Non-goals).
- This plan builds the pipeline/UI only. Writing the 20-30 actual lessons is a separate content-authoring pass that follows this plan (spec: Non-goals).

## Review Focus

- A category folder name that doesn't match the lookup table (typo, unknown number) — `categoryFromFolderName` must throw a clear error at build time, not silently misfile the lesson or crash with an unrelated stack trace.
- Every content folder empty (the state immediately after this plan ships, before any lesson is authored) — the `lessons` collection must be `[]`, and the nav tree / landing page must render all 18 categories at a `0` count without crashing on empty arrays.
- A lesson with no `short_title` in frontmatter — must fall back to the full `title` for sidebar/search display, not render `undefined` or crash.
- Two lessons with the same slug in different categories — routes are `/lessons/[category]/[slug]`, so slugs need only be unique per category; the lesson-detail page must filter by category before looking up the slug, not search globally and risk grabbing the wrong one.
- A lesson with no numeric order prefix in its filename — already covered by the existing, reused `lib/order.ts` sentinel (`Number.MAX_SAFE_INTEGER`) and its tests; confirmed still exercised through the new per-category sort in `nav-tree.ts`.

---

## File Structure

```
architectlens/
  content/system-design/
    01-foundations/.gitkeep
    02-apis-services-protocols/.gitkeep
    ... (18 total)
    18-engineering-case-studies/.gitkeep
  lib/
    categories.ts            (new — 18-entry lookup table + folder-name resolver)
    categories.test.ts        (new)
    short-title.ts            (new — pure fallback helper)
    short-title.test.ts       (new)
    content-root.ts           (new — replaces vault-path.ts)
    content.ts                (modified — remove track-specific helpers)
    content.test.ts            (modified)
    nav-tree.ts                 (rewritten — category-based, all 18 always present)
    nav-tree.test.ts             (rewritten)
    search-index.ts               (rewritten — single lessons collection)
    order.ts, slug.ts              (unchanged — still generic)
    vault-path.ts                   (deleted)
    resolve-wikilink.ts, .test.ts    (deleted)
    remark-wikilinks.ts               (deleted)
    vault-index.ts, .test.ts           (deleted)
    related.ts, .test.ts                (deleted)
  velite.config.ts                     (rewritten — single lessons collection)
  components/
    Sidebar.tsx                         (modified — category number + lesson count display)
    MetaPanel.tsx                        (modified — drop maturity/confidence)
    RelatedPanel.tsx                      (deleted)
  app/
    layout.tsx                            (modified — new buildNavTree/buildContentIndex calls)
    page.tsx                              (rewritten — curriculum grid, all 18 categories)
    lessons/[category]/[slug]/page.tsx    (new)
    concepts/[track]/[slug]/page.tsx      (deleted)
    cases/[slug]/page.tsx                 (deleted)
    studies/[slug]/page.tsx               (deleted)
    builds/[slug]/page.tsx                (deleted)
  package.json                           (modified — remove unist-util-visit, @types/mdast)
```

---

### Task 1: Category lookup table + short-title fallback (pure, tested)

**Files:**
- Create: `lib/categories.ts`
- Test: `lib/categories.test.ts`
- Create: `lib/short-title.ts`
- Test: `lib/short-title.test.ts`

**Interfaces:**
- Produces:
  - `type Category = { number: number; slug: string; name: string }`
  - `const CATEGORIES: Category[]` (18 entries)
  - `function categoryFromFolderName(folderName: string): Category` (throws on no match)
  - `function resolveShortTitle(title: string, shortTitle?: string): string`
- Consumed by: `velite.config.ts` (Task 4), `lib/nav-tree.ts` (Task 5), `app/page.tsx` (Task 8).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/categories.test.ts
import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryFromFolderName } from "./categories";

describe("CATEGORIES", () => {
  it("has exactly 18 categories numbered 1 through 18 with no gaps", () => {
    expect(CATEGORIES).toHaveLength(18);
    expect(CATEGORIES.map((c) => c.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
});

describe("categoryFromFolderName", () => {
  it("resolves a folder name to its category", () => {
    expect(categoryFromFolderName("01-foundations")).toEqual({
      number: 1,
      slug: "foundations",
      name: "Foundations",
    });
  });

  it("resolves a multi-word category name", () => {
    expect(categoryFromFolderName("06-distributed-coordination")).toEqual({
      number: 6,
      slug: "distributed-coordination",
      name: "Distributed coordination",
    });
  });

  it("throws for a folder name with no numeric prefix", () => {
    expect(() => categoryFromFolderName("foundations")).toThrow();
  });

  it("throws for an unknown category number", () => {
    expect(() => categoryFromFolderName("99-unknown")).toThrow();
  });
});
```

```ts
// lib/short-title.test.ts
import { describe, expect, it } from "vitest";
import { resolveShortTitle } from "./short-title";

describe("resolveShortTitle", () => {
  it("uses the provided short title when present", () => {
    expect(resolveShortTitle("CAP Theorem: A Long Subtitle", "CAP Theorem")).toBe("CAP Theorem");
  });

  it("falls back to the full title when short title is absent", () => {
    expect(resolveShortTitle("CAP Theorem: A Long Subtitle", undefined)).toBe("CAP Theorem: A Long Subtitle");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/categories.test.ts lib/short-title.test.ts`
Expected: FAIL — neither module exists yet.

- [ ] **Step 3: Implement lib/categories.ts**

```ts
// lib/categories.ts
export type Category = { number: number; slug: string; name: string };

export const CATEGORIES: Category[] = [
  { number: 1, slug: "foundations", name: "Foundations" },
  { number: 2, slug: "apis-services-protocols", name: "APIs, services and protocols" },
  { number: 3, slug: "data-modeling-and-sql", name: "Data modeling and SQL" },
  { number: 4, slug: "nosql-partitioning-and-ids", name: "NoSQL, partitioning and IDs" },
  { number: 5, slug: "caching-and-fast-reads", name: "Caching and fast reads" },
  { number: 6, slug: "distributed-coordination", name: "Distributed coordination" },
  { number: 7, slug: "storage-engines", name: "Storage engines" },
  { number: 8, slug: "async-work-and-streams", name: "Async work and streams" },
  { number: 9, slug: "search-and-retrieval", name: "Search and retrieval" },
  { number: 10, slug: "analytics-and-sketches", name: "Analytics and sketches" },
  { number: 11, slug: "realtime-social-and-feeds", name: "Realtime, social and feeds" },
  { number: 12, slug: "geo-matching-and-recs", name: "Geo, matching and recs" },
  { number: 13, slug: "media-files-and-cdn", name: "Media, files and CDN" },
  { number: 14, slug: "reliability-and-operations", name: "Reliability and operations" },
  { number: 15, slug: "service-and-data-designs", name: "Service and data designs" },
  { number: 16, slug: "product-designs", name: "Product designs" },
  { number: 17, slug: "media-and-operations-designs", name: "Media and operations designs" },
  { number: 18, slug: "engineering-case-studies", name: "Engineering case studies" },
];

export function categoryFromFolderName(folderName: string): Category {
  const match = /^(\d+)-(.+)$/.exec(folderName);
  if (!match) throw new Error(`Invalid category folder name: "${folderName}"`);

  const number = Number(match[1]);
  const category = CATEGORIES.find((c) => c.number === number);
  if (!category) throw new Error(`Unknown category number ${number} in folder "${folderName}"`);

  return category;
}
```

- [ ] **Step 4: Implement lib/short-title.ts**

```ts
// lib/short-title.ts
export function resolveShortTitle(title: string, shortTitle?: string): string {
  return shortTitle ?? title;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/categories.test.ts lib/short-title.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/categories.ts lib/categories.test.ts lib/short-title.ts lib/short-title.test.ts
git commit -m "feat: add category lookup table and short-title fallback helper"
```

---

### Task 2: Content directory scaffold + content-root path

**Files:**
- Create: `content/system-design/01-foundations/.gitkeep` through `content/system-design/18-engineering-case-studies/.gitkeep` (18 folders)
- Create: `lib/content-root.ts`

**Interfaces:**
- Produces: `const CONTENT_ROOT: string` (absolute path to `content/system-design/`).
- Consumed by: `velite.config.ts` (Task 4).

- [ ] **Step 1: Create all 18 category folders with .gitkeep**

Run:
```bash
cd /c/Users/rushi/architectlens
mkdir -p content/system-design/01-foundations \
  content/system-design/02-apis-services-protocols \
  content/system-design/03-data-modeling-and-sql \
  content/system-design/04-nosql-partitioning-and-ids \
  content/system-design/05-caching-and-fast-reads \
  content/system-design/06-distributed-coordination \
  content/system-design/07-storage-engines \
  content/system-design/08-async-work-and-streams \
  content/system-design/09-search-and-retrieval \
  content/system-design/10-analytics-and-sketches \
  content/system-design/11-realtime-social-and-feeds \
  content/system-design/12-geo-matching-and-recs \
  content/system-design/13-media-files-and-cdn \
  content/system-design/14-reliability-and-operations \
  content/system-design/15-service-and-data-designs \
  content/system-design/16-product-designs \
  content/system-design/17-media-and-operations-designs \
  content/system-design/18-engineering-case-studies
find content/system-design -maxdepth 1 -type d | sort | xargs -I{} touch {}/.gitkeep
```

- [ ] **Step 2: Create lib/content-root.ts**

```ts
// lib/content-root.ts
import path from "node:path";

export const CONTENT_ROOT = path.resolve(process.cwd(), "content", "system-design");
```

- [ ] **Step 3: Verify the path resolves and all 18 folders exist**

Run: `node -e "const fs=require('fs'); const p=require('path').resolve(process.cwd(),'content','system-design'); console.log(fs.readdirSync(p).length, 'folders')"`
Expected: prints `18 folders`.

- [ ] **Step 4: Commit**

```bash
git add content/system-design lib/content-root.ts
git commit -m "chore: scaffold 18 content category folders and content-root path"
```

---

### Task 3: Remove track-specific content helpers

**Files:**
- Modify: `lib/content.ts`
- Modify: `lib/content.test.ts`

**Interfaces:**
- Produces: `sortByOrder` and `findBySlug` only (removes `groupConceptsByTrack` and `findConceptBySlug`, which have no meaning in the category-based taxonomy).
- Consumed by: `lib/nav-tree.ts` (Task 5, uses `sortByOrder`), `app/lessons/[category]/[slug]/page.tsx` (Task 7, uses `findBySlug`).

- [ ] **Step 1: Replace lib/content.test.ts**

```ts
// lib/content.test.ts
import { describe, expect, it } from "vitest";
import { sortByOrder, findBySlug } from "./content";

const items = [
  { slug: "b", order: 2 },
  { slug: "a", order: 1 },
];

describe("sortByOrder", () => {
  it("sorts ascending by order", () => {
    expect(sortByOrder(items).map((i) => i.slug)).toEqual(["a", "b"]);
  });

  it("puts items with the no-prefix sentinel last (Velite serializes Infinity as null, so the sentinel must be a finite number)", () => {
    const withSentinel = [...items, { slug: "z", order: Number.MAX_SAFE_INTEGER }];
    expect(sortByOrder(withSentinel).map((i) => i.slug)).toEqual(["a", "b", "z"]);
  });
});

describe("findBySlug", () => {
  it("finds an item by slug", () => {
    expect(findBySlug(items, "a")?.slug).toBe("a");
  });

  it("returns undefined for a missing slug", () => {
    expect(findBySlug(items, "missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/content.test.ts`
Expected: FAIL — the test file no longer imports `groupConceptsByTrack`/`findConceptBySlug`, but `content.ts` still exports only the old shape; this step just confirms the new test file runs against the *old* implementation and passes for `sortByOrder`/`findBySlug` already (they're unchanged) — if it already passes, skip to Step 4. Run it and read the actual result before assuming either outcome.

- [ ] **Step 3: Replace lib/content.ts**

```ts
// lib/content.ts
export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function findBySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined {
  return items.find((item) => item.slug === slug);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/content.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/content.ts lib/content.test.ts
git commit -m "refactor: remove track-specific content helpers (no longer meaningful in category taxonomy)"
```

---

### Task 4: Rewrite Velite config for the single lessons collection

**Files:**
- Modify: `velite.config.ts`

**Interfaces:**
- Consumes: `CONTENT_ROOT` (Task 2), `categoryFromFolderName`, `resolveShortTitle` (Task 1), `order`, `slugFromFilename` (existing, unchanged).
- Produces: Velite collection `lessons`, fields `title, shortTitle, tags, sources, category ({number, slug, name}), order, slug, html`. Generated types importable from `#velite`, used by every later task.

**Known intermediate state:** after this task, `app/layout.tsx` and `app/page.tsx` still import `{ concepts, cases, studies, builds }` from `#velite`, which no longer exist — `npm run build` will fail until Task 8 rewires them. This task's own verification is `npx velite build`, which checks the pipeline in isolation. This mirrors the same pattern used in the prior plan's SearchOverlay task.

- [ ] **Step 1: Replace velite.config.ts**

```ts
// velite.config.ts
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
```

- [ ] **Step 2: Run Velite build and inspect output**

Run: `npx velite build`
Expected: exits 0, creates `.velite/lessons.json` containing `[]` (all 18 content folders are empty except `.gitkeep`, so no `.md` files match the pattern yet).

- [ ] **Step 3: Commit**

```bash
git add velite.config.ts
git commit -m "feat: rewrite Velite config for single lessons collection with category derivation"
```

---

### Task 5: Category-based nav tree + Sidebar count display

**Files:**
- Modify: `lib/nav-tree.ts` (full rewrite)
- Modify: `lib/nav-tree.test.ts` (full rewrite)
- Modify: `components/Sidebar.tsx`

**Interfaces:**
- Consumes: `CATEGORIES` (Task 1), `sortByOrder` (Task 3, `lib/content.ts`).
- Produces:
  - `type NavItem = { href: string; title: string }` (unchanged shape)
  - `type NavGroup = { heading: string; items: NavItem[] }` (unchanged shape)
  - `function buildNavTree(lessons: LessonLike[]): NavGroup[]` — **signature changed** from the old 4-array-argument version; now takes one array. `LessonLike = { slug: string; title: string; shortTitle: string; order: number; category: { number: number; slug: string; name: string } }`.
- Consumed by: `Sidebar` (this task), `app/layout.tsx` (Task 8, which will call `buildNavTree(lessons)` with the real Velite-generated array).

**Known intermediate state:** `app/layout.tsx` still calls the old 4-argument `buildNavTree` signature until Task 8 — this task's own verification is the unit test only, not a full build.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/nav-tree.test.ts
import { describe, expect, it } from "vitest";
import { buildNavTree } from "./nav-tree";

const foundations = { number: 1, slug: "foundations", name: "Foundations" };
const apis = { number: 2, slug: "apis-services-protocols", name: "APIs, services and protocols" };

describe("buildNavTree", () => {
  it("returns all 18 categories in fixed numeric order, even when every one is empty", () => {
    const tree = buildNavTree([]);
    expect(tree).toHaveLength(18);
    expect(tree[0].heading).toBe("01 Foundations");
    expect(tree[17].heading).toBe("18 Engineering case studies");
  });

  it("includes a zero-lesson category as an empty-items group, not omitted", () => {
    const tree = buildNavTree([]);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    expect(foundationsGroup.items).toEqual([]);
  });

  it("orders lessons within a category by their order field", () => {
    const lessons = [
      { slug: "second", title: "Second", shortTitle: "Second", order: 2, category: foundations },
      { slug: "first", title: "First", shortTitle: "First", order: 1, category: foundations },
    ];
    const tree = buildNavTree(lessons);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    expect(foundationsGroup.items.map((i) => i.title)).toEqual(["First", "Second"]);
  });

  it("uses shortTitle for nav display, not the full title", () => {
    const lessons = [
      {
        slug: "cap-theorem",
        title: "CAP Theorem: A Very Long Explanatory Subtitle",
        shortTitle: "CAP Theorem",
        order: 1,
        category: foundations,
      },
    ];
    const tree = buildNavTree(lessons);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    expect(foundationsGroup.items[0].title).toBe("CAP Theorem");
  });

  it("builds hrefs scoped by category slug", () => {
    const lessons = [{ slug: "rest-vs-rpc", title: "REST vs RPC", shortTitle: "REST vs RPC", order: 1, category: apis }];
    const tree = buildNavTree(lessons);
    const apisGroup = tree.find((g) => g.heading.startsWith("02"))!;
    expect(apisGroup.items[0].href).toBe("/lessons/apis-services-protocols/rest-vs-rpc");
  });

  it("keeps the same slug in two different categories separate (hrefs differ by category)", () => {
    const lessons = [
      { slug: "overview", title: "Foundations Overview", shortTitle: "Overview", order: 1, category: foundations },
      { slug: "overview", title: "APIs Overview", shortTitle: "Overview", order: 1, category: apis },
    ];
    const tree = buildNavTree(lessons);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    const apisGroup = tree.find((g) => g.heading.startsWith("02"))!;
    expect(foundationsGroup.items[0].href).toBe("/lessons/foundations/overview");
    expect(apisGroup.items[0].href).toBe("/lessons/apis-services-protocols/overview");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/nav-tree.test.ts`
Expected: FAIL — old `buildNavTree` takes 4 arguments and groups by track, not category; the test file's calls and assertions won't match.

- [ ] **Step 3: Replace lib/nav-tree.ts**

```ts
// lib/nav-tree.ts
import { sortByOrder } from "./content";
import { CATEGORIES } from "./categories";

export type NavItem = { href: string; title: string };
export type NavGroup = { heading: string; items: NavItem[] };

type LessonLike = {
  slug: string;
  title: string;
  shortTitle: string;
  order: number;
  category: { number: number; slug: string; name: string };
};

export function buildNavTree(lessons: LessonLike[]): NavGroup[] {
  return CATEGORIES.map((category) => {
    const inCategory = sortByOrder(lessons.filter((l) => l.category.number === category.number));
    return {
      heading: `${String(category.number).padStart(2, "0")} ${category.name}`,
      items: inCategory.map((l) => ({
        href: `/lessons/${category.slug}/${l.slug}`,
        title: l.shortTitle,
      })),
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/nav-tree.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Update components/Sidebar.tsx to show category number and lesson count**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav-tree";

export function Sidebar({ groups, onSearchClick }: { groups: NavGroup[]; onSearchClick: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(heading: string) {
    setCollapsed((prev) => ({ ...prev, [heading]: !prev[heading] }));
  }

  return (
    <nav className="w-64 shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-900 p-4">
      <button
        type="button"
        onClick={onSearchClick}
        className="mb-6 w-full rounded border border-neutral-700 px-3 py-2 text-left text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
      >
        Search... <span className="float-right text-xs text-neutral-600">Ctrl+K</span>
      </button>

      {groups.map((group) => (
        <div key={group.heading} className="mb-4">
          <button
            type="button"
            onClick={() => toggle(group.heading)}
            className="mb-2 flex w-full items-center justify-between font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            <span>{group.heading}</span>
            <span className="flex items-center gap-2">
              <span className="normal-case text-neutral-600">{group.items.length}</span>
              <span>{collapsed[group.heading] ? "+" : "−"}</span>
            </span>
          </button>
          {!collapsed[group.heading] && group.items.length > 0 && (
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        active
                          ? "block rounded px-2 py-1 text-sm text-cyan-400 bg-neutral-800"
                          : "block rounded px-2 py-1 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                      }
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/nav-tree.ts lib/nav-tree.test.ts components/Sidebar.tsx
git commit -m "feat: rebuild nav tree around 18 fixed categories, show lesson counts in sidebar"
```

---

### Task 6: Rewrite search index for the single lessons collection

**Files:**
- Modify: `lib/search-index.ts`

**Interfaces:**
- Consumes: `lessons` from `#velite` (Task 4).
- Produces: `ContentIndexItem` (unchanged shape: `{ href, title, tags }`), `buildContentIndex(): ContentIndexItem[]` (unchanged name/signature, new implementation).

**Known intermediate state:** `app/layout.tsx` doesn't call this yet with the new lessons-based data flow until Task 8 — no build check here, matches Task 4/5's pattern. This file was never unit-tested before (thin `#velite`-importing wrapper), so no test is added now either, consistent with the existing pattern.

- [ ] **Step 1: Replace lib/search-index.ts**

```ts
// lib/search-index.ts
import { lessons } from "#velite";

export type ContentIndexItem = { href: string; title: string; tags: string[] };

export function buildContentIndex(): ContentIndexItem[] {
  return lessons.map((l) => ({
    href: `/lessons/${l.category.slug}/${l.slug}`,
    title: l.title,
    tags: l.tags,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/search-index.ts
git commit -m "feat: rebuild search index around single lessons collection"
```

---

### Task 7: Lesson detail page, MetaPanel simplification, delete old routes

**Files:**
- Create: `app/lessons/[category]/[slug]/page.tsx`
- Modify: `components/MetaPanel.tsx`
- Delete: `components/RelatedPanel.tsx`
- Delete: `app/concepts/[track]/[slug]/page.tsx`
- Delete: `app/cases/[slug]/page.tsx`
- Delete: `app/studies/[slug]/page.tsx`
- Delete: `app/builds/[slug]/page.tsx`

**Interfaces:**
- Consumes: `lessons` from `#velite` (Task 4), `findBySlug` (Task 3).
- Produces: the app's only content-detail route, `/lessons/[category]/[slug]`.

**Known intermediate state:** `app/layout.tsx` and `app/page.tsx` still reference the old `#velite` exports until Task 8 — `npm run build` will still fail after this task. Verification here is `npm test` (Vitest, unaffected by these TSX-only changes), matching the pattern used for the equivalent SearchOverlay task in the prior plan.

- [ ] **Step 1: Update components/MetaPanel.tsx (drop maturity/confidence — not in the new schema)**

```tsx
export function MetaPanel({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-neutral-800 px-2 py-1">
          #{tag}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Delete components/RelatedPanel.tsx**

```bash
git rm components/RelatedPanel.tsx
```

(The new content schema has no `related` field — the wikilink-based related-notes feature has no counterpart here. `lib/related.ts`, its only other consumer, is deleted in Task 9.)

- [ ] **Step 3: Create app/lessons/[category]/[slug]/page.tsx**

```tsx
import { notFound } from "next/navigation";
import { lessons } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";

export function generateStaticParams() {
  return lessons.map((l) => ({ category: l.category.slug, slug: l.slug }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const inCategory = lessons.filter((l) => l.category.slug === category);
  const lesson = findBySlug(inCategory, slug);
  if (!lesson) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{lesson.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={lesson.tags} />
      </div>
      <article className="prose prose-invert mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: lesson.html }} />
      {lesson.sources.length > 0 && (
        <div className="mt-8 border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-medium text-neutral-200">Sources</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-400">
            {lesson.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
```

The lookup filters by category slug first (`inCategory`), then finds the
slug within that subset — this is what keeps two lessons with the same
slug in different categories (e.g. both named `overview`) from
colliding, per this plan's Review Focus.

- [ ] **Step 4: Delete the four old detail routes**

```bash
git rm "app/concepts/[track]/[slug]/page.tsx" "app/cases/[slug]/page.tsx" "app/studies/[slug]/page.tsx" "app/builds/[slug]/page.tsx"
```

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: all Vitest suites pass. (This does not type-check the TSX files against the still-stale `app/layout.tsx`/`app/page.tsx` — that's expected and fixed in Task 8.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add lesson detail page, simplify MetaPanel, remove old per-collection routes"
```

---

### Task 8: Wire layout and rewrite landing page as a curriculum grid

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `lessons` from `#velite`, `buildNavTree` (Task 5), `buildContentIndex` (Task 6), `CATEGORIES` (Task 1), `NavShell` (existing, unchanged).

This is the task where every earlier task's pieces become consistent —
after this task, `npm run build` must succeed.

- [ ] **Step 1: Rewrite app/layout.tsx**

```tsx
import "./globals.css";
import { lessons } from "#velite";
import { buildNavTree } from "@/lib/nav-tree";
import { buildContentIndex } from "@/lib/search-index";
import { NavShell } from "@/components/NavShell";

export const metadata = {
  title: "architectlens",
  description: "System design, learned from first principles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tree = buildNavTree(lessons);
  const searchItems = buildContentIndex();

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <NavShell tree={tree} searchItems={searchItems}>
          {children}
        </NavShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Rewrite app/page.tsx as a curriculum grid**

```tsx
import Link from "next/link";
import { lessons } from "#velite";
import { CATEGORIES } from "@/lib/categories";

export default function HomePage() {
  const counts = new Map<number, number>();
  for (const lesson of lessons) {
    counts.set(lesson.category.number, (counts.get(lesson.category.number) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-neutral-100">architectlens</h1>
      <p className="mt-2 text-neutral-400">System design, learned from first principles.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((category) => {
          const count = counts.get(category.number) ?? 0;
          const label = `${String(category.number).padStart(2, "0")} ${category.name}`;

          if (count === 0) {
            return (
              <div key={category.number} className="rounded-lg border border-neutral-800 p-6 opacity-50">
                <h2 className="text-lg font-semibold text-neutral-100">{label}</h2>
                <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">{count} lessons</p>
              </div>
            );
          }

          const firstLesson = lessons
            .filter((l) => l.category.number === category.number)
            .sort((a, b) => a.order - b.order)[0];

          return (
            <Link
              key={category.number}
              href={`/lessons/${category.slug}/${firstLesson.slug}`}
              className="block rounded-lg border border-neutral-800 p-6 hover:border-neutral-600 transition-colors"
            >
              <h2 className="text-lg font-semibold text-neutral-100">{label}</h2>
              <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">{count} lessons</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds. Route list shows `/`, `/lessons/[category]/[slug]` — no more `/concepts`, `/cases`, `/studies`, `/builds` routes of any kind. Since every content folder is still empty, `generateStaticParams` for the lesson route returns `[]`, which is valid (no static lesson pages yet, landing page renders all 18 categories at 0 lessons each, non-clickable).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: wire layout to category-based nav tree, rewrite landing page as curriculum grid"
```

---

### Task 9: Remove dead vault/wikilink code and unused dependencies

**Files:**
- Delete: `lib/vault-path.ts`
- Delete: `lib/resolve-wikilink.ts`, `lib/resolve-wikilink.test.ts`
- Delete: `lib/remark-wikilinks.ts`
- Delete: `lib/vault-index.ts`, `lib/vault-index.test.ts`
- Delete: `lib/related.ts`, `lib/related.test.ts`
- Modify: `package.json` (remove `unist-util-visit`, `@types/mdast`)

**Interfaces:** none — this task only removes code nothing else references after Task 4-7 landed.

- [ ] **Step 1: Verify nothing still imports the files being deleted**

Run: `grep -rn "vault-path\|resolve-wikilink\|remark-wikilinks\|vault-index\|lib/related" app/ components/ lib/ velite.config.ts`
Expected: no matches (all references were removed when `velite.config.ts` was rewritten in Task 4 and `RelatedPanel`/the old concept page were deleted in Task 7).

- [ ] **Step 2: Delete the dead files**

```bash
git rm lib/vault-path.ts lib/resolve-wikilink.ts lib/resolve-wikilink.test.ts lib/remark-wikilinks.ts lib/vault-index.ts lib/vault-index.test.ts lib/related.ts lib/related.test.ts
```

- [ ] **Step 3: Remove now-unused dependencies from package.json**

Run: `npm uninstall unist-util-visit @types/mdast`

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all remaining Vitest suites pass (the deleted files' tests are gone, not failing).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds — removing `unist-util-visit`/`@types/mdast` doesn't affect anything still in use, since only the deleted `remark-wikilinks.ts` imported them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove vault/wikilink pipeline and its now-unused dependencies"
```

---

### Task 10: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all Vitest suites pass.

- [ ] **Step 2: Start the dev server and browse the app**

Use the `run` skill to launch `npm run dev`, then in a browser:
- Visit `/` — verify all 18 categories render as cards, each showing "0 lessons," and none are clickable (no `href`/not wrapped in a `Link`).
- Verify the sidebar shows all 18 categories in fixed numeric order (`01 Foundations` through `18 Engineering case studies`), each with a `0` count, and none have an expandable lesson list (since none have lessons yet).
- Verify the search overlay opens (cmd+k or the visible button) and returns no results for any query (nothing indexed yet) without erroring.
- Directly visit a plausible old URL (`/concepts/classical/rate-limiting`) — verify it 404s (the old vault-sourced content and routes are gone).

- [ ] **Step 3: Final commit if any fixes were made during verification**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
