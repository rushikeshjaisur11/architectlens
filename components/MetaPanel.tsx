export function MetaPanel({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 font-mono text-xs text-paper-muted">
      {tags.map((tag) => (
        <span key={tag} className="rounded border border-line-soft px-2 py-1">
          {tag}
        </span>
      ))}
    </div>
  );
}
