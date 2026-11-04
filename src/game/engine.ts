// Centralised, pure game engine. Every action takes a state + settings + seed and returns a new
// state plus the log entries and transactions to persist. No I/O happens here, so the rules are
// auditable, testable, and identical for every team.
import { FIRST_NAMES, LAST_INITIALS } from "./content/roles";
import { INVESTORS, OFFER_TERMS } from "./content/funding";
import { clamp, computeMetrics, getTrack, SKILL_CAP, teamSkills, turnEconomics } from "./metrics";
import { computeScore } from "./scoring";
import { createRng, pickWeighted, type Rng } from "./rng";
import type {
  CriticalEventDef, Effects, Employee, FundingRoundDef, GameSettings, LogEntry, Offer, OutcomeTier, RollBreakdown, Skill,
  TaskDef, TeamState, TxEntry,
} from "./types";

export class GameError extends Error {}

export const SUCCESS_THRESHOLD = 62;
export const PARTIAL_THRESHOLD = 42;

export interface ActionResult {
  state: TeamState;
  logs: LogEntry[];
  txs: TxEntry[];
  outcome?: TaskOutcome;
}

export interface TaskOutcome {
  taskId: string;
  title: string;
  tier: OutcomeTier;
  narrative: string;
  roll: RollBreakdown;
  applied: AppliedEffects;
  event?: { title: string; text: string; applied: AppliedEffects };
  offers?: Offer[];
  turnSummary: TurnSummary;
}

export interface AppliedEffects {
  cash: number;
  customers: number;
  reputation: number;
  product: number;
  risk: number;
  arpuPct: number;
  churnPts: number;
  marginPts: number;
  milestones: string[];
}

export interface TurnSummary {
  turn: number;
  revenue: number;
  directCosts: number;
  payroll: number;
  churned: number;
  net: number;
  cashAfter: number;
  obligations: string[];
}

// ---------------------------------------------------------------- setup

export function newTeamState(settings: GameSettings, trackId: string): TeamState {
  getTrack(settings, trackId);
  return {
    trackId,
    cash: settings.startingCash,
    turn: 0,
    turnsTotal: settings.turns,
    customers: 0,
    acquiredTotal: 0,
    churnedTotal: 0,
    acquisitionSpend: 0,
    reputation: 50,
    product: 0,
    risk: 30,
    arpuPct: 0,
    churnPts: 0,
    marginPts: 0,
    milestones: [],
    completed: {},
    lockedGroups: [],
    employees: [],
    revenueTotal: 0,
    directCostsTotal: 0,
    payrollTotal: 0,
    spendTotal: 0,
    lastRevenue: 0,
    lastBurn: 0,
    lastNet: 0,
    ownership: 1,
    rounds: [],
    offers: [],
    obligations: [],
    stats: { profitable: 0, strategic: 0, partial: 0, failure: 0, events: 0, pitches: 0 },
    history: [],
    finished: false,
    nonce: 0,
  };
}

export function allTasks(settings: GameSettings, trackId: string): TaskDef[] {
  return [...getTrack(settings, trackId).tasks, ...settings.sharedTasks];
}

// ---------------------------------------------------------------- task board

export interface TaskAvailability {
  task: TaskDef;
  available: boolean;
  completedCount: number;
  reasons: string[];
}

