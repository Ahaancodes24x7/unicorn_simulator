"use client";

import { useEffect, useState } from "react";
import { milestoneLabel, tierLabel, type AppliedEffects, type TaskOutcome } from "@/game/engine";
import { money, pct, signed } from "../format";
import { Badge, Button, Modal } from "../ui";
import { Confetti } from "./fx";
import { XP } from "./gamify";

const TIER_STYLE = {
  profitable_success: { tone: "good", emoji: "🚀", color: "text-good", banner: "from-good/30", xp: XP.profitable },
  strategic_success: { tone: "crt", emoji: "🧭", color: "text-crt", banner: "from-crt/25", xp: XP.strategic },
  partial: { tone: "warn", emoji: "⚖️", color: "text-warn", banner: "from-warn/25", xp: XP.partial },
  failure: { tone: "bad", emoji: "💥", color: "text-bad", banner: "from-bad/30", xp: XP.failure },
} as const;

/** Animated roll gauge: fills to the roll, with the partial and success lines marked. */
function RollMeter({ total, success, partial }: { total: number; success: number; partial: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(total), 120);
    return () => clearTimeout(t);
  }, [total]);
  const color = total >= success ? "var(--good)" : total >= partial ? "var(--warn)" : "var(--bad)";
  return (
    <div>
      <div className="relative h-5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[1400ms] ease-out" style={{ width: `${shown}%`, background: color, boxShadow: `0 0 16px ${color}` }} />
        {[partial, success].map((v) => <div key={v} className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${v}%` }} />)}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-faint">
        <span className="absolute -translate-x-1/2" style={{ left: `${partial}%` }}>partial {partial}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${success}%` }}>success {success}</span>
      </div>
    </div>
  );
}

type Rounds = { id: string; name: string }[];

export function EffectChips({ a, label = "customers", rounds = [] }: { a: AppliedEffects; label?: string; rounds?: Rounds }) {
  const chips: { t: string; good: boolean }[] = [];
  if (a.cash) chips.push({ t: `${signed(a.cash, (v) => money(v))} cash`, good: a.cash > 0 });
  if (a.customers) chips.push({ t: `${signed(a.customers)} ${label}`, good: a.customers > 0 });
  if (a.reputation) chips.push({ t: `${signed(a.reputation)} reputation`, good: a.reputation > 0 });
  if (a.product) chips.push({ t: `${signed(a.product)} product level`, good: a.product > 0 });
  if (a.risk) chips.push({ t: `${signed(a.risk)} risk`, good: a.risk < 0 });
  if (a.arpuPct) chips.push({ t: `${signed(a.arpuPct)}% revenue/customer`, good: a.arpuPct > 0 });
  if (a.churnPts) chips.push({ t: `${signed(a.churnPts, (v) => v.toFixed(1))} pts churn`, good: a.churnPts < 0 });
  if (a.marginPts) chips.push({ t: `${signed(a.marginPts)} pts margin`, good: a.marginPts > 0 });
  if (!chips.length && !a.milestones.length) return <p className="text-sm text-faint">No direct effect.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => <Badge key={c.t} tone={c.good ? "good" : "bad"}>{c.t}</Badge>)}
      {a.milestones.map((m) => <Badge key={m} tone="accent">★ {milestoneLabel({ rounds }, m)}</Badge>)}
    </div>
  );
}

