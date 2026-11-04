"use client";

// Small dependency-free SVG charts tuned for the dusk palette.
import { useState } from "react";

export interface Series {
  label: string;
  color: string;
  values: number[];
  format?: (n: number) => string;
}

export function LineChart({ series, labels, height = 160 }: { series: Series[]; labels: (string | number)[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = height, P = { l: 8, r: 8, t: 12, b: 20 };
  const n = Math.max(1, labels.length);
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const x = (i: number) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);

  if (labels.length === 0) return <div className="flex h-32 items-center justify-center text-sm text-faint">No data yet: play a turn.</div>;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1)))));
        }}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)} stroke="var(--line)" />
        ))}
        {series.map((s) => {
          const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
          return (
            <g key={s.label}>
              <path d={`${d} L${x(s.values.length - 1)} ${y(min)} L${x(0)} ${y(min)} Z`} fill={s.color} opacity="0.08" />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.length === 1 && <circle cx={x(0)} cy={y(s.values[0])} r="3.5" fill={s.color} />}
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--line-strong)" />
            {series.map((s) => s.values[hover] !== undefined && <circle key={s.label} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="var(--ink)" strokeWidth="2" />)}
          </g>
        )}
        <text x={P.l} y={H - 4} fontSize="11" fill="var(--faint)">Turn {labels[0]}</text>
        <text x={W - P.r} y={H - 4} fontSize="11" fill="var(--faint)" textAnchor="end">Turn {labels[labels.length - 1]}</text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
            {hover !== null && s.values[hover] !== undefined && <b className="num text-cream">{(s.format ?? String)(s.values[hover])}</b>}
          </span>
        ))}
        {hover !== null && <span className="text-faint">· turn {labels[hover]}</span>}
      </div>
    </div>
  );
}

export function Donut({ parts, size = 150 }: { parts: { label: string; value: number; color: string }[]; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 42, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Ownership">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {parts.map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />;
          offset += len;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label} <b className="num text-cream">{((p.value / total) * 100).toFixed(1)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bar({ value, max, color = "var(--amber)" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%`, background: color }} />
    </div>
  );
}
