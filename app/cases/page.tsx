import Link from "next/link";
import { cases } from "#velite";
import { sortByOrder } from "@/lib/content";

export default function CasesPage() {
  const sorted = sortByOrder(cases);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Cases</h1>
      <ul className="mt-6 space-y-1">
        {sorted.map((item) => (
          <li key={item.slug}>
            <Link href={`/cases/${item.slug}`} className="text-blue-700 hover:underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
