import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "What architectlens is, who it is for, and how its notes are sourced.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-paper">About architectlens</h1>
      <p className="mt-5 text-lg leading-relaxed text-paper-muted">
        architectlens is a structured library for people who design and build software systems. It covers classic
        system design, the building blocks of production AI, and complete designs for AI products, written to be
        read the way you would read a good book: one idea at a time, with a diagram beside it.
      </p>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight text-paper">Who it is for</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-paper-muted">
        <li>Engineers moving from building features to designing systems.</li>
        <li>Teams adopting LLMs who need to reason about retrieval, serving, evaluation, safety and cost.</li>
        <li>Anyone preparing for architecture or system design discussions.</li>
      </ul>

      <h2 id="method" className="mt-12 scroll-mt-20 text-2xl font-semibold tracking-tight text-paper">
        How the notes are made
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-paper-muted">
        <li>Each note ends with a list of the references it draws on.</li>
        <li>
          Sections titled &ldquo;Current practice&rdquo; or &ldquo;Enterprise practice&rdquo; state the date they
          were checked and name their sources. Where a detail could not be checked against a primary source, the
          note says so.
        </li>
        <li>Notes move from the basic idea to the trade-offs you meet at enterprise scale.</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight text-paper">A note on use</h2>
      <p className="mt-4 leading-relaxed text-paper-muted">
        Products, prices and APIs change quickly. Treat the notes as a guide to the reasoning, and confirm specifics
        against official documentation before relying on them in production.
      </p>
    </main>
  );
}
