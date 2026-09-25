import { describe, expect, it } from "vitest";
import { buildNavTree } from "./nav-tree";

const concepts = [
  { slug: "load-balancing", title: "Load Balancing", track: "classical" as const, order: 2 },
  { slug: "rate-limiting", title: "Rate Limiting", track: "classical" as const, order: 7 },
  { slug: "prompt-routing", title: "Prompt Routing", track: "ai" as const, order: 2 },
];
const cases = [{ slug: "optimize-1m-queries-day", title: "Optimize 1M Queries/Day", order: 1 }];

describe("buildNavTree", () => {
  it("returns groups in fixed order (Classical, AI, Cases) when all have items", () => {
    const tree = buildNavTree(concepts, cases, [], []);
    expect(tree.map((g) => g.heading)).toEqual(["Classical", "AI", "Cases"]);
  });

  it("omits Studies and Builds entirely when they have zero items", () => {
    const tree = buildNavTree(concepts, cases, [], []);
    expect(tree.find((g) => g.heading === "Studies")).toBeUndefined();
    expect(tree.find((g) => g.heading === "Builds")).toBeUndefined();
  });

  it("includes Studies and Builds when they have items", () => {
    const studies = [{ slug: "design-twitter", title: "Design Twitter", order: 1 }];
    const builds = [{ slug: "rate-limiter", title: "Build a Rate Limiter", order: 1 }];
    const tree = buildNavTree(concepts, cases, studies, builds);
    expect(tree.map((g) => g.heading)).toEqual(["Classical", "AI", "Cases", "Studies", "Builds"]);
  });

  it("orders items within a group by their order field", () => {
    const tree = buildNavTree(concepts, [], [], []);
    const classical = tree.find((g) => g.heading === "Classical")!;
    expect(classical.items.map((i) => i.title)).toEqual(["Load Balancing", "Rate Limiting"]);
  });

  it("builds concept hrefs scoped by track", () => {
    const tree = buildNavTree(concepts, [], [], []);
    const ai = tree.find((g) => g.heading === "AI")!;
    expect(ai.items).toEqual([{ href: "/concepts/ai/prompt-routing", title: "Prompt Routing" }]);
  });

  it("builds case hrefs", () => {
    const tree = buildNavTree([], cases, [], []);
    const casesGroup = tree.find((g) => g.heading === "Cases")!;
    expect(casesGroup.items).toEqual([{ href: "/cases/optimize-1m-queries-day", title: "Optimize 1M Queries/Day" }]);
  });
});
