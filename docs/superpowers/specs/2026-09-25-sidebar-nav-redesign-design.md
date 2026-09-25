# Sidebar navigation + dark theme redesign — design spec

Date: 2026-09-25

## Purpose

Replace architectlens's current per-collection list pages with a single
persistent left sidebar (grouped tree: Concepts → Classical/AI, Cases,
Studies, Builds) so every note is one click away from anywhere in the
app, and apply a dark-mode-first technical visual theme across the
whole app. This is a UI/navigation restructure only — it does not
touch content (frontmatter, markdown, the vault) or the wikilink
resolver/Velite pipeline built previously. Content quality (rewriting
notes instead of rendering the vault as-is, pulling from external
sources like Alex Xu's System Design Interview books) is explicitly
out of scope here — it's a separate content-ops track.

## Non-goals

- No content rewriting or new note authoring (separate track).
- No light/dark theme toggle — dark is the only theme for v1.
- No persisted sidebar collapse state (localStorage) — local `useState`
  only; revisit if it's annoying in practice.
- No new routes or URL scheme changes — existing detail-page routes
  (`/concepts/[track]/[slug]`, `/cases/[slug]`, `/studies/[slug]`,
  `/builds/[slug]`) are unchanged.

## Architecture

The sidebar moves into the root layout (`app/layout.tsx`) so it
persists across every route without changing how routing works —
Next's App Router already wraps every page in the root layout. Detail
pages are untouched. The four list pages
(`app/concepts/page.tsx`, `app/cases/page.tsx`, `app/studies/page.tsx`,
`app/builds/page.tsx`) are deleted, since the sidebar now does their
job. The landing page (`/`) is simplified to a short welcome + content
stats — no links to the now-deleted list routes, since linking to
something the sidebar already surfaces directly would be redundant and
the old destinations are gone.

## Sidebar data

`lib/nav-tree.ts` (new, pure, unit-tested) builds the grouped structure
server-side, reusing `groupConceptsByTrack` and `sortByOrder` from
`lib/content.ts`:

```ts
type NavGroup = { heading: string; items: { href: string; title: string }[] };
type NavTree = NavGroup[]; // one entry per non-empty section
```

Groups, in order: "Classical" (concepts, track=classical), "AI"
(concepts, track=ai), "Cases", "Studies", "Builds". A group is omitted
entirely from the tree when it has zero items — today that's Studies
and Builds. When the content-ops track adds notes to those
collections, they'll appear automatically on the next build with no
code change.

## Sidebar component

`components/Sidebar.tsx` (client component — needs `usePathname` for
active-item highlighting and local expand/collapse state) receives the
`NavTree` as a prop computed server-side in `app/layout.tsx` (same
server-computes/client-receives pattern already used for
`SearchOverlay`, which avoided a client-bundle-size regression last
time — same discipline applies here: the tree is a few KB of
`{href,title}` pairs, not full document content).

- Each group renders a heading (click to expand/collapse, default
  expanded) and its item list.
- The active item (matching current pathname) gets a distinct
  highlight style.
- A visible "Search" button sits above the groups and opens the
  existing `SearchOverlay` (reuses its existing open-state mechanism;
  the cmd+k shortcut keeps working, this just adds a discoverable
  click target — the earlier build's search was cmd+k-only with no
  visible entry point, which was flagged and deferred at the time).

## Visual theme

Dark theme only, no toggle. Tailwind v4 CSS variables in
`app/globals.css`:

- Background: near-black (`neutral-950`-range), with the sidebar and
  main content panes using subtly distinct tones so the eye tracks
  which pane it's in.
- Text: high-contrast light gray/white, not pure white (reduces glare
  on long-form reading).
- Accent: a single desaturated blue/cyan for links, active nav items,
  and focus states — technical, not flashy.
- Typography: system sans-serif for body prose (long-form readability
  wins over thematic purity here); a monospace stack for nav labels,
  headings, and tags (carries the "technical" feel without hurting
  prose readability); code blocks already monospaced via
  `@tailwindcss/typography`, themed with `prose-invert` for dark
  backgrounds.

## Error handling

- Empty nav groups: omitted from the tree (see Sidebar data above) —
  no empty-section UI needed in the sidebar itself.
- Landing page: no broken links, since it no longer links to the
  deleted list routes.
- Deleting the four list pages: nothing else in the app links to them
  after the landing page is simplified — verified by grep before
  deletion, not just assumed.

## Testing

`lib/nav-tree.ts` gets unit tests (Vitest, same style as
`lib/content.test.ts`):

- Groups appear in the fixed order (Classical, AI, Cases, Studies,
  Builds) when all have items.
- A group with zero items is omitted from the result entirely.
- Items within a group are ordered via `sortByOrder` (regression
  coverage, not new logic — `sortByOrder` itself is already tested).

No test needed for `Sidebar.tsx`'s pathname-highlighting or
expand/collapse — trivial JSX with no branching logic worth pinning
down; visual correctness gets checked manually via the `run` skill
after implementation, the same way Task 12 verified the previous
build.
