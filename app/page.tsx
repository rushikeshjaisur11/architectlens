import { concepts, cases, studies, builds } from "#velite";
import { SectionCard } from "@/components/SectionCard";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold">architectlens</h1>
      <p className="mt-2 text-neutral-600">
        System design concepts, cases, studies, and builds.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <SectionCard
          href="/concepts"
          title="Concepts"
          count={concepts.length}
          description="Classical distributed systems and AI/LLM system design fundamentals."
        />
        <SectionCard
          href="/cases"
          title="Cases"
          count={cases.length}
          description="Real-world scenario walkthroughs and interview questions."
        />
        <SectionCard
          href="/studies"
          title="Studies"
          count={studies.length}
          description="Full end-to-end HLD case studies (design Twitter, Uber, etc)."
        />
        <SectionCard
          href="/builds"
          title="Builds"
          count={builds.length}
          description="Hands-on implementation write-ups."
        />
      </div>
    </main>
  );
}
