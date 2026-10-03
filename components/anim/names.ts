export const ANIMATION_NAMES = ["rag-pipeline", "consistent-hashing", "token-bucket", "cache-hit-rate", "cache-write-strategies", "thundering-herd"] as const;

export type AnimationName = (typeof ANIMATION_NAMES)[number];
