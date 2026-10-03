"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { AnimationName } from "./names";

export const ANIMATIONS: Record<AnimationName, ComponentType> = {
  "rag-pipeline": dynamic(() => import("./RagPipeline"), { ssr: false }),
  "consistent-hashing": dynamic(() => import("./ConsistentHashing"), { ssr: false }),
  "token-bucket": dynamic(() => import("./TokenBucket"), { ssr: false }),
  "cache-hit-rate": dynamic(() => import("./CacheHitRate"), { ssr: false }),
  "cache-write-strategies": dynamic(() => import("./CacheWriteStrategies"), { ssr: false }),
  "thundering-herd": dynamic(() => import("./ThunderingHerd"), { ssr: false }),
};
