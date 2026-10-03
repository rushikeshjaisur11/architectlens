import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licences",
  description: "Open source software and fonts used by architectlens.",
};

const SOFTWARE = [
  { name: "Next.js", license: "MIT", holder: "Vercel, Inc." },
  { name: "React", license: "MIT", holder: "Meta Platforms, Inc." },
  { name: "Fuse.js", license: "Apache-2.0", holder: "Kiro Risk" },
  { name: "Lucide", license: "ISC", holder: "Lucide Contributors" },
  { name: "thinking-orbs", license: "MIT", holder: "Jakub Antalik" },
  { name: "border-beam", license: "MIT", holder: "Jakub Antalik" },
];

const FONTS = [
  { name: "Atkinson Hyperlegible Next and Mono", holder: "Braille Institute of America, Inc." },
  { name: "Literata", holder: "The Literata Project Authors" },
];

export default function LicensesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <article className="prose max-w-none">
        <h1>Licences</h1>
        <p>architectlens is built with open source software and fonts. Thank you to their authors.</p>

        <h2>Software</h2>
        <ul>
          {SOFTWARE.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>: {s.license}, &copy; {s.holder}
            </li>
          ))}
        </ul>
        <p>
          The MIT, ISC and Apache-2.0 licences permit use, copying and distribution, including in commercial
          products, provided their copyright and licence notices are kept. Each package ships its full licence text.
        </p>

        <h2>Fonts</h2>
        <ul>
          {FONTS.map((f) => (
            <li key={f.name}>
              <strong>{f.name}</strong>: SIL Open Font License 1.1, &copy; {f.holder}
            </li>
          ))}
        </ul>
        <p>
          The SIL Open Font License allows these fonts to be used and embedded in commercial work. The full licence is
          at <a href="https://openfontlicense.org">openfontlicense.org</a>.
        </p>
      </article>
    </main>
  );
}