export function taskBoard(state: TeamState, settings: GameSettings): TaskAvailability[] {
  const econ = turnEconomics(state, settings);
  return allTasks(settings, state.trackId).map((task) => {
    const reasons: string[] = [];
    const done = state.completed[task.id] ?? 0;
    const r = task.requires ?? {};
    if (done > 0 && !task.repeatable) reasons.push("Already completed");
    if (task.choiceGroup && state.lockedGroups.includes(task.choiceGroup) && done === 0) reasons.push("Another path was chosen");
    for (const t of r.tasks ?? []) {
      if (!state.completed[t]) reasons.push(`Complete "${allTasks(settings, state.trackId).find((x) => x.id === t)?.title ?? t}" first`);
    }
    for (const m of r.milestones ?? []) if (!state.milestones.includes(m)) reasons.push(`Requires milestone: ${milestoneLabel(settings, m)}`);
    if (r.minProduct !== undefined && state.product < r.minProduct) reasons.push(`Product level ${r.minProduct}+`);
    if (r.minCustomers !== undefined && state.customers < r.minCustomers) reasons.push(`${r.minCustomers}+ customers`);
    if (r.minReputation !== undefined && state.reputation < r.minReputation) reasons.push(`Reputation ${r.minReputation}+`);
    if (r.maxReputation !== undefined && state.reputation > r.maxReputation) reasons.push(`Only when reputation is ${r.maxReputation} or below`);
    for (const role of new Set([...(r.roles ?? []), ...(task.crew ?? [])])) {
      if (!state.employees.some((e) => e.roleId === role)) reasons.push(`Hire ${settings.roles.find((x) => x.id === role)?.title ?? role}`);
    }
    if (!settings.overdraft && state.cash - task.cost + Math.min(0, econ.net) < 0) {
      reasons.push(`Not enough cash to cover cost + this turn's burn ($${Math.ceil(task.cost - Math.min(0, econ.net))})`);
    }
    return { task, available: reasons.length === 0 && !state.finished, completedCount: done, reasons };
  });
}

export function milestoneLabel(settings: { rounds: { id: string; name: string }[] }, id: string): string {
  const round = settings.rounds.find((r) => r.id === id);
  if (round) return `${round.name} raised`;
  return ({ validated: "Problem validated", prototype: "Prototype", pilot: "Pilot", compliance: "Compliance", v2: "Product v2",
    pricing: "Pricing", partnership: "Partnership", scale: "Scale-ready", v3: "Platform v3", expansion: "Expansion", global: "Global",
    "path-lean": "Lean pilot path", "path-enterprise": "Enterprise pilot path", "path-community": "Community beta path",
    selfserve: "Self-serve", anchor: "Anchor customer", referral: "Referral engine", moat: "Competitive moat" } as Record<string, string>)[id] ?? id;
}

// ---------------------------------------------------------------- hiring

export function hire(prev: TeamState, settings: GameSettings, roleId: string, seed: string): ActionResult {
  const state = structuredClone(prev);
  assertActive(state);
  const role = settings.roles.find((r) => r.id === roleId);
  if (!role) throw new GameError("Unknown role");
  const count = state.employees.filter((e) => e.roleId === roleId).length;
  if (count >= role.max) throw new GameError(`You can have at most ${role.max} × ${role.title}`);
  if (!settings.overdraft && state.cash < role.hireCost) throw new GameError("Not enough cash to hire");
  const rng = createRng(seed);
  const name = `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${LAST_INITIALS[Math.floor(rng() * LAST_INITIALS.length)]}.`;
  state.cash -= role.hireCost;
  state.spendTotal += role.hireCost;
  if (role.acquisition) state.acquisitionSpend += role.hireCost;
  state.nonce++;
  state.employees.push({ id: `${roleId}-${state.nonce}`, roleId, name, hiredTurn: state.turn });
  return {
    state,
    logs: [{ type: "hire", title: `Hired ${name} as ${role.title}`, detail: { roleId, name, hireCost: role.hireCost, salary: role.salary } }],
    txs: [{ amount: -role.hireCost, category: "hiring", memo: `Hiring fee: ${role.title} (${name})` }],
  };
}

export function fire(prev: TeamState, settings: GameSettings, employeeId: string): ActionResult {
  const state = structuredClone(prev);
  assertActive(state);
  const idx = state.employees.findIndex((e) => e.id === employeeId);
  if (idx < 0) throw new GameError("Employee not found");
  const emp = state.employees[idx];
  const role = settings.roles.find((r) => r.id === emp.roleId);
  const severance = Math.min(role?.salary ?? 0, settings.overdraft ? Infinity : state.cash);
  state.cash -= severance;
  state.spendTotal += severance;
  state.employees.splice(idx, 1);
  state.reputation = clamp(state.reputation - 1, 0, 100);
  state.nonce++;
  return {
    state,
    logs: [{ type: "fire", title: `Let go ${emp.name} (${role?.title ?? emp.roleId})`, detail: { employeeId, severance } }],
    txs: severance > 0 ? [{ amount: -severance, category: "severance", memo: `Severance: ${emp.name}` }] : [],
  };
}

