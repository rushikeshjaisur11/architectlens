export function MetaPanel({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-neutral-800 px-2 py-1">
          #{tag}
        </span>
      ))}
    </div>
  );
}
