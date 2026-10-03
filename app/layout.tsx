import "./globals.css";
import { Atkinson_Hyperlegible_Next, Atkinson_Hyperlegible_Mono, Instrument_Serif, Literata } from "next/font/google";
import { lessons } from "#velite";
import { buildContentIndex } from "@/lib/search-index";
import { NavShell } from "@/components/NavShell";
import { SITE_ORIGIN } from "@/lib/site";

const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-body",
  adjustFontFallback: false,
});

const mono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-body",
  adjustFontFallback: false,
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-serif",
});

const reading = Literata({
  subsets: ["latin"],
  variable: "--font-reading",
});

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme-v2");
    var theme = stored === "light" || stored === "sepia" ? stored : "dark";
    document.documentElement.dataset.theme = theme;
    var fs = localStorage.getItem("text-size-v1");
    if (fs === "sm" || fs === "lg") document.documentElement.dataset.fs = fs;
    if (JSON.parse(localStorage.getItem("read-lessons-v1") || "[]").length) document.documentElement.dataset.returning = "1";
  } catch (e) {}
})();
`;

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "architectlens: system design and AI systems", template: "%s | architectlens" },
  description:
    "A structured curriculum on system design and production AI systems, from first principles to enterprise practice, with interactive diagrams and current, sourced guidance.",
  openGraph: {
    title: "architectlens",
    description: "System design and AI systems, from first principles to enterprise practice.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const searchItems = buildContentIndex();

  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${reading.variable} ${display.variable}`}>
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
