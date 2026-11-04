import type { CriticalEventDef, TaskDef } from "../types";

// Available on every track. `consulting` and `damage-control` need no particular role, so no team can soft-lock.
export const DEFAULT_SHARED_TASKS: TaskDef[] = [
  { id: "consulting", title: "Freelance consulting sprint", category: "recovery", kind: "profitable",
    objective: "Take on a short paid project to extend runway.", benefits: "Reliable cash, but it costs a turn of progress.",
    cost: 0, risk: "low", difficulty: 30, skills: { tech: 1, strategy: 1 }, repeatable: true,
    outcomes: {
      success: { text: "The client paid in full and asked for more.", cash: 350 },
      partial: { text: "Scope creep ate into the fee.", cash: 180 },
      failure: { text: "The client paid late and grudgingly.", cash: 60, reputation: -1 },
    } },
  { id: "damage-control", title: "Reputation recovery plan", category: "recovery", kind: "strategic",
    objective: "Own the mistakes publicly, fix them, and win back trust.", benefits: "Rebuilds reputation after setbacks.",
    cost: 100, risk: "low", difficulty: 35, skills: { strategy: 1, marketing: 1 }, requires: { maxReputation: 40 }, repeatable: true,
    outcomes: {
      success: { text: "A transparent post-mortem earns respect.", reputation: 12, risk: -4 },
      partial: { text: "Some customers forgave you.", reputation: 6 },
      failure: { text: "The apology landed badly.", reputation: -2 },
    } },
  { id: "process-audit", title: "Team offsite & process audit", category: "ops", kind: "strategic",
    objective: "Tighten processes, reduce key-person risk and wasted spend.", benefits: "Lowers operating risk; improves resilience score.",
    cost: 150, risk: "low", difficulty: 40, skills: { ops: 2, finance: 1 }, crew: ["ops"], requires: { minProduct: 1 },
    outcomes: {
      success: { text: "Leaner processes, clearer ownership.", risk: -12, marginPts: 2 },
      partial: { text: "Some improvements stuck.", risk: -5 },
      failure: { text: "The offsite turned into a debate club.", risk: 2 },
    } },
];

export const DEFAULT_GLOBAL_EVENTS: CriticalEventDef[] = [
  { id: "press", title: "Viral tech-blog feature", weight: 3, effects: { text: "A popular newsletter featured you. Inbound interest spikes.", reputation: 7 } },
  { id: "award", title: "Startup award shortlist", weight: 2, effects: { text: "You were shortlisted for a regional startup award.", reputation: 5 } },
  { id: "outage", title: "Cloud provider outage", weight: 2, effects: { text: "A major cloud outage took you down for hours.", reputation: -4, cash: -80 } },
  { id: "rates", title: "Interest-rate shock", weight: 2, effects: { text: "Investors turn cautious across the market.", risk: 6 } },
  { id: "rival", title: "Competitor raises a mega-round", weight: 2, effects: { text: "A well-funded rival is now shouting louder than you.", reputation: -3, risk: 3 } },
];
