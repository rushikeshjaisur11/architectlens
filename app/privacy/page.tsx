import type { Metadata } from "next";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${SITE_NAME} handles information.`,
};

const ANALYTICS = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <article className="prose max-w-none">
        <h1>Privacy</h1>
        <p>
          {SITE_NAME} currently has <strong>no accounts</strong> and does not ask for personal information. This page
          explains what the site stores and what it does not.
        </p>

        <h2>Stored in your browser</h2>
        <p>To remember your choices, the site saves a few small settings in your browser&apos;s local storage:</p>
        <ul>
          <li>your colour theme and text size;</li>
          <li>which lessons you have read, so progress and &ldquo;Continue&rdquo; links work;</li>
          <li>which modules you have opened on a section page.</li>
        </ul>
        <p>
          This data stays on your device and is not sent to us. Clearing your browser&apos;s site data removes it. The
          site does not set cookies.
        </p>

        <h2>What the site does not do</h2>
        <ul>
          {ANALYTICS ? (
            <li>It does not run advertising trackers or set cookies.</li>
          ) : (
            <>
              <li>It does not run analytics or advertising trackers.</li>
              <li>It does not load fonts or scripts from third-party servers when you visit.</li>
            </>
          )}
          <li>It does not sell or share information about you.</li>
        </ul>

        {ANALYTICS && (
          <>
            <h2>Analytics</h2>
            <p>
              The site counts page views with Plausible, a privacy-focused service that uses no cookies and does not
              track you across sites or store personal data. It is used only to see which notes are read.
            </p>
          </>
        )}

        <h2>Hosting</h2>
        <p>
          Like any website, the hosting provider may process technical data such as your IP address when your browser
          requests a page, under its own privacy statement.
        </p>

        <h2>Changes</h2>
        <p>
          If the site starts to collect information, for example for accounts or payments, this page will be updated
          first.
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
