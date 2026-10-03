import type { Kind } from "../components/anim/scenes/shapes";

// Allowed node shapes for a lesson's `banner:` frontmatter (checked by the velite build).
export const BANNER_KINDS = [
  "server", "db", "cache", "queue", "client", "phone", "user", "lb",
  "cloud", "cdn", "doc", "gpu", "shield", "lock", "model",
] as const satisfies readonly Kind[];

export type BannerSpec = { layout: "line" | "loop" | "fan"; nodes: [(typeof BANNER_KINDS)[number], string][] };
