export const ANIMATION_NAMES = ["rag-pipeline", "consistent-hashing", "token-bucket", "cache-hit-rate", "cache-write-strategies", "thundering-herd", "delivery-guarantees", "chunking-playground", "raft-election", "eviction-policies", "littles-law-queue", "availability-nines", "circuit-breaker", "retry-storm", "quantization-tradeoff", "cap-partition", "prefix-caching", "agent-loop"] as const;

export type AnimationName = (typeof ANIMATION_NAMES)[number];
