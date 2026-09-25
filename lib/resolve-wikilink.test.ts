import { describe, expect, it } from "vitest";
import { parseWikilinkTarget, targetToHref } from "./resolve-wikilink";

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
