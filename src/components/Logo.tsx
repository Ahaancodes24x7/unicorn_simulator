import Link from "next/link";

export function UnicornMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M33 4 L28.5 15" />
      <path d="M12 42 C 10 32, 13 25, 19 20 C 21 15, 25 13, 29 14 C 33 15, 37 19, 40 25 C 41 27, 39 29, 37 28 L 33 26 C 31 30, 27 31, 25 36 L 24 42" />
      <path d="M19 20 C 16 18, 15 14, 17 10 M22 17 C 20 14, 20 11, 22 8 M25 15 C 24 12, 25 9, 27 7" />
      <circle cx="31" cy="19" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 text-cream">
      <UnicornMark className="h-9 w-9 text-cream transition group-hover:text-amber" />
      <span className="leading-none">
        <span className="block font-serif text-xl tracking-wide sm:text-2xl">Silicon Valley</span>
        <span className="block text-[9px] font-semibold tracking-[0.42em] text-muted sm:text-[10px]">UNICORN SIMULATOR</span>
      </span>
    </Link>
  );
}
