import { getGame, leaderboard } from "./game";

/** Leaderboard fields that are safe to show on a public screen. */
export async function publicLeaderboard() {
  const { game, teams } = await leaderboard();
  return {
    status: game.status,
    eventName: game.settings.eventName,
    tracks: game.settings.tracks.map((t) => ({ id: t.id, code: t.code, sector: t.sector, problem: t.problem, company: t.company })),
    assignment: game.settings.assignment,
    teams: teams.map((t) => ({
      rank: t.rank, name: t.name, company: t.company, sector: t.sector, score: t.score, valuation: t.metrics.valuation,
      customers: t.metrics.customers, revenue: t.metrics.revenue, turn: t.turn, turnsTotal: t.turnsTotal, finished: t.finished,
      rounds: t.roundsRaised,
    })),
  };
}

export async function lobbyInfo() {
  const game = await getGame();
  return {
    status: game.status,
    assignment: game.settings.assignment,
    maxTeamSize: game.settings.maxTeamSize,
    startingCash: game.settings.startingCash,
    tracks: game.settings.tracks.map((t) => ({ id: t.id, code: t.code, sector: t.sector, problem: t.problem })),
  };
}

export type PublicBoard = Awaited<ReturnType<typeof publicLeaderboard>>;
