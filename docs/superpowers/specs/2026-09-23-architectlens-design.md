# architectlens — design spec

Date: 2026-09-23

## Purpose

Web viewer for Rushikesh's system-design vault content, modeled on
fanout.sh's structure (Concepts / Cases / Builds + roadmap). Reads
markdown directly from the existing Obsidian vault
(`C:\Users\rushi\llm-wiki-memory\learning\systems-design`) — the vault
stays the single source of truth; the app never copies or duplicates
content into its own repo.

Content completeness (auditing against Alex Xu's System Design
Interview Vol 1/2, DDIA, and filling gaps) is a separate, ongoing
content-ops track run through the vault's own `/ingest` and
`/curriculum` skills. This spec covers the app only. The schema below
reserves two collections (`studies`, `builds`) that start empty and
fill in over time without requiring app changes.

## Non-goals

- No CMS/database — content is files.
- No auth, no multi-user editing.
- No server-side full-text search — dataset is small (~100 docs today).
- No e2e test suite for v1.

## Architecture

- Next.js 15 (App Router), TypeScript, Tailwind CSS.
- Velite for typed content collections, reading directly from the
  vault path via a relative/absolute glob root — no content copy step.
- Static export where possible; ISR fallback if vault content changes
  need to reflect without a full rebuild (decide at implementation
  time based on how often vault content updates during a session).

## Content collections (Velite)

All four collections share this shape:

| field | source | notes |
|---|---|---|
| `title` | frontmatter `title` | required |
| `slug` | filename | kebab, prefix number stripped |
| `order` | filename prefix | e.g. `07-rate-limiting.md` → `7`; missing prefix → `Infinity` (sorts last) |
| `track` | folder name | `concepts` only: `classical` \| `ai` |
| `tags` | frontmatter `tags` | array, may be empty |
| `maturity` | frontmatter `maturity` | optional |
| `confidence` | frontmatter `confidence` | optional |
| `related` | frontmatter `related` | array of vault wikilink strings, resolved to internal routes at build time |
| `body` | markdown body | rendered to HTML via remark/rehype pipeline |

Collection definitions:

1. **concepts** — glob `learning/systems-design/{classical,ai}/*.md`,
   excluding `index.md` and anything under `interview/`.
2. **cases** — glob
   `learning/systems-design/ai/interview/scenarios/*.md`.
3. **studies** — glob `learning/systems-design/studies/*.md` (new
   folder, created empty as part of this build). Full end-to-end HLD
   walkthroughs (e.g. "design Twitter"), filled in by the content-ops
   track.
4. **builds** — glob `learning/systems-design/builds/*.md` (new
   folder, created empty). Hands-on implementation write-ups, filled
   in by the content-ops track.

Empty `studies`/`builds` folders need a `.gitkeep` in the vault (vault
is a separate directory outside this repo — creating these folders is
part of this project's setup since the app depends on them existing).

## Wikilink resolution

Vault `related` frontmatter and in-body links use Obsidian wikilink
syntax: `[[learning/systems-design/classical/02-load-balancing]]`.

A remark plugin resolves each wikilink to an internal route by:
1. Stripping the `learning/systems-design/` prefix.
2. Splitting into `{collection-folder}/{slug}`.
3. Looking up the target in the Velite-generated index at build time.
4. If found → internal `<a href="/concepts/classical/load-balancing">`.
5. If not found → render as plain text (no link), add a
   `data-broken-link` attribute for styling, and emit a build-time
   `console.warn` with the source file and target. Build does not fail.

## Pages

- `/` — landing: hero, tagline, four section cards (Concepts, Cases,
  Studies, Builds) each showing doc count, global search entry point.
- `/concepts` — sidebar grouped by track (Classical, AI), ordered by
  `order`; main pane shows track overview.
- `/concepts/[track]/[slug]` — rendered note, frontmatter meta panel
  (tags, maturity, confidence), related-notes panel (resolved links).
- `/cases`, `/cases/[slug]` — same shape as concepts, single list (no
  track split).
- `/studies`, `/studies/[slug]` — same shape; `/studies` renders a
  "coming soon" empty state while the collection is empty.
- `/builds`, `/builds/[slug]` — same shape; same empty state.
- Global search: cmd+k overlay, client-side `fuse.js` over the full
  Velite index (title, tags, body excerpt) across all four collections.

## Error handling

- Broken wikilink → plain text + badge + build warning (above).
- Empty collection → dedicated empty-state component, not an empty
  `<ul>`.
- Malformed frontmatter (fails Velite schema) → build fails loudly;
  this is a real vault data-quality bug, not something to paper over.

## Testing

Per YAGNI: only the wikilink resolver has real branching logic worth a
test. One Vitest suite covering:
- valid wikilink → resolved route,
- wikilink to nonexistent target → plain text + warning,
- relative-path variant wikilinks.

No e2e framework for v1. Manual verification via the `run` skill
(launch dev server, browse each page type) after implementation.

## Open items deferred to content-ops track

- Gap analysis vs Alex Xu Vol 1/2 and DDIA to find missing classical
  concepts.
- Writing `studies/` HLD case-study notes.
- Writing `builds/` hands-on implementation notes.
- Roadmap page content (ordering/grouping recommendation across all
  four collections) — page shell is in this spec, curated ordering
  logic is not.
