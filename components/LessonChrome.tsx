"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Home } from "lucide-react";
import { TileBanner } from "./TileBanner";
import { markRead } from "@/lib/progress";
import type { BannerSpec } from "@/lib/banner-kinds";
import { onGlowMove } from "@/lib/glow";

const btn =
  "inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1 font-mono text-xs text-paper-muted transition-colors hover:border-accent-dim hover:text-paper";

export function LessonTopNav({
  trackName,
  trackHref,
  moduleName,
  moduleHref,
  prevHref,
  nextHref,
}: {
  trackName: string;
  trackHref: string;
  moduleName: string;
  moduleHref: string;
  prevHref?: string;
  nextHref?: string;
}) {
  const router = useRouter();
  function back() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push(moduleHref);
  }
  return (
    <div className="sticky top-0 z-30 -mx-4 flex items-center gap-2 border-b border-line-soft bg-ink/70 px-4 py-2 backdrop-blur-xl backdrop-saturate-150 sm:-mx-6 sm:px-6">
      <button type="button" onClick={back} className={btn} aria-label="Go back">
        <ArrowLeft size={13} /> <span className="hidden sm:inline">Back</span>
      </button>
      <Link href={trackHref} className={`${btn} min-w-0 max-w-[11rem]`} aria-label={`${trackName} home`}>
        <Home size={13} className="shrink-0" /> <span className="truncate">{trackName}</span>
      </Link>
      <nav className="ml-1 hidden min-w-0 items-center gap-1.5 font-mono text-xs text-paper-muted sm:flex" aria-label="Breadcrumb">
        <span aria-hidden>/</span>
        <Link href={moduleHref} className="truncate hover:text-paper">
          {moduleName}
        </Link>
      </nav>
      <div className="ml-auto flex shrink-0 gap-2">
        {prevHref && (
          <Link href={prevHref} className={btn} aria-label="Previous lesson" title="Previous lesson ([)">
            <ArrowLeft size={13} />
          </Link>
        )}
        {nextHref && (
          <Link href={nextHref} className={btn} aria-label="Next lesson" title="Next lesson (])">
            <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}

export function LessonBanner({ title, tags, spec }: { title: string; tags: string; spec?: BannerSpec }) {
  const [live, setLive] = useState(true);
  useEffect(() => {
    setLive(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return (
    <div className="banner-bg relative mt-5 h-40 overflow-hidden rounded-lg border border-line sm:h-44">
      <TileBanner title={title} tags={tags} hover={live} spec={spec} />
    </div>
  );
}

// Each section (an h2 and everything up to the next h2) can be folded. Toggling works on the live DOM,
// so animations injected after the section are folded with it.
export function SectionControls() {
  useEffect(() => {
    const body = document.querySelector<HTMLElement>("[data-lesson-body]");
    if (!body) return;
    const sectionOf = (h: Element) => {
      const out: Element[] = [];
      for (let el = h.nextElementSibling; el && !/^(H1|H2)$/.test(el.tagName); el = el.nextElementSibling) out.push(el);
      return out;
    };
    const set = (h: Element, collapsed: boolean) => {
      h.setAttribute("aria-expanded", String(!collapsed));
      sectionOf(h).forEach((el) => el.classList.toggle("sec-hidden", collapsed));
    };
    const heads = Array.from(body.querySelectorAll("h2"));
    const KINDS: [RegExp, string, string][] = [
      [/common mistakes/i, "mistakes", "Watch out"],
      [/worked example/i, "example", "Worked example"],
      [/current practice|enterprise practice/i, "current", "Current practice"],
    ];
    heads.forEach((h) => {
      const kind = KINDS.find(([re]) => re.test(h.textContent ?? ""));
      if (kind) {
        h.setAttribute("data-kind", kind[1]);
        h.setAttribute("data-label", kind[2]);
      }
      h.setAttribute("data-collapsible", "");
      h.setAttribute("role", "button");
      h.setAttribute("tabindex", "0");
      h.setAttribute("aria-expanded", "true");
    });
    const toggle = (h: Element) => set(h, h.getAttribute("aria-expanded") === "true");
    const onClick = (e: Event) => {
      const h = (e.target as Element).closest("h2[data-collapsible]");
      if (h && body.contains(h)) toggle(h);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const h = (e.target as Element).closest?.("h2[data-collapsible]");
      if (h) {
        e.preventDefault();
        toggle(h);
      }
    };
    const onAll = (e: Event) => heads.forEach((h) => set(h, (e as CustomEvent<boolean>).detail));
    body.addEventListener("click", onClick);
    body.addEventListener("keydown", onKey);
    window.addEventListener("lesson:collapse-all", onAll);
    return () => {
      body.removeEventListener("click", onClick);
      body.removeEventListener("keydown", onKey);
      window.removeEventListener("lesson:collapse-all", onAll);
      heads.forEach((h) => {
        ["data-collapsible", "data-kind", "data-label", "role", "tabindex", "aria-expanded"].forEach((a) => h.removeAttribute(a));
        sectionOf(h).forEach((el) => el.classList.remove("sec-hidden"));
      });
    };
  }, []);

  const [folded, setFolded] = useState(false);
  const fire = (collapsed: boolean) => window.dispatchEvent(new CustomEvent("lesson:collapse-all", { detail: collapsed }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TextSize />
      <button
        type="button"
        onClick={() => {
          fire(!folded);
          setFolded(!folded);
        }}
        className={btn}
      >
        {folded ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />} {folded ? "Expand all" : "Collapse all"}
      </button>
    </div>
  );
}

// Reading text size (small / default / large), remembered per browser.
function TextSize() {
  const [fs, setFs] = useState("md");
  useEffect(() => setFs(document.documentElement.dataset.fs ?? "md"), []);
  function pick(next: string) {
    setFs(next);
    if (next === "md") delete document.documentElement.dataset.fs;
    else document.documentElement.dataset.fs = next;
    try {
      localStorage.setItem("text-size-v1", next);
    } catch {
      // storage unavailable: size applies for this page view only
    }
  }
  return (
    <div className="inline-flex overflow-hidden rounded border border-line font-mono text-xs" role="group" aria-label="Text size">
      {([["sm", "A-", "Smaller text"], ["md", "A", "Default text"], ["lg", "A+", "Larger text"]] as const).map(([k, label, name]) => (
        <button
          key={k}
          type="button"
          onClick={() => pick(k)}
          aria-pressed={fs === k}
          aria-label={name}
          className={`px-2.5 py-1 transition-colors ${fs === k ? "bg-ink-elevated text-accent" : "text-paper-muted hover:text-paper"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Jump links to each h2; jumping also unfolds a collapsed section.
export function OnThisPage() {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  useEffect(() => {
    const heads = Array.from(document.querySelectorAll<HTMLElement>("[data-lesson-body] h2"));
    setItems(
      heads.map((h, i) => {
        if (!h.id) h.id = `sec-${i}`;
        return { id: h.id, text: h.textContent ?? "" };
      })
    );
  }, []);
  if (items.length < 3) return null;
  function go(id: string) {
    const h = document.getElementById(id);
    if (!h) return;
    if (h.getAttribute("aria-expanded") === "false") h.click();
    h.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <details className="mt-4 rounded-lg border border-line bg-ink-elevated p-3">
      <summary className="cursor-pointer font-mono text-xs text-paper-muted">On this page ({items.length})</summary>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={() => go(it.id)} className={btn}>
              {it.text}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

type PagerLink = { href: string; title: string; summary?: string };

export function LessonPager({ prev, next }: { prev?: PagerLink; next?: PagerLink }) {
  const router = useRouter();
  // [ and ] step to the previous and next lesson.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) return;
      const to = e.key === "[" ? prev : e.key === "]" ? next : undefined;
      if (to) router.push(to.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);
  const card =
    "glow group flex min-w-0 flex-1 flex-col rounded-xl border border-line p-4 transition-colors hover:border-accent-dim hover:bg-ink-elevated";
  return (
    <nav className="mt-10 flex flex-col gap-3 sm:flex-row" aria-label="Lesson navigation">
      {prev ? (
        <Link href={prev.href} className={card} onPointerMove={onGlowMove}>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-paper-muted">
            <ArrowLeft size={12} /> Previous
          </span>
          <span className="mt-1 truncate text-sm text-paper group-hover:text-accent">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link href={next.href} className={`${card} sm:items-end sm:text-right`} onPointerMove={onGlowMove}>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-paper-muted">
            Next <ArrowRight size={12} />
          </span>
          <span className="mt-1 max-w-full truncate text-sm text-paper group-hover:text-accent">{next.title}</span>
          {next.summary && <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-paper-muted">{next.summary}</span>}
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}

// Thin bar showing how far through the note you are; reaching the end marks the note as read.
export function ReadingProgress({ lessonKey, minutes }: { lessonKey: string; minutes: number }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const body = document.querySelector<HTMLElement>("[data-lesson-body]");
    let scroller: HTMLElement | null = body?.parentElement ?? null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (!scroller) return;
    const el = scroller;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? el.scrollTop / max : 1;
      setPct(Math.min(1, Math.max(0, p)));
      if (p > 0.9) markRead(lessonKey);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [lessonKey]);
  const left = Math.ceil(minutes * (1 - pct));
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-transparent" aria-hidden>
        <div className="h-full origin-left bg-hook transition-[width] duration-100" style={{ width: `${pct * 100}%` }} />
      </div>
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-30 rounded-full border border-line bg-ink/70 px-3 py-1 font-mono text-[11px] text-paper-muted backdrop-blur-xl"
        role="status"
      >
        {pct >= 0.9 ? "Done" : `~${Math.max(1, left)} min left`}
      </div>
    </>
  );
}
