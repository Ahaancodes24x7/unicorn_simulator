// Load test: N teams × 4 devices polling their dashboard, each team acting every ~10s, plus
// leaderboard screens. Test teams are named "LT-…" and deleted at the end.
// Usage: npm run loadtest -- [baseUrl] [teams] [seconds]   (the game must be running for actions)
import "dotenv/config";
import { createTeam, getGame } from "../src/lib/game";
import { prisma } from "../src/lib/db";

const BASE = process.argv[2] ?? "http://localhost:3000";
const TEAMS = Number(process.argv[3] ?? 100);
const SECONDS = Number(process.argv[4] ?? 60);
const DEVICES = 4;
const BOARDS = 20;

type Stat = { ms: number[]; codes: Record<number, number> };
const stats: Record<string, Stat> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(label: string, path: string, cookie?: string, body?: unknown) {
  const s = (stats[label] ??= { ms: [], codes: {} });
  const t = performance.now();
  try {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json", origin: BASE }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    Object.assign(res, { bodyText: text });
    s.codes[res.status] = (s.codes[res.status] ?? 0) + 1;
    return res;
  } catch {
    s.codes[0] = (s.codes[0] ?? 0) + 1;
    return null;
  } finally {
    s.ms.push(performance.now() - t);
  }
}

const pctl = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0; };

async function main() {
  const game = await getGame();
  console.log(`Game status: ${game.status}${game.status !== "running" ? " (actions will be refused; polling is still measured)" : ""}`);
  const tracks = game.settings.tracks.map((t) => t.id);
  const run = Date.now().toString(36).slice(-4);

  console.log(`Creating ${TEAMS} test teams…`);
  const teams: { name: string; code: string; cookie?: string }[] = [];
  for (let i = 0; i < TEAMS; i++) {
    const name = `LT-${run}-${i}`;
    const { code } = await createTeam({ name, trackId: tracks[i % tracks.length], byAdmin: true });
    teams.push({ name, code });
  }

  console.log("Teams entering with name + code…");
  await Promise.all(teams.map(async (t) => {
    const res = await call("enter", "/api/team/rejoin", undefined, { name: t.name, code: t.code });
    t.cookie = res?.headers.get("set-cookie")?.split(";")[0];
  }));

  const until = Date.now() + SECONDS * 1000;
  const loops: Promise<void>[] = [];
  for (const t of teams) {
    for (let d = 0; d < DEVICES; d++) {
      loops.push((async () => {
        await sleep(Math.random() * 6000);
        // Like the real dashboard: send the version we have; full payload only when it changed.
        let etag = "";
        while (Date.now() < until) {
          const res = await call(etag ? "dashboard poll" : "dashboard load", `/api/team/state${etag ? `?since=${encodeURIComponent(etag)}` : ""}`, t.cookie);
          const body = res && res.ok ? (() => { try { return JSON.parse((res as Response & { bodyText: string }).bodyText); } catch { return null; } })() : null;
          if (body?.etag) etag = body.etag;
          await sleep(6000);
        }
      })());
    }
    loops.push((async () => {
      await sleep(Math.random() * 10_000);
      let i = 0;
      while (Date.now() < until) {
        await call("action", "/api/team/action", t.cookie, i++ === 0 ? { type: "hire", roleId: game.settings.roles[0].id } : { type: "task", taskId: "consulting" });
        await sleep(8000 + Math.random() * 4000);
      }
    })());
  }
  for (let b = 0; b < BOARDS; b++) {
    loops.push((async () => { while (Date.now() < until) { await call("leaderboard", "/api/leaderboard"); await sleep(5000); } })());
  }
  console.log(`Running ${TEAMS * DEVICES} dashboards + ${TEAMS} acting teams + ${BOARDS} leaderboards for ${SECONDS}s…`);
  await Promise.all(loops);

  console.log("\nendpoint          requests   p50     p95     p99     max    status codes");
  for (const [k, s] of Object.entries(stats)) {
    console.log(`${k.padEnd(17)} ${String(s.ms.length).padStart(7)}  ${pctl(s.ms, 50).toFixed(0).padStart(5)}ms ${pctl(s.ms, 95).toFixed(0).padStart(5)}ms ${pctl(s.ms, 99).toFixed(0).padStart(5)}ms ${Math.max(...s.ms).toFixed(0).padStart(5)}ms  ${JSON.stringify(s.codes)}`);
  }

  const removed = await prisma.team.deleteMany({ where: { name: { startsWith: `LT-${run}-` } } });
  console.log(`\nCleaned up ${removed.count} test teams.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
