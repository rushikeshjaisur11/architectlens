"use client";

import { useEffect, useState } from "react";
import { announcePrefs } from "@/lib/prefs-events";
import { BookOpen, Moon, MoonStar, Sun, type LucideIcon } from "lucide-react";

type Theme = "light" | "dark" | "black" | "sepia";

const ORDER: { id: Theme; label: string; Icon: LucideIcon }[] = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "black", label: "OLED black", Icon: MoonStar },
  { id: "light", label: "Light", Icon: Sun },
  { id: "sepia", label: "Reading mode", Icon: BookOpen },
];

// One button that cycles dark, OLED black, light and reading mode.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const read = () => {
      const current = document.documentElement.dataset.theme;
      setTheme(current === "dark" || current === "black" || current === "sepia" ? current : "light");
    };
    read();
    window.addEventListener("prefs:applied", read);
    return () => window.removeEventListener("prefs:applied", read);
  }, []);

  const at = ORDER.findIndex((o) => o.id === theme);
  const next = ORDER[(at + 1) % ORDER.length];
  const { Icon, label } = ORDER[at];

  function choose() {
    setTheme(next.id);
    document.documentElement.dataset.theme = next.id;
    try {
      localStorage.setItem("theme-v2", next.id);
    } catch {
      // storage unavailable: theme applies for this page view only
    }
    announcePrefs({ theme: next.id });
  }

  return (
    <button
      type="button"
      onClick={choose}
      aria-label={`Theme: ${label}. Switch to ${next.label}`}
      title={`Theme: ${label}. Click for ${next.label}`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-paper-muted transition-colors hover:border-accent-dim hover:text-paper"
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
