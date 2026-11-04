import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/game/content/defaults";
import { acceptOffer, crewLimit, equityQuote, fire, GameError, hire, newTeamState, nextRound, pitch, runTask, sellEquity, suggestCrew, taskBoard } from "@/game/engine";
import { computeMetrics } from "@/game/metrics";
import { computeScore } from "@/game/scoring";
import type { TeamState } from "@/game/types";

const settings = defaultSettings();

describe("team setup", () => {
  it("starts every team with exactly the configured cash and no employees", () => {
    for (const t of settings.tracks) {
      const s = newTeamState(settings, t.id);
      expect(s.cash).toBe(1000);
      expect(s.employees).toHaveLength(0);
      expect(s.turnsTotal).toBe(settings.turns);
    }
  });
});

describe("hiring", () => {
  it("charges the upfront fee and adds salary to payroll", () => {
    const { state, txs } = hire(newTeamState(settings, "climate"), settings, "engineer", "seed");
    expect(state.cash).toBe(750);
    expect(computeMetrics(state, settings).payroll).toBe(50);
    expect(txs[0]).toMatchObject({ amount: -250, category: "hiring" });
  });

  it("enforces capacity and refuses to spend below zero", () => {
    let s = newTeamState(settings, "climate");
    s = hire(s, settings, "ceo", "a").state;
    expect(() => hire(s, settings, "ceo", "b")).toThrow(GameError);
    const broke: TeamState = { ...s, cash: 10 };
    expect(() => hire(broke, settings, "engineer", "c")).toThrow(/Not enough cash/);
  });

  it("pays severance when letting someone go", () => {
    const s = hire(newTeamState(settings, "climate"), settings, "engineer", "x").state;
    const r = fire(s, settings, s.employees[0].id);
    expect(r.state.employees).toHaveLength(0);
    expect(r.state.cash).toBe(700);
  });
});

describe("tasks", () => {
  it("consumes a turn, logs the outcome and posts payroll", () => {
    const s = hire(newTeamState(settings, "climate"), settings, "engineer", "x").state;
    const r = runTask(s, settings, "mvp", "deterministic-seed");
    expect(r.state.turn).toBe(1);
    expect(r.outcome?.roll.seed).toBe("deterministic-seed");
    expect(r.logs.some((l) => l.type === "task")).toBe(true);
    expect(r.txs.some((t) => t.category === "salary" && t.amount === -50)).toBe(true);
    const sum = r.txs.reduce((a, t) => a + t.amount, s.cash);
    expect(Math.round(sum)).toBe(Math.round(r.state.cash));
  });

  it("is deterministic for the same seed", () => {
    const s = hire(newTeamState(settings, "fintech"), settings, "engineer", "x").state;
    expect(runTask(s, settings, "mvp", "same").state).toEqual(runTask(s, settings, "mvp", "same").state);
  });

  it("locks tasks until prerequisites are met", () => {
    const fresh = newTeamState(settings, "health");
    const board = taskBoard(fresh, settings);
    expect(board.find((b) => b.task.id === "pilotLean")?.available).toBe(false);
    expect(board.find((b) => b.task.id === "mvp")?.reasons).toContain("Hire Engineer / CTO");
    expect(board.find((b) => b.task.id === "consulting")?.available).toBe(true);
    const staffed = hire(fresh, settings, "engineer", "e").state;
    expect(taskBoard(staffed, settings).find((b) => b.task.id === "mvp")?.available).toBe(true);
  });

  it("never lets cash go negative without overdraft", () => {
    let s = newTeamState(settings, "edtech");
    for (const role of ["engineer", "sales", "product"]) s = hire(s, settings, role, role).state;
    for (let i = 0; i < settings.turns && !s.finished; i++) {
      const pick = taskBoard(s, settings).find((b) => b.available);
      if (!pick) break;
      s = runTask(s, settings, pick.task.id, `t${i}`).state;
      expect(s.cash).toBeGreaterThanOrEqual(0);
    }
  });

  it("finishes after the configured number of turns", () => {
    let s = newTeamState(settings, "climate");
    for (let i = 0; i < settings.turns; i++) s = runTask(s, settings, "consulting", `c${i}`).state;
    expect(s.finished).toBe(true);
    expect(() => runTask(s, settings, "consulting", "late")).toThrow(GameError);
  });
});

