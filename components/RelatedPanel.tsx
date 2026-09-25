import Link from "next/link";

export function RelatedPanel({ items }: { items: { href: string; title: string }[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="mt-8 border-t border-neutral-800 pt-4">
      <h3 className="text-sm font-medium text-neutral-200">Related</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm text-cyan-400 hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
