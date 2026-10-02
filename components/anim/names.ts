export const ANIMATION_NAMES = ["rag-pipeline", "consistent-hashing", "token-bucket"] as const;

export type AnimationName = (typeof ANIMATION_NAMES)[number];
