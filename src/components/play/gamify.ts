// Game-layer presentation: founder rank, XP/levels, startup health, achievements and quests.
// Everything is derived from the team's state and metrics, so it never affects scoring or fairness.
import type { Metrics, TeamState } from "@/game/types";

// ---------------------------------------------------------------- founder rank (by valuation)

export const RANKS = [
  { min: 0, title: "Garage Hacker", icon: "wrench" },
  { min: 100_000, title: "Bootstrapper", icon: "boot" },
  { min: 1_000_000, title: "Seed Hustler", icon: "sprout" },
  { min: 10_000_000, title: "Rising Star", icon: "star" },
  { min: 100_000_000, title: "Scale-up Titan", icon: "rocket" },
  { min: 500_000_000, title: "Soonicorn", icon: "gem" },
  { min: 1_000_000_000, title: "Unicorn", icon: "crown" },
] as const;

export function founderRank(valuation: number) {
  let i = 0;
  while (i < RANKS.length - 1 && valuation >= RANKS[i + 1].min) i++;
  const next = RANKS[i + 1];
  // log-scale progress between tiers feels fair across orders of magnitude
  const lo = Math.log10(Math.max(RANKS[i].min, 10_000));
  const progress = next ? Math.min(1, Math.max(0, (Math.log10(Math.max(valuation, 1)) - lo) / (Math.log10(next.min) - lo))) : 1;
  return { ...RANKS[i], index: i, next, progress };
}

/** Progress (0–1) toward a $1B valuation on a log scale from $10k. */
export const unicornProgress = (valuation: number) => Math.min(1, Math.max(0, (Math.log10(Math.max(valuation, 1)) - 4) / 5));

// ---------------------------------------------------------------- XP and levels

export const XP = { profitable: 120, strategic: 100, partial: 45, failure: 15, milestone: 150, round: 300, pitch: 25 } as const;

export function xpFor(s: TeamState): number {
  return s.stats.profitable * XP.profitable + s.stats.strategic * XP.strategic + s.stats.partial * XP.partial
    + s.stats.failure * XP.failure + s.milestones.length * XP.milestone + s.rounds.length * XP.round + s.stats.pitches * XP.pitch
    + Math.min(500, s.employees.length * 20);
}

/** Level n needs 150·n·(n−1)/2 total XP: 0, 150, 450, 900, … */
export function levelFor(xp: number) {
  let level = 1;
  while (xp >= (150 * (level + 1) * level) / 2) level++;
  const floor = (150 * level * (level - 1)) / 2;
  const ceil = (150 * (level + 1) * level) / 2;
  return { level, xp, into: xp - floor, span: ceil - floor, progress: (xp - floor) / (ceil - floor) };
}

/** XP a mission is worth on success (shown on mission cards). */
export const missionXp = (kind: "profitable" | "strategic") => (kind === "profitable" ? XP.profitable : XP.strategic);

// ---------------------------------------------------------------- startup health

export function health(m: Metrics) {
  const runwayPart = m.netBurn <= 0 ? 1 : Math.min(1, m.runway / 6);
  const value = Math.round(100 * (0.45 * runwayPart + 0.35 * (m.reputation / 100) + 0.2 * (1 - m.risk / 100)));
  const label = value >= 80 ? "Thriving" : value >= 60 ? "Healthy" : value >= 40 ? "Shaky" : "Critical";
  const tone = value >= 80 ? "var(--good)" : value >= 60 ? "var(--crt)" : value >= 40 ? "var(--warn)" : "var(--bad)";
  return { value, label, tone };
}

// ---------------------------------------------------------------- achievements

export interface Achievement { id: string; icon: string; title: string; desc: string }

// Based on counts and metrics (not specific mission or milestone ids), so they work for any problem set.
const ACHIEVEMENTS: (Achievement & { test: (s: TeamState, m: Metrics) => boolean })[] = [
  { id: "first-hire", icon: "handshake", title: "First Hire", desc: "Hire your first employee", test: (s) => s.employees.length >= 1 },
  { id: "first-win", icon: "target", title: "First Win", desc: "Succeed at a mission", test: (s) => s.stats.profitable + s.stats.strategic >= 1 },
  { id: "prototype", icon: "wrench", title: "It's Alive!", desc: "Reach product level 1", test: (s) => s.product >= 1 },
  { id: "first-customer", icon: "party", title: "First Customer", desc: "Land a paying customer", test: (s) => s.acquiredTotal >= 1 },
  { id: "profitable", icon: "chart-line", title: "In the Black", desc: "Earn more than you burn in a turn", test: (s) => s.lastNet > 0 && s.turn > 0 },
  { id: "first-round", icon: "briefcase", title: "Funded", desc: "Close your first funding round", test: (s) => s.rounds.length >= 1 },
  { id: "dream-team", icon: "users", title: "Dream Team", desc: "Grow to 5 employees", test: (s) => s.employees.length >= 5 },
  { id: "comeback", icon: "flame", title: "Comeback Kid", desc: "Succeed after a failure", test: (s) => s.stats.failure > 0 && s.stats.profitable + s.stats.strategic > 0 },
  { id: "milestones-5", icon: "map", title: "Trailblazer", desc: "Reach 5 milestones", test: (s) => s.milestones.filter((x) => !x.startsWith("path-")).length >= 5 },
  { id: "product-3", icon: "puzzle", title: "Product Wizard", desc: "Reach product level 3", test: (s) => s.product >= 3 },
  { id: "rounds-2", icon: "🅰️", title: "Repeat Raiser", desc: "Close two funding rounds", test: (s) => s.rounds.length >= 2 },
  { id: "millionaire", icon: "wallet", title: "Seven Figures", desc: "Reach a $1M valuation", test: (_s, m) => m.valuation >= 1_000_000 },
  { id: "rep", icon: "star", title: "Crowd Favourite", desc: "Reputation 80+", test: (_s, m) => m.reputation >= 80 },
  { id: "hundred-m", icon: "rocket", title: "Nine Figures", desc: "Reach a $100M valuation", test: (_s, m) => m.valuation >= 100_000_000 },
  { id: "unicorn", icon: "gem", title: "Unicorn!", desc: "Reach a $1B valuation", test: (_s, m) => m.valuation >= 1_000_000_000 },
];

export function achievements(s: TeamState, m: Metrics) {
  return ACHIEVEMENTS.map(({ test, ...a }) => ({ ...a, unlocked: test(s, m) }));
}

// ---------------------------------------------------------------- deltas

/** Change since the previous turn, from the history log. */
export function deltaSincePrevious(s: TeamState, key: "cash" | "revenue" | "customers" | "valuation", current: number): number | null {
  const prev = s.history.length >= 2 ? s.history[s.history.length - 2] : null;
  if (!prev) return null;
  return current - prev[key];
}
