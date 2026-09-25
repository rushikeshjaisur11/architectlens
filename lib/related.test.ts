import { describe, expect, it } from "vitest";
import { resolveRelated } from "./related";

const items = [
  { href: "/concepts/classical/load-balancing", title: "Load Balancing" },
  { href: "/concepts/ai/prompt-routing-model-gateway", title: "Prompt Routing" },
  { href: "/cases/optimize-1m-queries-day", title: "Optimize 1M Queries/Day" },
];

describe("resolveRelated", () => {
  it("resolves a valid absolute wikilink to its item", () => {
    const result = resolveRelated(
      ["[[learning/systems-design/classical/02-load-balancing]]"],
      "classical/07-rate-limiting.md",
      items
    );
    expect(result).toEqual([{ href: "/concepts/classical/load-balancing", title: "Load Balancing" }]);
  });

  it("drops a related entry whose target does not exist (index hub, out-of-vault-section, etc.)", () => {
    const result = resolveRelated(
      ["[[learning/systems-design/classical/index]]", "[[learning/ai/agents/foo]]"],
      "classical/07-rate-limiting.md",
      items
    );
    expect(result).toEqual([]);
  });

  it("does not false-positive match on a short slug appearing inside another word (e.g. slug 'ai')", () => {
    // regression: naive substring matching on "ai" would match "availability"
    const shortSlugItems = [{ href: "/concepts/ai/ai", title: "AI Hub" }];
    const result = resolveRelated(
      ["[[learning/systems-design/classical/01-fundamentals-availability-consistency]]"],
      "classical/07-rate-limiting.md",
      shortSlugItems
    );
    expect(result).toEqual([]);
  });

  it("dedupes when multiple raw links resolve to the same href", () => {
    const result = resolveRelated(
      [
        "[[learning/systems-design/classical/02-load-balancing]]",
        "[[learning/systems-design/classical/02-load-balancing|Load Balancing Alias]]",
      ],
      "classical/07-rate-limiting.md",
      items
    );
    expect(result).toEqual([{ href: "/concepts/classical/load-balancing", title: "Load Balancing" }]);
  });

  it("resolves a related entry that points to a case, not just a concept", () => {
    const result = resolveRelated(
      ["[[learning/systems-design/ai/interview/scenarios/01-optimize-1m-queries-day]]"],
      "ai/09-agent-system-design.md",
      items
    );
    expect(result).toEqual([{ href: "/cases/optimize-1m-queries-day", title: "Optimize 1M Queries/Day" }]);
  });
});
