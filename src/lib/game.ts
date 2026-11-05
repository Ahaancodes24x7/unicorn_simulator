// Persistence + orchestration around the pure engine. All financial changes happen here,
// server-side, inside a DB transaction guarded by an optimistic version check.
import { randomBytes, randomInt } from "node:crypto";
import type { Team } from "@prisma/client";
import { defaultSettings } from "@/game/content/defaults";
import {
  acceptOffer, declineOffers, equityQuote, fire, hire, newTeamState, nextRound, pitch, runTask, sellEquity, taskBoard,
  type ActionResult, type TaskOutcome,
} from "@/game/engine";
import { computeMetrics, getTrack } from "@/game/metrics";
import { compareRank, computeScore } from "@/game/scoring";
import type { GameSettings, GameStatus, Metrics, ScoreBreakdown, TeamState } from "@/game/types";
import { sha256 } from "./auth";
import { parse, prisma } from "./db";
import { HttpError } from "./http";
import { settingsSchema } from "./settingsSchema";

// ---------------------------------------------------------------- game config

export interface GameInfo {
  status: GameStatus;
  settings: GameSettings;
  startedAt: Date | null;
  endedAt: Date | null;
  /** Short hash of the settings: tags cached leaderboard rows and dashboard versions. */
  stamp: string;
  updatedAt: Date;
}

// Every request starts by reading the config row, so it's cached for 2s per server instance (a pause or
// settings change reaches every instance within that time). Dropped immediately on this instance's writes.
const GAME_TTL_MS = 2_000;
type ConfigRow = { status: string; settings: string; startedAt: Date | null; endedAt: Date | null; updatedAt: Date; stamp: string };
let gameCache: { at: number; row: Promise<ConfigRow> } | null = null;

export function invalidateGame() {
  gameCache = null;
}

async function loadConfig(): Promise<ConfigRow> {
  const row = (await prisma.gameConfig.findUnique({ where: { id: 1 } })) ?? (await prisma.gameConfig.upsert({
    where: { id: 1 }, update: {}, create: { id: 1, status: "lobby", settings: JSON.stringify(defaultSettings()) },
  }));
  return { ...row, stamp: sha256(row.settings).slice(0, 12) };
}

export async function getGame(): Promise<GameInfo> {
  if (!gameCache || Date.now() - gameCache.at > GAME_TTL_MS) {
    const row = loadConfig();
    gameCache = { at: Date.now(), row };
    row.catch(() => { gameCache = null; });
  }
  const row = await gameCache.row;
  // parsed per call so no request can mutate another request's settings object
  return {
    status: row.status as GameStatus, settings: parse<GameSettings>(row.settings), startedAt: row.startedAt, endedAt: row.endedAt,
    stamp: row.stamp, updatedAt: row.updatedAt,
  };
}

export async function audit(actor: string, action: string, opts: { target?: string; reason?: string; detail?: unknown } = {}) {
  await prisma.auditLog.create({
    data: { actor, action, target: opts.target, reason: opts.reason, detail: JSON.stringify(opts.detail ?? {}) },
  });
}

export async function saveSettings(raw: unknown, actor: string, reason?: string) {
  invalidateLeaderboard();
  invalidateGame();
  const settings = settingsSchema.parse(raw) as GameSettings;
  const before = await getGame();
  await prisma.gameConfig.update({ where: { id: 1 }, data: { settings: JSON.stringify(settings) } });
  invalidateGame();
  // Keep in-flight teams consistent with a changed turn limit.
  if (settings.turns !== before.settings.turns) {
    const teams = await prisma.team.findMany();
    for (const t of teams) {
      const s = parse<TeamState>(t.state);
      s.turnsTotal = settings.turns;
      s.finished = s.turn >= s.turnsTotal;
      await prisma.team.update({ where: { id: t.id }, data: { state: JSON.stringify(s), finished: s.finished, version: { increment: 1 } } });
    }
  }
  await audit(actor, "settings.update", { reason, detail: { changedKeys: changedKeys(before.settings, settings) } });
  return settings;
}

