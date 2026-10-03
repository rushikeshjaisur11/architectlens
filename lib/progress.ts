// Read-state lives in the browser only (no accounts). Key per lesson: "<track>/<category>/<slug>".
const KEY = "read-lessons-v1";

export function readSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markRead(lessonKey: string): void {
  const set = readSet();
  if (set.has(lessonKey)) return;
  set.add(lessonKey);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
    window.dispatchEvent(new Event("lessons:read"));
  } catch {
    // storage unavailable: progress simply is not remembered
  }
}
