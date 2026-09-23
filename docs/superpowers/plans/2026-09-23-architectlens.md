# architectlens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js viewer for the system-design vault content (Concepts, Cases, Studies, Builds), reading markdown directly from the vault with no content duplication.

**Architecture:** Next.js 15 App Router + TypeScript + Tailwind, with Velite generating typed content collections straight from `C:\Users\rushi\llm-wiki-memory\learning\systems-design`. A pure resolver function turns Obsidian wikilinks into internal routes at build time; broken/empty states degrade gracefully instead of crashing.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Velite, Vitest, fuse.js.

**Spec:** `docs/superpowers/specs/2026-09-23-architectlens-design.md`

## Global Constraints

- Vault path is read directly, never copied: `../llm-wiki-memory/learning/systems-design` relative to this repo.
- No CMS/database, no auth, no server-side search (spec: Non-goals).
- No e2e test suite for v1; manual check via `run` skill only (spec: Testing).
- Package manager: npm. Node 20+.
- TypeScript strict mode on.
- Malformed frontmatter that fails the Velite schema must fail the build loudly (spec: Error handling) — never silently coerced.

## Review Focus

- Markdown file with no numeric filename prefix (`system-design-roadmap.md`, `designing-data-intensive-applications.md`) — must sort last, not crash the sort or get silently dropped.
- Wikilink pointing at `index.md` or a genuinely nonexistent target — resolver must return `null`, never throw, and the caller must render plain text, not a dead link.
- Empty `studies`/`builds` collections — list pages must render the empty state, not `.map` over `undefined` or an array with `undefined` entries.
- Frontmatter missing `tags` or `related` entirely — schema must default to `[]`, not `undefined`, so render code doesn't need defensive null checks.
- Same numeric prefix reused in both `classical/` and `ai/` (e.g. two different `07-*.md` files) — slugs must stay unique per-track since routes are `/concepts/[track]/[slug]`, not globally unique.

---

## File Structure

```
architectlens/
  velite.config.ts
  lib/
    vault-path.ts
    resolve-wikilink.ts
    resolve-wikilink.test.ts
    remark-wikilinks.ts
    content.ts
    content.test.ts
  components/
    SectionCard.tsx
    EmptyState.tsx
    MetaPanel.tsx
    RelatedPanel.tsx
    Sidebar.tsx
    SearchOverlay.tsx
  app/
    layout.tsx
    page.tsx
    concepts/page.tsx
    concepts/[track]/[slug]/page.tsx
    cases/page.tsx
    cases/[slug]/page.tsx
    studies/page.tsx
    studies/[slug]/page.tsx
    builds/page.tsx
    builds/[slug]/page.tsx
```

`lib/resolve-wikilink.ts` and `lib/content.ts` are the only files with
branching logic worth unit-testing — everything else is composition
(config, JSX, routing).

---

### Task 1: Scaffold Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Produces: a running `npm run dev` / `npm run build` Next.js app that later tasks add routes and components to.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "architectlens",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install next@15 react@19 react-dom@19 typescript @types/react @types/node velite fuse.js`
Run: `npm install -D tailwindcss postcss autoprefixer vitest`

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "#velite": [".velite"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".velite/**/*.d.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create tailwind.config.ts and postcss.config.mjs**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
} satisfies Config;
```

```js
// postcss.config.mjs
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Create next.config.mjs**

```js
import { withVelite } from "velite/next";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withVelite(nextConfig);
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
.next/
.velite/
```

- [ ] **Step 7: Create app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create app/layout.tsx**

```tsx
import "./globals.css";

export const metadata = {
  title: "architectlens",
  description: "System design concepts, cases, studies, and builds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create app/page.tsx (placeholder, replaced in Task 7)**

```tsx
export default function HomePage() {
  return <main className="p-8">architectlens</main>;
}
```

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json tailwind.config.ts postcss.config.mjs next.config.mjs .gitignore app
git commit -m "chore: scaffold Next.js app"
```

---

### Task 2: Vault path constant and new content folders

