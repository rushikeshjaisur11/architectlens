"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn } from "lucide-react";

const LABELS: Record<string, string> = { github: "GitHub", google: "Google" };

export function AccountMenu() {
  const { data: session, status } = useSession();
  const [providers, setProviders] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((p: Record<string, unknown>) => setProviders(Object.keys(p).filter((id) => id in LABELS)))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (status === "loading" || (!session && providers.length === 0)) return null;

  const user = session?.user;
  const initials = (user?.name ?? user?.email ?? "?").trim().slice(0, 2).toUpperCase();
  const trigger =
    "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-line text-sm text-paper-muted transition-colors hover:border-accent-dim hover:text-paper";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={user ? "Account menu" : "Sign in"}
        className={user ? `${trigger} w-9 overflow-hidden` : `${trigger} px-3`}
      >
        {user ? (
          user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-medium">{initials}</span>
          )
        ) : (
          <>
            <LogIn size={15} aria-hidden />
            <span className="hidden sm:inline">Sign in</span>
          </>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={user ? "Account" : "Sign in"}
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-ink-elevated p-3 text-sm shadow-lg"
        >
          {user ? (
            <>
              <p className="truncate font-medium text-paper">{user.name}</p>
              <p className="truncate text-xs text-paper-muted">{user.email}</p>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: window.location.href })}
                className="mt-3 w-full rounded-full border border-line px-3 py-1.5 text-paper-muted transition-colors hover:border-accent-dim hover:text-paper"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs leading-relaxed text-paper-muted">
                Sign in to sync your reading progress and settings across devices. Reading never requires an account.
              </p>
              <div className="flex flex-col gap-2">
                {providers.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => signIn(id, { callbackUrl: window.location.href })}
                    className="w-full rounded-full border border-line px-3 py-1.5 text-paper-muted transition-colors hover:border-accent-dim hover:text-paper"
                  >
                    Continue with {LABELS[id]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
