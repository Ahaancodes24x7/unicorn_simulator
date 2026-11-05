"use client";

// Small game-UI pieces shared by the dashboard: confetti, progress bars and the health ring.
import { useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
const CONFETTI_COLORS = ["#f2a65a", "#ec4899", "#8b5cf6", "#7ee08a", "#f6c56b", "#60a5fa"];

/** A one-shot confetti burst. Change `fire` (e.g. a counter) to replay it. */
export function Confetti({ fire, count = 70 }: { fire: number; count?: number }) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; dx: number; rot: number; color: string; w: number }[]>([]);
  useEffect(() => {
    if (!fire || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPieces(Array.from({ length: count }, (_, i) => ({
      id: fire * 1000 + i, left: Math.random() * 100, delay: Math.random() * 0.4, dx: (Math.random() - 0.5) * 240,
      rot: 360 + Math.random() * 720, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], w: 6 + Math.random() * 6,
    })));
    const t = setTimeout(() => setPieces([]), 3200);
    return () => clearTimeout(t);
  }, [fire, count]);
  if (!pieces.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.color, animation: `confetti-fall 2.6s ${p.delay}s cubic-bezier(0.2,0.6,0.4,1) both`, ["--dx" as string]: `${p.dx}px`, ["--rot" as string]: `${p.rot}deg` }} />
      ))}
    </div>
  );
}

export function Meter({ value, className = "", bar = "xp-bar", height = "h-2.5" }: { value: number; className?: string; bar?: string; height?: string }) {
  return (
    <div className={`${height} overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10 ${className}`}>
      <div className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`} style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Ring({ value, color, size = 120, stroke = 12, children }: { value: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: "stroke-dashoffset 1s ease-out", filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Delta({ value, fmt }: { value: number | null; fmt: (v: number) => string }) {
  if (value === null || Math.abs(value) < 0.5) return <span className="text-[11px] text-faint">· no change</span>;
  const up = value > 0;
  return <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${up ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}><Icon name={up ? "up" : "down"} inherit />{fmt(Math.abs(value))}</span>;
}
