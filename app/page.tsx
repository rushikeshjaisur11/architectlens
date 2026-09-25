import { concepts, cases, studies, builds } from "#velite";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-neutral-100">architectlens</h1>
      <p className="mt-2 text-neutral-400">
        System design concepts, cases, studies, and builds — browse via the sidebar.
      </p>
      <dl className="mt-10 grid grid-cols-2 gap-4 text-sm text-neutral-400">
        <div>
          <dt className="text-neutral-500">Concepts</dt>
          <dd className="text-xl text-neutral-100">{concepts.length}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Cases</dt>
          <dd className="text-xl text-neutral-100">{cases.length}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Studies</dt>
          <dd className="text-xl text-neutral-100">{studies.length}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Builds</dt>
          <dd className="text-xl text-neutral-100">{builds.length}</dd>
        </div>
      </dl>
    </main>
  );
}
