import "./globals.css";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { lessons } from "#velite";
import { buildContentIndex } from "@/lib/search-index";
import { NavShell } from "@/components/NavShell";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    if (theme === "light") document.documentElement.dataset.theme = "light";
  } catch (e) {}
})();
`;

export const metadata = {
  title: "architectlens",
  description: "System design, learned from first principles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const searchItems = buildContentIndex();

  return (
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-ink font-sans text-paper" suppressHydrationWarning>
        <NavShell lessons={lessons} searchItems={searchItems}>
          {children}
        </NavShell>
      </body>
    </html>
  );
}
