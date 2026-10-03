"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ANIMATIONS } from "./registry";
import SceneCanvas from "./scene/SceneCanvas";
import { SCENES } from "./scenes";
import type { AnimationName } from "./names";

type Slot = { el: HTMLElement; key: string; node: ReactNode };

const STOP = /^(H1|H2|H3)$/;

// The visual goes after the section's lead-in: skip a paragraph that ends with a colon so it
// lands after the list it introduces, and otherwise sit right under the first block.
function anchorFor(heading: Element): Element {
  const first = heading.nextElementSibling;
  if (!first || STOP.test(first.tagName)) return heading;
  const next = first.nextElementSibling;
  const leadsIn = first.tagName === "P" && /:\s*$/.test(first.textContent ?? "");
  if (leadsIn && next && /^(UL|OL|TABLE|PRE)$/.test(next.tagName)) return next;
  return first;
}

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

    const injected: HTMLElement[] = [];
    const scenes = SCENES[lessonKey] ?? [];
    if (!explicit.length && scenes.length) {
      const heads = Array.from(body.querySelectorAll("h2"));
      const last = heads.length - 1;
      let after: Element | null = null;
      scenes.forEach((scene, i) => {
        const el = document.createElement("div");
        el.setAttribute("data-anim-auto", "");
        const hi = scenes.length === 1 || last < 1 ? 0 : Math.min(last, Math.round((i * last) / (scenes.length - 1)));
        let anchor = heads[hi] ? anchorFor(heads[hi]) : null;
        if (after && anchor && (anchor === after || (anchor.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING) === 0)) anchor = after;
        if (anchor) anchor.after(el);
        else body.append(el);
        after = el;
        injected.push(el);
        found.push({ el, key: `auto-${i}`, node: <SceneCanvas scene={scene} /> });
      });
    }

    setSlots(found);
    return () => {
      injected.forEach((el) => el.remove());
    };
  }, [lessonKey]);

  return <>{slots.map(({ el, key, node }) => createPortal(node, el, key))}</>;
}
