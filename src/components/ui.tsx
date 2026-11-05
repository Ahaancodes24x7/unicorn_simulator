"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "subtle";

const variants: Record<Variant, string> = {
  primary: "bg-cream text-ink hover:bg-white shadow-[0_6px_24px_-8px_rgba(246,231,207,0.6)]",
  ghost: "border border-line-strong text-cream hover:bg-white/5",
  danger: "bg-bad/90 text-ink hover:bg-bad",
  subtle: "bg-white/5 text-cream hover:bg-white/10 border border-line",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
    />
  );
}

export function LinkButton({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Panel({ title, action, children, className = "", id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`glass p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-serif text-xl tracking-wide text-cream">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const badgeTones = {
  neutral: "bg-white/8 text-muted border-line",
  good: "bg-good/12 text-good border-good/30",
  bad: "bg-bad/12 text-bad border-bad/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  accent: "bg-rust/15 text-amber border-rust/35",
  crt: "bg-crt/10 text-crt border-crt/30",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badgeTones[tone]} ${className}`}>{children}</span>;
}

/** Business-term tooltip: hover or focus the dotted label to read the definition. */
export function Term({ label, tip }: { label: ReactNode; tip: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex cursor-help items-center">
      <span tabIndex={0} aria-describedby={id} className="border-b border-dotted border-faint">{label}</span>
      <span id={id} role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-60 rounded-lg border border-line-strong bg-panel-solid p-2.5 text-xs font-normal normal-case leading-relaxed tracking-normal text-muted opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100">
        {tip}
      </span>
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose is usually a fresh function on every render (every keystroke, every background refresh).
  // Keep it in a ref so focus is moved only when the modal opens/closes, not while someone is typing.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        className={`glass anim-float max-h-[90vh] w-full overflow-y-auto bg-panel-solid/95 p-5 outline-none sm:p-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="font-serif text-2xl text-cream">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md px-2 text-2xl leading-none text-muted hover:text-cream">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-faint">{children}</div>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{children}</div>;
}

export const inputClass =
  "w-full rounded-lg border border-line-strong bg-black/25 px-3 py-2 text-sm text-cream placeholder:text-faint focus:border-amber focus:outline-none";

/** JSON fetch helper for our same-origin APIs. Throws with the server's error message. */
export async function api<T = unknown>(url: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(url, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error ?? `Request failed (${res.status})`), { status: res.status });
  return data as T;
}