**Files:**
- Create: `lib/vault-path.ts`
- Create (in vault, outside this repo): `C:\Users\rushi\llm-wiki-memory\learning\systems-design\studies\.gitkeep`
- Create (in vault): `C:\Users\rushi\llm-wiki-memory\learning\systems-design\builds\.gitkeep`

**Interfaces:**
- Produces: `VAULT_SYSTEMS_DESIGN_ROOT: string` (absolute path), imported by `velite.config.ts` in Task 4.

- [ ] **Step 1: Create the two new vault folders**

Run: `mkdir -p /c/Users/rushi/llm-wiki-memory/learning/systems-design/studies /c/Users/rushi/llm-wiki-memory/learning/systems-design/builds`
Run: `touch /c/Users/rushi/llm-wiki-memory/learning/systems-design/studies/.gitkeep /c/Users/rushi/llm-wiki-memory/learning/systems-design/builds/.gitkeep`

- [ ] **Step 2: Create lib/vault-path.ts**

```ts
import path from "node:path";

export const VAULT_SYSTEMS_DESIGN_ROOT = path.resolve(
  process.cwd(),
  "..",
  "llm-wiki-memory",
  "learning",
  "systems-design"
);
```

- [ ] **Step 3: Verify the path resolves**

Run: `node -e "console.log(require('path').resolve(process.cwd(), '..', 'llm-wiki-memory', 'learning', 'systems-design'))"`
Expected: prints `C:\Users\rushi\llm-wiki-memory\learning\systems-design` (or POSIX equivalent), and the printed folder exists.

- [ ] **Step 4: Commit**

```bash
git add lib/vault-path.ts
git commit -m "chore: add vault path constant and new content folders"
```

