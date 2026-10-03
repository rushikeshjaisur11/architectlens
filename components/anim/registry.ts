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
  "delivery-guarantees": dynamic(() => import("./DeliveryGuarantees"), { ssr: false }),
  "chunking-playground": dynamic(() => import("./ChunkingPlayground"), { ssr: false }),
  "raft-election": dynamic(() => import("./RaftElection"), { ssr: false }),
  "eviction-policies": dynamic(() => import("./EvictionPolicies"), { ssr: false }),
  "littles-law-queue": dynamic(() => import("./LittlesLawQueue"), { ssr: false }),
  "availability-nines": dynamic(() => import("./AvailabilityNines"), { ssr: false }),
  "circuit-breaker": dynamic(() => import("./CircuitBreaker"), { ssr: false }),
  "retry-storm": dynamic(() => import("./RetryStorm"), { ssr: false }),
  "quantization-tradeoff": dynamic(() => import("./QuantizationTradeoff"), { ssr: false }),
  "cap-partition": dynamic(() => import("./CapPartition"), { ssr: false }),
  "prefix-caching": dynamic(() => import("./PrefixCaching"), { ssr: false }),
  "agent-loop": dynamic(() => import("./AgentLoop"), { ssr: false }),
};
