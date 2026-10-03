import { describe, expect, it } from "vitest";
import { TRACKS, hasTrackContext } from "./tracks";
import { SECTIONS, activeSection } from "./track-meta";

describe("SECTIONS", () => {
  it("has one section per track plus frameworks, each with its own hue, route and icon", () => {
    expect(SECTIONS.map((s) => s.key)).toEqual([...TRACKS.map((t) => t.slug), "frameworks"]);
    expect(new Set(SECTIONS.map((s) => s.hue)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((s) => s.icon)).size).toBe(SECTIONS.length);
    expect(SECTIONS.map((s) => s.href)).toEqual(SECTIONS.map((s) => `/${s.key}`));
  });
});

describe("activeSection", () => {
  it("maps section roots and lesson paths, and is null elsewhere", () => {
    expect(activeSection("/ai-systems")).toBe("ai-systems");
    expect(activeSection("/lessons/ai-system-design/x/y")).toBe("ai-system-design");
    expect(activeSection("/frameworks/google-adk")).toBe("frameworks");
    expect(activeSection("/")).toBeNull();
    expect(activeSection("/about")).toBeNull();
  });
});

describe("hasTrackContext", () => {
  it("is true on track and lesson pages only", () => {
    expect(hasTrackContext("/system-design")).toBe(true);
    expect(hasTrackContext("/lessons/ai-systems/a/b")).toBe(true);
    expect(hasTrackContext("/")).toBe(false);
    expect(hasTrackContext("/frameworks")).toBe(false);
  });
});
