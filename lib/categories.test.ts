import { describe, expect, it } from "vitest";
import { categoryFromFolderName, type Category } from "./categories";

const categories: Category[] = [
  { number: 1, slug: "foundations", name: "Foundations" },
  { number: 6, slug: "distributed-coordination", name: "Distributed coordination" },
];

describe("categoryFromFolderName", () => {
  it("resolves a folder name to its category", () => {
    expect(categoryFromFolderName(categories, "01-foundations")).toEqual({
      number: 1,
      slug: "foundations",
      name: "Foundations",
    });
  });

  it("resolves a multi-word category name", () => {
    expect(categoryFromFolderName(categories, "06-distributed-coordination")).toEqual({
      number: 6,
      slug: "distributed-coordination",
      name: "Distributed coordination",
    });
  });

  it("throws for a folder name with no numeric prefix", () => {
    expect(() => categoryFromFolderName(categories, "foundations")).toThrow();
  });

  it("throws for an unknown category number", () => {
    expect(() => categoryFromFolderName(categories, "99-unknown")).toThrow();
  });

  it("throws when the slug doesn't match the number's real slug (wrong/duplicate number reuse)", () => {
    expect(() => categoryFromFolderName(categories, "06-foundations")).toThrow();
  });

  it("throws for an unpadded number even if the slug is correct", () => {
    expect(() => categoryFromFolderName(categories, "1-foundations")).toThrow();
  });
});
