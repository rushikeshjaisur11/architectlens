import { describe, expect, it } from "vitest";
import { buildKnownHrefs } from "./vault-index";

describe("buildKnownHrefs", () => {
  it("includes a real classical concept and excludes classical/index.md", () => {
    const hrefs = buildKnownHrefs();
    expect(hrefs.has("/concepts/classical/rate-limiting")).toBe(true);
    expect(hrefs.has("/concepts/classical/index")).toBe(false);
  });

  it("includes a real case scenario", () => {
    const hrefs = buildKnownHrefs();
    expect(hrefs.has("/cases/optimize-1m-queries-day")).toBe(true);
  });

  it("does not include ai/interview/*.md non-scenario notes as cases or concepts", () => {
    const hrefs = buildKnownHrefs();
    expect(hrefs.has("/concepts/ai/interview")).toBe(false);
    expect(hrefs.has("/cases/interview")).toBe(false);
  });
});
