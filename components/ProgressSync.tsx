"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { readSet, writeSet } from "@/lib/progress";
import type { PrefsPatch } from "@/lib/prefs-events";

const warn = (e: unknown) => console.warn("sync failed", e);

function send(url: string, method: string, body: unknown) {
  return fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function applyPrefs(p: PrefsPatch) {
  const root = document.documentElement;
  if (p.theme) {
    root.dataset.theme = p.theme;
    localStorage.setItem("theme-v2", p.theme);
  }
  if (p.textSize) {
    if (p.textSize === "md") delete root.dataset.fs;
    else root.dataset.fs = p.textSize;
    localStorage.setItem("text-size-v1", p.textSize);
  }
  window.dispatchEvent(new Event("prefs:applied"));
}

export function ProgressSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    const synced = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: PrefsPatch = {};
    let prefTimer: ReturnType<typeof setTimeout> | undefined;

    function flushProgress() {
      const fresh = [...readSet()].filter((k) => !synced.has(k));
      for (let i = 0; i < fresh.length; i += 400) {
        const keys = fresh.slice(i, i + 400);
        keys.forEach((k) => synced.add(k));
        send("/api/progress/", "POST", { keys }).catch(warn);
      }
    }

    function onRead() {
      clearTimeout(timer);
      timer = setTimeout(flushProgress, 800);
    }

    function onPrefs(e: Event) {
      pending = { ...pending, ...(e as CustomEvent<PrefsPatch>).detail };
      clearTimeout(prefTimer);
      prefTimer = setTimeout(() => {
        send("/api/preferences/", "PUT", pending).catch(warn);
        pending = {};
      }, 500);
    }

    async function init() {
      const [progress, prefs] = await Promise.all([
        fetch("/api/progress/").then((r) => r.json() as Promise<{ read: string[] }>),
        fetch("/api/preferences/").then((r) => r.json() as Promise<{ theme: string | null; textSize: string | null }>),
      ]);
      if (cancelled) return;
      const local = readSet();
      progress.read.forEach((k) => synced.add(k));
      const merged = new Set([...local, ...progress.read]);
      if (merged.size > local.size) {
        writeSet(merged);
        window.dispatchEvent(new Event("lessons:read"));
      }
      flushProgress();

      const root = document.documentElement;
      const push: PrefsPatch = {};
      if (prefs.theme) applyPrefs({ theme: prefs.theme });
      else push.theme = root.dataset.theme ?? "light";
      if (prefs.textSize) applyPrefs({ textSize: prefs.textSize });
      else push.textSize = root.dataset.fs ?? "md";
      if (push.theme || push.textSize) send("/api/preferences/", "PUT", push).catch(warn);

      window.addEventListener("lessons:read", onRead);
      window.addEventListener("prefs:changed", onPrefs);
    }

    init().catch(warn);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(prefTimer);
      window.removeEventListener("lessons:read", onRead);
      window.removeEventListener("prefs:changed", onPrefs);
    };
  }, [status]);

  return null;
}
