import { describe, expect, it } from "vitest";
import { sortByOrder, findBySlug } from "./content";

const items = [
  { slug: "b", order: 2 },
  { slug: "a", order: 1 },
];

describe("sortByOrder", () => {
  it("sorts ascending by order", () => {
    expect(sortByOrder(items).map((i) => i.slug)).toEqual(["a", "b"]);
  });

  it("puts items with the no-prefix sentinel last (Velite serializes Infinity as null, so the sentinel must be a finite number)", () => {
    const withSentinel = [...items, { slug: "z", order: Number.MAX_SAFE_INTEGER }];
    expect(sortByOrder(withSentinel).map((i) => i.slug)).toEqual(["a", "b", "z"]);
  });
});

describe("findBySlug", () => {
  it("finds an item by slug", () => {
    expect(findBySlug(items, "a")?.slug).toBe("a");
  });

  it("returns undefined for a missing slug", () => {
    expect(findBySlug(items, "missing")).toBeUndefined();
  });
});
