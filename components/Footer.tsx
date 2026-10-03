import Link from "next/link";
import { SECTIONS } from "@/lib/track-meta";
import { CONTACT_EMAIL, GITHUB_URL, OWNER_NAME } from "@/lib/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-ink-elevated/50">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Logo size={26} />
            <span className="text-[15px] font-semibold tracking-tight text-paper">architectlens</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper-muted">
            System design and AI systems, from first principles to current enterprise practice.
          </p>
        </div>
        <nav aria-label="Learn">
          <p className="text-xs font-medium uppercase tracking-wide text-paper-muted">Learn</p>
          <ul className="mt-3 space-y-2 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="text-paper-muted transition-colors hover:text-paper">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="About">
          <p className="text-xs font-medium uppercase tracking-wide text-paper-muted">About</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/about" className="text-paper-muted transition-colors hover:text-paper">
                About architectlens
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-paper-muted transition-colors hover:text-paper">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-paper-muted transition-colors hover:text-paper">
                Terms of use
              </Link>
            </li>
            <li>
              <Link href="/licenses" className="text-paper-muted transition-colors hover:text-paper">
                Licences
              </Link>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-paper-muted transition-colors hover:text-paper">
                Contact
              </a>
            </li>
            <li>
              <a href={GITHUB_URL} className="text-paper-muted transition-colors hover:text-paper">
                GitHub
              </a>
            </li>
            <li>
              <Link href="/about#method" className="text-paper-muted transition-colors hover:text-paper">
                How the notes are made
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line-soft">
        <p className="mx-auto max-w-5xl px-6 py-5 text-xs leading-relaxed text-paper-muted">
          &copy; {new Date().getFullYear()} {OWNER_NAME}. Educational content: check official documentation before relying on it in production.
        </p>
      </div>
    </footer>
  );
}
