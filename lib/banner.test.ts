import { describe, expect, it } from "vitest";
import { motifFor } from "../components/anim/scenes/banner";
import lessons from "../.velite/lessons.json";

describe("motifFor", () => {
  it("maps concepts to matching diagrams", () => {
    expect(motifFor("Designing an LLM Gateway").id).toBe("gateway");
    expect(motifFor("Enterprise RAG Assistant").id).toBe("rag");
    expect(motifFor("Designing a Semantic Caching Service").id).toBe("semantic-cache");
  });

  it("uses a lesson's own banner over the title match", () => {
    const m = motifFor("Designing an LLM Gateway", "", { layout: "loop", nodes: [["db", "a"], ["db", "b"]] });
    expect(m.id).toBe("custom");
    expect(m.layout).toBe("loop");
  });

  it("covers almost every lesson with a specific diagram", () => {
    const generic = (lessons as { title: string; tags: string[] }[]).filter(
      (l) => motifFor(l.title, l.tags.join(" ")).id === "default",
    );
    expect(generic.map((l) => l.title)).toEqual([]);
  });
});
