"use client";

import { ThinkingOrb } from "thinking-orbs";

export default function Loading() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <ThinkingOrb state="working" size={32} />
    </main>
  );
}
