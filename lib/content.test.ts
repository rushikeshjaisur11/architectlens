import { describe, expect, it } from "vitest";
import { groupConceptsByTrack, sortByOrder, findBySlug, findConceptBySlug } from "./content";

const concepts = [
  { slug: "b", order: 2, track: "classical" as const },
  { slug: "a", order: 1, track: "classical" as const },
  { slug: "c", order: 1, track: "ai" as const },
];

describe("sortByOrder", () => {
  it("sorts ascending by order", () => {
    expect(sortByOrder(concepts).map((c) => c.slug)).toEqual(["a", "c", "b"]);
  });

  it("puts items without a finite order last", () => {
    const withInfinite = [...concepts, { slug: "z", order: Number.POSITIVE_INFINITY, track: "classical" as const }];
    expect(sortByOrder(withInfinite).map((c) => c.slug)).toEqual(["a", "c", "b", "z"]);
  });
});

describe("groupConceptsByTrack", () => {
  it("splits concepts into classical and ai buckets", () => {
    const grouped = groupConceptsByTrack(concepts);
    expect(grouped.classical.map((c) => c.slug)).toEqual(["a", "b"]);
    expect(grouped.ai.map((c) => c.slug)).toEqual(["c"]);
  });

  it("returns an empty array for a track with no entries", () => {
    const grouped = groupConceptsByTrack([]);
    expect(grouped.classical).toEqual([]);
    expect(grouped.ai).toEqual([]);
  });
});

describe("findBySlug", () => {
  it("finds an item by slug", () => {
    expect(findBySlug(concepts, "a")?.slug).toBe("a");
  });

  it("returns undefined for a missing slug", () => {
    expect(findBySlug(concepts, "missing")).toBeUndefined();
  });
});

describe("findConceptBySlug", () => {
  it("scopes lookup to track, so duplicate slugs across tracks don't collide", () => {
    const dup = [
      { slug: "same", order: 1, track: "classical" as const },
      { slug: "same", order: 1, track: "ai" as const },
    ];
    expect(findConceptBySlug(dup, "ai", "same")?.track).toBe("ai");
  });
});
