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
