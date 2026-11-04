// Composite score. Each component is normalised to 0–100, then weighted by admin-configured weights.
import { clamp, getTrack } from "./metrics";
import type { GameSettings, Metrics, ScoreBreakdown, ScoreWeights, TeamState } from "./types";

const logScale = (v: number, lo: number, hi: number) =>
  clamp((100 * Math.log10(Math.max(v, lo) / lo)) / Math.log10(hi / lo), 0, 100);

export const SCORE_LABELS: Record<keyof ScoreWeights, string> = {
  valuation: "Final company value",
  profitability: "Profitability & unit economics",
  traction: "Customer traction",
  execution: "Execution / task completion",
  efficiency: "Capital efficiency / runway",
  fundraising: "Fundraising & ownership quality",
  resilience: "Risk, reputation & resilience",
};

export function scoreComponents(state: TeamState, settings: GameSettings, m: Metrics): Record<keyof ScoreWeights, number> {
  const track = getTrack(settings, state.trackId);

  const valuation = logScale(m.valuation, 10_000, 1_000_000_000); // $1B unicorn = 100

  const ltvCacScore = m.cac > 0 ? clamp((m.ltvCac / 5) * 100, 0, 100) : 0;
  const costs = m.payroll + m.revenue * (1 - m.grossMargin);
  const marginScore = clamp(50 + (50 * (m.revenue - costs)) / Math.max(m.revenue, costs, 1), 0, 100);
  const profitability = 0.5 * ltvCacScore + 0.5 * marginScore;

  const traction = 0.6 * logScale(m.customers + 1, 1, track.tractionTarget + 1) + 0.4 * logScale(m.revenue + 1, 1, 100_001);

  const s = state.stats;
  const attempts = s.profitable + s.strategic + s.partial + s.failure;
  const hitRate = attempts > 0 ? (s.profitable + s.strategic + 0.5 * s.partial) / attempts : 0;
  const execution = clamp(60 * hitRate + Math.min(40, state.milestones.length * 3), 0, 100);

  const runwayScore = clamp((m.runway / 12) * 100, 0, 100);
  const valuePerDollar = logScale(m.valuation / (m.fundingRaised + settings.startingCash), 1, 100);
  const efficiency = 0.5 * runwayScore + 0.5 * valuePerDollar;

  const missed = state.obligations.filter((o) => o.status === "missed").length;
  const fundraising = clamp(
    (state.rounds.length === 0 ? 30 * state.ownership : 60 * state.ownership + 40 * Math.min(1, state.rounds.length / 3)) - 15 * missed, 0, 100);

  const resilience = 0.7 * state.reputation + 0.3 * (100 - state.risk);

  return { valuation, profitability, traction, execution, efficiency, fundraising, resilience };
}

export function computeScore(state: TeamState, settings: GameSettings, m: Metrics, adjustment = 0): ScoreBreakdown {
  const components = scoreComponents(state, settings, m);
  const w = settings.weights;
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const weighted = Object.fromEntries(
    (Object.keys(components) as (keyof ScoreWeights)[]).map((k) => [k, (components[k] * w[k]) / totalWeight]),
  ) as Record<keyof ScoreWeights, number>;
  const total = Object.values(weighted).reduce((a, b) => a + b, 0) + adjustment;
  return { components, weighted, adjustment, total: Math.round(total * 100) / 100 };
}

/** Sort: score desc, then tie-breakers profitability → runway → execution. */
export function compareRank(
  a: { score: number; breakdown: ScoreBreakdown; runway: number },
  b: { score: number; breakdown: ScoreBreakdown; runway: number },
): number {
  return (
    b.score - a.score ||
    b.breakdown.components.profitability - a.breakdown.components.profitability ||
    b.runway - a.runway ||
    b.breakdown.components.execution - a.breakdown.components.execution
  );
}
