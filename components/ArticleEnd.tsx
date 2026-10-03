"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { readSet } from "@/lib/progress";

// Closing line of a lesson: a blinking caret while reading, a small confirmation once it counts as read.
export function ArticleEnd({ lessonKey }: { lessonKey: string }) {
  const [read, setRead] = useState(false);
  useEffect(() => {
    const sync = () => setRead(readSet().has(lessonKey));
    sync();
    window.addEventListener("lessons:read", sync);
    return () => window.removeEventListener("lessons:read", sync);
  }, [lessonKey]);

  return (
    <div className="mt-12 border-t border-line-soft pt-8 text-center">
      {read ? (
        <p className="pop inline-flex items-center gap-2 text-sm font-medium text-hook">
          <Check size={16} /> Marked as read
        </p>
      ) : (
        <p className="text-sm text-paper-muted">
          End of lesson
          <span className="caret" aria-hidden />
        </p>
      )}
    </div>
  );
}
