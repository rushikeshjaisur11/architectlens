"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { buildNavTree } from "@/lib/nav-tree";
import { hasTrackContext, trackFromSlug, trackSlugFromPath } from "@/lib/tracks";
import { activeSection } from "@/lib/track-meta";
import type { ContentIndexItem } from "@/lib/search-index";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SearchOverlay } from "./SearchOverlay";
import { JourneyTransition } from "./JourneyTransition";
import { AmbientGrid } from "./AmbientGrid";
import { Footer } from "./Footer";

type LessonLike = {
  slug: string;
  title: string;
  shortTitle: string;
  order: number;
  track: { slug: string; name: string };
  category: { number: number; slug: string; name: string };
};

// Content pieces that reveal after navigation, and the card-like containers that reveal as a whole instead.
const REVEAL = "h1, h2, h3, p, li, pre, table, blockquote, figure, dl > div, a.rounded-full, .rounded-lg, .rounded-xl, .rounded-2xl";
const WHOLE = "li, pre, table, figure, .rounded-lg, .rounded-xl, .rounded-2xl";
const STAGGER_MAX = 14; // later pieces share the last delay, so a long first screen never waits long

export function NavShell({
  lessons,
  searchItems,
  children,
}: {
  lessons: LessonLike[];
  searchItems: ContentIndexItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);
  const lastTop = useRef(0);
  const firstPath = useRef(pathname);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPath = useRef(pathname);
  const inLesson = pathname.startsWith("/lessons");
  const [desktopCollapsed, setDesktopCollapsed] = useState(true);

  const track = trackFromSlug(trackSlugFromPath(pathname));
  const inTrack = hasTrackContext(pathname);
  const tree = inTrack
    ? buildNavTree(
        lessons.filter((l) => l.track.slug === track.slug),
        track
      )
    : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement).tagName);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setBarHidden(false);
    lastTop.current = 0;
  }, [pathname]);

  // While reading a lesson the top bar tucks away on scroll down and returns on scroll up, leaving one sticky bar.
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop;
    const delta = top - lastTop.current;
    if (Math.abs(delta) < 12) return;
    setBarHidden(inLesson && delta > 0 && top > 120);
    lastTop.current = top;
  }

  // Going deeper (home > section > module > lesson) slides in from the right, going back from the left.
  const depth = (p: string) => p.split("/").filter(Boolean).length;
  const step = depth(pathname) - depth(prevPath.current);
  const enter = step > 0 ? { opacity: 0, x: 16 } : step < 0 ? { opacity: 0, x: -16 } : { opacity: 0, y: 10 };
  // Tag the first screen's content, in reading order, so it can reveal piece by piece (see globals.css).
  useLayoutEffect(() => {
    if (!document.documentElement.dataset.navigated) return;
    let n = 0;
    document.querySelectorAll<HTMLElement>(`main :is(${REVEAL})`).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0 || el.parentElement?.closest(WHOLE)) return;
      el.dataset.rv = "";
      el.style.setProperty("--ri", String(Math.min(n++, STAGGER_MAX)));
    });
  }, [pathname]);

  useEffect(() => {
    prevPath.current = pathname;
    if (pathname !== firstPath.current) document.documentElement.dataset.navigated = "1";
    const section = activeSection(pathname);
    if (section) document.documentElement.dataset.section = section;
    else delete document.documentElement.dataset.section;
  }, [pathname]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-screen">
      <Sidebar
        groups={tree}
        mobileOpen={mobileOpen}
        desktopCollapsed={desktopCollapsed || !inTrack}
        title={inTrack ? track.name : "Sections"}
        onCloseMobile={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AmbientGrid mode={pathname === "/" ? "home" : (activeSection(pathname) ?? "plain")} calm={inLesson} scrollRef={scrollRef} />
        <TopBar
          onSearchClick={() => setSearchOpen(true)}
          onMenuClick={() => setMobileOpen(true)}
          onToggleContents={() => setDesktopCollapsed((prev) => !prev)}
          contentsOpen={!desktopCollapsed}
          showContents={inTrack}
          hidden={barHidden}
        />
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden" onScroll={onScroll}>
          <motion.div
            key={pathname}
            initial={pathname === firstPath.current ? false : enter}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
          <Footer />
        </div>
      </div>
      <JourneyTransition />
      <SearchOverlay items={searchItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
    </MotionConfig>
  );
}
