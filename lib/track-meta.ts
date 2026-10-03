// Identity of each top-level section of the site. The three tracks and the frameworks guides are
// separate sections, each with its own route, hue and icon, so none reads as part of another.
export type SectionKey = "system-design" | "ai-systems" | "ai-system-design" | "frameworks";
export type SectionIconKey = "network" | "brain" | "blocks" | "wrench";

export type Section = {
  key: SectionKey;
  name: string;
  href: string;
  hue: number;
  icon: SectionIconKey;
  tagline: string;
  audience: string[];
};

export const SECTIONS: Section[] = [
  {
    key: "system-design",
    name: "System Design",
    href: "/system-design",
    hue: 232,
    icon: "network",
    tagline: "How large systems scale, fail and recover.",
    audience: ["Data, caching and consistency", "Queues, streams and coordination", "Classic designs and real incidents"],
  },
  {
    key: "ai-systems",
    name: "AI Systems",
    href: "/ai-systems",
    hue: 172,
    icon: "brain",
    tagline: "The building blocks of production AI.",
    audience: ["Prompting, context and RAG", "Serving, agents and tool use", "Evals, safety and cost"],
  },
  {
    key: "ai-system-design",
    name: "AI System Design",
    href: "/ai-system-design",
    hue: 268,
    icon: "blocks",
    tagline: "End-to-end designs for AI products and platforms.",
    audience: ["Assistants, search and agents", "LLM platforms and multi-tenant AI", "Regulated and industry solutions"],
  },
  {
    key: "frameworks",
    name: "Frameworks",
    href: "/frameworks",
    hue: 335,
    icon: "wrench",
    tagline: "Hands-on guides for agent and AI frameworks.",
    audience: ["Mapped back to the patterns", "Grouped by language", "New guides on the way"],
  },
];

export function sectionByKey(key: string): Section {
  const section = SECTIONS.find((s) => s.key === key);
  if (!section) throw new Error(`Unknown section: "${key}"`);
  return section;
}

// Which section a pathname belongs to; null on the landing page and other site pages.
export function activeSection(pathname: string): SectionKey | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  const key = first === "lessons" ? second : first;
  return SECTIONS.some((s) => s.key === key) ? (key as SectionKey) : null;
}
