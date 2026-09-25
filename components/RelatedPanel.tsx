import Link from "next/link";

export function RelatedPanel({ items }: { items: { href: string; title: string }[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="mt-8 border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-medium text-neutral-700">Related</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-sm text-blue-700 hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
