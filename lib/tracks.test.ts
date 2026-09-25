import { describe, expect, it } from "vitest";
import { TRACKS, trackFromSlug } from "./tracks";

describe("TRACKS", () => {
  it("has exactly two tracks: system-design and ai-systems", () => {
    expect(TRACKS.map((t) => t.slug)).toEqual(["system-design", "ai-systems"]);
  });

  it("gives system-design 18 numbered categories with no gaps", () => {
    const sd = TRACKS.find((t) => t.slug === "system-design")!;
    expect(sd.categories).toHaveLength(18);
    expect(sd.categories.map((c) => c.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it("gives ai-systems 10 numbered categories with no gaps", () => {
    const ai = TRACKS.find((t) => t.slug === "ai-systems")!;
    expect(ai.categories).toHaveLength(10);
    expect(ai.categories.map((c) => c.number)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });
});

describe("trackFromSlug", () => {
  it("resolves a known track", () => {
    expect(trackFromSlug("ai-systems").name).toBe("AI Systems");
  });

  it("throws for an unknown track slug", () => {
    expect(() => trackFromSlug("nonexistent")).toThrow();
  });
});
