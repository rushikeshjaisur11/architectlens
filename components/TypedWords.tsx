"use client";

import { useEffect, useState } from "react";

// Types the words one after another with a blinking caret. The first word is in the server HTML, and the
// loop never starts for people who prefer reduced motion.
export function TypedWords({ words, className = "" }: { words: string[]; className?: string }) {
  const [text, setText] = useState(words[0]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let index = 0;
    let shown = words[0];
    let phase: "hold" | "delete" | "type" = "hold";
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      let delay: number;
      if (phase === "hold") {
        phase = "delete";
        delay = 60;
      } else if (phase === "delete") {
        shown = shown.slice(0, -1);
        setText(shown);
        if (shown === "") {
          index = (index + 1) % words.length;
          phase = "type";
          delay = 280;
        } else delay = 40;
      } else {
        shown = words[index].slice(0, shown.length + 1);
        setText(shown);
        if (shown === words[index]) {
          phase = "hold";
          delay = 2400;
        } else delay = 85;
      }
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 2600);
    return () => clearTimeout(timer);
  }, [words]);

  return (
    <span className={className} aria-hidden>
      {text}
      <span className="caret" />
    </span>
  );
}
