import { describe, expect, it } from "vitest";
import { buildNavTree } from "./nav-tree";

const foundations = { number: 1, slug: "foundations", name: "Foundations" };
const apis = { number: 2, slug: "apis-services-protocols", name: "APIs, services and protocols" };

describe("buildNavTree", () => {
  it("returns all 18 categories in fixed numeric order, even when every one is empty", () => {
    const tree = buildNavTree([]);
    expect(tree).toHaveLength(18);
    expect(tree[0].heading).toBe("01 Foundations");
    expect(tree[17].heading).toBe("18 Engineering case studies");
  });

  it("includes a zero-lesson category as an empty-items group, not omitted", () => {
    const tree = buildNavTree([]);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    expect(foundationsGroup.items).toEqual([]);
  });

  it("orders lessons within a category by their order field", () => {
    const lessons = [
      { slug: "second", title: "Second", shortTitle: "Second", order: 2, category: foundations },
      { slug: "first", title: "First", shortTitle: "First", order: 1, category: foundations },
    ];
    const tree = buildNavTree(lessons);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    expect(foundationsGroup.items.map((i) => i.title)).toEqual(["First", "Second"]);
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
    const tree = buildNavTree(lessons);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    expect(foundationsGroup.items[0].title).toBe("CAP Theorem");
  });

  it("builds hrefs scoped by category slug", () => {
    const lessons = [{ slug: "rest-vs-rpc", title: "REST vs RPC", shortTitle: "REST vs RPC", order: 1, category: apis }];
    const tree = buildNavTree(lessons);
    const apisGroup = tree.find((g) => g.heading.startsWith("02"))!;
    expect(apisGroup.items[0].href).toBe("/lessons/apis-services-protocols/rest-vs-rpc");
  });

  it("keeps the same slug in two different categories separate (hrefs differ by category)", () => {
    const lessons = [
      { slug: "overview", title: "Foundations Overview", shortTitle: "Overview", order: 1, category: foundations },
      { slug: "overview", title: "APIs Overview", shortTitle: "Overview", order: 1, category: apis },
    ];
    const tree = buildNavTree(lessons);
    const foundationsGroup = tree.find((g) => g.heading.startsWith("01"))!;
    const apisGroup = tree.find((g) => g.heading.startsWith("02"))!;
    expect(foundationsGroup.items[0].href).toBe("/lessons/foundations/overview");
    expect(apisGroup.items[0].href).toBe("/lessons/apis-services-protocols/overview");
  });
});
