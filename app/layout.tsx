import "./globals.css";
import { Atkinson_Hyperlegible_Next, Atkinson_Hyperlegible_Mono, Literata } from "next/font/google";
import { lessons } from "#velite";
import { buildContentIndex } from "@/lib/search-index";
import { NavShell } from "@/components/NavShell";
import { CursorGlow } from "@/components/CursorGlow";

const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-body",
});

const mono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-body",
});

const reading = Literata({
  subsets: ["latin"],
  variable: "--font-reading",
});

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme-v2");
    var theme = stored === "dark" || stored === "sepia" ? stored : "light";
    document.documentElement.dataset.theme = theme;
    var fs = localStorage.getItem("text-size-v1");
    if (fs === "sm" || fs === "lg") document.documentElement.dataset.fs = fs;
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
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${reading.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-ink font-sans text-paper" suppressHydrationWarning>
        <NavShell lessons={lessons} searchItems={searchItems}>
          {children}
        </NavShell>
        <CursorGlow />
      </body>
    </html>
  );
}
