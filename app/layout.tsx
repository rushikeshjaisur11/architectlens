import "./globals.css";
import { SearchOverlay } from "@/components/SearchOverlay";
import { buildContentIndex } from "@/lib/search-index";

export const metadata = {
  title: "architectlens",
  description: "System design concepts, cases, studies, and builds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">
        {children}
        <SearchOverlay items={buildContentIndex()} />
      </body>
    </html>
  );
}
