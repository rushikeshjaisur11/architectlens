"use client";

import { useEffect, useState } from "react";
import { BookOpen, Moon, Sun, type LucideIcon } from "lucide-react";

type Theme = "light" | "dark" | "sepia";

const OPTIONS: { id: Theme; label: string; Icon: LucideIcon }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "sepia", label: "Reading mode", Icon: BookOpen },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" || current === "sepia" ? current : "dark");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme-v2", next);
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-ink-elevated p-0.5">
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(id)}
            className={`flex h-6 w-7 items-center justify-center rounded-full transition-colors ${
              active ? "bg-accent/20 text-accent ring-1 ring-accent-dim" : "text-paper-muted hover:text-paper"
            }`}
          >
            <Icon size={13} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
