// Balance check: plays N games per track with simple bot strategies and prints outcomes.
// Usage: npm run sim [-- games]
import { defaultSettings } from "../src/game/content/defaults";
import { acceptOffer, hire, newTeamState, nextRound, pitch, runTask, taskBoard } from "../src/game/engine";
import { computeMetrics } from "../src/game/metrics";
import { computeScore } from "../src/game/scoring";
import type { GameSettings, TeamState } from "../src/game/types";

type Bot = (s: TeamState, settings: GameSettings, seed: string) => TeamState;

// "smart" (empty plan) hires whichever role its next-priority task is missing, when it can afford it.
function hireForNextTask(state: TeamState, settings: GameSettings, seed: string): TeamState {
  const board = taskBoard(state, settings);
  for (const id of PRIORITY) {
    const b = board.find((t) => t.task.id === id);
    if (!b || b.available) continue;
    const missing = b.reasons.filter((r) => r.startsWith("Hire"));
    if (!missing.length || missing.length !== b.reasons.length) continue;
    const roleId = (b.task.crew ?? []).find((r) => !state.employees.some((e) => e.roleId === r));
    const role = settings.roles.find((r) => r.id === roleId);
    if (!role) continue;
    const m = computeMetrics(state, settings);
    if (state.cash - role.hireCost - b.task.cost > (m.payroll + role.salary) * 2) return hire(state, settings, role.id, seed + role.id).state;
  }
  return state;
}

const HIRE_PLAN: Record<string, string[]> = {
  "smart-lean": [],
  "smart-enterprise": [],
  "smart-community": [],
  balanced: ["engineer", "sales", "ceo", "product", "marketing", "ops", "finance", "engineer", "sales"],
  lean: ["engineer", "sales", "ceo"],
  heavy: ["engineer", "engineer", "sales", "ceo", "marketing", "product", "ops", "finance", "sales", "engineer"],
};
const BASE = ["v2", "compliance", "pricing", "aiFeature", "opsExcellence", "brandCampaign", "scale", "partnership", "v3", "expansion", "global", "growth", "process-audit", "damage-control", "consulting"];
// One priority list per branch strategy, so every path gets played.
const PATHS: Record<string, string[]> = {
  lean: ["mvp", "research", "pilotLean", "selfServe", ...BASE],
  enterprise: ["mvp", "research", "pilotPremium", "enterpriseDeal", ...BASE],
  community: ["noCodeMvp", "landingTest", "pilotCommunity", "referral", ...BASE],
};
let PRIORITY = PATHS.lean;

function makeBot(plan: string[]): Bot {
  return (s, settings, seed) => {
    let state = s;
    if (!plan.length) state = hireForNextTask(state, settings, seed);
    for (const roleId of plan) {
      const role = settings.roles.find((r) => r.id === roleId)!;
      const have = state.employees.filter((e) => e.roleId === roleId).length;
      const want = plan.filter((p) => p === roleId).length;
      const m = computeMetrics(state, settings);
      if (have < want && state.cash - role.hireCost > (m.payroll + role.salary) * 2.5) {
        state = hire(state, settings, roleId, seed + roleId + have).state;
      }
    }
    if (state.offers.length) state = acceptOffer(state, settings, state.offers[0].id).state;
    const round = nextRound(state, settings);
    if (round?.eligible) return pitch(state, settings, seed).state;
    const board = taskBoard(state, settings).filter((t) => t.available);
    const pick = PRIORITY.map((id) => board.find((t) => t.task.id === id)).find(Boolean);
    if (!pick) return state;
    return runTask(state, settings, pick.task.id, seed).state;
  };
}

const settings = defaultSettings();
const games = Number(process.argv[2] ?? 30);
for (const track of settings.tracks) {
  for (const [name, plan] of Object.entries(HIRE_PLAN)) {
    PRIORITY = PATHS[name.replace("smart-", "")] ?? PATHS.lean;
    const bot = makeBot(plan);
    const results: { score: number; val: number; cust: number; rounds: number; cash: number }[] = [];
    for (let g = 0; g < games; g++) {
      let state = newTeamState(settings, track.id);
      let guard = 0;
      while (!state.finished && guard++ < 200) {
        const before = state.turn;
        state = bot(state, settings, `${track.id}-${name}-${g}-${state.turn}-${state.nonce}`);
        if (state.turn === before && !state.offers.length) break;
      }
      if (state.offers.length) state = acceptOffer(state, settings, state.offers[0].id).state;
      const m = computeMetrics(state, settings);
      results.push({ score: computeScore(state, settings, m).total, val: m.valuation, cust: state.customers, rounds: state.rounds.length, cash: state.cash });
    }
    const avg = (k: keyof (typeof results)[number]) => results.reduce((s, r) => s + r[k], 0) / results.length;
    const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : n.toFixed(0));
    console.log(`${track.sector.padEnd(12)} ${name.padEnd(16)} score ${avg("score").toFixed(1).padStart(5)}  val $${fmt(avg("val")).padStart(6)}  cust ${fmt(avg("cust")).padStart(5)}  rounds ${avg("rounds").toFixed(1)}  cash $${fmt(avg("cash"))}`);
  }
}
