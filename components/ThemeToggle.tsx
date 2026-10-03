"use client";

import { useEffect, useState } from "react";
import { BookOpen, Moon, Sun, type LucideIcon } from "lucide-react";

type Theme = "light" | "dark" | "sepia";

const ORDER: { id: Theme; label: string; Icon: LucideIcon }[] = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
  { id: "sepia", label: "Reading mode", Icon: BookOpen },
];

// One button that cycles dark, light and reading mode.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" || current === "sepia" ? current : "dark");
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
