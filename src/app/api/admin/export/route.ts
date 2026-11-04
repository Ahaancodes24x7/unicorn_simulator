import { adminTeamDetail } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { audit, leaderboard } from "@/lib/game";
import { handler, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

function csv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`; // spreadsheet formula-injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const GET = handler(async (req) => {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "leaderboard";
  let body: string;
  let filename: string;

  if (type === "leaderboard") {
    const { teams } = await leaderboard();
    body = csv([
      ["Rank", "Team", "Members", "Track", "Company", "Score", "Valuation", "Net worth (cash)", "Revenue/turn", "Customers", "CAC", "LTV",
        "LTV:CAC", "Runway (turns)", "Turn", "Tasks completed", "Funding raised", "Rounds", "Founder ownership %", "Reputation",
        "Valuation pts", "Profitability pts", "Traction pts", "Execution pts", "Efficiency pts", "Fundraising pts", "Resilience pts", "Adjustment"],
      ...teams.map((t) => [
        t.rank, t.name, t.members.join("; "), t.sector, t.company, t.score, Math.round(t.metrics.valuation), Math.round(t.metrics.netWorth),
        Math.round(t.metrics.revenue), t.metrics.customers, r2(t.metrics.cac), r2(t.metrics.ltv), r2(t.metrics.ltvCac),
        t.metrics.runway >= 99 ? "profitable" : r2(t.metrics.runway), `${t.turn}/${t.turnsTotal}`, t.completedTasks,
        Math.round(t.metrics.fundingRaised), t.roundsRaised.join("; "), r2(t.metrics.ownership * 100), Math.round(t.metrics.reputation),
        ...Object.values(t.breakdown.weighted).map(r2), t.breakdown.adjustment,
      ]),
    ]);
    filename = "leaderboard.csv";
  } else if (type === "team") {
    const id = url.searchParams.get("id");
    if (!id) throw new HttpError(400, "Missing team id");
    const d = await adminTeamDetail(id);
    body = csv([
      ["Team", d.summary.name], ["Company", d.summary.company], ["Track", d.summary.sector], ["Rank", d.summary.rank], ["Score", d.summary.score],
      [],
      ["Timeline"], ["Time", "Turn", "Type", "Title"],
      ...d.events.map((e) => [e.createdAt.toISOString(), e.turn, e.type, e.title]),
      [],
      ["Transactions"], ["Time", "Turn", "Category", "Memo", "Amount", "Balance after"],
      ...d.transactions.map((t) => [t.createdAt.toISOString(), t.turn, t.category, t.memo, r2(t.amount), r2(t.balanceAfter)]),
      [],
      ["Metrics history"], ["Turn", "Score", "Cash", "Revenue/turn", "Customers", "Valuation", "CAC", "LTV"],
      ...d.snapshots.map((s) => {
        const m = s.metrics as Record<string, number>;
        return [s.turn, s.score, r2(m.cash), r2(m.revenue), m.customers, Math.round(m.valuation), r2(m.cac), r2(m.ltv)];
      }),
    ]);
    filename = `team-${d.summary.name.replace(/[^a-z0-9]+/gi, "-")}.csv`;
  } else {
    throw new HttpError(400, "Unknown export type");
  }
  await audit(admin.email, "export", { target: type, detail: { id: url.searchParams.get("id") } });
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
});
