import Link from "next/link";

export function SectionCard({
  href,
  title,
  count,
  description,
}: {
  href: string;
  title: string;
  count: number;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-200 p-6 hover:border-neutral-400 transition-colors"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <p className="mt-4 text-xs uppercase tracking-wide text-neutral-400">{count} notes</p>
    </Link>
  );
}
