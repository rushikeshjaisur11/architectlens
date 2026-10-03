"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.dataset.theme === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    localStorage.setItem("theme", next ? "light" : "dark");
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Switch to dark theme" : "Switch to light theme"}
      onClick={toggle}
      className="relative flex h-7 w-14 shrink-0 items-center rounded-full border border-line bg-ink-elevated text-paper-muted transition-colors hover:border-accent-dim"
    >
      <span
        aria-hidden
        className={`absolute top-0.5 h-5.5 w-6 rounded-full bg-accent/20 ring-1 ring-accent-dim transition-all duration-200 ${
          light ? "left-[calc(100%-1.625rem)]" : "left-0.5"
        }`}
      />
      <Moon size={13} aria-hidden className={`relative z-10 ml-[0.55rem] ${light ? "" : "text-accent"}`} />
      <Sun size={13} aria-hidden className={`relative z-10 ml-auto mr-[0.55rem] ${light ? "text-accent" : ""}`} />
    </button>
  );
}
