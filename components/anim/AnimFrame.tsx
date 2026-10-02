import type { ButtonHTMLAttributes, ReactNode } from "react";

export function AnimFrame({
  title,
  caption,
  controls,
  children,
}: {
  title: string;
  caption?: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="not-prose my-8 rounded-lg border border-line bg-ink-elevated/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-accent">{title}</span>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
      {children}
      {caption && <p className="mt-4 text-xs leading-relaxed text-paper-muted">{caption}</p>}
    </figure>
  );
}

export function AnimButton({ active, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-accent-dim text-accent" : "border-line text-paper-muted hover:border-accent-dim hover:text-paper"
      } ${className}`}
    />
  );
}
