export function MetaPanel({ tags }: { tags: string[] }) {
  return <p className="font-mono text-xs text-paper-muted">{tags.join(" \u00b7 ")}</p>;
}