// ---------------------------------------------------------------- tasks

/**
 * Resolves a task with the employees the team assigned to it (`crewIds`; defaults to everyone).
 * Only the assigned crew's skills count, and the crew must include every role the task requires.
 */
export function runTask(prev: TeamState, settings: GameSettings, taskId: string, seed: string, crewIds?: string[]): ActionResult {
  const state = structuredClone(prev);
  assertActive(state);
  const entry = taskBoard(state, settings).find((t) => t.task.id === taskId);
  if (!entry) throw new GameError("Unknown task");
  if (!entry.available) throw new GameError(entry.reasons[0] ?? "Task unavailable");
  const task = entry.task;
  const crew = pickCrew(state, settings, task, crewIds);
  const logs: LogEntry[] = [];
  const txs: TxEntry[] = [];
  expireOffers(state, logs);

  const rng = createRng(seed);
  const skills = teamSkills({ ...state, employees: crew }, settings);

  // Pay the task cost.
  if (task.cost > 0) {
    state.cash -= task.cost;
    state.spendTotal += task.cost;
    if (task.acquisition) state.acquisitionSpend += task.cost;
    txs.push({ amount: -task.cost, category: "task", memo: `Task cost: ${task.title}` });
  }

  const roll = rollFor(state, settings, task.skills, task.difficulty, skills, rng, seed);
  const succeeded = roll.total >= SUCCESS_THRESHOLD;
  const tier: OutcomeTier = succeeded
    ? task.kind === "profitable" ? "profitable_success" : "strategic_success"
    : roll.total >= PARTIAL_THRESHOLD ? "partial" : "failure";
  const effects = succeeded ? task.outcomes.success : tier === "partial" ? task.outcomes.partial : task.outcomes.failure;
  const applied = applyEffects(state, settings, effects, skills, txs, task.title);

  if (tier !== "failure") {
    state.completed[task.id] = (state.completed[task.id] ?? 0) + 1;
    if (task.choiceGroup && !state.lockedGroups.includes(task.choiceGroup)) state.lockedGroups.push(task.choiceGroup);
  }
  state.stats[tier === "profitable_success" ? "profitable" : tier === "strategic_success" ? "strategic" : tier]++;

  logs.push({
    type: "task",
    title: `${task.title}: ${tierLabel(tier)}`,
    detail: { taskId: task.id, tier, cost: task.cost, roll, applied, narrative: effects.text, crew: crew.map((e) => ({ id: e.id, name: e.name, roleId: e.roleId })) },
  });

  const turns = Math.max(1, task.turns ?? 1);
  let summary!: TurnSummary;
  let event: TaskOutcome["event"];
  for (let i = 0; i < turns && !state.finished; i++) {
    const res = endTurn(state, settings, rng, logs, txs);
    summary = res.summary;
    event ??= res.event;
  }

  return {
    state, logs, txs,
    outcome: { taskId: task.id, title: task.title, tier, narrative: effects.text, roll, applied, event, turnSummary: summary },
  };
}

export function crewLimit(task: Pick<TaskDef, "crew" | "crewMax">): number {
  return task.crewMax ?? Math.max(2, (task.crew?.length ?? 0) + 1);
}

/** Share of the task's skill needs covered by a set of skills (0–1). */
export function capabilityFor(weights: Partial<Record<Skill, number>>, skills: Record<Skill, number>): number {
  const entries = Object.entries(weights) as [Skill, number][];
  const totalW = entries.reduce((s, [, w]) => s + w, 0);
  return totalW > 0 ? entries.reduce((s, [k, w]) => s + (w * Math.min(skills[k], SKILL_CAP)) / SKILL_CAP, 0) / totalW : 0.5;
}

