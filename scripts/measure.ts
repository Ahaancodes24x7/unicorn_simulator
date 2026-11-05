// Bytes per dashboard poll (full vs "unchanged") and per leaderboard read (full state vs summary column).
// Usage: npx tsx scripts/measure.ts [baseUrl]
import "dotenv/config";
import { createTeam } from "../src/lib/game";
import { prisma } from "../src/lib/db";

const BASE = process.argv[2] ?? "http://localhost:3000";

async function main() {
  const name = `MS-${Date.now().toString(36)}`;
  const { code } = await createTeam({ name, byAdmin: true, trackId: undefined });
  const res = await fetch(`${BASE}/api/team/rejoin`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ name, code }) });
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  for (let i = 0; i < 6; i++) {
    await fetch(`${BASE}/api/team/action`, { method: "POST", headers: { cookie, "content-type": "application/json", origin: BASE }, body: JSON.stringify({ type: "task", taskId: "consulting" }) });
  }
  const full = await (await fetch(`${BASE}/api/team/state`, { headers: { cookie } })).text();
  const etag = JSON.parse(full).etag;
  const same = await (await fetch(`${BASE}/api/team/state?since=${encodeURIComponent(etag)}`, { headers: { cookie } })).text();
  const row = await prisma.team.findUnique({ where: { name }, select: { state: true, summary: true } });
  console.log(`dashboard poll: full ${full.length} B, unchanged ${same.length} B -> ${same}`);
  console.log(`leaderboard row: state ${row!.state.length} B, summary ${row!.summary.length} B (after 6 turns; state grows every turn)`);
  await prisma.team.delete({ where: { name } });
  await prisma.$disconnect();
}
main();
