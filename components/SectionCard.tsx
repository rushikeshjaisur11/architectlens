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
      className="block rounded-lg border border-neutral-800 p-6 hover:border-neutral-600 transition-colors"
    >
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      <p className="mt-1 text-sm text-neutral-400">{description}</p>
      <p className="mt-4 text-xs uppercase tracking-wide text-neutral-500">{count} notes</p>
    </Link>
  );
}
