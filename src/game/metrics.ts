// Derived startup metrics. Formulas are documented in docs/FORMULAS.md — keep the two in sync.
import { SKILLS, type GameSettings, type Metrics, type Skill, type TeamState, type TrackDef } from "./types";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const SKILL_CAP = 4;

export function getTrack(settings: GameSettings, trackId: string): TrackDef {
  const track = settings.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error(`Unknown track ${trackId}`);
  return track;
}

export function teamSkills(state: TeamState, settings: GameSettings): Record<Skill, number> {
  const out = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;
  for (const e of state.employees) {
    const role = settings.roles.find((r) => r.id === e.roleId);
    if (!role) continue;
    for (const [skill, v] of Object.entries(role.skills)) out[skill as Skill] += v ?? 0;
  }
  return out;
}

export function payroll(state: TeamState, settings: GameSettings): number {
  return state.employees.reduce((sum, e) => sum + (settings.roles.find((r) => r.id === e.roleId)?.salary ?? 0), 0);
}

export function arpu(state: TeamState, track: TrackDef): number {
  return track.arpu * (1 + state.arpuPct / 100);
}

export function grossMargin(state: TeamState, track: TrackDef, skills: Record<Skill, number>): number {
  return clamp(track.grossMargin + state.marginPts / 100 + 0.01 * Math.min(skills.ops, SKILL_CAP), 0.05, 0.95);
}

export function churnRate(state: TeamState, track: TrackDef, skills: Record<Skill, number>): number {
  return clamp(track.baseChurn + state.churnPts / 100 - 0.005 * state.product - 0.002 * Math.min(skills.product, SKILL_CAP), 0.01, 0.5);
}

/** Projected recurring economics for the coming turn. */
export function turnEconomics(state: TeamState, settings: GameSettings) {
  const track = getTrack(settings, state.trackId);
  const skills = teamSkills(state, settings);
  const revenue = state.customers * arpu(state, track);
  const margin = grossMargin(state, track, skills);
  const directCosts = revenue * (1 - margin);
  const pay = payroll(state, settings);
  return { track, skills, revenue, margin, directCosts, payroll: pay, net: revenue - directCosts - pay };
}

export function computeValuation(state: TeamState, settings: GameSettings, ltvCac: number, revenue: number): number {
  const arr = revenue * 12;
  const past = state.history.length >= 3 ? state.history[state.history.length - 3].revenue : 0;
  const growth = past > 0 ? clamp((revenue - past) / past, 0, 3) : revenue > 0 ? 1 : 0;
  const multiple = clamp(5 + 3 * growth + (state.reputation - 50) / 10 + (ltvCac >= 3 ? 2 : 0), 2, 20);
  const strategic = state.milestones.reduce((s, m) => s + (settings.milestoneValues[m] ?? 0), 0) + state.product ** 2 * 10_000;
  const raw = (arr * multiple + strategic + state.cash) * (1 - state.risk / 250);
  const lastPost = state.rounds.length ? state.rounds[state.rounds.length - 1].postMoney : 0;
  return Math.round(Math.max(raw, lastPost * 0.6, state.cash));
}

export function computeMetrics(state: TeamState, settings: GameSettings): Metrics {
  const econ = turnEconomics(state, settings);
  const churn = churnRate(state, econ.track, econ.skills);
  const unitArpu = arpu(state, econ.track);
  const cac = state.acquiredTotal > 0 ? state.acquisitionSpend / state.acquiredTotal : 0;
  const ltv = (unitArpu * econ.margin) / churn;
  const ltvCac = cac > 0 ? ltv / cac : 0;
  const burn = econ.payroll + econ.directCosts;
  const netBurn = burn - econ.revenue;
  const runway = netBurn > 0 ? state.cash / netBurn : 99;
  const valuation = computeValuation(state, settings, ltvCac, econ.revenue);
  return {
    cash: state.cash,
    revenue: econ.revenue,
    arr: econ.revenue * 12,
    customers: state.customers,
    burn,
    netBurn,
    runway: Math.min(99, runway),
    grossMargin: econ.margin,
    cac,
    ltv,
    ltvCac,
    churnRate: churn,
    arpu: unitArpu,
    payroll: econ.payroll,
    valuation,
    netWorth: state.cash, // assets (cash) − liabilities (none modelled unless overdraft)
    founderEquityValue: valuation * state.ownership,
    ownership: state.ownership,
    fundingRaised: state.rounds.reduce((s, r) => s + r.amount, 0) + (state.equitySales ?? []).reduce((s, e) => s + e.amount, 0),
    reputation: state.reputation,
    product: state.product,
    risk: state.risk,
    turn: state.turn,
    turnsTotal: state.turnsTotal,
  };
}
