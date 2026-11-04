import type { FundingRoundDef } from "../types";

// Revenue criteria are per turn (1 turn = 1 simulated month) so they are fair across tracks.
export const DEFAULT_ROUNDS: FundingRoundDef[] = [
  { id: "preseed", name: "Pre-seed",
    criteria: { minProduct: 1, milestones: ["validated"] },
    preMoneyRange: [40_000, 120_000], dilutionRange: [0.08, 0.14],
    expectation: { customerMultiplier: 1.5, withinTurns: 3, penaltyReputation: 6 } },
  { id: "seed", name: "Seed",
    criteria: { minProduct: 2, minRevenue: 800, milestones: ["pilot"], requireRoles: ["ceo"] },
    preMoneyRange: [500_000, 2_000_000], dilutionRange: [0.12, 0.2],
    expectation: { customerMultiplier: 1.6, withinTurns: 3, penaltyReputation: 8 } },
  { id: "seriesA", name: "Series A",
    criteria: { minProduct: 3, minRevenue: 5_000, minReputation: 55, minLtvCac: 2, requireRoles: ["ceo"] },
    preMoneyRange: [4_000_000, 15_000_000], dilutionRange: [0.15, 0.25],
    expectation: { customerMultiplier: 1.8, withinTurns: 3, penaltyReputation: 10 } },
  { id: "seriesB", name: "Series B",
    criteria: { minProduct: 4, minRevenue: 25_000, minReputation: 60, minLtvCac: 3, requireRoles: ["ceo", "finance"] },
    preMoneyRange: [25_000_000, 90_000_000], dilutionRange: [0.12, 0.2],
    expectation: { customerMultiplier: 2, withinTurns: 3, penaltyReputation: 12 } },
  { id: "seriesC", name: "Series C+",
    criteria: { minProduct: 5, minRevenue: 90_000, minReputation: 70, minLtvCac: 3, requireRoles: ["ceo", "finance"] },
    preMoneyRange: [150_000_000, 700_000_000], dilutionRange: [0.08, 0.15],
    expectation: { customerMultiplier: 1.5, withinTurns: 2, penaltyReputation: 12 } },
];

export const INVESTORS = [
  "Quarry Hill Ventures", "Bayline Capital", "Tidewater Angels", "Copperleaf Partners", "Redwood Arc Fund",
  "Foglight Ventures", "Mesa Verde Capital", "Lantern Street Partners", "Orchard Row VC", "Halcyon Bridge Fund",
];

export const OFFER_TERMS = [
  { terms: "Standard terms, 1x non-participating preference.", expectation: false },
  { terms: "Board seat + growth mandate on customer targets.", expectation: true },
  { terms: "Founder-friendly: no board seat, light reporting.", expectation: false },
  { terms: "Aggressive growth mandate; investor expects rapid scale.", expectation: true },
];
