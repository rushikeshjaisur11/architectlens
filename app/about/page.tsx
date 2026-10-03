import type { Metadata } from "next";
import { CONTACT_EMAIL, GITHUB_URL, OWNER_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "What architectlens is, who it is for, and how its notes are sourced.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <article className="prose max-w-none">
        <h1>About architectlens</h1>
        <p>
          architectlens is a structured library for people who design and build software systems. It covers{" "}
          <strong>classic system design</strong>, the <strong>building blocks of production AI</strong>, and complete
          designs for AI products, written to be read the way you would read a good book: one idea at a time, with a
          diagram beside it.
        </p>

        <h2>Who it is for</h2>
        <ul>
          <li>Engineers moving from building features to designing systems.</li>
          <li>Teams adopting LLMs who need to reason about retrieval, serving, evaluation, safety and cost.</li>
          <li>Anyone preparing for architecture or system design discussions.</li>
        </ul>

        <h2 id="method">How the notes are made</h2>
        <ul>
          <li>
            Each note ends with a <strong>list of the references</strong> it draws on.
          </li>
          <li>
            Sections titled &ldquo;Current practice&rdquo; or &ldquo;Enterprise practice&rdquo; state the date they
            were checked and name their sources. Where a detail could not be checked against a primary source, the
            note says so.
          </li>
          <li>Notes move from the basic idea to the trade-offs you meet at enterprise scale.</li>
        </ul>

        <h2>About the author</h2>
        <p>
          architectlens is written and maintained by <strong>{OWNER_NAME}</strong>, a senior data engineer and AI
          engineer based in Pune, India, with more than six years of experience building data platforms and, more
          recently, production AI and agentic systems. Education: M.Tech in Data Science and Engineering, BITS Pilani.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, corrections and suggestions are welcome: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          You can also find the author on <a href={GITHUB_URL}>GitHub</a>.
        </p>

        <h2>A note on use</h2>
        <p>
          Products, prices and APIs change quickly. Treat the notes as a guide to the <strong>reasoning</strong>, and
          confirm specifics against official documentation before relying on them in production.
        </p>
      </article>
    </main>
  );
}
