import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, OWNER_NAME, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `Terms for using ${SITE_NAME}.`,
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <article className="prose max-w-none">
        <h1>Terms of use</h1>
        <p>By using {SITE_NAME} you agree to these terms. They are short on purpose.</p>

        <h2>Educational content</h2>
        <p>
          The notes are provided for learning. Technology, prices and APIs change quickly, and the notes may be
          incomplete or out of date. Check official documentation and use your own judgement before relying on
          anything here in production, legal, financial or safety-critical work.
        </p>

        <h2>No warranty</h2>
        <p>
          The site and its content are provided &ldquo;as is&rdquo;, without warranties of any kind. To the extent the
          law allows, {SITE_NAME} is not liable for losses that result from using the site or its content.
        </p>

        <h2>Ownership and use</h2>
        <p>
          The notes, diagrams and design of the site belong to {OWNER_NAME} ({SITE_NAME}). You may read them, link to them and quote
          short excerpts with attribution. Please do not copy, republish or resell them in bulk without permission.
          Product and company names mentioned are trademarks of their owners and are used only to identify them. Open
          source components used by the site are listed on the <Link href="/licenses">licences page</Link>.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may change as the site grows. Continued use after a change means you accept the updated terms.
        </p>
        {CONTACT_EMAIL && (
          <p>
            Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        )}
      </article>
    </main>
  );
}
