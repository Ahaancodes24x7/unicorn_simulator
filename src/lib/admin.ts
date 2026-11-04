// Admin-only read models and manual interventions. Callers must have passed requireAdmin().
import { newTeamState } from "@/game/engine";
import { computeMetrics, getTrack } from "@/game/metrics";
import { computeScore, SCORE_LABELS } from "@/game/scoring";
import type { TeamState } from "@/game/types";
import { parse, prisma } from "./db";
import { audit, getGame, invalidateLeaderboard, leaderboard, type TeamSummary } from "./game";
import { HttpError } from "./http";

export function alertsFor(t: TeamSummary, running: boolean): string[] {
  const out: string[] = [];
  if (t.awaitingTrack) out.push("Needs a problem set");
  if (t.finished) return out;
  if (t.metrics.runway < 2) out.push("Runway under 2 turns");
  if (t.metrics.reputation < 30) out.push("Reputation critical");
  if (t.metrics.cash < 100) out.push("Cash nearly exhausted");
  if (running && Date.now() - new Date(t.updatedAt).getTime() > 10 * 60_000) out.push("Inactive 10+ min");
  return out;
}

export async function adminOverview() {
  const { game, teams } = await leaderboard();
  const running = game.status === "running";
  return {
    status: game.status,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    eventName: game.settings.eventName,
    turns: game.settings.turns,
    weights: game.settings.weights,
    scoreLabels: SCORE_LABELS,
    tracks: game.settings.tracks.map((t) => ({ id: t.id, code: t.code, sector: t.sector, company: t.company })),
    teams: teams.map((t) => ({ ...t, alerts: alertsFor(t, running) })),
  };
}

export async function adminTeamDetail(id: string) {
  const game = await getGame();
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new HttpError(404, "Team not found");
  const state = parse<TeamState>(team.state);
  const [events, transactions, snapshots, { teams }] = await Promise.all([
    prisma.event.findMany({ where: { teamId: id }, orderBy: { id: "asc" } }),
    prisma.transaction.findMany({ where: { teamId: id }, orderBy: { id: "asc" } }),
    prisma.metricsSnapshot.findMany({ where: { teamId: id }, orderBy: { id: "asc" } }),
    leaderboard(),
  ]);
  const summary = teams.find((t) => t.id === id)!;
  return {
    summary,
    seed: team.seed,
    scoreAdjustment: team.scoreAdjustment,
    state,
    track: getTrack(game.settings, state.trackId),
    roles: game.settings.roles,
    tracks: game.settings.tracks.map((t) => ({ id: t.id, sector: t.sector, company: t.company })),
    scoreLabels: SCORE_LABELS,
    events: events.map((e) => ({ ...e, detail: parse<Record<string, unknown>>(e.detail) })),
    transactions,
    snapshots: snapshots.map((s) => ({ turn: s.turn, score: s.score, createdAt: s.createdAt, metrics: parse(s.metrics), breakdown: parse(s.breakdown) })),
  };
}

export type AdminAdjust =
  | { kind: "score"; delta: number; reason: string }
  | { kind: "cash"; delta: number; reason: string }
  | { kind: "track"; trackId: string; reason: string };

export async function adjustTeam(id: string, adj: AdminAdjust, actor: string) {
  invalidateLeaderboard();
  const { settings } = await getGame();
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new HttpError(404, "Team not found");
  let state = parse<TeamState>(team.state);
  let scoreAdjustment = team.scoreAdjustment;
  let title: string;
  const txs: { amount: number; category: string; memo: string; balanceAfter: number }[] = [];

  if (adj.kind === "score") {
    scoreAdjustment += adj.delta;
    title = `Admin score adjustment ${adj.delta >= 0 ? "+" : ""}${adj.delta}`;
  } else if (adj.kind === "cash") {
    if (!settings.overdraft && state.cash + adj.delta < 0) throw new HttpError(400, "Adjustment would make cash negative");
    state.cash += adj.delta;
    txs.push({ amount: adj.delta, category: "admin", memo: `Admin adjustment: ${adj.reason}`, balanceAfter: state.cash });
    title = `Admin cash adjustment ${adj.delta >= 0 ? "+" : "-"}$${Math.abs(adj.delta).toLocaleString()}`;
  } else {
    if (state.turn > 0) throw new HttpError(400, "A problem set can only be changed before the team's first turn");
    const track = getTrack(settings, adj.trackId);
    const keep = state.employees;
    const cash = state.cash;
    state = { ...newTeamState(settings, track.id), employees: keep, cash }; // also clears awaitingTrack
    title = `Organizers assigned problem set: ${track.code} · ${track.sector}`;
  }

  const m = computeMetrics(state, settings);
  const score = computeScore(state, settings, m, scoreAdjustment);
  const updated = await prisma.team.updateMany({
    where: { id, version: team.version },
    data: {
      state: JSON.stringify(state), version: { increment: 1 }, trackId: state.trackId, cash: state.cash,
      valuation: m.valuation, score: score.total, scoreAdjustment,
    },
  });
  if (updated.count !== 1) throw new HttpError(409, "Team changed while adjusting; reload and retry");
  await prisma.event.create({
    data: { teamId: id, turn: state.turn, type: adj.kind === "score" ? "score" : "admin", title, detail: JSON.stringify({ ...adj, actor, from: team.score, to: score.total }) },
  });
  if (txs.length) await prisma.transaction.createMany({ data: txs.map((t) => ({ ...t, teamId: id, turn: state.turn })) });
  await audit(actor, `team.adjust.${adj.kind}`, { target: `${team.name} (${id})`, reason: adj.reason, detail: adj });
}

/**
 * Assigns problem sets from the overview. Explicit picks first; then, if `autoRest`, every team still
 * waiting gets the least-used set (ties go to the earlier set). Each change is logged like a manual one.
 */
export async function assignSets(picks: { id: string; trackId: string }[], autoRest: boolean, actor: string) {
  const { settings } = await getGame();
  for (const p of picks) await adjustTeam(p.id, { kind: "track", trackId: p.trackId, reason: "Assigned from the overview" }, actor);
  if (!autoRest) return { assigned: picks.length };
  const teams = (await prisma.team.findMany({ select: { id: true, state: true, createdAt: true }, orderBy: { createdAt: "asc" } }))
    .map((t) => ({ id: t.id, state: parse<TeamState>(t.state) }));
  const counts = new Map(settings.tracks.map((t) => [t.id, 0]));
  for (const t of teams) if (!t.state.awaitingTrack) counts.set(t.state.trackId, (counts.get(t.state.trackId) ?? 0) + 1);
  let auto = 0;
  for (const t of teams.filter((x) => x.state.awaitingTrack)) {
    const trackId = [...counts].sort((a, b) => a[1] - b[1])[0][0];
    await adjustTeam(t.id, { kind: "track", trackId, reason: "Auto-assigned (balanced) from the overview" }, actor);
    counts.set(trackId, (counts.get(trackId) ?? 0) + 1);
    auto++;
  }
  return { assigned: picks.length + auto };
}

export async function deleteTeam(id: string, actor: string, reason: string) {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw new HttpError(404, "Team not found");
  await prisma.team.delete({ where: { id } });
  invalidateLeaderboard();
  await audit(actor, "team.delete", { target: `${team.name} (${id})`, reason });
}
