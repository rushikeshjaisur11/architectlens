# Original content + fanout-style taxonomy — design spec

Date: 2026-09-25

## Purpose

Replace vault-sourced content entirely with original, researched
system-design lessons authored directly for this app, organized under
the same category taxonomy fanout.sh uses for its System Design course
(category *names* are generic system-design domain terms, not
proprietary — no fanout branding, copy, pricing, sign-in, progress
tracking, or "Pro" gating is reproduced). Content lives inside this
repo at `content/system-design/`, not in the external
`llm-wiki-memory` vault. The vault-reading pipeline (Velite pointed at
an external root, the Obsidian-wikilink resolver, the four
classical/ai/cases/studies/builds collections) is retired along with
it — new content is authored with plain Markdown links, since both
sides of every link are now under this repo's control.

## Non-goals

- Not reproducing fanout's UI chrome that depends on a paid-course
  product model: sign-in, pricing, "Pro" lesson locks, per-user
  progress tracking, live-viewer count. Only the structural pattern
  (numbered categories, lesson counts, curriculum-grid landing,
  breadcrumb nav) is adopted.
- Not writing all 18 categories to full depth in this pass — 1-2
  in-depth lessons per category first (~20-30 lessons total), broad
  coverage before depth, so the shape can be reviewed before going
  deeper on any one category.
- Not keeping the old vault-sourced content live alongside the new
  content — this is a replacement, not an addition. The old Velite
  collections, the wikilink resolver, and their tests are removed.
- No plagiarism: lessons are original synthesis informed by public
  sources (Alex Xu's *System Design Interview* Vol 1/2, *Designing
  Data-Intensive Applications*, official docs, engineering blogs),
  never close-paraphrased or copied. Sources are cited per lesson.

## Taxonomy

18 categories, numbered, matching fanout's category names (generic
domain terms):

1. Foundations
2. APIs, services and protocols
3. Data modeling and SQL
4. NoSQL, partitioning and IDs
5. Caching and fast reads
6. Distributed coordination
7. Storage engines
8. Async work and streams
9. Search and retrieval
10. Analytics and sketches
11. Realtime, social and feeds
12. Geo, matching and recs
13. Media, files and CDN
14. Reliability and operations
15. Service and data designs
16. Product designs
17. Media and operations designs
18. Engineering case studies

## Content structure

```
content/system-design/
  01-foundations/
    01-<lesson-slug>.md
    02-<lesson-slug>.md
  02-apis-services-protocols/
    01-<lesson-slug>.md
  ...
  18-engineering-case-studies/
    01-<lesson-slug>.md
```

Each lesson is plain Markdown with frontmatter:

```yaml
---
title: "Full lesson title"
short_title: "Short sidebar title"
tags: [tag1, tag2]
sources:
  - "https://..."
  - "Alex Xu, System Design Interview Vol 1, Ch 3"
---
```

`short_title` is the field requested for sidebar/nav display. Every
new lesson is authored with both fields, but the schema still falls
back to `title` when `short_title` is missing — computed in
`.transform()` as `shortTitle: data.short_title ?? data.title`, since
Zod's `.default()` can't reference a sibling field's value.

## Velite pipeline changes

- `root` in `velite.config.ts` changes from
  `VAULT_SYSTEMS_DESIGN_ROOT` to a new local path constant pointing at
  `content/system-design/` inside this repo.
- Single collection, `lessons`, replaces the four old collections
  (`concepts`, `cases`, `studies`, `builds`). Pattern:
  `*/*.md` (category-folder / lesson-file).
- Schema fields: `title`, `short_title` (defaults to `title` via
  `.default()` reading the raw title when absent — actually: since
  Zod defaults can't reference sibling fields, this is computed in
  `.transform()` instead: `shortTitle: data.short_title ?? data.title`),
  `tags`, `sources` (array of strings, default `[]`), `category`
  (parsed from the folder name, e.g. `01-foundations` →
  `{ number: 1, slug: "foundations", name: "Foundations" }`), `order`
  (parsed from the filename prefix, same `lib/order.ts` logic as
  before), `slug` (filename-derived, same `lib/slug.ts` logic as
  before), `html` (rendered via `s.markdown()` with **no** wikilink
  remark plugin — new content uses standard Markdown links directly).
- **Removed**: `lib/resolve-wikilink.ts`, `lib/remark-wikilinks.ts`,
  `lib/vault-index.ts`, `lib/vault-path.ts`, `lib/related.ts`, and
  their test files. These existed solely to resolve Obsidian
  `[[wikilinks]]` against the external vault; new content has no
  wikilinks. `lib/order.ts` and `lib/slug.ts` are kept (still needed,
  now operating on the new content tree instead of the vault).

## Category display name mapping

The folder name (`01-foundations`) round-trips to a display name
(`Foundations`) via a small static lookup table (18 entries,
`{ number, slug, name }`), not derived by string-transforming the
slug — "APIs, services and protocols" and "NoSQL, partitioning and
IDs" have capitalization/punctuation a slug can't reconstruct
losslessly. This table is the single source of truth for category
names and numbers, used by both the content schema and the sidebar.

## Sidebar

Replaces the current Classical/AI/Cases/Studies/Builds grouping with
the 18-category tree, in fixed numeric order, each group labeled with
its number and lesson count (`01 Foundations — 2 lessons`), matching
fanout's pattern. Unlike the old taxonomy (where omitting an
incidentally-empty group like Studies/Builds made sense because most
groups had content), **all 18 categories are always shown**, including
ones with zero lessons (`06 Distributed Coordination — 0 lessons`,
not clickable). This taxonomy is a fixed, predefined curriculum
structure that content gets authored into over time — hiding empty
categories would hide most of the app immediately after this pipeline
ships, before any lesson exists. A category becomes clickable once it
has at least one lesson.

## Landing page

Replaces the current stats-only intro with a curriculum-grid: one
card per category, numbered, showing lesson count, linking to the
category's first lesson. All 18 cards always render (same reasoning
as the sidebar); a category with zero lessons renders as a
non-clickable card so the full curriculum shape is visible from day
one.

## Testing

- `lib/order.ts`, `lib/slug.ts`: existing tests carry over unchanged
  (pure functions, content-source-agnostic).
- New: category-lookup table test (number/slug/name round-trip,
  unknown folder name handling).
- New: nav-tree rebuilt around categories — fixed numeric order, all
  18 categories always present (including zero-lesson ones, per the
  Sidebar section above), per-category ordering by `order` field.
- Removed: `lib/resolve-wikilink.test.ts`, `lib/vault-index.test.ts`,
  `lib/related.test.ts` (their subjects are removed).

## Open questions (resolved inline, not deferred)

- **Does a category need its own index/landing page, or does clicking
  a category card jump straight to lesson 1?** Jump straight to lesson
  1 — simplest thing that works, matches "1-2 lessons per category"
  scale where a separate index page would be nearly empty. Revisit if
  categories grow enough that a real index becomes useful.
