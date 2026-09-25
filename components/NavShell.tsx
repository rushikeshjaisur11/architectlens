"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { buildNavTree } from "@/lib/nav-tree";
import { trackFromSlug } from "@/lib/tracks";
import type { ContentIndexItem } from "@/lib/search-index";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SearchOverlay } from "./SearchOverlay";

type LessonLike = {
  slug: string;
  title: string;
  shortTitle: string;
  order: number;
  track: { slug: string; name: string };
  category: { number: number; slug: string; name: string };
};

function activeTrackSlug(pathname: string): string {
  if (pathname.startsWith("/ai-systems") || pathname.startsWith("/lessons/ai-systems")) return "ai-systems";
  return "system-design";
}

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
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const track = trackFromSlug(activeTrackSlug(pathname));
  const tree = buildNavTree(
    lessons.filter((l) => l.track.slug === track.slug),
    track
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
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
  }, [pathname]);

  return (
    <div className="flex h-screen">
      <Sidebar
        groups={tree}
        mobileOpen={mobileOpen}
        desktopCollapsed={desktopCollapsed}
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
          onToggleSidebar={() => setDesktopCollapsed((prev) => !prev)}
          sidebarCollapsed={desktopCollapsed}
        />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <SearchOverlay items={searchItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
