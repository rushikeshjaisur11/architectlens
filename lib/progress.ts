// Read-state lives in the browser only (no accounts). Key per lesson: "<track>/<category>/<slug>".
const KEY = "read-lessons-v1";

export function readSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function writeSet(set: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...set]));
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

// The lesson to offer next: the first unread one after the most recently read lesson in this list,
// else the first unread one. Home, section pages and path cards all use this so they agree.
export function nextAfterLast<T extends { key: string }>(list: T[], read: Set<string>): T | undefined {
  const last = [...read].filter((k) => list.some((l) => l.key === k)).pop();
  const after = last ? list.slice(list.findIndex((l) => l.key === last) + 1) : list;
  return after.find((l) => !read.has(l.key)) ?? list.find((l) => !read.has(l.key));
}
