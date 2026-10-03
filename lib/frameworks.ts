export type Framework = { slug: string; name: string; language: string; blurb: string; status: "soon" | "live" };

// Framework guides, grouped by language in the menu. Add an entry here and a page appears for it.
export const FRAMEWORKS: Framework[] = [
  { slug: "google-adk", name: "Google ADK", language: "Python", blurb: "Google's Agent Development Kit for building and deploying agents.", status: "soon" },
  { slug: "langgraph", name: "LangGraph", language: "Python", blurb: "Graph-based framework for stateful, long-running agents and workflows.", status: "soon" },
  { slug: "fastapi", name: "FastAPI", language: "Python", blurb: "Serving LLM and agent backends: async APIs, streaming, auth and deployment.", status: "soon" },
];

export type FrameworkSection = { slug: string; name: string; blurb: string; art: string };

// Every framework is a parent with the same sections; each mirrors a track in the curriculum.
export const FRAMEWORK_SECTIONS: FrameworkSection[] = [
  { slug: "fundamentals", art: "agent workflow tools", name: "Fundamentals", blurb: "Core concepts, setup and a first working example." },
  { slug: "system-design", art: "queue stream async event", name: "System Design", blurb: "Scaling, state, queues, caching and failure handling when building on it." },
  { slug: "ai-systems", art: "rag retrieval augmented", name: "AI Systems", blurb: "Retrieval, tools, memory, evaluation and serving patterns." },
  { slug: "ai-system-design", art: "platform architecture", name: "AI System Design", blurb: "End-to-end reference designs for enterprise AI products." },
  { slug: "production", art: "observability monitoring traces", name: "Production and operations", blurb: "Security, observability, cost, testing and deployment." },
];

export function frameworksByLanguage(): [string, Framework[]][] {
  const out = new Map<string, Framework[]>();
  for (const f of FRAMEWORKS) out.set(f.language, [...(out.get(f.language) ?? []), f]);
  return [...out.entries()];
}
