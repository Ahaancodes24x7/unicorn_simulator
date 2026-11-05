"use client";

import { Logo } from "@/components/Logo";
import { money, num } from "@/components/format";
import { Badge, Spinner } from "@/components/ui";
import { useLiveBoard } from "@/components/useLiveBoard";

import { Icon } from "@/components/Icon";
export default function LeaderboardPage() {
  const board = useLiveBoard();
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        {board && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 rounded-full bg-crt" style={{ animation: "twinkle 1.6s infinite" }} /> Live · <Badge tone={board.status === "running" ? "good" : "warn"}>{board.status}</Badge>
          </span>
        )}
      </header>
      <h1 className="mt-8 font-serif text-4xl text-cream sm:text-6xl">Leaderboard</h1>
      <p className="mt-1 text-muted">{board?.eventName ?? "Silicon Valley: Unicorn Simulator"} · all figures simulated</p>

      {!board ? <Spinner label="Connecting to live standings…" /> : board.teams.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-line p-10 text-center text-faint">No teams have joined yet.</p>
      ) : (
        <>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {board.teams.slice(0, 3).map((t) => (
              <li key={t.name} className={`glass relative overflow-hidden p-5 ${t.rank === 1 ? "md:-translate-y-2 border-gold/50" : ""}`}>
                <span className="absolute -right-2 -top-5 font-serif text-[110px] leading-none text-white/[0.05]">{t.rank}</span>
                <p className="text-sm text-amber">{t.rank === 1 ? <><Icon name="crown" className="mr-1" />Leading</> : `#${t.rank}`}</p>
                <p className="mt-1 truncate font-serif text-2xl text-cream">{t.name}</p>
                <p className="truncate text-xs text-faint">{t.company} · {t.sector}</p>
                <p className="num mt-4 font-serif text-4xl text-cream">{t.score.toFixed(1)}</p>
                <p className="num text-sm text-muted">{money(t.valuation)} valuation</p>
              </li>
            ))}
          </ol>
          <div className="glass mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  <th className="px-4 py-3">#</th><th>Team</th><th>Track</th><th className="text-right">Valuation</th>
                  <th className="text-right">Revenue/turn</th><th className="text-right">Customers</th><th className="text-right">Turn</th><th className="px-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {board.teams.map((t) => (
                  <tr key={t.name} className="border-b border-line/50 transition last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-serif text-lg text-muted">{t.rank}</td>
                    <td><span className="font-medium text-cream">{t.name}</span><span className="block text-xs text-faint">{t.company}{t.rounds.length ? ` · ${t.rounds[t.rounds.length - 1]}` : ""}</span></td>
                    <td className="text-muted">{t.sector}</td>
                    <td className="num text-right text-cream">{money(t.valuation)}</td>
                    <td className="num text-right text-muted">{money(t.revenue)}</td>
                    <td className="num text-right text-muted">{num(t.customers)}</td>
                    <td className="num text-right text-muted">{t.finished ? <Icon name="check" /> : `${t.turn}/${t.turnsTotal}`}</td>
                    <td className="num px-4 text-right font-serif text-xl text-cream">{t.score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
