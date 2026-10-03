import { describe, expect, it } from "vitest";
import { TRACKS, trackFromSlug, trackSlugFromPath } from "./tracks";

describe("TRACKS", () => {
  it("has three tracks: system-design, ai-systems and ai-system-design", () => {
    expect(TRACKS.map((t) => t.slug)).toEqual(["system-design", "ai-systems", "ai-system-design"]);
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

describe("trackSlugFromPath", () => {
  it("maps track roots and lesson paths to their track", () => {
    expect(trackSlugFromPath("/")).toBe("system-design");
    expect(trackSlugFromPath("/ai-systems")).toBe("ai-systems");
    expect(trackSlugFromPath("/ai-system-design")).toBe("ai-system-design");
    expect(trackSlugFromPath("/lessons/ai-system-design/x/y")).toBe("ai-system-design");
    expect(trackSlugFromPath("/lessons/ai-systems/x/y")).toBe("ai-systems");
    expect(trackSlugFromPath("/frameworks/google-adk")).toBe("system-design");
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
