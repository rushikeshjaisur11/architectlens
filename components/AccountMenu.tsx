"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn } from "lucide-react";

const field =
  "w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-paper placeholder:text-paper-muted focus:border-accent-dim focus:outline-none";
const LABELS: Record<string, string> = { github: "GitHub", google: "Google" };

export function AccountMenu() {
  const { data: session, status } = useSession();
  const [providers, setProviders] = useState<string[]>([]);
  const [database, setDatabase] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((s: { database: boolean; providers: string[] }) => {
        setDatabase(s.database);
        setProviders(s.providers.filter((id) => id in LABELS));
      })
      .catch(() => setDatabase(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (mode === "signup") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).catch(() => null);
      if (!res?.ok) {
        setError((await res?.json().catch(() => null))?.error ?? "Something went wrong. Try again");
        setBusy(false);
        return;
      }
    }
    const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setBusy(false);
    if (result?.error) setError(result.code === "rate_limited" ? "Too many attempts. Try again in a few minutes" : "Incorrect email or password");
    else setOpen(false);
  }

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

  if (status === "loading") return null;

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
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-line bg-ink-elevated p-3 text-sm shadow-lg"
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
              {database ? (
                <p className="mb-3 text-xs leading-relaxed text-paper-muted">
                  Sign in to sync your reading progress and settings across devices. Reading never requires an account.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-paper-muted">
                  Accounts are being set up. Reading works without signing in and your progress is saved in this browser.
                </p>
              )}
              <form onSubmit={submit} className="flex flex-col gap-2">
                <fieldset disabled={!database || busy} className="flex flex-col gap-2 disabled:opacity-50">
                  {mode === "signup" && (
                    <input name="name" autoComplete="name" placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
                  )}
                  <input name="email" type="email" required autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === "signup" ? 10 : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder={mode === "signup" ? "Password (10+ characters)" : "Password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={field}
                  />
                  {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
                  <button type="submit" className="w-full rounded-full border border-accent-dim px-3 py-1.5 text-paper transition-colors hover:bg-accent-dim/20">
                    {mode === "signup" ? "Create account" : "Sign in"}
                  </button>
                </fieldset>
                {database && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "signup" ? "signin" : "signup");
                      setError("");
                    }}
                    className="text-xs text-paper-muted underline-offset-2 hover:text-paper hover:underline"
                  >
                    {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
                  </button>
                )}
              </form>
              {database && providers.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
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
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