/** Best crew within the limit: one employee per required role, then whoever adds the most capability. */
export function suggestCrew(employees: Employee[], settings: Pick<GameSettings, "roles">, task: Pick<TaskDef, "crew" | "crewMax" | "skills">): Employee[] {
  const skillsOf = (crew: Employee[]) => teamSkills({ employees: crew } as TeamState, settings as GameSettings);
  const crew: Employee[] = [];
  for (const role of task.crew ?? []) {
    const e = employees.find((x) => x.roleId === role && !crew.includes(x));
    if (e) crew.push(e);
  }
  while (crew.length < crewLimit(task)) {
    const base = capabilityFor(task.skills, skillsOf(crew));
    let best: Employee | null = null;
    let gain = 0.0001;
    for (const e of employees) {
      if (crew.includes(e)) continue;
      const g = capabilityFor(task.skills, skillsOf([...crew, e])) - base;
      if (g > gain) { gain = g; best = e; }
    }
    if (!best) break;
    crew.push(best);
  }
  return crew;
}

function pickCrew(state: TeamState, settings: GameSettings, task: TaskDef, crewIds?: string[]) {
  if (!crewIds) return suggestCrew(state.employees, settings, task);
  if (new Set(crewIds).size !== crewIds.length) throw new GameError("Each employee can only be assigned once");
  if (crewIds.length > crewLimit(task)) throw new GameError(`At most ${crewLimit(task)} people can work on this task`);
  const crew = crewIds.map((id) => {
    const e = state.employees.find((x) => x.id === id);
    if (!e) throw new GameError("That employee isn't on your team");
    return e;
  });
  for (const role of task.crew ?? []) {
    if (!crew.some((e) => e.roleId === role)) throw new GameError(`Assign your ${settings.roles.find((r) => r.id === role)?.title ?? role} to this task`);
  }
  return crew;
}

export function tierLabel(tier: OutcomeTier): string {
  return { profitable_success: "Profitable success", strategic_success: "Strategic success", partial: "Partial success", failure: "Failure" }[tier];
}

function rollFor(
  state: TeamState, settings: GameSettings, weights: Partial<Record<Skill, number>>, difficulty: number,
  skills: Record<Skill, number>, rng: Rng, seed: string,
): RollBreakdown {
  const capability = capabilityFor(weights, skills);
  const econ = turnEconomics(state, settings);
  const netBurn = -econ.net;
  const runwayAfter = netBurn > 0 ? state.cash / netBurn : Infinity; // task cost is already deducted
  const readiness = netBurn <= 0 || runwayAfter >= 3 ? 5 : runwayAfter >= 1 ? 0 : -8;
  const base = 40;
  const capabilityBonus = 40 * capability;
  const difficultyPenalty = (difficulty - 50) * 0.6;
  const reputation = (state.reputation - 50) / 10;
  const risk = -state.risk / 10;
  const variance = (rng() * 2 - 1) * settings.variance;
  const total = clamp(base + capabilityBonus - difficultyPenalty + readiness + reputation + risk + variance, 0, 100);
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    seed, base, capability: r(capability), capabilityBonus: r(capabilityBonus), difficultyPenalty: r(difficultyPenalty),
    readiness, reputation: r(reputation), risk: r(risk), variance: r(variance), total: r(total),
    thresholds: { success: SUCCESS_THRESHOLD, partial: PARTIAL_THRESHOLD },
  };
}

