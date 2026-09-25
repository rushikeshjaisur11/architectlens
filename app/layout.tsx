import "./globals.css";
import { lessons } from "#velite";
import { buildNavTree } from "@/lib/nav-tree";
import { buildContentIndex } from "@/lib/search-index";
import { NavShell } from "@/components/NavShell";

export const metadata = {
  title: "architectlens",
  description: "System design, learned from first principles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const tree = buildNavTree(lessons);
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
