import Link from "next/link";
import { studies } from "#velite";
import { sortByOrder } from "@/lib/content";
import { EmptyState } from "@/components/EmptyState";

export default function StudiesPage() {
  const sorted = sortByOrder(studies);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Studies</h1>
      {sorted.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No studies yet"
            message="Full end-to-end HLD walkthroughs land here as they're written."
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-1">
          {sorted.map((item) => (
            <li key={item.slug}>
              <Link href={`/studies/${item.slug}`} className="text-blue-700 hover:underline">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