function applyEffects(
  state: TeamState, settings: GameSettings, e: Effects, skills: Record<Skill, number>, txs: TxEntry[], label: string,
): AppliedEffects {
  const applied: AppliedEffects = { cash: 0, customers: 0, reputation: 0, product: 0, risk: 0, arpuPct: 0, churnPts: 0, marginPts: 0, milestones: [] };
  if (e.customers) {
    let delta = e.customers;
    if (delta > 0) delta = Math.round(delta * (1 + 0.08 * Math.min(skills.sales + skills.marketing, 2 * SKILL_CAP)));
    delta = Math.max(delta, -state.customers);
    state.customers += delta;
    if (delta > 0) state.acquiredTotal += delta;
    applied.customers = delta;
  }
  if (e.cash) {
    let delta = e.cash;
    if (delta < 0 && !settings.overdraft) delta = Math.max(delta, -state.cash);
    state.cash += delta;
    if (delta > 0) state.revenueTotal += delta;
    else state.spendTotal -= delta;
    if (delta !== 0) txs.push({ amount: delta, category: delta > 0 ? "contract" : "task", memo: `${delta > 0 ? "Contract revenue" : "Extra cost"}: ${label}` });
    applied.cash = delta;
  }
  const bump = (key: "reputation" | "product" | "risk", max: number) => {
    const v = e[key];
    if (!v) return;
    const before = state[key];
    state[key] = clamp(before + v, 0, max);
    applied[key] = state[key] - before;
  };
  bump("reputation", 100);
  bump("product", 6);
  bump("risk", 100);
  if (e.arpuPct) { state.arpuPct += e.arpuPct; applied.arpuPct = e.arpuPct; }
  if (e.churnPts) { state.churnPts += e.churnPts; applied.churnPts = e.churnPts; }
  if (e.marginPts) { state.marginPts += e.marginPts; applied.marginPts = e.marginPts; }
  for (const m of e.milestones ?? []) {
    if (!state.milestones.includes(m)) { state.milestones.push(m); applied.milestones.push(m); }
  }
  return applied;
}

// ---------------------------------------------------------------- end of turn

function endTurn(state: TeamState, settings: GameSettings, rng: Rng, logs: LogEntry[], txs: TxEntry[]) {
  const econ = turnEconomics(state, settings);
  const turnNo = state.turn + 1;
  const revenue = Math.round(econ.revenue);
  const direct = Math.round(econ.directCosts);
  const pay = econ.payroll;

  if (revenue > 0) txs.push({ amount: revenue, category: "revenue", memo: `Turn ${turnNo} recurring revenue (${state.customers} customers)` });
  if (direct > 0) txs.push({ amount: -direct, category: "direct_cost", memo: `Turn ${turnNo} direct costs` });
  if (pay > 0) txs.push({ amount: -pay, category: "salary", memo: `Turn ${turnNo} payroll (${state.employees.length} staff)` });
  state.cash += revenue - direct - pay;
  if (!settings.overdraft) state.cash = Math.max(0, state.cash);
  state.revenueTotal += revenue;
  state.directCostsTotal += direct;
  state.payrollTotal += pay;
  state.spendTotal += direct + pay;
  state.acquisitionSpend += state.employees
    .map((e) => settings.roles.find((r) => r.id === e.roleId))
    .reduce((s, r) => s + (r?.acquisition ? r.salary : 0), 0);

  // Churn with stochastic rounding so small customer bases still churn fairly.
  const churnRaw = state.customers * clamp(
    econ.track.baseChurn + state.churnPts / 100 - 0.005 * state.product - 0.002 * Math.min(econ.skills.product, SKILL_CAP), 0.01, 0.5);
  const churned = Math.min(state.customers, Math.floor(churnRaw + rng()));
  state.customers -= churned;
  state.churnedTotal += churned;

  state.lastRevenue = revenue;
  state.lastBurn = direct + pay;
  state.lastNet = revenue - direct - pay;
  state.turn = turnNo;

  // Critical event (controlled chance, seeded).
  let event: TaskOutcome["event"];
  if (rng() < settings.eventChance) {
    const pool: CriticalEventDef[] = [...econ.track.events, ...settings.globalEvents];
    const ev = pickWeighted(pool, rng);
    if (ev) {
      const applied = applyEffects(state, settings, ev.effects, econ.skills, txs, ev.title);
      state.stats.events++;
      event = { title: ev.title, text: ev.effects.text, applied };
      logs.push({ type: "event", title: `Critical event: ${ev.title}`, detail: { eventId: ev.id, text: ev.effects.text, applied } });
    }
  }

  // Investor expectations.
  const obligationNotes: string[] = [];
  for (const o of state.obligations) {
    if (o.status !== "open") continue;
    if (state.customers >= o.customers) {
      o.status = "met";
      obligationNotes.push(`Met ${o.investor}'s target of ${o.customers} customers.`);
      state.reputation = clamp(state.reputation + 3, 0, 100);
      logs.push({ type: "obligation", title: `Investor target met (${o.investor})`, detail: { ...o } });
    } else if (state.turn >= o.dueTurn) {
      o.status = "missed";
      state.reputation = clamp(state.reputation - o.penaltyReputation, 0, 100);
      state.risk = clamp(state.risk + 5, 0, 100);
      obligationNotes.push(`Missed ${o.investor}'s target of ${o.customers} customers (−${o.penaltyReputation} reputation).`);
      logs.push({ type: "obligation", title: `Investor target missed (${o.investor})`, detail: { ...o } });
    }
  }

  if (state.turn >= state.turnsTotal) state.finished = true;

  const m = computeMetrics(state, settings);
  const score = computeScore(state, settings, m).total;
  state.history.push({
    turn: state.turn, cash: state.cash, revenue: m.revenue, customers: state.customers, valuation: m.valuation,
    burn: state.lastBurn, cac: m.cac, ltv: m.ltv, score,
  });
  logs.push({
    type: "payroll",
    title: `Turn ${turnNo} closed`,
    detail: { revenue, directCosts: direct, payroll: pay, churned, net: state.lastNet, cashAfter: state.cash },
  });

  const summary: TurnSummary = { turn: turnNo, revenue, directCosts: direct, payroll: pay, churned, net: state.lastNet, cashAfter: state.cash, obligations: obligationNotes };
  return { summary, event };
}

