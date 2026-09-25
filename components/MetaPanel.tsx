export function MetaPanel({
  tags,
  maturity,
  confidence,
}: {
  tags: string[];
  maturity?: string;
  confidence?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
      {maturity && <span className="rounded bg-neutral-100 px-2 py-1">{maturity}</span>}
      {confidence && <span className="rounded bg-neutral-100 px-2 py-1">confidence: {confidence}</span>}
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-neutral-100 px-2 py-1">
          #{tag}
        </span>
      ))}
    </div>
  );
}
