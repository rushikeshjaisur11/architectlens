"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ANIMATIONS } from "./registry";

type Slot = { el: Element; name: string };

export function LessonAnimations() {
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    const found = document.querySelectorAll<HTMLElement>("[data-lesson-body] [data-anim]");
    setSlots(Array.from(found, (el) => ({ el, name: el.dataset.anim ?? "" })));
  }, []);

  return (
    <>
      {slots.map(({ el, name }, i) => {
        const Animation = ANIMATIONS[name as keyof typeof ANIMATIONS];
        return Animation ? createPortal(<Animation />, el, `${name}-${i}`) : null;
      })}
    </>
  );
}