export function ResultModal({ outcome, customerLabel, rounds, onClose }: { outcome: TaskOutcome | null; customerLabel: string; rounds: Rounds; onClose: () => void }) {
  if (!outcome) return null;
  const st = TIER_STYLE[outcome.tier];
  const r = outcome.roll;
  const ts = outcome.turnSummary;
  return (
    <Modal open onClose={onClose} title={outcome.title} wide>
      <Confetti fire={outcome.tier === "profitable_success" || outcome.tier === "strategic_success" ? 1 : 0} />
      <div className="space-y-5">
        <div className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${st.banner} to-transparent p-5 ${outcome.tier === "failure" ? "anim-shake" : ""}`}>
          <div className="flex items-center gap-4">
            <span className="anim-pop text-6xl" aria-hidden="true">{st.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className={`anim-pop font-serif text-3xl sm:text-4xl ${st.color}`}>{outcome.taskId === "pitch" && outcome.tier === "strategic_success" ? "Investors are in!" : tierLabel(outcome.tier)}</p>
              <p className="text-muted">{outcome.narrative}</p>
            </div>
            <span className="anim-pop shrink-0 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] px-3 py-1.5 text-sm font-bold text-white shadow-[0_0_18px_rgba(236,72,153,0.6)]">+{st.xp} XP</span>
          </div>
          <div className="mt-4">
            <p className="mb-1 flex justify-between text-xs text-muted"><span>🎲 Your roll</span><span className="num font-semibold text-cream">{r.total}</span></p>
            <RollMeter total={r.total} success={r.thresholds.success} partial={r.thresholds.partial} />
          </div>
        </div>
        <EffectChips a={outcome.applied} label={customerLabel} rounds={rounds} />

        {outcome.event && (
          <div className="rounded-xl border border-amber/40 bg-amber/5 p-4">
            <p className="text-sm font-semibold text-amber">⚡ Critical event: {outcome.event.title}</p>
            <p className="mt-1 text-sm text-muted">{outcome.event.text}</p>
            <div className="mt-2"><EffectChips a={outcome.event.applied} label={customerLabel} rounds={rounds} /></div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <p className="mb-2 text-sm font-semibold text-muted">Turn {ts.turn} books</p>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-faint">Recurring revenue</dt><dd className="num text-right text-good">{money(ts.revenue)}</dd>
              <dt className="text-faint">Direct costs</dt><dd className="num text-right text-bad">−{money(ts.directCosts)}</dd>
              <dt className="text-faint">Payroll</dt><dd className="num text-right text-bad">−{money(ts.payroll)}</dd>
              <dt className="text-faint">Churned</dt><dd className="num text-right text-cream">{ts.churned} {customerLabel}</dd>
              <dt className="font-medium text-cream">Cash now</dt><dd className="num text-right font-semibold text-cream">{money(ts.cashAfter)}</dd>
            </dl>
            {ts.obligations.map((o) => <p key={o} className="mt-2 text-xs text-warn">{o}</p>)}
          </div>
          <details className="rounded-xl border border-line p-4">
            <summary className="cursor-pointer text-sm font-semibold text-muted">How this was calculated</summary>
            <dl className="mt-2 grid grid-cols-2 gap-1 font-mono text-[15px]">
              <dt className="text-faint">base</dt><dd className="text-right text-cream">{r.base}</dd>
              <dt className="text-faint">team fit ({pct(r.capability)})</dt><dd className="text-right text-good">+{r.capabilityBonus}</dd>
              <dt className="text-faint">difficulty</dt><dd className="text-right text-cream">{signed(-r.difficultyPenalty, (v) => v.toFixed(1))}</dd>
              <dt className="text-faint">runway readiness</dt><dd className="text-right text-cream">{signed(r.readiness)}</dd>
              <dt className="text-faint">reputation</dt><dd className="text-right text-cream">{signed(r.reputation, (v) => v.toFixed(1))}</dd>
              <dt className="text-faint">risk</dt><dd className="text-right text-cream">{signed(r.risk, (v) => v.toFixed(1))}</dd>
              <dt className="text-faint">market luck</dt><dd className="text-right text-amber">{signed(r.variance, (v) => v.toFixed(1))}</dd>
              <dt className="border-t border-line pt-1 text-cream">roll</dt><dd className="border-t border-line pt-1 text-right text-cream">{r.total}</dd>
            </dl>
            <p className="mt-2 text-xs text-faint">Success ≥ {r.thresholds.success}, partial ≥ {r.thresholds.partial}. Seed logged for audit.</p>
          </details>
        </div>

        {outcome.offers && outcome.offers.length > 0 && <p className="rounded-lg border border-good/40 bg-good/10 p-3 text-sm text-good">You have {outcome.offers.length} term sheet(s) waiting in the Funding tab.</p>}
        <div className="flex justify-end"><Button onClick={onClose} className="chunky-btn px-6">Continue ▶</Button></div>
      </div>
    </Modal>
  );
}
