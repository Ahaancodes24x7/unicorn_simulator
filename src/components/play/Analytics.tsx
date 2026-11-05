"use client";

import { useId, useState } from "react";
import { SCORE_LABELS } from "@/game/scoring";
import type { ScoreWeights } from "@/game/types";
import type { TeamView } from "@/lib/game";
import { money, num, pct, ratio, runway } from "../format";
import { Term } from "../ui";
import { PageHero } from "./PageHero";
import { TERMS } from "./terms";

import { Icon } from "@/components/Icon";
// ---------------------------------------------------------------- small chart kit

type Series = { label: string; color: string; values: number[] };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Multi-series area/line chart with grid, y-axis labels, hover readout and an optional last-point callout. */
function AreaChart({ labels, series, fmt, height = 190, callout }: { labels: number[]; series: Series[]; fmt: (v: number) => string; height?: number; callout?: boolean }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = height, P = { l: 52, r: 14, t: 14, b: 26 };
  const n = labels.length;
  if (n === 0) return <p className="py-10 text-center text-sm text-faint">Play a month to see this chart.</p>;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const x = (i: number) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const step = Math.max(1, Math.ceil(n / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1))))); }}>
      <defs>
        {series.map((s, k) => (
          <linearGradient key={k} id={`${id}-g${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity="0.45" />
            <stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,0.07)" />
          <text x={P.l - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="#8d7a6c">{fmt(max * f)}</text>
        </g>
      ))}
      {labels.map((l, i) => (i % step === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor={i === n - 1 && n > 1 ? "end" : i === 0 && n > 1 ? "start" : "middle"} fontSize="11" fill="#c4ad97">Turn {l}</text>)}
      {series.map((s, k) => {
        const line = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
        return (
          <g key={k}>
            <path d={`${line} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${id}-g${k})`} />
            <path d={line} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${s.color})` }} />
            {s.values.map((v, i) => (n <= 12 || i === n - 1 || i === hover) && <circle key={i} cx={x(i)} cy={y(v)} r={i === hover ? 5.5 : 4} fill="#1d1029" stroke={s.color} strokeWidth="2.5" />)}
          </g>
        );
      })}
      {callout && series[0] && hover === null && (() => {
        const v = series[0].values[n - 1], cx = x(n - 1), cy = y(v), label = fmt(v), w = label.length * 7.5 + 18;
        return (
          <g>
            <rect x={Math.min(W - P.r - w, cx - w / 2)} y={Math.max(0, cy - 34)} width={w} height="24" rx="8" fill={series[0].color} />
            <text x={Math.min(W - P.r - w, cx - w / 2) + w / 2} y={Math.max(0, cy - 34) + 16} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{label}</text>
          </g>
        );
      })()}
      {hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
          <rect x={Math.min(W - 160, x(hover) + 8)} y={P.t} width="150" height={18 + series.length * 16} rx="8" fill="#1d1029" stroke="rgba(255,255,255,0.15)" />
          <text x={Math.min(W - 160, x(hover) + 8) + 10} y={P.t + 14} fontSize="11" fill="#c4ad97">Turn {labels[hover]}</text>
          {series.map((s, k) => <text key={k} x={Math.min(W - 160, x(hover) + 8) + 10} y={P.t + 30 + k * 16} fontSize="12" fill={s.color}>{s.label}: {fmt(s.values[hover])}</text>)}
        </g>
      )}
    </svg>
  );
}

function Gauge({ value, big, small }: { value: number; big: string; small: string }) {
  const r = 80, c = Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[230px]">
      <defs>
        <linearGradient id="gauge-g" x1="0" x2="1"><stop offset="0" stopColor="#e2553b" /><stop offset="0.6" stopColor="#f2a65a" /><stop offset="1" stopColor="#f6c56b" /></linearGradient>
      </defs>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" strokeLinecap="round" />
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#gauge-g)" strokeWidth="16" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
        style={{ transition: "stroke-dashoffset 1s ease-out", filter: "drop-shadow(0 0 6px rgba(242,166,90,0.6))" }} />
      <text x="100" y="88" textAnchor="middle" fontSize="30" fontWeight="700" fill="#f6e7cf" style={{ fontFamily: "var(--font-dm-serif)" }}>{big}</text>
      <text x="100" y="108" textAnchor="middle" fontSize="13" fill="#c4ad97">{small}</text>
    </svg>
  );
}

