// Core simulation types. Everything numeric here is a configurable *game parameter*,
// not a real-world benchmark.

export type Skill = "strategy" | "tech" | "sales" | "marketing" | "ops" | "finance" | "product";
export const SKILLS: Skill[] = ["strategy", "tech", "sales", "marketing", "ops", "finance", "product"];

export type GameStatus = "lobby" | "running" | "paused" | "ended";
export type RiskLevel = "low" | "medium" | "high";
export type OutcomeTier = "profitable_success" | "strategic_success" | "partial" | "failure";

export interface RoleDef {
  id: string;
  title: string;
  hireCost: number; // one-off
  salary: number; // per turn
  skills: Partial<Record<Skill, number>>;
  max: number; // capacity per team
  blurb: string;
  icon?: string; // emoji shown in the UI
  acquisition?: boolean; // hiring fee and salary count toward customer acquisition cost (CAC)
}

/** Effects applied when an outcome resolves. Positive `cash` is contract revenue, negative is extra cost. */
export interface Effects {
  text: string;
  cash?: number;
  customers?: number;
  reputation?: number;
  product?: number;
  risk?: number;
  arpuPct?: number; // permanent % change to revenue per customer
  churnPts?: number; // permanent change to churn, in percentage points (negative = better)
  marginPts?: number; // permanent change to gross margin, percentage points
  milestones?: string[];
}

export interface TaskRequirements {
  tasks?: string[]; // all must be completed (success or partial)
  milestones?: string[];
  minProduct?: number;
  minCustomers?: number;
  minReputation?: number;
  maxReputation?: number;
  roles?: string[]; // role ids that must be on payroll
}

export interface TaskDef {
  id: string;
  title: string;
  objective: string;
  benefits: string; // shown before resolution; exact numbers stay hidden
  category: "research" | "product" | "growth" | "ops" | "compliance" | "partnership" | "finance" | "recovery";
  kind: "profitable" | "strategic";
  cost: number;
  risk: RiskLevel;
  difficulty: number; // 0–100, 50 = average
  skills: Partial<Record<Skill, number>>; // relative weight of each skill
  requires?: TaskRequirements;
  crew?: string[]; // role ids that must be assigned to the task (one employee each)
  crewMax?: number; // most employees that can work on it (default: required roles + 1, at least 2)
  repeatable?: boolean;
  acquisition?: boolean; // cost counts toward CAC
  choiceGroup?: string; // completing one task in a group locks the others
  turns?: number; // default 1
  outcomes: { success: Effects; partial: Effects; failure: Effects };
}

export interface CriticalEventDef {
  id: string;
  title: string;
  weight: number;
  effects: Effects;
}

export interface TrackDef {
  id: string;
  code: string; // A–D
  sector: string;
  problem: string;
  company: string;
  tagline: string;
  customerLabel: string;
  arpu: number; // revenue per customer per turn
  grossMargin: number; // 0–1
  baseChurn: number; // per turn, 0–1
  tractionTarget: number; // customers that count as "full marks" for traction
  tasks: TaskDef[];
  events: CriticalEventDef[];
}

export interface RoundCriteria {
  minProduct?: number;
  minCustomers?: number;
  minRevenue?: number; // per turn
  minReputation?: number;
  minLtvCac?: number;
  milestones?: string[];
  requireRoles?: string[];
}

export interface FundingRoundDef {
  id: string;
  name: string;
  criteria: RoundCriteria;
  preMoneyRange: [number, number];
  dilutionRange: [number, number]; // fraction of company sold
  /** Growth expectation attached to the offer: customers multiplier within N turns. */
  expectation: { customerMultiplier: number; withinTurns: number; penaltyReputation: number };
}

export interface ScoreWeights {
  valuation: number;
  profitability: number;
  traction: number;
  execution: number;
  efficiency: number;
  fundraising: number;
  resilience: number;
}

