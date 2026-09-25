import Link from "next/link";

export function Sidebar({
  groups,
}: {
  groups: { heading: string; items: { href: string; title: string }[] }[];
}) {
  return (
    <nav className="w-64 shrink-0 border-r border-neutral-200 p-4">
      {groups.map((group) => (
        <div key={group.heading} className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {group.heading}
          </h3>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-neutral-700 hover:text-neutral-950">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
