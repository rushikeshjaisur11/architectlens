import { describe, expect, it } from "vitest";
import { buildNavTree } from "./nav-tree";
import type { Track } from "./tracks";

const foundations = { number: 1, slug: "foundations", name: "Foundations" };
const apis = { number: 2, slug: "apis-services-protocols", name: "APIs, services and protocols" };

const track: Track = {
  slug: "system-design",
  name: "System Design",
  categories: [foundations, apis],
};

describe("buildNavTree", () => {
  it("returns all of the track's categories in fixed numeric order, even when every one is empty", () => {
    const tree = buildNavTree([], track);
    expect(tree).toHaveLength(2);
    expect(tree[0].heading).toBe("01 Foundations");
    expect(tree[1].heading).toBe("02 APIs, services and protocols");
  });

  it("includes a zero-lesson category as an empty-items group, not omitted", () => {
    const tree = buildNavTree([], track);
    expect(tree[0].items).toEqual([]);
  });

  it("orders lessons within a category by their order field", () => {
    const lessons = [
      { slug: "second", title: "Second", shortTitle: "Second", order: 2, category: foundations },
      { slug: "first", title: "First", shortTitle: "First", order: 1, category: foundations },
    ];
    const tree = buildNavTree(lessons, track);
    expect(tree[0].items.map((i) => i.title)).toEqual(["First", "Second"]);
  });

  it("uses shortTitle for nav display, not the full title", () => {
    const lessons = [
      {
        slug: "cap-theorem",
        title: "CAP Theorem: A Very Long Explanatory Subtitle",
        shortTitle: "CAP Theorem",
        order: 1,
        category: foundations,
      },
    ];
    const tree = buildNavTree(lessons, track);
    expect(tree[0].items[0].title).toBe("CAP Theorem");
  });

  it("builds hrefs scoped by track slug and category slug", () => {
    const lessons = [{ slug: "rest-vs-rpc", title: "REST vs RPC", shortTitle: "REST vs RPC", order: 1, category: apis }];
    const tree = buildNavTree(lessons, track);
    expect(tree[1].items[0].href).toBe("/lessons/system-design/apis-services-protocols/rest-vs-rpc");
  });

  it("keeps the same slug in two different categories separate (hrefs differ by category)", () => {
    const lessons = [
      { slug: "overview", title: "Foundations Overview", shortTitle: "Overview", order: 1, category: foundations },
      { slug: "overview", title: "APIs Overview", shortTitle: "Overview", order: 1, category: apis },
    ];
    const tree = buildNavTree(lessons, track);
    expect(tree[0].items[0].href).toBe("/lessons/system-design/foundations/overview");
    expect(tree[1].items[0].href).toBe("/lessons/system-design/apis-services-protocols/overview");
  });
});
