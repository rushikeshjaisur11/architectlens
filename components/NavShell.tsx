"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buildNavTree } from "@/lib/nav-tree";
import { hasTrackContext, trackFromSlug, trackSlugFromPath } from "@/lib/tracks";
import type { ContentIndexItem } from "@/lib/search-index";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SearchOverlay } from "./SearchOverlay";
import { Footer } from "./Footer";

type LessonLike = {
  slug: string;
  title: string;
  shortTitle: string;
  order: number;
  track: { slug: string; name: string };
  category: { number: number; slug: string; name: string };
};

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

  return (
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          onSearchClick={() => setSearchOpen(true)}
          onMenuClick={() => setMobileOpen(true)}
          onToggleContents={() => setDesktopCollapsed((prev) => !prev)}
          contentsOpen={!desktopCollapsed}
          showContents={inTrack}
          hidden={barHidden}
        />
        <div className="flex-1 overflow-y-auto" onScroll={onScroll}>
          {children}
          <Footer />
        </div>
      </div>
      <SearchOverlay items={searchItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
