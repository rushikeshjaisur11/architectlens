import { describe, expect, it } from "vitest";
import { resolveShortTitle } from "./short-title";

describe("resolveShortTitle", () => {
  it("uses the provided short title when present", () => {
    expect(resolveShortTitle("CAP Theorem: A Long Subtitle", "CAP Theorem")).toBe("CAP Theorem");
  });

  it("falls back to the full title when short title is absent", () => {
    expect(resolveShortTitle("CAP Theorem: A Long Subtitle", undefined)).toBe("CAP Theorem: A Long Subtitle");
  });
});
