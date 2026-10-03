"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ThinkingOrb } from "thinking-orbs";
import { SECTIONS, activeSection, type Section } from "@/lib/track-meta";
import { hslToHex } from "@/lib/color";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const HOME = { name: "architectlens", tagline: "System design and AI systems, from first principles." };
const LOGO = { x: 28, y: 28 };
const COVER = { major: 480, minor: 300 };

type Trip = {
  dx: number; // click point relative to the screen centre
  dy: number;
  href: string;
  path: string;
  major: boolean;
  section: Section | null;
  title: string;
  dark: boolean;
  color: string;
};

const clean = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

function titleFromPath(path: string): string {
  const last = path.split("/").filter(Boolean).pop() ?? "";
  const words = last.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Every in-app navigation travels. Between top-level sections the page softens, an orb leaves the clicked
// spot, wires itself up at the centre in the destination's colour while naming it, then flies home to the
// logo. Inside a section the same trip is shorter and quieter. Directional slides live in NavShell.
export function JourneyTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [trip, setTrip] = useState<Trip | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (reduced) return;
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin) return;
      const path = a.pathname.startsWith(BASE) ? a.pathname.slice(BASE.length) || "/" : a.pathname;
      if (clean(path) === clean(pathname)) return;
      e.preventDefault();
      e.stopPropagation();
      pushed.current = false;
      document.documentElement.dataset.navigated = "1"; // enables the staggered page reveal for the page about to mount

      const toKey = activeSection(path);
      const section = toKey ? SECTIONS.find((s) => s.key === toKey)! : null;
      const major = toKey !== activeSection(pathname);
      const root = document.documentElement;
      const dark = ["dark", "black"].includes(root.dataset.theme ?? "");
      const color = section ? hslToHex(section.hue, dark ? 65 : 60, dark ? 70 : 40) : getComputedStyle(root).getPropertyValue("--color-accent").trim();
      const rect = a.getBoundingClientRect();
      const keyboard = e.clientX === 0 && e.clientY === 0;
      const x = keyboard ? rect.left + rect.width / 2 : e.clientX;
      const y = keyboard ? rect.top + rect.height / 2 : e.clientY;
      setTrip({
        dx: x - innerWidth / 2,
        dy: y - innerHeight / 2,
        href: a.pathname + a.search + a.hash,
        path,
        major,
        section,
        title: major || path === section?.href ? (section?.name ?? HOME.name) : titleFromPath(path),
        dark,
        color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#0550ae",
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, reduced]);

  // Once the orb has settled, go to the page; lift shortly after the new page is in, never leaving a stuck overlay.
  useEffect(() => {
    if (!trip) return;
    const go = setTimeout(() => {
      pushed.current = true;
      router.push(trip.href);
    }, trip.major ? COVER.major : COVER.minor);
    const safety = setTimeout(() => setTrip(null), 4000);
    return () => {
      clearTimeout(go);
      clearTimeout(safety);
    };
  }, [trip, router]);
  useEffect(() => {
    if (!trip || !pushed.current || clean(pathname) !== clean(trip.path)) return;
    const id = setTimeout(() => setTrip(null), 0);
    return () => clearTimeout(id);
  }, [pathname, trip]);

  // While the veil is up the incoming page's content waits; it starts revealing as the veil lifts (see globals.css).
  useEffect(() => {
    if (!trip) return;
    document.documentElement.dataset.veil = "1";
    return () => {
      delete document.documentElement.dataset.veil;
    };
  }, [trip]);

  const theme = trip?.dark ? "dark" : "light";
  return (
    <>
      <AnimatePresence>
      {trip && (
        <motion.div
          key="journey"
          role="status"
          aria-label={`Going to ${trip.title}`}
          className={`fixed inset-0 z-[70] flex items-center justify-center ${trip.major ? "bg-ink/75 backdrop-blur-md" : "bg-ink/55 backdrop-blur-sm"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: trip.major ? 0.4 : 0.25, ease: "easeOut" } }}
          transition={{ duration: trip.major ? 0.25 : 0.15, ease: "easeOut" }}
        >
          <motion.div
            className="flex flex-col items-center"
            initial={{ x: trip.dx, y: trip.dy, scale: 0.35, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={{
              x: LOGO.x - innerWidth / 2,
              y: LOGO.y - innerHeight / 2,
              scale: 0.3,
              opacity: 0,
              transition: { duration: trip.major ? 0.4 : 0.25, ease: [0.6, 0, 0.3, 1] },
            }}
            transition={{ type: "spring", stiffness: trip.major ? 140 : 220, damping: 20, mass: 0.9 }}
          >
            <ThinkingOrb state={trip.major ? "connecting" : "working"} size={trip.major ? 64 : 32} theme={theme} color={trip.color} aria-hidden />
            <motion.div
              className="mt-6 flex w-max max-w-[80vw] flex-col items-center text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ delay: trip.major ? 0.2 : 0.08, duration: 0.3, ease: "easeOut" }}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-paper-muted">
                {trip.major ? "Now entering" : "Heading to"}
              </span>
              <span
                className={`mt-2 font-display leading-tight [text-wrap:balance] ${trip.major ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}
                style={{ color: trip.color }}
              >
                {trip.title}
              </span>
              {trip.major && <span className="mt-2 max-w-xs text-sm text-paper-muted [text-wrap:balance]">{trip.section?.tagline ?? HOME.tagline}</span>}
              <span className="mt-5 block h-0.5 w-40 overflow-hidden rounded-full bg-line">
                <motion.span
                  className="block h-full origin-left rounded-full"
                  style={{ background: trip.color }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: (trip.major ? COVER.major : COVER.minor) / 1000 + 0.15, ease: "easeInOut" }}
                />
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
