# Sidebar Nav + Dark Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace architectlens's per-collection list pages with a persistent left sidebar (grouped tree nav) and apply a dark-mode-first technical visual theme across the whole app.

**Architecture:** A new pure `buildNavTree()` function builds the grouped sidebar structure; a client `NavShell` component owns the shared open/close state for the search overlay and renders `Sidebar` + `SearchOverlay` + page content together; the root layout computes the nav tree and search index server-side and passes them down as props (same pattern as the existing search-index fix from the last review). The four list pages are deleted since the sidebar replaces them; every component gets its Tailwind classes swapped from the light palette to a dark one.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-sidebar-nav-redesign-design.md`

## Global Constraints

- Dark theme only for v1 — no light/dark toggle (spec: Non-goals).
- No sidebar collapse-state persistence (localStorage) — local `useState` only (spec: Non-goals).
- No URL/route changes — existing detail-page routes are untouched (spec: Non-goals).
- Server computes data, client components only receive props — never import `#velite` directly inside a `"use client"` file (established in the prior review fix; the spec's Sidebar component section explicitly calls this out).

## Review Focus

- Studies/Builds groups have zero items today — the sidebar must omit them entirely, not render an empty/awkward section (spec: Sidebar data).
- Deleting the four list pages must not leave a dangling `<Link>` anywhere in the app (landing page) pointing at a route that now 404s (spec: Error handling).
- The search overlay must still work identically after being made a controlled component (open/onClose props) — cmd+k toggle and Escape-to-close must not regress during the refactor (spec: Sidebar component).
- Active-item highlighting must match the *current* route exactly, not partially (e.g. `/concepts/classical/load-balancing` should not also highlight `/concepts/classical/load-balancing-strategies` if such a slug existed) — use exact pathname equality, not `startsWith`.
- Concepts fixture data used in `nav-tree.test.ts` must include a real `order` field (not just `slug`/`title`/`track`), since `groupConceptsByTrack` sorts internally — omitting it would let a test pass while silently not exercising the sort path.

---

## File Structure

```
architectlens/
  lib/
    nav-tree.ts          (new — pure, tested)
    nav-tree.test.ts      (new)
  components/
    Sidebar.tsx           (rewritten)
    SearchOverlay.tsx      (modified — controlled component)
    NavShell.tsx           (new — client, owns shared open state)
  app/
    layout.tsx             (modified — renders NavShell)
    page.tsx                (rewritten — simplified landing page)
    globals.css              (modified — dark background)
    concepts/[track]/[slug]/page.tsx  (modified — prose-invert)
    cases/[slug]/page.tsx             (modified — prose-invert)
    studies/[slug]/page.tsx           (modified — prose-invert)
    builds/[slug]/page.tsx            (modified — prose-invert)
    concepts/page.tsx        (deleted)
    cases/page.tsx           (deleted)
    studies/page.tsx         (deleted)
    builds/page.tsx          (deleted)
```

---

### Task 1: Nav tree data (pure, tested)

**Files:**
- Create: `lib/nav-tree.ts`
- Test: `lib/nav-tree.test.ts`

**Interfaces:**
- Consumes: `groupConceptsByTrack`, `sortByOrder` from `lib/content.ts` (existing).
- Produces:
  - `type NavItem = { href: string; title: string }`
  - `type NavGroup = { heading: string; items: NavItem[] }`
  - `function buildNavTree(concepts, cases, studies, builds): NavGroup[]` — full parameter types below.
- Consumed by: `app/layout.tsx` (Task 5), which imports the real `concepts, cases, studies, builds` arrays from `#velite` and passes them in.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/nav-tree.test.ts
import { describe, expect, it } from "vitest";
import { buildNavTree } from "./nav-tree";

