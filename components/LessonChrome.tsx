"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronsDownUp, ChevronsUpDown, Home } from "lucide-react";
import { TileBanner } from "./TileBanner";
import { markRead } from "@/lib/progress";

const btn =
  "inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1 font-mono text-xs text-paper-muted transition-colors hover:border-accent-dim hover:text-paper";

export function LessonTopNav({
  trackName,
  trackHref,
  moduleName,
  moduleHref,
}: {
  trackName: string;
  trackHref: string;
  moduleName: string;
  moduleHref: string;
}) {
  const router = useRouter();
  function back() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push(moduleHref);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={back} className={btn} aria-label="Go back">
        <ArrowLeft size={13} /> Back
      </button>
      <Link href="/" className={btn} aria-label="Home">
        <Home size={13} /> Home
      </Link>
      <nav className="ml-1 flex min-w-0 items-center gap-1.5 font-mono text-xs text-paper-muted" aria-label="Breadcrumb">
        <Link href={trackHref} className="truncate hover:text-paper">
          {trackName}
        </Link>
        <span aria-hidden>/</span>
        <Link href={moduleHref} className="truncate hover:text-paper">
          {moduleName}
        </Link>
      </nav>
    </div>
  );
}

export function LessonBanner({ title, tags, label, minutes }: { title: string; tags: string; label: string; minutes: number }) {
  const [live, setLive] = useState(true);
  useEffect(() => {
    setLive(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return (
    <div className="banner-bg relative mt-5 h-40 overflow-hidden rounded-lg border border-line sm:h-44">
      <TileBanner title={title} tags={tags} hover={live} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/80 to-transparent px-4 pb-2 pt-8 font-mono text-[11px] text-paper-muted">
        <span>{label}</span>
        <span>{minutes} min read</span>
      </div>
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
    heads.forEach((h) => {
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
        ["data-collapsible", "role", "tabindex", "aria-expanded"].forEach((a) => h.removeAttribute(a));
        sectionOf(h).forEach((el) => el.classList.remove("sec-hidden"));
      });
    };
  }, []);

  const fire = (collapsed: boolean) => window.dispatchEvent(new CustomEvent("lesson:collapse-all", { detail: collapsed }));
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => fire(true)} className={btn}>
        <ChevronsDownUp size={13} /> Collapse all
      </button>
      <button type="button" onClick={() => fire(false)} className={btn}>
        <ChevronsUpDown size={13} /> Expand all
      </button>
    </div>
  );
}

type PagerLink = { href: string; title: string };

export function LessonPager({ prev, next }: { prev?: PagerLink; next?: PagerLink }) {
  const card =
    "group flex min-w-0 flex-1 flex-col rounded-lg border border-line p-4 transition-colors hover:border-accent-dim hover:bg-ink-elevated";
  return (
    <nav className="mt-10 flex flex-col gap-3 sm:flex-row" aria-label="Lesson navigation">
      {prev ? (
        <Link href={prev.href} className={card}>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-paper-muted">
            <ArrowLeft size={12} /> Previous
          </span>
          <span className="mt-1 truncate text-sm text-paper group-hover:text-accent">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link href={next.href} className={`${card} sm:items-end sm:text-right`}>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-paper-muted">
            Next <ArrowRight size={12} />
          </span>
          <span className="mt-1 max-w-full truncate text-sm text-paper group-hover:text-accent">{next.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}

// Thin bar showing how far through the note you are; reaching the end marks the note as read.
export function ReadingProgress({ lessonKey }: { lessonKey: string }) {
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
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-transparent" aria-hidden>
      <div className="h-full origin-left bg-accent transition-[width] duration-100" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