// ---------------------------------------------------------------- fundraising

export interface RoundStatus {
  round: FundingRoundDef;
  checks: { label: string; met: boolean }[];
  eligible: boolean;
}

// ---------------------------------------------------------------- selling equity

export const DEFAULT_EQUITY_SALE = { discount: 0.3, maxPct: 0.1, minOwnership: 0.25 };

/** Price an angel sale of `pct` of the company: new shares at a discount to the current valuation. */
export function equityQuote(state: TeamState, settings: GameSettings, pct: number) {
  const rules = settings.equitySale ?? DEFAULT_EQUITY_SALE;
  const valuation = computeMetrics(state, settings).valuation;
  const amount = Math.round(valuation * (1 - rules.discount) * pct);
  const ownershipAfter = state.ownership * (1 - pct);
  const soldThisTurn = (state.equitySales ?? []).some((e) => e.turn === state.turn);
  const maxPct = Math.max(0, Math.min(rules.maxPct, 1 - rules.minOwnership / Math.max(state.ownership, 1e-9)));
  return { rules, valuation, amount, ownershipAfter, soldThisTurn, maxPct };
}

/** Sell new shares to angel investors for cash. Doesn't use a turn; at most once per month. */
export function sellEquity(prev: TeamState, settings: GameSettings, pct: number): ActionResult {
  const state = structuredClone(prev);
  assertActive(state);
  const q = equityQuote(state, settings, pct);
  if (!(pct > 0)) throw new GameError("Choose how much equity to sell");
  if (q.soldThisTurn) throw new GameError("You can sell equity once per month");
  if (pct > q.rules.maxPct + 1e-9) throw new GameError(`You can sell at most ${Math.round(q.rules.maxPct * 100)}% at a time`);
  if (q.ownershipAfter < q.rules.minOwnership - 1e-9) throw new GameError(`Founders must keep at least ${Math.round(q.rules.minOwnership * 100)}% of the company`);
  if (q.amount <= 0) throw new GameError("Your company has no value to sell yet");
  state.cash += q.amount;
  state.ownership = q.ownershipAfter;
  state.equitySales = [...(state.equitySales ?? []), { turn: state.turn, pct, amount: q.amount, valuation: q.valuation }];
  state.nonce++;
  const label = `${(pct * 100).toFixed(pct * 100 % 1 ? 1 : 0)}%`;
  return {
    state,
    logs: [{ type: "funding", title: `Sold ${label} to angel investors for $${q.amount.toLocaleString()}`, detail: { pct, amount: q.amount, valuation: q.valuation, discount: q.rules.discount, ownershipAfter: q.ownershipAfter } }],
    txs: [{ amount: q.amount, category: "funding", memo: `Angel equity sale: ${label} at ${Math.round(q.rules.discount * 100)}% discount` }],
  };
}

