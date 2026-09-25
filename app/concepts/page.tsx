import Link from "next/link";
import { concepts } from "#velite";
import { groupConceptsByTrack } from "@/lib/content";

export default function ConceptsPage() {
  const grouped = groupConceptsByTrack(concepts);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold">Concepts</h1>
      {(["classical", "ai"] as const).map((track) => (
        <section key={track} className="mt-8">
          <h2 className="text-lg font-semibold capitalize">{track}</h2>
          <ul className="mt-3 space-y-1">
            {grouped[track].map((concept) => (
              <li key={concept.slug}>
                <Link href={`/concepts/${track}/${concept.slug}`} className="text-blue-700 hover:underline">
                  {concept.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
