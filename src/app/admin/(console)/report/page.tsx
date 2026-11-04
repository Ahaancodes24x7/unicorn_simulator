import { PrintButton } from "@/components/admin/PrintButton";
import { money, num, pct, ratio, runway } from "@/components/format";
import { SCORE_LABELS } from "@/game/scoring";
import type { ScoreWeights } from "@/game/types";
import { leaderboard } from "@/lib/game";

export const dynamic = "force-dynamic";

// Print-optimised final report; "Save as PDF" from the browser print dialog produces the PDF export.
export default async function ReportPage() {
  const { game, teams } = await leaderboard();
  const keys = Object.keys(SCORE_LABELS) as (keyof ScoreWeights)[];
  return (
    <div className="print-dark space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">{game.settings.eventName}: Final report</h1>
          <p className="text-sm text-muted">Generated {new Date().toLocaleString()} · status {game.status} · {teams.length} teams · all figures simulated</p>
        </div>
        <PrintButton />
      </div>
      <table className="w-full text-xs">
        <thead className="text-left uppercase tracking-wider text-faint">
          <tr className="border-b border-line">
            <th className="py-2">#</th><th>Team</th><th>Track</th><th className="text-right">Score</th><th className="text-right">Valuation</th><th className="text-right">Cash</th>
            <th className="text-right">Rev/turn</th><th className="text-right">Cust.</th><th className="text-right">LTV:CAC</th><th className="text-right">Runway</th><th className="text-right">Raised</th><th className="text-right">Founders</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} className="border-b border-line/40">
              <td className="py-1.5">{t.rank}</td><td>{t.name}<span className="block text-faint">{t.members.join(", ")}</span></td><td>{t.sector}</td>
              <td className="num text-right font-semibold">{t.score.toFixed(1)}</td><td className="num text-right">{money(t.metrics.valuation)}</td><td className="num text-right">{money(t.metrics.cash)}</td>
              <td className="num text-right">{money(t.metrics.revenue)}</td><td className="num text-right">{num(t.metrics.customers)}</td><td className="num text-right">{ratio(t.metrics.ltvCac)}</td>
              <td className="num text-right">{runway(t.metrics.runway)}</td><td className="num text-right">{money(t.metrics.fundingRaised)}</td><td className="num text-right">{pct(t.metrics.ownership)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="font-serif text-2xl">Score breakdown (weighted points)</h2>
      <table className="w-full text-xs">
        <thead className="text-left uppercase tracking-wider text-faint">
          <tr className="border-b border-line"><th className="py-2">Team</th>{keys.map((k) => <th key={k} className="text-right">{SCORE_LABELS[k]}</th>)}<th className="text-right">Adj.</th><th className="text-right">Total</th></tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} className="border-b border-line/40">
              <td className="py-1.5">{t.rank}. {t.name}</td>
              {keys.map((k) => <td key={k} className="num text-right">{t.breakdown.weighted[k].toFixed(1)}</td>)}
              <td className="num text-right">{t.breakdown.adjustment}</td><td className="num text-right font-semibold">{t.score.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-faint">Tie-breakers: profitability, then cash runway, then execution. Valuation ≠ net worth: net worth is cash (no liabilities modelled).</p>
    </div>
  );
}