(The `.gitkeep` files live in the vault, a separate git repo — commit them there separately if the vault tracks git; skip if it doesn't.)

---

### Task 3: Wikilink resolver (pure logic + tests)

**Files:**
- Create: `lib/resolve-wikilink.ts`
- Test: `lib/resolve-wikilink.test.ts`

**Interfaces:**
- Produces:
  - `type ResolvedTarget = { collection: "concepts"; track: "classical" | "ai"; slug: string } | { collection: "cases" | "studies" | "builds"; slug: string }`
  - `function parseWikilinkTarget(raw: string, currentVaultRelativePath: string): ResolvedTarget | null`
  - `function targetToHref(target: ResolvedTarget): string`
- Consumed by: `lib/remark-wikilinks.ts` in Task 4.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/resolve-wikilink.test.ts
import { describe, expect, it } from "vitest";
import { parseWikilinkTarget, targetToHref } from "./resolve-wikilink";

describe("parseWikilinkTarget", () => {
  it("resolves an absolute classical concept link", () => {
    const target = parseWikilinkTarget(
      "[[learning/systems-design/classical/02-load-balancing]]",
      "classical/07-rate-limiting.md"
    );
    expect(target).toEqual({ collection: "concepts", track: "classical", slug: "load-balancing" });
  });

  it("resolves an absolute case-scenario link", () => {
    const target = parseWikilinkTarget(
      "[[learning/systems-design/ai/interview/scenarios/01-optimize-1m-queries-day]]",
      "classical/07-rate-limiting.md"
    );
    expect(target).toEqual({ collection: "cases", slug: "optimize-1m-queries-day" });
  });

  it("resolves a relative link within the same folder", () => {
    const target = parseWikilinkTarget("[[08-consistent-hashing]]", "classical/07-rate-limiting.md");
    expect(target).toEqual({ collection: "concepts", track: "classical", slug: "consistent-hashing" });
  });

  it("returns null for a link to index.md", () => {
    const target = parseWikilinkTarget("[[learning/systems-design/classical/index]]", "classical/07-rate-limiting.md");
    expect(target).toBeNull();
  });

  it("returns null for an unrecognized path", () => {
    const target = parseWikilinkTarget("[[learning/systems-design/nope/whatever]]", "classical/07-rate-limiting.md");
    expect(target).toBeNull();
  });

  it("strips an alias after a pipe", () => {
    const target = parseWikilinkTarget(
      "[[learning/systems-design/classical/02-load-balancing|Load Balancing]]",
      "classical/07-rate-limiting.md"
    );
    expect(target).toEqual({ collection: "concepts", track: "classical", slug: "load-balancing" });
  });
});

describe("targetToHref", () => {
  it("builds a track-scoped concepts href", () => {
    expect(targetToHref({ collection: "concepts", track: "classical", slug: "load-balancing" })).toBe(
      "/concepts/classical/load-balancing"
    );
  });

  it("builds a cases href", () => {
    expect(targetToHref({ collection: "cases", slug: "optimize-1m-queries-day" })).toBe(
      "/cases/optimize-1m-queries-day"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/resolve-wikilink.test.ts`
Expected: FAIL — `resolve-wikilink.ts` does not exist yet.

- [ ] **Step 3: Implement lib/resolve-wikilink.ts**

```ts
// lib/resolve-wikilink.ts
export type ResolvedTarget =
  | { collection: "concepts"; track: "classical" | "ai"; slug: string }
  | { collection: "cases" | "studies" | "builds"; slug: string };

const PREFIX = "learning/systems-design/";

function stripNumericPrefix(filename: string): string {
  return filename.replace(/^\d+-/, "").replace(/\.md$/, "");
}

function dirname(vaultRelativePath: string): string {
  const parts = vaultRelativePath.split("/");
  return parts.slice(0, -1).join("/");
}

function fromParts(parts: string[]): ResolvedTarget | null {
  const [first, second, third, fourth] = parts;

  if (first === "classical" || first === "ai") {
    if (first === "ai" && second === "interview" && third === "scenarios") {
      if (!fourth || fourth === "index") return null;
      return { collection: "cases", slug: stripNumericPrefix(fourth) };
    }
    if (!second || second === "index") return null;
    return { collection: "concepts", track: first, slug: stripNumericPrefix(second) };
  }

  if (first === "studies" || first === "builds") {
    if (!second || second === "index") return null;
    return { collection: first, slug: stripNumericPrefix(second) };
  }

  return null;
}

export function parseWikilinkTarget(raw: string, currentVaultRelativePath: string): ResolvedTarget | null {
  const cleaned = raw.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
  if (!cleaned) return null;

  const rest = cleaned.startsWith(PREFIX)
    ? cleaned.slice(PREFIX.length)
    : [dirname(currentVaultRelativePath), cleaned].filter(Boolean).join("/");

  return fromParts(rest.split("/"));
}

export function targetToHref(target: ResolvedTarget): string {
  if (target.collection === "concepts") return `/concepts/${target.track}/${target.slug}`;
  return `/${target.collection}/${target.slug}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/resolve-wikilink.test.ts`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/resolve-wikilink.ts lib/resolve-wikilink.test.ts
git commit -m "feat: add wikilink resolver with unit tests"
```

---

### Task 4: Velite config with remark wikilink plugin

**Files:**
- Create: `velite.config.ts`
- Create: `lib/remark-wikilinks.ts`

**Interfaces:**
- Consumes: `VAULT_SYSTEMS_DESIGN_ROOT` (Task 2), `parseWikilinkTarget`/`targetToHref` (Task 3).
- Produces: Velite collections `concepts`, `cases`, `studies`, `builds`, each with fields `title, slug, order, tags, maturity, confidence, related, html` (plus `track` on `concepts`). Generated types importable from `#velite` (used by Task 5's `lib/content.ts`).

- [ ] **Step 1: Write lib/remark-wikilinks.ts**

```ts
// lib/remark-wikilinks.ts
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import { parseWikilinkTarget, targetToHref } from "./resolve-wikilink";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

export function remarkWikilinks() {
  return (tree: Root, file: { path?: string; data: Record<string, unknown> }) => {
    const currentPath = (file.data.vaultRelativePath as string) ?? "";

    visit(tree, "text", (node: { value: string }, index, parent) => {
      if (!parent || index === null || !WIKILINK_RE.test(node.value)) return;
      WIKILINK_RE.lastIndex = 0;

      const newChildren: unknown[] = [];
      let lastEnd = 0;
      let match: RegExpExecArray | null;

      while ((match = WIKILINK_RE.exec(node.value))) {
        const [full, raw] = match;
        if (match.index > lastEnd) {
          newChildren.push({ type: "text", value: node.value.slice(lastEnd, match.index) });
        }

        const target = parseWikilinkTarget(`[[${raw}]]`, currentPath);
        if (target) {
          newChildren.push({
            type: "link",
            url: targetToHref(target),
            children: [{ type: "text", value: raw.split("|")[0] }],
          });
        } else {
          console.warn(`[architectlens] broken wikilink "${raw}" in ${currentPath}`);
          newChildren.push({
            type: "html",
            value: `<span data-broken-link="true">${raw.split("|")[0]}</span>`,
          });
        }

        lastEnd = match.index + full.length;
      }

      if (lastEnd < node.value.length) {
        newChildren.push({ type: "text", value: node.value.slice(lastEnd) });
      }

      parent.children.splice(index, 1, ...(newChildren as never[]));
    });
  };
}
```

- [ ] **Step 2: Install remaining markdown deps**

Run: `npm install unist-util-visit`
Run: `npm install -D @types/mdast`

- [ ] **Step 3: Write velite.config.ts**

```ts
// velite.config.ts
import { defineConfig, s } from "velite";
import path from "node:path";
import { VAULT_SYSTEMS_DESIGN_ROOT } from "./lib/vault-path";
import { remarkWikilinks } from "./lib/remark-wikilinks";

function order(filename: string): number {
  const match = /^(\d+)-/.exec(filename);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

const sharedFields = {
  title: s.string(),
  slug: s.slug("global"),
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
          return { ...data, track, order: order(filename) };
        }),
    },
    cases: {
      name: "Case",
      pattern: "ai/interview/scenarios/*.md",
      schema: s
        .object({ ...sharedFields, path: s.path() })
        .transform((data) => ({ ...data, order: order(path.basename(data.path)) })),
    },
    studies: {
      name: "Study",
      pattern: "studies/*.md",
      schema: s
        .object({ ...sharedFields, path: s.path() })
        .transform((data) => ({ ...data, order: order(path.basename(data.path)) })),
    },
    builds: {
      name: "Build",
      pattern: "builds/*.md",
      schema: s
        .object({ ...sharedFields, path: s.path() })
        .transform((data) => ({ ...data, order: order(path.basename(data.path)) })),
    },
  },
});
```

`pattern: "{classical,ai}/*.md"` only matches files directly inside
`classical/` or `ai/` (not `ai/interview/**`), so `index.md` files are
included by the glob but excluded from being link targets by the
resolver (Task 3 treats `index` as a dead end) — they still get
rendered as ordinary concept pages, which is correct since they carry
real navigational content.

- [ ] **Step 4: Run Velite build and inspect output**

Run: `npx velite build`
Expected: exits 0, creates `.velite/` with `concepts.json`, `cases.json`, `studies.json`, `builds.json`. `studies.json` and `builds.json` are `[]`.

- [ ] **Step 5: Commit**

```bash
git add velite.config.ts lib/remark-wikilinks.ts package.json package-lock.json
git commit -m "feat: configure Velite collections with wikilink resolution"
```

---

### Task 5: Content helper functions

**Files:**
- Create: `lib/content.ts`
- Test: `lib/content.test.ts`

**Interfaces:**
- Consumes: Velite-generated `concepts`, `cases`, `studies`, `builds` arrays from `#velite`.
- Produces:
  - `function groupConceptsByTrack(concepts: Concept[]): Record<"classical" | "ai", Concept[]>`
  - `function sortByOrder<T extends { order: number }>(items: T[]): T[]`
  - `function findBySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined`
  - `function findConceptBySlug(concepts: Concept[], track: string, slug: string): Concept | undefined`
- Consumed by: all `app/**/page.tsx` files in Tasks 7–10.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/content.test.ts
import { describe, expect, it } from "vitest";
import { groupConceptsByTrack, sortByOrder, findBySlug, findConceptBySlug } from "./content";

const concepts = [
  { slug: "b", order: 2, track: "classical" as const },
  { slug: "a", order: 1, track: "classical" as const },
  { slug: "c", order: 1, track: "ai" as const },
];

describe("sortByOrder", () => {
  it("sorts ascending by order", () => {
    expect(sortByOrder(concepts).map((c) => c.slug)).toEqual(["a", "c", "b"]);
  });

  it("puts items without a finite order last", () => {
    const withInfinite = [...concepts, { slug: "z", order: Number.POSITIVE_INFINITY, track: "classical" as const }];
    expect(sortByOrder(withInfinite).map((c) => c.slug)).toEqual(["a", "c", "b", "z"]);
  });
});

describe("groupConceptsByTrack", () => {
  it("splits concepts into classical and ai buckets", () => {
    const grouped = groupConceptsByTrack(concepts);
    expect(grouped.classical.map((c) => c.slug)).toEqual(["b", "a"]);
    expect(grouped.ai.map((c) => c.slug)).toEqual(["c"]);
  });

  it("returns an empty array for a track with no entries", () => {
    const grouped = groupConceptsByTrack([]);
    expect(grouped.classical).toEqual([]);
    expect(grouped.ai).toEqual([]);
  });
});

describe("findBySlug", () => {
  it("finds an item by slug", () => {
    expect(findBySlug(concepts, "a")?.slug).toBe("a");
  });

  it("returns undefined for a missing slug", () => {
    expect(findBySlug(concepts, "missing")).toBeUndefined();
  });
});

describe("findConceptBySlug", () => {
  it("scopes lookup to track, so duplicate slugs across tracks don't collide", () => {
    const dup = [
      { slug: "same", order: 1, track: "classical" as const },
      { slug: "same", order: 1, track: "ai" as const },
    ];
    expect(findConceptBySlug(dup, "ai", "same")?.track).toBe("ai");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/content.test.ts`
Expected: FAIL — `content.ts` does not exist yet.

- [ ] **Step 3: Implement lib/content.ts**

```ts
// lib/content.ts
export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function groupConceptsByTrack<T extends { track: "classical" | "ai" }>(
  concepts: T[]
): Record<"classical" | "ai", T[]> {
  return {
    classical: sortByOrder(concepts.filter((c) => c.track === "classical") as (T & { order: number })[]),
    ai: sortByOrder(concepts.filter((c) => c.track === "ai") as (T & { order: number })[]),
  } as Record<"classical" | "ai", T[]>;
}

export function findBySlug<T extends { slug: string }>(items: T[], slug: string): T | undefined {
  return items.find((item) => item.slug === slug);
}

export function findConceptBySlug<T extends { slug: string; track: string }>(
  concepts: T[],
  track: string,
  slug: string
): T | undefined {
  return concepts.find((c) => c.track === track && c.slug === slug);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/content.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/content.ts lib/content.test.ts
git commit -m "feat: add content helper functions with tests"
```

---

### Task 6: Shared UI components

**Files:**
- Create: `components/SectionCard.tsx`
- Create: `components/EmptyState.tsx`
- Create: `components/MetaPanel.tsx`
- Create: `components/RelatedPanel.tsx`
- Create: `components/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing beyond plain props (no Velite types needed here, kept generic so components don't depend on collection shape).
- Produces:
  - `SectionCard({ href, title, count, description })`
  - `EmptyState({ title, message })`
  - `MetaPanel({ tags, maturity, confidence }: { tags: string[]; maturity?: string; confidence?: string })`
  - `RelatedPanel({ items }: { items: { href: string; title: string }[] })`
  - `Sidebar({ groups }: { groups: { heading: string; items: { href: string; title: string }[] }[] })`
- Consumed by: `app/**/page.tsx` in Tasks 7–10.

- [ ] **Step 1: Create components/SectionCard.tsx**

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
      className="block rounded-lg border border-neutral-200 p-6 hover:border-neutral-400 transition-colors"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <p className="mt-4 text-xs uppercase tracking-wide text-neutral-400">{count} notes</p>
    </Link>
  );
}
```

- [ ] **Step 2: Create components/EmptyState.tsx**

```tsx
export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center">
      <h2 className="text-base font-medium text-neutral-700">{title}</h2>
      <p className="mt-2 text-sm text-neutral-500">{message}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create components/MetaPanel.tsx**

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
    <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
      {maturity && <span className="rounded bg-neutral-100 px-2 py-1">{maturity}</span>}
      {confidence && <span className="rounded bg-neutral-100 px-2 py-1">confidence: {confidence}</span>}
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-neutral-100 px-2 py-1">
          #{tag}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create components/RelatedPanel.tsx**

```tsx
import Link from "next/link";

export function RelatedPanel({ items }: { items: { href: string; title: string }[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="mt-8 border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-medium text-neutral-700">Related</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm text-blue-700 hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 5: Create components/Sidebar.tsx**

```tsx
import Link from "next/link";

export function Sidebar({
  groups,
}: {
  groups: { heading: string; items: { href: string; title: string }[] }[];
}) {
  return (
    <nav className="w-64 shrink-0 border-r border-neutral-200 p-4">
      {groups.map((group) => (
        <div key={group.heading} className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {group.heading}
          </h3>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-neutral-700 hover:text-neutral-950">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds (components aren't wired into pages yet, but must type-check standalone).

- [ ] **Step 7: Commit**

```bash
git add components
git commit -m "feat: add shared UI components"
```

---

### Task 7: Landing page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `concepts, cases, studies, builds` from `#velite`; `SectionCard` (Task 6).

- [ ] **Step 1: Replace app/page.tsx**

```tsx
import { concepts, cases, studies, builds } from "#velite";
import { SectionCard } from "@/components/SectionCard";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">architectlens</h1>
      <p className="mt-2 text-neutral-600">
        System design concepts, cases, studies, and builds.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <SectionCard
          href="/concepts"
          title="Concepts"
          count={concepts.length}
          description="Classical distributed systems and AI/LLM system design fundamentals."
        />
        <SectionCard
          href="/cases"
          title="Cases"
          count={cases.length}
          description="Real-world scenario walkthroughs and interview questions."
        />
        <SectionCard
          href="/studies"
          title="Studies"
          count={studies.length}
          description="Full end-to-end HLD case studies (design Twitter, Uber, etc)."
        />
        <SectionCard
          href="/builds"
          title="Builds"
          count={builds.length}
          description="Hands-on implementation write-ups."
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds, `/` page compiles.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: build landing page with section cards"
```

---

### Task 8: Concepts pages

**Files:**
- Create: `app/concepts/page.tsx`
- Create: `app/concepts/[track]/[slug]/page.tsx`

**Interfaces:**
- Consumes: `concepts` from `#velite`; `groupConceptsByTrack`, `findConceptBySlug` (Task 5); `Sidebar`, `MetaPanel`, `RelatedPanel` (Task 6); `findBySlug` for related-item title lookup.

- [ ] **Step 1: Create app/concepts/page.tsx**

```tsx
import Link from "next/link";
import { concepts } from "#velite";
import { groupConceptsByTrack } from "@/lib/content";

export default function ConceptsPage() {
  const grouped = groupConceptsByTrack(concepts);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Concepts</h1>
      {(["classical", "ai"] as const).map((track) => (
        <section key={track} className="mt-8">
          <h2 className="text-lg font-semibold capitalize">{track}</h2>
          <ul className="mt-3 space-y-1">
            {grouped[track].map((concept) => (
              <li key={concept.slug}>
                <Link href={`/concepts/${track}/${concept.slug}`} className="text-blue-700 hover:underline">
                  {concept.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Create app/concepts/[track]/[slug]/page.tsx**

```tsx
import { notFound } from "next/navigation";
import { concepts } from "#velite";
import { findConceptBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";
import { RelatedPanel } from "@/components/RelatedPanel";

export function generateStaticParams() {
  return concepts.map((c) => ({ track: c.track, slug: c.slug }));
}

export default function ConceptPage({ params }: { params: { track: string; slug: string } }) {
  const concept = findConceptBySlug(concepts, params.track, params.slug);
  if (!concept) notFound();

  const related = (concept.related as string[])
    .map((raw) => concepts.find((c) => raw.includes(c.slug)))
    .filter((c): c is (typeof concepts)[number] => Boolean(c))
    .map((c) => ({ href: `/concepts/${c.track}/${c.slug}`, title: c.title }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{concept.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={concept.tags} maturity={concept.maturity} confidence={concept.confidence} />
      </div>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: concept.html }} />
      <RelatedPanel items={related} />
    </main>
  );
}
```

The `related` lookup above uses `raw.includes(c.slug)` as a pragmatic
match against the raw wikilink string (`related` frontmatter stores
full vault wikilinks, not pre-resolved slugs) — good enough since
slugs are filename-derived and specific; note this in the PR
description for the content-ops track to consider a stricter match if
false positives ever show up.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds, generates one static page per concept.

- [ ] **Step 4: Commit**

```bash
git add app/concepts
git commit -m "feat: build concepts list and detail pages"
```

---

### Task 9: Cases pages

**Files:**
- Create: `app/cases/page.tsx`
- Create: `app/cases/[slug]/page.tsx`

**Interfaces:**
- Consumes: `cases` from `#velite`; `sortByOrder`, `findBySlug` (Task 5); `MetaPanel` (Task 6).

- [ ] **Step 1: Create app/cases/page.tsx**

```tsx
import Link from "next/link";
import { cases } from "#velite";
import { sortByOrder } from "@/lib/content";

export default function CasesPage() {
  const sorted = sortByOrder(cases);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Cases</h1>
      <ul className="mt-6 space-y-1">
        {sorted.map((item) => (
          <li key={item.slug}>
            <Link href={`/cases/${item.slug}`} className="text-blue-700 hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Create app/cases/[slug]/page.tsx**

```tsx
import { notFound } from "next/navigation";
import { cases } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";

export function generateStaticParams() {
  return cases.map((c) => ({ slug: c.slug }));
}

export default function CasePage({ params }: { params: { slug: string } }) {
  const item = findBySlug(cases, params.slug);
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{item.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={item.tags} maturity={item.maturity} confidence={item.confidence} />
      </div>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: item.html }} />
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds, generates one static page per case.

- [ ] **Step 4: Commit**

```bash
git add app/cases
git commit -m "feat: build cases list and detail pages"
```

---

### Task 10: Studies and Builds pages (empty-state ready)

**Files:**
- Create: `app/studies/page.tsx`
- Create: `app/studies/[slug]/page.tsx`
- Create: `app/builds/page.tsx`
- Create: `app/builds/[slug]/page.tsx`

**Interfaces:**
- Consumes: `studies`/`builds` from `#velite` (both `[]` today); `EmptyState`, `MetaPanel` (Task 6); `findBySlug`, `sortByOrder` (Task 5).

- [ ] **Step 1: Create app/studies/page.tsx**

```tsx
import Link from "next/link";
import { studies } from "#velite";
import { sortByOrder } from "@/lib/content";
import { EmptyState } from "@/components/EmptyState";

export default function StudiesPage() {
  const sorted = sortByOrder(studies);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Studies</h1>
      {sorted.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No studies yet"
            message="Full end-to-end HLD walkthroughs land here as they're written."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-1">
          {sorted.map((item) => (
            <li key={item.slug}>
              <Link href={`/studies/${item.slug}`} className="text-blue-700 hover:underline">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create app/studies/[slug]/page.tsx**

```tsx
import { notFound } from "next/navigation";
import { studies } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";

export function generateStaticParams() {
  return studies.map((s) => ({ slug: s.slug }));
}

export default function StudyPage({ params }: { params: { slug: string } }) {
  const item = findBySlug(studies, params.slug);
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{item.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={item.tags} maturity={item.maturity} confidence={item.confidence} />
      </div>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: item.html }} />
    </main>
  );
}
```

- [ ] **Step 3: Create app/builds/page.tsx (mirror of studies)**

```tsx
import Link from "next/link";
import { builds } from "#velite";
import { sortByOrder } from "@/lib/content";
import { EmptyState } from "@/components/EmptyState";

export default function BuildsPage() {
  const sorted = sortByOrder(builds);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Builds</h1>
      {sorted.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No builds yet" message="Hands-on implementation write-ups land here as they're written." />
        </div>
      ) : (
        <ul className="mt-6 space-y-1">
          {sorted.map((item) => (
            <li key={item.slug}>
              <Link href={`/builds/${item.slug}`} className="text-blue-700 hover:underline">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Create app/builds/[slug]/page.tsx (mirror of studies)**

```tsx
import { notFound } from "next/navigation";
import { builds } from "#velite";
import { findBySlug } from "@/lib/content";
import { MetaPanel } from "@/components/MetaPanel";

export function generateStaticParams() {
  return builds.map((b) => ({ slug: b.slug }));
}

export default function BuildPage({ params }: { params: { slug: string } }) {
  const item = findBySlug(builds, params.slug);
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">{item.title}</h1>
      <div className="mt-4">
        <MetaPanel tags={item.tags} maturity={item.maturity} confidence={item.confidence} />
      </div>
      <article className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: item.html }} />
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds. `generateStaticParams` returning `[]` for both routes is valid — Next.js emits no static pages for them yet, and the list pages show the empty state.

- [ ] **Step 6: Commit**

```bash
git add app/studies app/builds
git commit -m "feat: build studies and builds pages with empty states"
```

---

### Task 11: Global search overlay

**Files:**
- Create: `components/SearchOverlay.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `concepts, cases, studies, builds` from `#velite`; `fuse.js`.
- Produces: a cmd+k triggered overlay mounted once in the root layout.

- [ ] **Step 1: Create components/SearchOverlay.tsx**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import { concepts, cases, studies, builds } from "#velite";

type SearchItem = { href: string; title: string; tags: string[] };

function toSearchItems(): SearchItem[] {
  const conceptItems = concepts.map((c) => ({
    href: `/concepts/${c.track}/${c.slug}`,
    title: c.title,
    tags: c.tags,
  }));
  const caseItems = cases.map((c) => ({ href: `/cases/${c.slug}`, title: c.title, tags: c.tags }));
  const studyItems = studies.map((s) => ({ href: `/studies/${s.slug}`, title: s.title, tags: s.tags }));
  const buildItems = builds.map((b) => ({ href: `/builds/${b.slug}`, title: b.title, tags: b.tags }));
  return [...conceptItems, ...caseItems, ...studyItems, ...buildItems];
}

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = useMemo(toSearchItems, []);
  const fuse = useMemo(() => new Fuse(items, { keys: ["title", "tags"], threshold: 0.35 }), [items]);
  const results = query.trim() ? fuse.search(query).slice(0, 10).map((r) => r.item) : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search architectlens..."
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none"
        />
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {results.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)} className="block rounded px-2 py-1 text-sm hover:bg-neutral-100">
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

- [ ] **Step 2: Mount it in app/layout.tsx**

```tsx
import "./globals.css";
import { SearchOverlay } from "@/components/SearchOverlay";

export const metadata = {
  title: "architectlens",
  description: "System design concepts, cases, studies, and builds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">
        {children}
        <SearchOverlay />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/SearchOverlay.tsx app/layout.tsx
git commit -m "feat: add cmd+k global search overlay"
```

---

### Task 12: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all Vitest suites pass (`resolve-wikilink.test.ts`, `content.test.ts`).

- [ ] **Step 2: Start the dev server and browse every page type**

Use the `run` skill to launch `npm run dev`, then in a browser visit:
- `/` — verify four section cards show correct counts
- `/concepts` and one `/concepts/classical/[slug]` and one `/concepts/ai/[slug]` — verify content renders, tags/meta panel show, related links work
- `/cases` and one `/cases/[slug]`
- `/studies` and `/builds` — verify empty-state renders (not a blank page)
- Press cmd+k (or ctrl+k) — verify search overlay opens and returns results for a known concept title

- [ ] **Step 3: Check console for wikilink warnings**

While browsing concept/case pages, check the dev server terminal output for `[architectlens] broken wikilink` warnings — note any and decide whether they're real vault typos to fix or resolver gaps to file as follow-up.

- [ ] **Step 4: Final commit if any fixes were made during verification**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
