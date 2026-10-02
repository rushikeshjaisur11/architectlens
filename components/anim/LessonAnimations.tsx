"use client";

import dynamic from "next/dynamic";

const AnimRuntime = dynamic(() => import("./AnimRuntime"), { ssr: false });

export function LessonAnimations({ lessonKey }: { lessonKey: string }) {
  return <AnimRuntime lessonKey={lessonKey} />;
}
