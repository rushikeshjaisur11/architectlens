import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import path from "node:path";
import { parseWikilinkTarget, targetToHref } from "./resolve-wikilink";
import { VAULT_SYSTEMS_DESIGN_ROOT } from "./vault-path";

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

export function remarkWikilinks() {
  return (tree: Root, file: { path?: string; data: Record<string, unknown> }) => {
    const currentPath = file.path
      ? path.relative(VAULT_SYSTEMS_DESIGN_ROOT, file.path).replace(/\\/g, "/")
      : "";

    visit(tree, "text", (node: { value: string }, index, parent) => {
      if (!parent || index === null || !WIKILINK_RE.test(node.value)) return;
      WIKILINK_RE.lastIndex = 0;

      const newChildren: unknown[] = [];
      let lastEnd = 0;
      let match: RegExpExecArray | null;

      while ((match = WIKILINK_RE.exec(node.value))) {
        const [full, raw] = match;
        if (match.index > lastEnd) {
          newChildren.push({ type: "text", value: node.value.slice(lastEnd, match.index) });
        }

        const target = parseWikilinkTarget(`[[${raw}]]`, currentPath);
        if (target) {
          newChildren.push({
            type: "link",
            url: targetToHref(target),
            children: [{ type: "text", value: raw.split("|")[0] }],
          });
        } else {
          console.warn(`[architectlens] broken wikilink "${raw}" in ${currentPath}`);
          newChildren.push({
            type: "html",
            value: `<span data-broken-link="true">${raw.split("|")[0]}</span>`,
          });
        }

        lastEnd = match.index + full.length;
      }

      if (lastEnd < node.value.length) {
        newChildren.push({ type: "text", value: node.value.slice(lastEnd) });
      }

      parent.children.splice(index, 1, ...(newChildren as never[]));
    });
  };
}
