export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-700 p-12 text-center">
      <h2 className="text-base font-medium text-neutral-200">{title}</h2>
      <p className="mt-2 text-sm text-neutral-400">{message}</p>
    </div>
  );
}