export interface GameSettings {
  eventName: string;
  turns: number;
  startingCash: number;
  maxTeams: number;
  maxTeamSize: number;
  assignment: "random" | "balanced" | "choice" | "admin"; // "admin": organizers assign each team's set
  allowLateJoin: boolean;
  variance: number; // ± points of controlled randomness on each roll
  eventChance: number; // probability of a critical event per turn
  overdraft: boolean;
  /** Selling founder equity to angels for quick cash: price discount, max % per sale, founders' floor. */
  equitySale?: { discount: number; maxPct: number; minOwnership: number };
  weights: ScoreWeights;
  milestoneValues: Record<string, number>;
  roles: RoleDef[];
  rounds: FundingRoundDef[];
  sharedTasks: TaskDef[];
  globalEvents: CriticalEventDef[];
  tracks: TrackDef[];
}

export interface Employee {
  id: string;
  roleId: string;
  name: string;
  hiredTurn: number;
}

export interface Offer {
  id: string;
  roundId: string;
  investor: string;
  amount: number;
  preMoney: number;
  postMoney: number;
  ownershipSold: number;
  terms: string;
  expectation?: { customers: number; dueTurn: number; penaltyReputation: number };
  nextMilestone: string;
}

export interface RoundRecord {
  roundId: string;
  investor: string;
  amount: number;
  preMoney: number;
  postMoney: number;
  ownershipSold: number;
  turn: number;
  terms: string;
}

export interface Obligation {
  roundId: string;
  investor: string;
  customers: number;
  dueTurn: number;
  penaltyReputation: number;
  status: "open" | "met" | "missed";
}

export interface HistoryPoint {
  turn: number;
  cash: number;
  revenue: number;
  customers: number;
  valuation: number;
  burn: number;
  cac: number;
  ltv: number;
  score: number;
}

export interface TeamState {
  trackId: string;
  cash: number;
  turn: number; // turns consumed
  turnsTotal: number;
  customers: number;
  acquiredTotal: number;
  churnedTotal: number;
  acquisitionSpend: number;
  reputation: number; // 0–100
  product: number; // 0–6
  risk: number; // 0–100
  arpuPct: number;
  churnPts: number;
  marginPts: number;
  milestones: string[];
  completed: Record<string, number>;
  lockedGroups: string[];
  employees: Employee[];
  revenueTotal: number; // recurring + contracts
  directCostsTotal: number;
  payrollTotal: number;
  spendTotal: number; // all cash out
  lastRevenue: number;
  lastBurn: number; // gross cash out last turn
  lastNet: number;
  ownership: number; // founders' fraction
  rounds: RoundRecord[];
  equitySales?: { turn: number; pct: number; amount: number; valuation: number }[];
  offers: Offer[];
  obligations: Obligation[];
  stats: { profitable: number; strategic: number; partial: number; failure: number; events: number; pitches: number };
  history: HistoryPoint[];
  finished: boolean;
  awaitingTrack?: boolean; // waiting for an organizer to assign the problem set ("admin" assignment)
  nonce: number; // increments every resolved action, feeds the RNG seed
}

export interface Metrics {
  cash: number;
  revenue: number; // per turn (recurring)
  arr: number;
  customers: number;
  burn: number;
  netBurn: number;
  runway: number; // turns
  grossMargin: number;
  cac: number;
  ltv: number;
  ltvCac: number;
  churnRate: number;
  arpu: number;
  payroll: number;
  valuation: number;
  netWorth: number;
  founderEquityValue: number;
  ownership: number;
  fundingRaised: number;
  reputation: number;
  product: number;
  risk: number;
  turn: number;
  turnsTotal: number;
}

export interface ScoreBreakdown {
  components: Record<keyof ScoreWeights, number>; // 0–100 each
  weighted: Record<keyof ScoreWeights, number>;
  adjustment: number;
  total: number;
}

export interface RollBreakdown {
  seed: string;
  base: number;
  capability: number;
  capabilityBonus: number;
  difficultyPenalty: number;
  readiness: number;
  reputation: number;
  risk: number;
  variance: number;
  total: number;
  thresholds: { success: number; partial: number };
}

export interface LogEntry {
  type: string;
  title: string;
  detail: Record<string, unknown>;
}

export interface TxEntry {
  amount: number;
  category: string;
  memo: string;
}