const concepts = [
  { slug: "load-balancing", title: "Load Balancing", track: "classical" as const, order: 2 },
  { slug: "rate-limiting", title: "Rate Limiting", track: "classical" as const, order: 7 },
  { slug: "prompt-routing", title: "Prompt Routing", track: "ai" as const, order: 2 },
];
const cases = [{ slug: "optimize-1m-queries-day", title: "Optimize 1M Queries/Day", order: 1 }];

describe("buildNavTree", () => {
  it("returns groups in fixed order (Classical, AI, Cases) when all have items", () => {
    const tree = buildNavTree(concepts, cases, [], []);
    expect(tree.map((g) => g.heading)).toEqual(["Classical", "AI", "Cases"]);
  });

  it("omits Studies and Builds entirely when they have zero items", () => {
    const tree = buildNavTree(concepts, cases, [], []);
    expect(tree.find((g) => g.heading === "Studies")).toBeUndefined();
    expect(tree.find((g) => g.heading === "Builds")).toBeUndefined();
  });

  it("includes Studies and Builds when they have items", () => {
    const studies = [{ slug: "design-twitter", title: "Design Twitter", order: 1 }];
    const builds = [{ slug: "rate-limiter", title: "Build a Rate Limiter", order: 1 }];
    const tree = buildNavTree(concepts, cases, studies, builds);
    expect(tree.map((g) => g.heading)).toEqual(["Classical", "AI", "Cases", "Studies", "Builds"]);
  });

  it("orders items within a group by their order field", () => {
    const tree = buildNavTree(concepts, [], [], []);
    const classical = tree.find((g) => g.heading === "Classical")!;
    expect(classical.items.map((i) => i.title)).toEqual(["Load Balancing", "Rate Limiting"]);
  });

  it("builds concept hrefs scoped by track", () => {
    const tree = buildNavTree(concepts, [], [], []);
    const ai = tree.find((g) => g.heading === "AI")!;
    expect(ai.items).toEqual([{ href: "/concepts/ai/prompt-routing", title: "Prompt Routing" }]);
  });

  it("builds case hrefs", () => {
    const tree = buildNavTree([], cases, [], []);
    const casesGroup = tree.find((g) => g.heading === "Cases")!;
    expect(casesGroup.items).toEqual([{ href: "/cases/optimize-1m-queries-day", title: "Optimize 1M Queries/Day" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/nav-tree.test.ts`
Expected: FAIL — `nav-tree.ts` does not exist yet.

- [ ] **Step 3: Implement lib/nav-tree.ts**

```ts
// lib/nav-tree.ts
import { groupConceptsByTrack, sortByOrder } from "./content";

export type NavItem = { href: string; title: string };
export type NavGroup = { heading: string; items: NavItem[] };

type ConceptLike = { slug: string; title: string; track: "classical" | "ai"; order: number };
type OrderedLike = { slug: string; title: string; order: number };

function toNavItems<T extends { title: string }>(items: T[], hrefOf: (item: T) => string): NavItem[] {
  return items.map((item) => ({ href: hrefOf(item), title: item.title }));
}

export function buildNavTree(
  concepts: ConceptLike[],
  cases: OrderedLike[],
  studies: OrderedLike[],
  builds: OrderedLike[]
): NavGroup[] {
  const grouped = groupConceptsByTrack(concepts);

  const groups: NavGroup[] = [
    { heading: "Classical", items: toNavItems(grouped.classical, (c) => `/concepts/classical/${c.slug}`) },
    { heading: "AI", items: toNavItems(grouped.ai, (c) => `/concepts/ai/${c.slug}`) },
    { heading: "Cases", items: toNavItems(sortByOrder(cases), (c) => `/cases/${c.slug}`) },
    { heading: "Studies", items: toNavItems(sortByOrder(studies), (s) => `/studies/${s.slug}`) },
    { heading: "Builds", items: toNavItems(sortByOrder(builds), (b) => `/builds/${b.slug}`) },
  ];

  return groups.filter((g) => g.items.length > 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/nav-tree.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/nav-tree.ts lib/nav-tree.test.ts
git commit -m "feat: add pure nav-tree builder with tests"
```

---

### Task 2: Sidebar component (grouped tree, active highlight, collapse)

**Files:**
- Modify: `components/Sidebar.tsx` (full rewrite)

**Interfaces:**
- Consumes: `NavGroup` type from `lib/nav-tree.ts` (Task 1).
- Produces: `Sidebar({ groups, onSearchClick }: { groups: NavGroup[]; onSearchClick: () => void })`.
- Consumed by: `NavShell` (Task 4).

- [ ] **Step 1: Replace components/Sidebar.tsx**

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
        <div key={group.heading} className="mb-6">
          <button
            type="button"
            onClick={() => toggle(group.heading)}
            className="mb-2 flex w-full items-center justify-between font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            {group.heading}
            <span>{collapsed[group.heading] ? "+" : "−"}</span>
          </button>
          {!collapsed[group.heading] && (
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

- [ ] **Step 2: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: rewrite Sidebar as grouped tree nav with active highlight"
```

(No automated test for this component — per spec's Testing section, pathname-highlighting and expand/collapse are trivial JSX with no branching worth pinning down. This task's build verification happens in Task 5 once it's wired into the layout, since it can't render standalone without a `NavGroup[]` and router context.)

---

### Task 3: Make SearchOverlay a controlled component

**Files:**
- Modify: `components/SearchOverlay.tsx`

**Interfaces:**
- Consumes: `ContentIndexItem` from `lib/search-index.ts` (existing).
- Produces: `SearchOverlay({ items, open, onClose }: { items: ContentIndexItem[]; open: boolean; onClose: () => void })` — replaces the previous `SearchOverlay({ items })` which owned its own open state and keydown listener.
- Consumed by: `NavShell` (Task 4), which now owns the open state and the keydown listener.

- [ ] **Step 1: Replace components/SearchOverlay.tsx**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { ContentIndexItem } from "@/lib/search-index";

export function SearchOverlay({
  items,
  open,
  onClose,
}: {
  items: ContentIndexItem[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const fuse = useMemo(() => new Fuse(items, { keys: ["title", "tags"], threshold: 0.35 }), [items]);
  const results = query.trim() ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-full max-w-lg rounded-lg bg-neutral-900 p-4 shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search architectlens..."
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none"
        />
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {results.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className="block rounded px-2 py-1 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SearchOverlay.tsx
git commit -m "refactor: make SearchOverlay a controlled component"
```

(No test — this is a straight prop-shape refactor of an already-working component; behavior is verified end-to-end in Task 7's manual check. Build verification happens in Task 5 once `NavShell` wires it in.)

---

### Task 4: NavShell (shared open state + keydown handling)

**Files:**
- Create: `components/NavShell.tsx`

**Interfaces:**
- Consumes: `Sidebar` (Task 2), `SearchOverlay` (Task 3), `NavGroup` (Task 1), `ContentIndexItem` (existing `lib/search-index.ts`).
- Produces: `NavShell({ tree, searchItems, children }: { tree: NavGroup[]; searchItems: ContentIndexItem[]; children: React.ReactNode })`.
- Consumed by: `app/layout.tsx` (Task 5).

- [ ] **Step 1: Create components/NavShell.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { NavGroup } from "@/lib/nav-tree";
import type { ContentIndexItem } from "@/lib/search-index";
import { Sidebar } from "./Sidebar";
import { SearchOverlay } from "./SearchOverlay";

export function NavShell({
  tree,
  searchItems,
  children,
}: {
  tree: NavGroup[];
  searchItems: ContentIndexItem[];
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar groups={tree} onSearchClick={() => setSearchOpen(true)} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <SearchOverlay items={searchItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/NavShell.tsx
git commit -m "feat: add NavShell to own shared sidebar/search state"
```

(Build verification happens in Task 5, once `app/layout.tsx` actually renders this component — it can't compile standalone without a real `NavGroup[]`/`ContentIndexItem[]` shape flowing through the tree.)

---

### Task 5: Wire NavShell into the root layout + dark theme pass

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/MetaPanel.tsx`
- Modify: `components/RelatedPanel.tsx`
- Modify: `components/EmptyState.tsx`
- Modify: `components/SectionCard.tsx`
- Modify: `app/concepts/[track]/[slug]/page.tsx`
- Modify: `app/cases/[slug]/page.tsx`
- Modify: `app/studies/[slug]/page.tsx`
- Modify: `app/builds/[slug]/page.tsx`

**Interfaces:**
- Consumes: `NavShell` (Task 4), `buildNavTree` (Task 1), `buildContentIndex` (existing `lib/search-index.ts`), `concepts, cases, studies, builds` from `#velite`.

- [ ] **Step 1: Rewrite app/layout.tsx**

```tsx
import "./globals.css";
import { concepts, cases, studies, builds } from "#velite";
import { buildNavTree } from "@/lib/nav-tree";
import { buildContentIndex } from "@/lib/search-index";
import { NavShell } from "@/components/NavShell";

export const metadata = {
  title: "architectlens",
  description: "System design concepts, cases, studies, and builds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tree = buildNavTree(concepts, cases, studies, builds);
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

- [ ] **Step 2: Verify globals.css already has the typography plugin (no change needed if present)**

Run: `grep -n "@plugin" app/globals.css`
Expected: prints `@plugin "@tailwindcss/typography";` — this was added in the previous review's fix pass and stays as-is.

- [ ] **Step 3: Update components/MetaPanel.tsx for dark backgrounds**

```tsx
export function MetaPanel({
  tags,
  maturity,
  confidence,
}: {
  tags: string[];
  maturity?: string;
  confidence?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
      {maturity && <span className="rounded bg-neutral-800 px-2 py-1">{maturity}</span>}
      {confidence && <span className="rounded bg-neutral-800 px-2 py-1">confidence: {confidence}</span>}
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-neutral-800 px-2 py-1">
          #{tag}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Update components/RelatedPanel.tsx for dark backgrounds**

```tsx
import Link from "next/link";

export function RelatedPanel({ items }: { items: { href: string; title: string }[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="mt-8 border-t border-neutral-800 pt-4">
      <h3 className="text-sm font-medium text-neutral-200">Related</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm text-cyan-400 hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 5: Update components/EmptyState.tsx for dark backgrounds**

```tsx
export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-700 p-12 text-center">
      <h2 className="text-base font-medium text-neutral-200">{title}</h2>
      <p className="mt-2 text-sm text-neutral-400">{message}</p>
    </div>
  );
}
```

- [ ] **Step 6: Update components/SectionCard.tsx for dark backgrounds**

```tsx
import Link from "next/link";

export function SectionCard({
  href,
  title,
  count,
  description,
}: {
  href: string;
  title: string;
  count: number;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-800 p-6 hover:border-neutral-600 transition-colors"
    >
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <p className="mt-1 text-sm text-neutral-400">{description}</p>
      <p className="mt-4 text-xs uppercase tracking-wide text-neutral-500">{count} notes</p>
    </Link>
  );
}
```

- [ ] **Step 7: Switch `prose` to `prose prose-invert` in all four detail pages**

In each of these four files, change:
```tsx
<article className="prose mt-8 max-w-none" dangerouslySetInnerHTML=...
```
to:
```tsx
<article className="prose prose-invert mt-8 max-w-none" dangerouslySetInnerHTML=...
```
Files: `app/concepts/[track]/[slug]/page.tsx`, `app/cases/[slug]/page.tsx`, `app/studies/[slug]/page.tsx`, `app/builds/[slug]/page.tsx` (all four have the identical line; this is one string replacement per file).

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds, no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add app/layout.tsx components/MetaPanel.tsx components/RelatedPanel.tsx components/EmptyState.tsx components/SectionCard.tsx "app/concepts/[track]/[slug]/page.tsx" "app/cases/[slug]/page.tsx" "app/studies/[slug]/page.tsx" "app/builds/[slug]/page.tsx"
git commit -m "feat: wire NavShell into root layout and apply dark theme"
```

---

### Task 6: Delete list pages, simplify landing page

**Files:**
- Delete: `app/concepts/page.tsx`
- Delete: `app/cases/page.tsx`
- Delete: `app/studies/page.tsx`
- Delete: `app/builds/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `concepts, cases, studies, builds` from `#velite` (for stats only, no listing).

- [ ] **Step 1: Delete the four list pages**

```bash
git rm "app/concepts/page.tsx" "app/cases/page.tsx" "app/studies/page.tsx" "app/builds/page.tsx"
```

- [ ] **Step 2: Verify nothing else links to the deleted routes**

Run: `grep -rn 'href="/concepts"' app/ components/; grep -rn 'href="/cases"' app/ components/; grep -rn 'href="/studies"' app/ components/; grep -rn 'href="/builds"' app/ components/`
Expected: only matches inside `app/page.tsx` (the landing page, about to be rewritten in the next step) — no other file references these routes.

- [ ] **Step 3: Rewrite app/page.tsx as a simple intro**

```tsx
import { concepts, cases, studies, builds } from "#velite";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-neutral-100">architectlens</h1>
      <p className="mt-2 text-neutral-400">
        System design concepts, cases, studies, and builds — browse via the sidebar.
      </p>
      <dl className="mt-10 grid grid-cols-2 gap-4 text-sm text-neutral-400">
        <div>
          <dt className="text-neutral-500">Concepts</dt>
          <dd className="text-xl text-neutral-100">{concepts.length}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Cases</dt>
          <dd className="text-xl text-neutral-100">{cases.length}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Studies</dt>
          <dd className="text-xl text-neutral-100">{studies.length}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Builds</dt>
          <dd className="text-xl text-neutral-100">{builds.length}</dd>
        </div>
      </dl>
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds. The route list should show `/`, `/concepts/[track]/[slug]`, `/cases/[slug]`, `/studies/[slug]`, `/builds/[slug]` — no more `/concepts`, `/cases`, `/studies`, `/builds` list routes.

- [ ] **Step 5: Verify SectionCard is now unused and decide whether to remove it**

Run: `grep -rn "SectionCard" app/ components/`
Expected: no remaining imports of `SectionCard` outside its own file, since the landing page no longer uses it. Delete `components/SectionCard.tsx` in this step (`git rm components/SectionCard.tsx`) — it has no other caller and keeping unused code around violates YAGNI.

- [ ] **Step 6: Re-verify build after removing SectionCard**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: delete list pages, simplify landing page, remove now-unused SectionCard"
```

---

### Task 7: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all Vitest suites pass, including the new `lib/nav-tree.test.ts`.

- [ ] **Step 2: Start the dev server and browse the app**

Use the `run` skill to launch `npm run dev`, then in a browser:
- Visit `/` — verify dark background, stats-only landing page, no broken links.
- Verify the sidebar is visible on every page (not just `/`) and shows Classical, AI, and Cases groups (Studies/Builds omitted since they're empty).
- Click a Classical concept, then an AI concept, then a Case — verify the sidebar stays visible, the clicked item highlights as active, and content renders with dark-themed prose (`prose-invert`).
- Click a group heading to collapse it, then expand it again.
- Click the visible "Search..." button in the sidebar — verify the overlay opens (not just cmd+k).
- Type a known title into search, click a result — verify it navigates and the overlay closes.
- Manually visit `/concepts`, `/cases`, `/studies`, `/builds` in the URL bar — verify these now 404 (expected, since the pages were deleted and nothing should link to them).

- [ ] **Step 3: Final commit if any fixes were made during verification**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
