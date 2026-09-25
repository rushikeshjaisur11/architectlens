import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryFromFolderName } from "./categories";

describe("CATEGORIES", () => {
  it("has exactly 18 categories numbered 1 through 18 with no gaps", () => {
    expect(CATEGORIES).toHaveLength(18);
    expect(CATEGORIES.map((c) => c.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
});

describe("categoryFromFolderName", () => {
  it("resolves a folder name to its category", () => {
    expect(categoryFromFolderName("01-foundations")).toEqual({
      number: 1,
      slug: "foundations",
      name: "Foundations",
    });
  });

  it("resolves a multi-word category name", () => {
    expect(categoryFromFolderName("06-distributed-coordination")).toEqual({
      number: 6,
      slug: "distributed-coordination",
      name: "Distributed coordination",
    });
  });

  it("throws for a folder name with no numeric prefix", () => {
    expect(() => categoryFromFolderName("foundations")).toThrow();
  });

  it("throws for an unknown category number", () => {
    expect(() => categoryFromFolderName("99-unknown")).toThrow();
  });

  it("throws when the slug doesn't match the number's real slug (wrong/duplicate number reuse)", () => {
    expect(() => categoryFromFolderName("06-foundations")).toThrow();
  });

  it("throws for an unpadded number even if the slug is correct", () => {
    expect(() => categoryFromFolderName("1-foundations")).toThrow();
  });
});