describe("crew assignment", () => {
  const staffed = () => {
    let s = newTeamState(settings, "climate");
    for (const r of ["engineer", "engineer", "sales", "ceo"]) s = { ...hire(s, settings, r, r + s.nonce).state, cash: 5000 };
    return s;
  };

  it("requires the task's roles in the assigned crew", () => {
    const s = staffed();
    const sales = s.employees.find((e) => e.roleId === "sales")!;
    expect(() => runTask(s, settings, "mvp", "c", [sales.id])).toThrow(/Assign your Engineer/);
  });

  it("caps the crew size and rejects unknown or repeated employees", () => {
    const s = staffed();
    const ids = s.employees.map((e) => e.id);
    expect(() => runTask(s, settings, "mvp", "c", ids)).toThrow(/At most 2/);
    expect(() => runTask(s, settings, "mvp", "c", [ids[0], ids[0]])).toThrow(GameError);
    expect(() => runTask(s, settings, "mvp", "c", ["ghost"])).toThrow(GameError);
  });

  it("counts only the assigned crew's skills", () => {
    const s = staffed();
    const [eng1, eng2] = s.employees.filter((e) => e.roleId === "engineer");
    const sales = s.employees.find((e) => e.roleId === "sales")!;
    const strong = runTask(s, settings, "mvp", "same", [eng1.id, eng2.id]).outcome!.roll;
    const weak = runTask(s, settings, "mvp", "same", [eng1.id, sales.id]).outcome!.roll;
    expect(strong.capability).toBeGreaterThan(weak.capability);
    expect(strong.variance).toBe(weak.variance);
  });

  it("suggests a crew that covers required roles within the limit", () => {
    const s = staffed();
    const task = taskBoard(s, settings).find((b) => b.task.id === "mvp")!.task;
    const crew = suggestCrew(s.employees, settings, task);
    expect(crew.length).toBeLessThanOrEqual(crewLimit(task));
    expect(crew.every((e) => e.roleId === "engineer")).toBe(true);
  });
});

describe("branching missions", () => {
  it("offers alternative paths and opens path-specific follow-ups", () => {
    let s = newTeamState(settings, "fintech");
    for (const r of ["ceo", "marketing", "product", "sales"]) s = { ...hire(s, settings, r, r).state, cash: 9000 };
    const ready = (st: typeof s) => taskBoard(st, settings).filter((b) => b.available).map((b) => b.task.id);
    expect(ready(s)).toEqual(expect.arrayContaining(["research", "landingTest", "noCodeMvp"]));
    s = { ...s, milestones: ["validated", "prototype"], completed: { landingTest: 1, noCodeMvp: 1 }, lockedGroups: ["discovery", "build"] };
    expect(ready(s)).toEqual(expect.arrayContaining(["pilotLean", "pilotPremium", "pilotCommunity"]));
    expect(ready(s)).not.toContain("research");
    const community = { ...s, milestones: [...s.milestones, "pilot", "path-community"], lockedGroups: [...s.lockedGroups, "pilot"], completed: { ...s.completed, pilotCommunity: 1 } };
    expect(ready(community)).toContain("referral");
    expect(ready(community)).not.toContain("pilotLean");
    expect(taskBoard(community, settings).find((b) => b.task.id === "enterpriseDeal")?.available).toBe(false);
  });
});

describe("selling equity", () => {
  it("sells new shares at a discount, once per month, above the founders' floor", () => {
    const s = { ...newTeamState(settings, "climate"), cash: 5000 };
    const q = equityQuote(s, settings, 0.1);
    const r = sellEquity(s, settings, 0.1);
    expect(r.state.cash).toBe(s.cash + q.amount);
    expect(q.amount).toBe(Math.round(q.valuation * 0.7 * 0.1));
    expect(r.state.ownership).toBeCloseTo(0.9, 10);
    expect(() => sellEquity(r.state, settings, 0.05)).toThrow(/once per month/);
    expect(() => sellEquity(s, settings, 0.2)).toThrow(/at most 10%/);
    expect(() => sellEquity({ ...s, ownership: 0.26 }, settings, 0.1)).toThrow(/at least 25%/);
  });
});

describe("fundraising", () => {
  it("requires criteria and applies dilution as investment / post-money", () => {
    let s = newTeamState(settings, "climate");
    expect(nextRound(s, settings)?.eligible).toBe(false);
    expect(() => pitch(s, settings, "p")).toThrow(GameError);
    s = { ...s, product: 1, milestones: ["validated", "prototype"], employees: [{ id: "ceo-1", roleId: "ceo", name: "A", hiredTurn: 0 }] };
    expect(nextRound(s, settings)?.eligible).toBe(true);
    let offers = s.offers;
    for (let i = 0; i < 20 && !offers.length; i++) {
      const r = pitch(s, settings, `pitch-${i}`);
      offers = r.state.offers;
      if (offers.length) s = r.state;
    }
    expect(offers.length).toBeGreaterThan(0);
    const o = offers[0];
    expect(o.postMoney).toBe(o.preMoney + o.amount);
    expect(o.ownershipSold).toBeCloseTo(o.amount / o.postMoney, 10);
    const after = acceptOffer(s, settings, o.id).state;
    expect(after.cash).toBe(s.cash + o.amount);
    expect(after.ownership).toBeCloseTo(1 - o.ownershipSold, 10);
    expect(after.milestones).toContain("preseed");
  });
});

describe("scoring", () => {
  it("produces a 0–100 score with configurable weights", () => {
    const s = newTeamState(settings, "climate");
    const m = computeMetrics(s, settings);
    const b = computeScore(s, settings, m);
    expect(b.total).toBeGreaterThanOrEqual(0);
    expect(b.total).toBeLessThanOrEqual(100);
    const onlyValuation = { ...settings, weights: { valuation: 1, profitability: 0, traction: 0, execution: 0, efficiency: 0, fundraising: 0, resilience: 0 } };
    expect(computeScore(s, onlyValuation, m).total).toBeCloseTo(b.components.valuation, 1);
  });
});