function GroupedBars({ labels, a, b, fmt }: { labels: number[]; a: Series; b: Series; fmt: (v: number) => string }) {
  const W = 560, H = 190, P = { l: 52, r: 10, t: 22, b: 26 };
  const n = labels.length;
  if (n === 0) return <p className="py-10 text-center text-sm text-faint">Play a month to see this chart.</p>;
  const max = niceMax(Math.max(...a.values, ...b.values, 0));
  const slot = (W - P.l - P.r) / n, bw = Math.min(28, slot * 0.32);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y(max * f)} y2={y(max * f)} stroke="rgba(255,255,255,0.07)" />
          <text x={P.l - 8} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill="#8d7a6c">{fmt(max * f)}</text>
        </g>
      ))}
      {labels.map((l, i) => {
        const cx = P.l + slot * (i + 0.5);
        return (
          <g key={i}>
            {[a, b].map((s, k) => {
              const v = s.values[i], bx = cx + (k === 0 ? -bw - 2 : 2);
              return (
                <g key={k}>
                  <rect x={bx} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} rx="5" fill={s.color} style={{ filter: `drop-shadow(0 0 5px ${s.color})` }} />
                  {n <= 8 && <text x={bx + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize="10.5" fill="#f6e7cf">{fmt(v)}</text>}
                </g>
              );
            })}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="#c4ad97">Turn {l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Radar({ axes }: { axes: { label: string; value: number }[] }) {
  const C = 150, R = 100, n = axes.length;
  const pt = (i: number, f: number) => [C + Math.sin((2 * Math.PI * i) / n) * R * f, C - Math.cos((2 * Math.PI * i) / n) * R * f];
  const poly = (f: (i: number) => number) => axes.map((_, i) => pt(i, f(i)).join(",")).join(" ");
  return (
    <svg viewBox="-70 -10 440 320" className="mx-auto w-full max-w-[380px]">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="rgba(201,150,255,0.18)" />)}
      {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(201,150,255,0.14)" />; })}
      <polygon points={poly((i) => Math.max(0.03, axes[i].value / 100))} fill="rgba(236,72,153,0.25)" stroke="#ec4899" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 8px rgba(236,72,153,0.7))" }} />
      {axes.map((a, i) => { const [x, y] = pt(i, Math.max(0.03, a.value / 100)); return <circle key={i} cx={x} cy={y} r="4" fill="#f9a8d4" />; })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.24);
        return <text key={a.label} x={x} y={y} textAnchor={Math.abs(x - C) < 10 ? "middle" : x > C ? "start" : "end"} dominantBaseline="middle" fontSize="11" fill="#f6e7cf">{a.label}</text>;
      })}
    </svg>
  );
}

