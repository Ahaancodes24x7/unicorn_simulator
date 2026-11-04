// Scenic Silicon Valley banner (dusk sky, the hill with its sign and radio tower, city lights) used as
// the header of the Missions and Crew pages. Pure SVG + CSS, so it stays cheap to render.
import type { ReactNode } from "react";

const LIGHTS = Array.from({ length: 46 }, (_, i) => {
  const h = Math.imul(i + 1, 2654435761) >>> 0;
  return { x: 520 + (h % 1080), y: 205 + ((h >>> 11) % 60), d: (h >>> 7) % 5 };
});

export function PageHero({ title, subtitle, right, children }: { title: string; subtitle: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="game-card overflow-hidden">
      <svg viewBox="0 0 1600 280" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f1236" />
            <stop offset="0.45" stopColor="#5b2a5e" />
            <stop offset="0.8" stopColor="#c4584a" />
            <stop offset="1" stopColor="#f19a5a" />
          </linearGradient>
          <linearGradient id="ph-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#170d22" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#170d22" stopOpacity="0.55" />
            <stop offset="1" stopColor="#170d22" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1600" height="280" fill="url(#ph-sky)" />
        <circle cx="1180" cy="250" r="70" fill="#ffd38a" opacity="0.35" />
        <path d="M0 250 L180 225 L360 240 L560 212 L760 232 L980 205 L1200 226 L1400 208 L1600 222 L1600 280 L0 280 Z" fill="#4a2342" opacity="0.8" />
        <path d="M620 280 C 820 230, 1000 160, 1240 110 C 1340 92, 1460 88, 1600 96 L1600 280 Z" fill="#2c1828" />
        <text x="1000" y="214" transform="rotate(-13 1000 214)" fill="#f3e4cf" fontSize="34" fontWeight="800" letterSpacing="5" opacity="0.85" style={{ fontFamily: "var(--font-inter)" }}>SILICON VALLEY</text>
        <g stroke="#1a0f17" strokeWidth="3" fill="none">
          <path d="M1392 100 L1406 22 M1428 100 L1414 22 M1396 74 L1424 74 M1400 50 L1420 50 M1396 74 L1420 50 M1424 74 L1400 50" />
          <path d="M1388 22 L1432 22 M1410 22 L1410 6" />
        </g>
        <circle cx="1410" cy="6" r="4" fill="#ff4b3a" style={{ animation: "beacon 2.4s linear infinite" }} />
        {LIGHTS.map((l, i) => <circle key={i} cx={l.x} cy={l.y} r="1.6" fill="#ffd27f" style={{ animation: `twinkle ${3 + l.d}s ${l.d}s ease-in-out infinite` }} />)}
        <rect width="1600" height="280" fill="url(#ph-fade)" />
      </svg>
      <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div>
          <h2 className="font-serif text-4xl text-cream [text-shadow:0_4px_20px_rgba(0,0,0,0.5)] sm:text-6xl">{title}</h2>
          <p className="mt-2 max-w-xl text-cream/85 [text-shadow:0_2px_10px_rgba(0,0,0,0.6)]">{subtitle}</p>
        </div>
        {right}
      </div>
      {children && <div className="relative px-6 pb-6 sm:px-8">{children}</div>}
    </section>
  );
}
