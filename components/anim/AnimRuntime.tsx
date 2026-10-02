"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ANIMATIONS } from "./registry";
import SceneCanvas from "./scene/SceneCanvas";
import { SCENES } from "./scenes";
import type { AnimationName } from "./names";

type Slot = { el: HTMLElement; key: string; node: ReactNode };

export default function AnimRuntime({ lessonKey }: { lessonKey: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>("[data-lesson-body]");
    if (!body) return;

    const found: Slot[] = [];
    const explicit = body.querySelectorAll<HTMLElement>("[data-anim]");
    explicit.forEach((el, i) => {
      const Custom = ANIMATIONS[el.dataset.anim as AnimationName];
      if (Custom) found.push({ el, key: `${el.dataset.anim}-${i}`, node: <Custom /> });
    });

    let injected: HTMLElement | null = null;
    const scene = SCENES[lessonKey];
    if (!explicit.length && scene) {
      injected = document.createElement("div");
      injected.setAttribute("data-anim-auto", "");
      const anchor = body.querySelector("h2")?.nextElementSibling;
      if (anchor) anchor.after(injected);
      else body.prepend(injected);
      found.push({ el: injected, key: "auto", node: <SceneCanvas scene={scene} /> });
    }

    setSlots(found);
    return () => {
      injected?.remove();
    };
  }, [lessonKey]);

  return <>{slots.map(({ el, key, node }) => createPortal(node, el, key))}</>;
}