export function nextRound(state: TeamState, settings: GameSettings): RoundStatus | null {
  const raised = new Set(state.rounds.map((r) => r.roundId));
  const round = settings.rounds.find((r) => !raised.has(r.id));
  if (!round) return null;
  const m = computeMetrics(state, settings);
  const c = round.criteria;
  const checks: { label: string; met: boolean }[] = [];
  if (c.minProduct !== undefined) checks.push({ label: `Product level ${c.minProduct}+`, met: state.product >= c.minProduct });
  if (c.minRevenue !== undefined) checks.push({ label: `Revenue $${c.minRevenue.toLocaleString()}+/turn`, met: m.revenue >= c.minRevenue });
  if (c.minCustomers !== undefined) checks.push({ label: `${c.minCustomers}+ customers`, met: state.customers >= c.minCustomers });
  if (c.minReputation !== undefined) checks.push({ label: `Reputation ${c.minReputation}+`, met: state.reputation >= c.minReputation });
  if (c.minLtvCac !== undefined) checks.push({ label: `LTV:CAC ${c.minLtvCac}+`, met: m.ltvCac >= c.minLtvCac });
  for (const ms of c.milestones ?? []) checks.push({ label: milestoneLabel(settings, ms), met: state.milestones.includes(ms) });
  for (const role of c.requireRoles ?? []) {
    checks.push({ label: `${settings.roles.find((r) => r.id === role)?.title ?? role} on the team`, met: state.employees.some((e) => e.roleId === role) });
  }
  return { round, checks, eligible: checks.every((x) => x.met) };
}

export function pitch(prev: TeamState, settings: GameSettings, seed: string): ActionResult {
  const state = structuredClone(prev);
  assertActive(state);
  const status = nextRound(state, settings);
  if (!status) throw new GameError("No further funding rounds available");
  if (!status.eligible) throw new GameError(`Not yet eligible for ${status.round.name}`);
  const logs: LogEntry[] = [];
  const txs: TxEntry[] = [];
  expireOffers(state, logs);
  const rng = createRng(seed);
  const skills = teamSkills(state, settings);
  const roundIdx = settings.rounds.indexOf(status.round);
  const roll = rollFor(state, settings, { strategy: 2, finance: 1, sales: 1 }, 45 + roundIdx * 4, skills, rng, seed);
  const tier: OutcomeTier = roll.total >= SUCCESS_THRESHOLD ? "strategic_success" : roll.total >= PARTIAL_THRESHOLD ? "partial" : "failure";
  const offerCount = tier === "strategic_success" ? 3 : tier === "partial" ? 2 : 0;
  const offers = makeOffers(state, settings, status.round, offerCount, tier === "partial" ? 0.9 : 1, rng);
  state.stats.pitches++;
  state.stats[tier === "strategic_success" ? "strategic" : tier]++;
  let narrative: string;
  const applied: AppliedEffects = { cash: 0, customers: 0, reputation: 0, product: 0, risk: 0, arpuPct: 0, churnPts: 0, marginPts: 0, milestones: [] };
  if (offerCount === 0) {
    narrative = "Investors passed this time. Sharpen your metrics and story, then pitch again.";
    const before = state.reputation;
    state.reputation = clamp(state.reputation - 2, 0, 100);
    applied.reputation = state.reputation - before;
  } else {
    narrative = tier === "strategic_success"
      ? `Strong pitch! ${offerCount} investors sent term sheets for your ${status.round.name}.`
      : `Mixed reception. ${offerCount} investors offered ${status.round.name} terms, a little below your ask.`;
  }
  logs.push({ type: "pitch", title: `${status.round.name} pitch: ${offerCount} offer(s)`, detail: { roundId: status.round.id, tier, roll, offers } });
  const { summary, event } = endTurn(state, settings, rng, logs, txs);
  // Offers are generated against the pre-pitch valuation and are open until the next turn-consuming action.
  state.offers = offers.map((o) => ({ ...o, expectation: o.expectation ? { ...o.expectation, dueTurn: state.turn + status.round.expectation.withinTurns } : undefined }));
  return {
    state, logs, txs,
    outcome: { taskId: "pitch", title: `${status.round.name} investor pitch`, tier, narrative, roll, applied, event, offers: state.offers, turnSummary: summary },
  };
}

