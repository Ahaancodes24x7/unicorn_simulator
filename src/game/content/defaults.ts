import type { GameSettings } from "../types";
import { DEFAULT_ROUNDS } from "./funding";
import { DEFAULT_ROLES } from "./roles";
import { DEFAULT_GLOBAL_EVENTS, DEFAULT_SHARED_TASKS } from "./shared";
import { DEFAULT_TRACKS } from "./tracks";

export function defaultSettings(): GameSettings {
  const settings: GameSettings = {
    eventName: "Silicon Valley: Unicorn Simulator",
    turns: 30,
    startingCash: 1000,
    maxTeams: 40,
    maxTeamSize: 6,
    assignment: "balanced",
    allowLateJoin: true,
    variance: 15,
    eventChance: 0.15,
    overdraft: false,
    equitySale: { discount: 0.3, maxPct: 0.1, minOwnership: 0.25 },
    weights: { valuation: 25, profitability: 20, traction: 15, execution: 15, efficiency: 10, fundraising: 5, resilience: 10 },
    milestoneValues: {
      validated: 15_000, prototype: 30_000, pilot: 60_000, compliance: 120_000, v2: 150_000, pricing: 50_000,
      partnership: 250_000, scale: 300_000, v3: 600_000, expansion: 1_500_000, global: 8_000_000,
      selfserve: 80_000, anchor: 120_000, referral: 80_000, moat: 200_000,
    },
    roles: DEFAULT_ROLES,
    rounds: DEFAULT_ROUNDS,
    sharedTasks: DEFAULT_SHARED_TASKS,
    globalEvents: DEFAULT_GLOBAL_EVENTS,
    tracks: DEFAULT_TRACKS,
  };
  return structuredClone(settings);
}
