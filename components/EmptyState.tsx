export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center">
      <h2 className="text-base font-medium text-neutral-700">{title}</h2>
      <p className="mt-2 text-sm text-neutral-500">{message}</p>
    </div>
  );
}
