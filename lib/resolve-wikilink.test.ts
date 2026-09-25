import { describe, expect, it } from "vitest";
import { parseWikilinkTarget, targetToHref, isKnownTarget } from "./resolve-wikilink";

describe("parseWikilinkTarget", () => {
  it("resolves an absolute classical concept link", () => {
    const target = parseWikilinkTarget(
      "[[learning/systems-design/classical/02-load-balancing]]",
      "classical/07-rate-limiting.md"
    );
    expect(target).toEqual({ collection: "concepts", track: "classical", slug: "load-balancing" });
  });

  it("resolves an absolute case-scenario link", () => {
    const target = parseWikilinkTarget(
      "[[learning/systems-design/ai/interview/scenarios/01-optimize-1m-queries-day]]",
      "classical/07-rate-limiting.md"
    );
    expect(target).toEqual({ collection: "cases", slug: "optimize-1m-queries-day" });
  });

  it("resolves a relative link within the same folder", () => {
    const target = parseWikilinkTarget("[[08-consistent-hashing]]", "classical/07-rate-limiting.md");
    expect(target).toEqual({ collection: "concepts", track: "classical", slug: "consistent-hashing" });
  });

  it("returns null for a link to index.md", () => {
    const target = parseWikilinkTarget("[[learning/systems-design/classical/index]]", "classical/07-rate-limiting.md");
    expect(target).toBeNull();
  });

  it("returns null for an unrecognized path", () => {
    const target = parseWikilinkTarget("[[learning/systems-design/nope/whatever]]", "classical/07-rate-limiting.md");
    expect(target).toBeNull();
  });

  it("strips an alias after a pipe", () => {
    const target = parseWikilinkTarget(
      "[[learning/systems-design/classical/02-load-balancing|Load Balancing]]",
      "classical/07-rate-limiting.md"
    );
    expect(target).toEqual({ collection: "concepts", track: "classical", slug: "load-balancing" });
  });

  it("returns null for an absolute link into a different vault section entirely", () => {
    const target = parseWikilinkTarget("[[learning/data-eng/kafka/index]]", "ai/01-llm-system-overview.md");
    expect(target).toBeNull();
  });

  it("normalizes a relative '../../' link that climbs back to an in-scope concept", () => {
    const target = parseWikilinkTarget(
      "[[../../02-prompt-routing-model-gateway]]",
      "ai/interview/scenarios/25-red-team-a-customer-agent.md"
    );
    expect(target).toEqual({ collection: "concepts", track: "ai", slug: "prompt-routing-model-gateway" });
  });

  it("returns null for a relative '../' link that lands outside any collection (ai/interview/*.md is not a collection)", () => {
    const target = parseWikilinkTarget(
      "[[../18-prompt-injection-in-tool-using-agent]]",
      "ai/interview/scenarios/25-red-team-a-customer-agent.md"
    );
    expect(target).toBeNull();
  });
});

describe("isKnownTarget", () => {
  it("returns true when the target's href is in the known set", () => {
    const known = new Set(["/concepts/classical/load-balancing"]);
    expect(isKnownTarget({ collection: "concepts", track: "classical", slug: "load-balancing" }, known)).toBe(true);
  });

  it("returns false when the target's href is not in the known set", () => {
    const known = new Set(["/concepts/classical/load-balancing"]);
    expect(isKnownTarget({ collection: "cases", slug: "some-scenario" }, known)).toBe(false);
  });
});

describe("targetToHref", () => {
  it("builds a track-scoped concepts href", () => {
    expect(targetToHref({ collection: "concepts", track: "classical", slug: "load-balancing" })).toBe(
      "/concepts/classical/load-balancing"
    );
  });

  it("builds a cases href", () => {
    expect(targetToHref({ collection: "cases", slug: "optimize-1m-queries-day" })).toBe(
      "/cases/optimize-1m-queries-day"
    );
  });
});