function Card({ title, icon, tip, right, children, className = "" }: { title: string; icon: string; tip?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`game-card p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-cream"><Icon name={icon} />{tip ? <Term label={title} tip={tip} /> : title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const Legend = ({ items }: { items: Series[] }) => (
  <span className="flex gap-3 text-xs text-muted">{items.map((s) => <span key={s.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>)}</span>
);

function Change({ now, before, invert }: { now: number; before: number | undefined; invert?: boolean }) {
  if (before === undefined || before === 0) return <span className="text-xs text-faint">first month</span>;
  const c = (now - before) / Math.abs(before);
  if (Math.abs(c) < 0.0005) return <span className="text-xs text-faint">no change</span>;
  const good = invert ? c < 0 : c > 0;
  return <span className={`text-xs font-semibold ${good ? "text-good" : "text-bad"}`}>{c > 0 ? "↑" : "↓"} {c > 0 ? "+" : ""}{(c * 100).toFixed(1)}%</span>;
}

// ---------------------------------------------------------------- Analytics

export function Analytics({ view }: { view: TeamView }) {
  const h = view.state.history;
  const labels = h.map((p) => p.turn);
  const m = view.metrics;
  const prev = h.length >= 2 ? h[h.length - 2] : undefined;
  const contribution = m.arpu * m.grossMargin;
  const payback = m.cac && contribution > 0 ? m.cac / contribution : 0;
  const recent = h.slice(-6);

  const tiles = [
    { icon: "growth", label: "Revenue / turn", value: money(m.revenue), now: m.revenue, before: prev?.revenue, tip: TERMS.revenue },
    { icon: "flame", label: "Burn / turn", value: money(m.burn), now: m.burn, before: prev?.burn, invert: true, tip: "Total cash going out each turn: payroll plus direct costs." },
    { icon: "users", label: "CAC", value: m.cac ? money(m.cac, { cents: m.cac < 100 }) : "–", now: m.cac, before: prev?.cac, invert: true, tip: TERMS.cac },
    { icon: "heart", label: "LTV", value: m.ltv ? money(m.ltv, { cents: m.ltv < 100 }) : "–", now: m.ltv, before: prev?.ltv, tip: TERMS.ltv },
    { icon: "gem", label: "Valuation", value: money(m.valuation), now: m.valuation, before: prev?.valuation, tip: TERMS.valuation },
    { icon: "wallet", label: "Cash on hand", value: money(m.cash), now: m.cash, before: prev?.cash, tip: TERMS.cash, sub: `Runway: ${runway(m.runway)}` },
  ];
  const won = view.state.acquiredTotal;
  const funnel = [
    { label: `${view.track.customerLabel} won (all-time)`, v: won, c: "from-[#8b5cf6] to-[#a855f7]" },
    { label: "Still active", v: view.state.customers, c: "from-[#ec4899] to-[#f472b6]" },
    { label: "Churned", v: view.state.churnedTotal, c: "from-[#f2a65a] to-[#f6c56b]" },
  ];

  return (
    <div className="space-y-5">
      <PageHero title="Analytics" subtitle="Track performance, unit economics and startup health, month by month." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="game-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/30 text-lg ring-1 ring-white/10" aria-hidden="true"><Icon name={t.icon} /></span>
              <span className="text-xs text-muted"><Term label={t.label} tip={t.tip} /></span>
            </div>
            <p className="num mt-2 truncate font-serif text-2xl text-cream">{t.value}</p>
            {t.sub ? <p className="text-xs text-[#c58bff]">{t.sub}</p> : <Change now={t.now} before={t.before} invert={t.invert} />}
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Revenue & burn per turn" icon="chart" right={<Legend items={[{ label: "Revenue", color: "#4ade80", values: [] }, { label: "Burn", color: "#f87171", values: [] }]} />}>
          <AreaChart labels={labels} fmt={(v) => money(v)} series={[
            { label: "Revenue", color: "#4ade80", values: h.map((p) => p.revenue) },
            { label: "Burn", color: "#f87171", values: h.map((p) => p.burn) },
          ]} />
        </Card>
        <Card title="Cash runway" icon="hourglass" tip={TERMS.runway} className="game-card-hot">
          <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr] xl:grid-cols-1 2xl:grid-cols-[auto_1fr]">
            <div className="flex justify-center"><Gauge value={m.netBurn <= 0 ? 1 : m.runway / 12} big={m.netBurn <= 0 ? "∞" : m.runway.toFixed(1)} small={m.netBurn <= 0 ? "Profitable" : "turns left"} /></div>
            <dl className="space-y-2.5 text-sm">
              {[["wallet", "Cash on hand", money(m.cash)], ["flame", "Net burn / turn", m.netBurn > 0 ? money(m.netBurn) : "None"], ["hourglass", "Runway", runway(m.runway)]].map(([i, k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2"><dt className="text-muted"><Icon name={i} /> {k}</dt><dd className="num font-semibold text-cream">{v}</dd></div>
              ))}
            </dl>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Valuation history" icon="gem" tip={TERMS.valuation}>
          <AreaChart labels={labels} fmt={(v) => money(v)} callout series={[{ label: "Valuation", color: "#d946ef", values: h.map((p) => p.valuation) }]} />
        </Card>
        <Card title="CAC vs LTV" icon="balance" tip={TERMS.ltvCac} right={<Legend items={[{ label: "CAC", color: "#a855f7", values: [] }, { label: "LTV", color: "#f59e0b", values: [] }]} />}>
          <GroupedBars labels={recent.map((p) => p.turn)} fmt={(v) => money(v, { cents: v > 0 && v < 10 })}
            a={{ label: "CAC", color: "#a855f7", values: recent.map((p) => p.cac) }} b={{ label: "LTV", color: "#f59e0b", values: recent.map((p) => p.ltv) }} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Customer funnel (all-time)" icon="funnel">
          <ul className="space-y-2">
            {funnel.map((f, i) => (
              <li key={f.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
                <div className="flex justify-center">
                  <div className={`h-10 bg-gradient-to-r ${f.c} shadow-[0_0_14px_rgba(236,72,153,0.35)]`} style={{ width: `${100 - i * 22}%`, clipPath: "polygon(0 0, 100% 0, 94% 100%, 6% 100%)" }} />
                </div>
                <span className="w-48 truncate text-sm capitalize text-cream">{f.label}</span>
                <span className="num w-24 text-right text-sm text-cream">{num(f.v)} <span className="text-faint">{won ? pct(f.v / won) : "–"}</span></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Unit economics" icon="calculator">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["chart", "Gross margin", pct(m.grossMargin), TERMS.margin],
              ["cash", "Contribution / customer", money(contribution, { cents: contribution < 100 }), "Revenue per customer after direct costs, each turn."],
              ["user", "ARPU", money(m.arpu, { cents: m.arpu < 100 }), "Average revenue per customer, per turn."],
              ["timer", "Payback period", payback ? `${payback.toFixed(1)} turns` : "–", "Turns of contribution needed to earn back what a customer cost to acquire (CAC)."],
              ["balance", "LTV : CAC", ratio(m.ltvCac), TERMS.ltvCac],
              ["repeat", "Churn / turn", pct(m.churnRate, 1), TERMS.churn],
            ].map(([i, k, v, tip]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs text-muted"><Icon name={i} /> <Term label={k} tip={tip} /></p>
                <p className="num mt-1 font-serif text-xl text-cream">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Score

const SCORE_META: Record<keyof ScoreWeights, { icon: string; short: string; desc: string; tip: string }> = {
  valuation: { icon: "gem", short: "Company value", desc: "Valuation on a log scale: $10k = 0, $1B = 100.", tip: "grow valuation: revenue growth and milestones raise your multiple" },
  profitability: { icon: "chart-line", short: "Profitability", desc: "LTV:CAC (5× = full marks) and operating margin.", tip: "improve unit economics: raise prices, cut churn, acquire more efficiently" },
  traction: { icon: "users", short: "Traction", desc: "Customers vs your track's target, plus recurring revenue.", tip: "win more customers with growth and partnership missions" },
  execution: { icon: "check-circle", short: "Execution", desc: "Mission hit-rate (partials count half) and milestones.", tip: "complete more missions; assign the best-fit crew" },
  efficiency: { icon: "hourglass", short: "Runway", desc: "Runway (12+ turns or profitable = full) and value per dollar raised.", tip: "protect runway: avoid idle hires and wasteful spend" },
  fundraising: { icon: "handshake", short: "Fundraising", desc: "Rounds raised and ownership retained; missed targets cost points.", tip: "raise rounds on good terms and keep more of your company" },
  resilience: { icon: "shield", short: "Resilience", desc: "70% reputation, 30% low operating risk.", tip: "build reputation and lower risk with compliance and process work" },
};

export function ScorePanel({ view }: { view: TeamView }) {
  const b = view.breakdown;
  const w = view.game.weights;
  const total = Object.values(w).reduce((a, c) => a + c, 0) || 1;
  const keys = Object.keys(SCORE_LABELS) as (keyof ScoreWeights)[];
  const sorted = [...keys].sort((x, y) => b.components[y] - b.components[x]);
  const best = sorted[0];
  const weakest = sorted.slice(-2).reverse();

  return (
    <div className="space-y-5">
      <PageHero title="Score & Performance" subtitle="See how every part of your startup adds up to your score, and how you rank." />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
        <section className="game-card game-card-hot flex items-center justify-center gap-4 p-6">
          <span className="text-4xl opacity-80"><Icon name="leaf" /></span>
          <div className="text-center">
            <p className="text-sm text-muted">Composite score</p>
            <p className="font-serif text-6xl text-cream"><span className="num">{b.total.toFixed(1)}</span><span className="text-2xl text-muted"> / 100</span></p>
          </div>
          <span className="-scale-x-100 text-4xl opacity-80"><Icon name="leaf" /></span>
        </section>
        <section className="game-card grid grid-cols-2 divide-white/10 sm:grid-cols-4 sm:divide-x">
          {[
            ["medal", "Rank", view.team.rank ? `#${view.team.rank}` : "–", view.game.teamCount ? `of ${view.game.teamCount}` : ""],
            [SCORE_META.valuation.icon, "Company value", `${Math.round(b.components.valuation)}%`, ""],
            [SCORE_META.execution.icon, "Execution", `${Math.round(b.components.execution)}%`, ""],
            [SCORE_META.efficiency.icon, "Runway", `${Math.round(b.components.efficiency)}%`, ""],
          ].map(([i, k, v, sub]) => (
            <div key={k} className="flex items-center gap-3 p-5">
              <span className="text-3xl"><Icon name={i} /></span>
              <span><span className="block text-xs text-muted">{k}</span><span className="num font-serif text-3xl text-amber">{v}</span> <span className="text-sm text-muted">{sub}</span></span>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <section className="game-card overflow-hidden">
          <div className="grid grid-cols-[1fr_70px_minmax(90px,1fr)_70px] items-center gap-3 border-b border-white/10 px-5 py-3 text-xs text-muted sm:grid-cols-[1fr_70px_minmax(120px,1fr)_70px_80px]">
            <span className="font-serif text-xl text-cream">Scoring breakdown</span><span>Weight</span><span>Progress</span><span className="text-right">Score</span><span className="hidden text-right sm:block">Points</span>
          </div>
          <ul>
            {keys.map((k) => {
              const share = w[k] / total;
              const c = b.components[k];
              return (
                <li key={k} className="grid grid-cols-[1fr_70px_minmax(90px,1fr)_70px] items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0 sm:grid-cols-[1fr_70px_minmax(120px,1fr)_70px_80px]">
                  <span className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true"><Icon name={SCORE_META[k].icon} /></span>
                    <span><span className="block text-sm font-semibold text-cream">{SCORE_LABELS[k]}</span><span className="hidden text-xs text-faint md:block">{SCORE_META[k].desc}</span></span>
                  </span>
                  <span className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-amber">{Math.round(share * 100)}%</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                    <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, c)}%`, background: c >= 66 ? "linear-gradient(90deg,#22c55e,#86efac)" : c >= 33 ? "linear-gradient(90deg,#f97316,#f6c56b)" : "linear-gradient(90deg,#a855f7,#ec4899)" }} />
                  </span>
                  <span className="num text-right text-sm text-muted">{c.toFixed(0)} / 100</span>
                  <span className="num hidden text-right text-sm font-semibold text-cream sm:block">{b.weighted[k].toFixed(1)} pts</span>
                </li>
              );
            })}
          </ul>
          {b.adjustment !== 0 && <p className="px-5 py-3 text-sm text-warn">Organizer adjustment: {b.adjustment > 0 ? "+" : ""}{b.adjustment} pts</p>}
        </section>

        <div className="space-y-5">
          <section className="game-card p-5">
            <h3 className="mb-1 flex items-center gap-2 font-serif text-xl text-cream"><Icon name="radar" />Performance radar</h3>
            <Radar axes={keys.map((k) => ({ label: SCORE_META[k].short, value: b.components[k] }))} />
          </section>
          <section className="game-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-serif text-xl text-cream"><Icon name="idea" />Key insights</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2 rounded-xl border border-good/30 bg-good/10 p-3 text-good"><span aria-hidden="true">↑</span>Strongest: {SCORE_META[best].short} ({Math.round(b.components[best])}%). Keep it up.</li>
              {weakest.map((k) => (
                <li key={k} className="flex gap-2 rounded-xl border border-bad/30 bg-bad/10 p-3 text-bad"><span aria-hidden="true">↓</span>{SCORE_META[k].short} ({Math.round(b.components[k])}%): {SCORE_META[k].tip}.</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Tie-breakers: profitability, then runway, then execution.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