function changedKeys(a: GameSettings, b: GameSettings): string[] {
  return (Object.keys(b) as (keyof GameSettings)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

export async function setStatus(status: GameStatus, actor: string, reason?: string) {
  invalidateGame();
  const game = await getGame();
  const allowed: Record<GameStatus, GameStatus[]> = {
    lobby: ["running"], running: ["paused", "ended"], paused: ["running", "ended"], ended: ["running"],
  };
  if (!allowed[game.status].includes(status)) throw new HttpError(400, `Cannot move from ${game.status} to ${status}`);
  await prisma.gameConfig.update({
    where: { id: 1 },
    data: {
      status,
      ...(status === "running" && !game.startedAt ? { startedAt: new Date() } : {}),
      ...(status === "ended" ? { endedAt: new Date() } : {}),
    },
  });
  invalidateGame();
  await audit(actor, `game.${status === "running" ? (game.status === "lobby" ? "start" : "resume") : status === "paused" ? "pause" : "end"}`, { reason });
}

export async function resetGame(actor: string, reason: string, keepSettings: boolean) {
  invalidateLeaderboard();
  invalidateGame();
  const count = await prisma.team.count();
  await prisma.$transaction([
    prisma.team.deleteMany(),
    prisma.gameConfig.update({
      where: { id: 1 },
      data: { status: "lobby", startedAt: null, endedAt: null, ...(keepSettings ? {} : { settings: JSON.stringify(defaultSettings()) }) },
    }),
  ]);
  invalidateGame();
  invalidateLeaderboard();
  await audit(actor, "game.reset", { reason, detail: { teamsDeleted: count, keepSettings } });
}

// ---------------------------------------------------------------- teams

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function accessCode(): string {
  const chars = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}
const hashCode = (code: string) => sha256(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));

/**
 * Registers a team and returns its access code (shown or emailed once; only the hash is stored).
 * `lead` is the team lead's email, which can lead only one team. Admins may create teams outside the lobby.
 */
export async function createTeam(input: { name: string; lead?: string; trackId?: string; byAdmin?: boolean }) {
  invalidateLeaderboard();
  const game = await getGame();
  const { settings } = game;
  if (!input.byAdmin) {
    if (game.status === "ended") throw new HttpError(400, "The game has ended");
    if (game.status !== "lobby" && !settings.allowLateJoin) throw new HttpError(400, "Registration is closed for this event");
  }
  const teams = await prisma.team.findMany({ select: { trackId: true, name: true } });
  if (!input.byAdmin && teams.length >= settings.maxTeams) throw new HttpError(400, "This event is full");
  if (teams.some((t) => t.name.toLowerCase() === input.name.toLowerCase())) throw new HttpError(409, "That team name is taken");
  if (input.lead && (await prisma.teamMember.findUnique({ where: { email: input.lead } }))) {
    throw new HttpError(409, "This email already leads a team. Use \"Lost your code?\" to get a new code.");
  }

  let trackId: string;
  const ids = settings.tracks.map((t) => t.id);
  if ((settings.assignment === "choice" || input.byAdmin) && input.trackId && ids.includes(input.trackId)) {
    trackId = input.trackId;
  } else if (settings.assignment === "random") {
    trackId = ids[randomInt(ids.length)];
  } else {
    // balanced (also the provisional set in "admin" mode): least-used track, ties broken randomly
    const counts = ids.map((id) => ({ id, n: teams.filter((t) => t.trackId === id).length }));
    const min = Math.min(...counts.map((c) => c.n));
    const least = counts.filter((c) => c.n === min);
    trackId = least[randomInt(least.length)].id;
  }

  const code = accessCode();
  const members = input.lead ? [input.lead] : [];
  // "admin" assignment: a provisional set is stored, but the team can't play until an organizer assigns one.
  const awaiting = settings.assignment === "admin" && !(input.byAdmin && input.trackId && ids.includes(input.trackId));
  const state = { ...newTeamState(settings, trackId), ...(awaiting ? { awaitingTrack: true } : {}) };
  const m = computeMetrics(state, settings);
  const score = computeScore(state, settings, m);
  const team = await prisma.team.create({
    data: {
      name: input.name, members: JSON.stringify(members), accessCodeHash: hashCode(code),
      trackId, seed: randomBytes(12).toString("hex"), state: JSON.stringify(state),
      cash: state.cash, valuation: m.valuation, score: score.total, summary: summaryColumn(state, 0, game),
      ...(input.lead ? { memberRows: { create: { email: input.lead } } } : {}),
      events: { create: { turn: 0, type: "admin", title: `${input.name} founded ${getTrack(settings, trackId).company}`, detail: JSON.stringify({ trackId, lead: input.lead ?? null, byAdmin: !!input.byAdmin, startingCash: state.cash }) } },
      transactions: { create: { turn: 0, amount: state.cash, category: "funding", memo: "Bootstrapping: starting capital", balanceAfter: state.cash } },
      snapshots: { create: { turn: 0, metrics: JSON.stringify(m), score: score.total, breakdown: JSON.stringify(score) } },
    },
  });
  return { team, code };
}

/** Team names are matched case-insensitively; the code ignores case and dashes. */
// Names are matched case-insensitively in code (SQLite and Postgres differ), so only the small
// login columns are read for every team, never the game state.
const LOGIN_COLUMNS = { id: true, name: true, members: true, accessCodeHash: true } as const;
type LoginRow = { id: string; name: string; members: string; accessCodeHash: string };

export async function findTeamByCode(name: string, code: string): Promise<LoginRow | null> {
  const team = await findTeamByName(name);
  if (!team || team.accessCodeHash !== hashCode(code)) return null;
  return team;
}

export async function findTeamByName(name: string): Promise<LoginRow | null> {
  const wanted = name.trim().toLowerCase();
  const exact = await prisma.team.findUnique({ where: { name: name.trim() }, select: LOGIN_COLUMNS });
  if (exact) return exact;
  return (await prisma.team.findMany({ select: LOGIN_COLUMNS })).find((t) => t.name.toLowerCase() === wanted) ?? null;
}

/** The team lead's email (the first member), if the team has one. */
export const teamLead = (team: { members: string }) => parse<string[]>(team.members)[0] ?? null;

/** Issues a new access code; the old one stops working, but people already inside stay signed in. */
export async function reissueAccessCode(teamId: string) {
  const code = accessCode();
  const team = await prisma.team.update({ where: { id: teamId }, data: { accessCodeHash: hashCode(code) } });
  return { team, code };
}

export type TeamAction =
  | { type: "hire"; roleId: string }
  | { type: "fire"; employeeId: string }
  | { type: "task"; taskId: string; crew?: string[] }
  | { type: "pitch" }
  | { type: "accept"; offerId: string }
  | { type: "decline" }
  | { type: "sell"; pct: number };

export async function performAction(teamId: string, action: TeamAction): Promise<{ outcome?: TaskOutcome }> {
  const game = await getGame();
  if (game.status === "lobby") throw new HttpError(409, "The game hasn't started yet. Hang tight!");
  if (game.status === "paused") throw new HttpError(409, "The game is paused by the organizers");
  if (game.status === "ended") throw new HttpError(409, "The game has ended");
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new HttpError(404, "Team not found");
  const state = parse<TeamState>(team.state);
  const { settings } = game;
  if (state.awaitingTrack) throw new HttpError(409, "Your problem set hasn't been assigned yet. The organizers will assign it shortly.");
  const seed = `${team.seed}:${state.turn}:${state.nonce}:${action.type}`;

  let result: ActionResult;
  switch (action.type) {
    case "hire": result = hire(state, settings, action.roleId, seed); break;
    case "fire": result = fire(state, settings, action.employeeId); break;
    case "task": result = runTask(state, settings, action.taskId, seed, action.crew); break;
    case "pitch": result = pitch(state, settings, seed); break;
    case "accept": result = acceptOffer(state, settings, action.offerId); break;
    case "decline": result = declineOffers(state); break;
    case "sell": result = sellEquity(state, settings, action.pct); break;
  }
  await persist(team, state, result, game, action.type === "task" || action.type === "pitch" ? `Turn ${result.state.turn}: ${result.outcome?.title}` : undefined);
  return { outcome: result.outcome };
}

async function persist(team: Team, before: TeamState, result: ActionResult, game: GameInfo, scoreReason?: string) {
  // No leaderboard invalidation here: with 100 teams acting, that would rebuild the ranking on nearly
  // every poll. Ranks may lag a move by up to BOARD_TTL_MS, which nobody notices.
  const { settings } = game;
  const { state } = result;
  const m = computeMetrics(state, settings);
  const score = computeScore(state, settings, m, team.scoreAdjustment);
  const eventTurn = state.turn;
  let balance = before.cash;
  const txRows = result.txs.map((t) => {
    balance += t.amount;
    return { teamId: team.id, turn: eventTurn, amount: t.amount, category: t.category, memo: t.memo, balanceAfter: balance };
  });
  const prevScore = team.score;

  await prisma.$transaction(async (tx) => {
    // Optimistic lock: a concurrent request from another teammate will fail here instead of double-resolving.
    const updated = await tx.team.updateMany({
      where: { id: team.id, version: team.version },
      data: {
        state: JSON.stringify(state), version: { increment: 1 }, turn: state.turn, cash: state.cash,
        valuation: m.valuation, score: score.total, finished: state.finished,
        summary: summaryColumn(state, team.scoreAdjustment, game),
      },
    });
    if (updated.count !== 1) throw new HttpError(409, "A teammate just made a move. Refresh and try again.");
    const events = result.logs.map((l) => ({ teamId: team.id, turn: eventTurn, type: l.type, title: l.title, detail: JSON.stringify(l.detail) }));
    if (scoreReason && Math.abs(score.total - prevScore) >= 0.01) {
      events.push({ teamId: team.id, turn: eventTurn, type: "score", title: `Score ${prevScore.toFixed(1)} → ${score.total.toFixed(1)}`, detail: JSON.stringify({ from: prevScore, to: score.total, reason: scoreReason }) });
    }
    if (events.length) await tx.event.createMany({ data: events });
    if (txRows.length) await tx.transaction.createMany({ data: txRows });
    if (state.turn !== before.turn) {
      await tx.metricsSnapshot.create({ data: { teamId: team.id, turn: state.turn, metrics: JSON.stringify(m), score: score.total, breakdown: JSON.stringify(score) } });
    }
  }, { maxWait: 10_000, timeout: 15_000 }); // queue for a busy database instead of failing at the 2s/5s defaults
}

// ---------------------------------------------------------------- views

export interface TeamSummary {
  id: string;
  name: string;
  members: string[];
  trackId: string;
  awaitingTrack: boolean;
  company: string;
  sector: string;
  turn: number;
  turnsTotal: number;
  finished: boolean;
  metrics: Metrics;
  breakdown: ScoreBreakdown;
  score: number;
  rank: number;
  roundsRaised: string[];
  completedTasks: number;
  employees: number;
  updatedAt: Date;
}

type SummaryFields = Omit<TeamSummary, "id" | "name" | "members" | "rank" | "updatedAt">;

function summaryFields(state: TeamState, scoreAdjustment: number, settings: GameSettings): SummaryFields {
  const m = computeMetrics(state, settings);
  const breakdown = computeScore(state, settings, m, scoreAdjustment);
  const track = settings.tracks.find((t) => t.id === state.trackId);
  return {
    trackId: state.trackId, awaitingTrack: !!state.awaitingTrack,
    company: track?.company ?? "?", sector: track?.sector ?? "?", turn: state.turn, turnsTotal: state.turnsTotal,
    finished: state.finished, metrics: m, breakdown, score: breakdown.total,
    roundsRaised: state.rounds.map((r) => settings.rounds.find((x) => x.id === r.roundId)?.name ?? r.roundId),
    completedTasks: Object.values(state.completed).reduce((a, b) => a + b, 0), employees: state.employees.length,
  };
}

/** The `summary` column: leaderboard fields tagged with the settings stamp they were computed under. */
export function summaryColumn(state: TeamState, scoreAdjustment: number, game: Pick<GameInfo, "settings" | "stamp">): string {
  return JSON.stringify({ h: game.stamp, ...summaryFields(state, scoreAdjustment, game.settings) });
}

export function summarize(team: Team, settings: GameSettings): Omit<TeamSummary, "rank"> {
  return {
    id: team.id, name: team.name, members: parse<string[]>(team.members), updatedAt: team.updatedAt,
    ...summaryFields(parse<TeamState>(team.state), team.scoreAdjustment, settings),
  };
}

// Every dashboard poll needs a rank, so ranking is the hot path. It reads only the small precomputed
// `summary` column (rows written under older settings are recomputed once and saved back), and the
// ranked list is cached briefly per server instance (dropped on admin changes and new/removed teams).
const BOARD_TTL_MS = 2_000;
let boardCache: { at: number; teams: Promise<TeamSummary[]> } | null = null;

export function invalidateLeaderboard() {
  boardCache = null;
}

async function rankTeams(game: GameInfo): Promise<TeamSummary[]> {
  const teams = await prisma.team.findMany({ select: { id: true, name: true, members: true, summary: true, updatedAt: true } });
  const fields = new Map<string, SummaryFields>();
  const stale: string[] = [];
  for (const t of teams) {
    const s = t.summary ? parse<SummaryFields & { h?: string }>(t.summary) : null;
    if (s && s.h === game.stamp) fields.set(t.id, s);
    else stale.push(t.id);
  }
  if (stale.length) {
    const full = await prisma.team.findMany({ where: { id: { in: stale } }, select: { id: true, state: true, scoreAdjustment: true, version: true } });
    await Promise.all(full.map(async (t) => {
      const summary = summaryColumn(parse<TeamState>(t.state), t.scoreAdjustment, game);
      fields.set(t.id, parse<SummaryFields>(summary));
      // Save it back without bumping the version; skipped if the team changed meanwhile.
      await prisma.team.updateMany({ where: { id: t.id, version: t.version }, data: { summary } }).catch(() => {});
    }));
  }
  const rows = teams.filter((t) => fields.has(t.id)).map((t) => {
    const { h: _h, ...f } = fields.get(t.id) as SummaryFields & { h?: string };
    return { id: t.id, name: t.name, members: parse<string[]>(t.members), updatedAt: t.updatedAt, ...f };
  });
  rows.sort((a, b) => compareRank(
    { score: a.score, breakdown: a.breakdown, runway: a.metrics.runway },
    { score: b.score, breakdown: b.breakdown, runway: b.metrics.runway },
  ));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function leaderboard(): Promise<{ game: GameInfo; teams: TeamSummary[] }> {
  const game = await getGame();
  if (!boardCache || Date.now() - boardCache.at > BOARD_TTL_MS) {
    const teams = rankTeams(game);
    boardCache = { at: Date.now(), teams };
    teams.catch(() => { boardCache = null; });
  }
  return { game, teams: await boardCache.teams };
}

export type RewardKind = "cash" | "customers" | "product" | "reputation" | "arpuPct" | "marginPts" | "risk" | "churnPts" | "milestones";

/** What a participant may see: their own company only, with task outcomes hidden until resolved. */
export async function teamView(teamId: string) {
  const game = await getGame();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new HttpError(404, "Team not found");
  const { settings } = game;
  const state = parse<TeamState>(team.state);
  const track = getTrack(settings, state.trackId);
  const m = computeMetrics(state, settings);
  const breakdown = computeScore(state, settings, m, team.scoreAdjustment);
  // Outcome numbers stay hidden; only the *kinds* of reward a success brings are shown.
  const board = taskBoard(state, settings).map(({ task, ...rest }) => {
    const { outcomes, ...visible } = task;
    const win = outcomes.success;
    const rewards: RewardKind[] = [
      ...(["cash", "customers", "product", "reputation", "arpuPct", "marginPts"] as const).filter((k) => (win[k] ?? 0) > 0),
      ...(["risk", "churnPts"] as const).filter((k) => (win[k] ?? 0) < 0),
      ...(win.milestones?.length ? (["milestones"] as const) : []),
    ];
    return { ...rest, task: visible, rewards };
  });
  const [events, { teams }] = await Promise.all([
    prisma.event.findMany({ where: { teamId, type: { not: "payroll" } }, orderBy: { id: "desc" }, take: 40 }),
    leaderboard(),
  ]);
  const rank = teams.find((t) => t.id === teamId)?.rank ?? null;
  return {
    etag: viewTag(team.version, game),
    game: { status: game.status, eventName: settings.eventName, turns: settings.turns, weights: settings.weights, teamCount: teams.length, trackCount: settings.tracks.length },
    team: { id: team.id, name: team.name, members: parse<string[]>(team.members), rank },
    track: { id: track.id, code: track.code, sector: track.sector, problem: track.problem, company: track.company, tagline: track.tagline, customerLabel: track.customerLabel },
    state: { ...state, history: state.history },
    metrics: m,
    breakdown,
    board,
    roles: settings.roles,
    funding: nextRound(state, settings),
    equity: (({ rules, valuation, soldThisTurn, maxPct }) => ({ rules, valuation, soldThisTurn, maxPct }))(equityQuote(state, settings, 0)),
    rounds: settings.rounds.map((r) => ({ id: r.id, name: r.name })),
    events: events.map((e) => ({ id: e.id, turn: e.turn, type: e.type, title: e.title, createdAt: e.createdAt, detail: e.type === "task" || e.type === "event" ? parse(e.detail) : undefined })),
  };
}

export type TeamView = Awaited<ReturnType<typeof teamView>>;

/** Identifies one version of a team's dashboard: its own state, the settings, and the game status. */
const viewTag = (version: number, game: GameInfo) => `${version}.${game.stamp}.${game.status}`;

/**
 * Dashboard poll. When the client already has the current version (`since`), only the rank and team
 * count are returned: one tiny indexed read instead of the full state, event feed and payload.
 */
export async function teamViewSince(teamId: string, since: string | null) {
  if (since) {
    const [game, row, { teams }] = await Promise.all([
      getGame(),
      prisma.team.findUnique({ where: { id: teamId }, select: { version: true } }),
      leaderboard(),
    ]);
    if (!row) throw new HttpError(404, "Team not found");
    if (viewTag(row.version, game) === since) {
      return { same: true as const, rank: teams.find((t) => t.id === teamId)?.rank ?? null, teamCount: teams.length };
    }
  }
  return teamView(teamId);
}