function makeOffers(state: TeamState, settings: GameSettings, round: FundingRoundDef, count: number, quality: number, rng: Rng): Offer[] {
  const val = computeMetrics(state, settings).valuation;
  const used = new Set<string>();
  const offers: Offer[] = [];
  const nextIdx = settings.rounds.indexOf(round) + 1;
  const next = settings.rounds[nextIdx];
  for (let i = 0; i < count; i++) {
    let investor = INVESTORS[Math.floor(rng() * INVESTORS.length)];
    while (used.has(investor)) investor = INVESTORS[(INVESTORS.indexOf(investor) + 1) % INVESTORS.length];
    used.add(investor);
    const pre = roundTo(clamp(val * (0.85 + rng() * 0.45) * quality, round.preMoneyRange[0], round.preMoneyRange[1]), 1000);
    const sold = round.dilutionRange[0] + rng() * (round.dilutionRange[1] - round.dilutionRange[0]);
    const amount = roundTo((pre * sold) / (1 - sold), 1000);
    const post = pre + amount;
    const t = OFFER_TERMS[Math.floor(rng() * OFFER_TERMS.length)];
    const target = Math.max(Math.ceil(state.customers * round.expectation.customerMultiplier), state.customers + 5);
    offers.push({
      id: `${round.id}-${state.nonce + 1}-${i}`,
      roundId: round.id,
      investor,
      amount,
      preMoney: pre,
      postMoney: post,
      ownershipSold: amount / post,
      terms: t.terms,
      expectation: t.expectation
        ? { customers: target, dueTurn: 0, penaltyReputation: round.expectation.penaltyReputation }
        : undefined,
      nextMilestone: next ? `Next: ${next.name}` : "Next: category leadership / exit",
    });
  }
  state.nonce++;
  return offers;
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function acceptOffer(prev: TeamState, settings: GameSettings, offerId: string): ActionResult {
  const state = structuredClone(prev);
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) throw new GameError("Offer not found or expired");
  const round = settings.rounds.find((r) => r.id === offer.roundId);
  state.cash += offer.amount;
  state.ownership = state.ownership * (1 - offer.ownershipSold);
  state.rounds.push({
    roundId: offer.roundId, investor: offer.investor, amount: offer.amount, preMoney: offer.preMoney,
    postMoney: offer.postMoney, ownershipSold: offer.ownershipSold, turn: state.turn, terms: offer.terms,
  });
  if (!state.milestones.includes(offer.roundId)) state.milestones.push(offer.roundId);
  if (offer.expectation) {
    state.obligations.push({
      roundId: offer.roundId, investor: offer.investor, customers: offer.expectation.customers,
      dueTurn: offer.expectation.dueTurn, penaltyReputation: offer.expectation.penaltyReputation, status: "open",
    });
  }
  state.reputation = clamp(state.reputation + 3, 0, 100);
  state.offers = [];
  state.nonce++;
  return {
    state,
    logs: [{ type: "funding", title: `Raised ${round?.name ?? offer.roundId} from ${offer.investor}`, detail: { ...offer } }],
    txs: [{ amount: offer.amount, category: "funding", memo: `${round?.name ?? offer.roundId} from ${offer.investor}` }],
  };
}

export function declineOffers(prev: TeamState): ActionResult {
  const state = structuredClone(prev);
  if (!state.offers.length) throw new GameError("No open offers");
  const logs: LogEntry[] = [{ type: "funding", title: "Declined all investor offers", detail: { offers: state.offers.map((o) => o.id) } }];
  state.offers = [];
  return { state, logs, txs: [] };
}

function expireOffers(state: TeamState, logs: LogEntry[]) {
  if (state.offers.length) {
    logs.push({ type: "funding", title: "Investor offers expired", detail: { offers: state.offers.map((o) => o.id) } });
    state.offers = [];
  }
}

function assertActive(state: TeamState) {
  if (state.finished) throw new GameError("Your company has used all its turns");
}
