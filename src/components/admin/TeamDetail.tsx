"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { adminTeamDetail } from "@/lib/admin";
import type { ScoreWeights } from "@/game/types";
import { Bar, LineChart } from "../charts";
import { money, num, pct, ratio, runway } from "../format";
import { api, Badge, Button, ErrorNote, inputClass, Panel, Spinner } from "../ui";
import { TeamAccess } from "./TeamAccess";

type Detail = Awaited<ReturnType<typeof adminTeamDetail>>;
type Tab = "timeline" | "transactions" | "company";

export function TeamDetail({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timeline");
  const [adj, setAdj] = useState<{ kind: "score" | "cash" | "track" | "delete"; delta: string; trackId: string; reason: string; confirm: string }>({ kind: "score", delta: "", trackId: "", reason: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => api<Detail>(`/api/admin/teams/${id}`).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      const body = adj.kind === "track" ? { kind: "track", trackId: adj.trackId, reason: adj.reason }
        : adj.kind === "delete" ? { kind: "delete", reason: adj.reason, confirm: adj.confirm }
        : { kind: adj.kind, delta: Number(adj.delta), reason: adj.reason };
      await api(`/api/admin/teams/${id}`, body);
      if (adj.kind === "delete") { router.replace("/admin"); return; }
      setMsg("Saved and logged to the audit trail.");
      setAdj({ ...adj, delta: "", reason: "", confirm: "" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!d) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;
  const s = d.summary;
  const m = s.metrics;
  const labels = d.snapshots.map((x) => x.turn);
  const metricSeries = (k: string) => d.snapshots.map((x) => (x.metrics as Record<string, number>)[k] ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-amber">#{s.rank} · {s.sector}</p>
          <h1 className="font-serif text-4xl text-cream">{s.name}</h1>
          <p className="text-sm text-muted">{s.company} · {s.members.join(", ")} · turn {s.turn}/{s.turnsTotal} {s.finished && <Badge tone="good">finished</Badge>}</p>
          <p className="mt-1 font-mono text-xs text-faint">RNG seed {d.seed}</p>
        </div>
        <div className="no-print flex gap-2">
          <a href={`/api/admin/export?type=team&id=${id}`} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-cream hover:bg-white/5">⬇ CSV</a>
          <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[["Score", s.score.toFixed(1)], ["Valuation", money(m.valuation)], ["Cash", money(m.cash)], ["Revenue/turn", money(m.revenue)],
          ["Customers", num(m.customers)], ["LTV:CAC", ratio(m.ltvCac)], ["Runway", runway(m.runway)], ["Founders", pct(m.ownership)]].map(([k, v]) => (
          <div key={k} className="glass p-3"><p className="text-[11px] uppercase tracking-wider text-faint">{k}</p><p className="num mt-1 truncate font-serif text-xl text-cream">{v}</p></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Metrics history">
          <LineChart labels={labels} series={[
            { label: "Score", color: "#f6c56b", values: d.snapshots.map((x) => x.score), format: (v) => v.toFixed(1) },
          ]} height={120} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <LineChart labels={labels} series={[{ label: "Cash", color: "#f2a65a", values: metricSeries("cash"), format: (v) => money(v) }, { label: "Revenue", color: "#7ee08a", values: metricSeries("revenue"), format: (v) => money(v) }]} height={130} />
            <LineChart labels={labels} series={[{ label: "Valuation", color: "#e2553b", values: metricSeries("valuation"), format: (v) => money(v) }]} height={130} />
          </div>
        </Panel>
        <Panel title="Score breakdown">
          <ul className="space-y-3">
            {(Object.keys(d.scoreLabels) as (keyof ScoreWeights)[]).map((k) => (
              <li key={k}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{d.scoreLabels[k]}</span><span className="num text-cream">{s.breakdown.components[k].toFixed(0)} → {s.breakdown.weighted[k].toFixed(1)}</span></div>
                <Bar value={s.breakdown.components[k]} max={100} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Manual adjustment: <b className="text-cream">{d.scoreAdjustment >= 0 ? "+" : ""}{d.scoreAdjustment}</b></p>
        </Panel>
      </div>

      <TeamAccess id={id} team={s.name} lead={s.members[0] ?? null} />

      <Panel title="Manual intervention" className="no-print">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[180px_1fr_2fr_auto] md:items-end">
          <label className="block text-sm"><span className="mb-1 block text-muted">Action</span>
            <select className={inputClass} value={adj.kind} onChange={(e) => setAdj({ ...adj, kind: e.target.value as typeof adj.kind })}>
              <option value="score">Adjust score (pts)</option>
              <option value="cash">Adjust cash ($)</option>
              <option value="track" disabled={s.turn > 0}>Reassign track</option>
              <option value="delete">Delete team</option>
            </select>
          </label>
          {adj.kind === "track" ? (
            <label className="block text-sm"><span className="mb-1 block text-muted">Track</span>
              <select className={inputClass} value={adj.trackId} onChange={(e) => setAdj({ ...adj, trackId: e.target.value })} required>
                <option value="">Choose…</option>
                {d.tracks.map((t) => <option key={t.id} value={t.id}>{t.sector} · {t.company}</option>)}
              </select>
            </label>
          ) : adj.kind === "delete" ? (
            <label className="block text-sm"><span className="mb-1 block text-muted">Type DELETE</span><input className={inputClass} value={adj.confirm} onChange={(e) => setAdj({ ...adj, confirm: e.target.value })} required /></label>
          ) : (
            <label className="block text-sm"><span className="mb-1 block text-muted">Delta (±)</span><input type="number" step="any" className={inputClass} value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} required /></label>
          )}
          <label className="block text-sm"><span className="mb-1 block text-muted">Reason (logged)</span><input className={inputClass} value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required minLength={3} /></label>
          <Button type="submit" variant={adj.kind === "delete" ? "danger" : "primary"} disabled={busy}>Apply</Button>
        </form>
        {msg && <p className="mt-2 text-sm text-good">{msg}</p>}
        {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      </Panel>

      <div className="no-print flex gap-1 rounded-xl border border-line bg-black/20 p-1">
        {(["timeline", "transactions", "company"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize ${tab === t ? "bg-cream text-ink" : "text-muted hover:text-cream"}`}>{t}</button>
        ))}
      </div>

      {tab === "timeline" && (
        <Panel title={`Event timeline (${d.events.length})`}>
          <ol className="space-y-2">
            {d.events.map((e) => (
              <li key={e.id} className="rounded-lg border border-line/60 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-cream"><Badge className="mr-2">{e.type}</Badge>{e.title}</span>
                  <span className="text-xs text-faint">Turn {e.turn} · {new Date(e.createdAt).toLocaleString()}</span>
                </div>
                {(e.type === "task" || e.type === "pitch" || e.type === "event" || e.type === "score" || e.type === "admin" || e.type === "funding" || e.type === "obligation") && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted">Calculation & details</summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-black/40 p-3 text-[11px] leading-relaxed text-muted">{JSON.stringify(e.detail, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {tab === "transactions" && (
        <Panel title={`Transactions (${d.transactions.length})`}>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-faint"><tr className="border-b border-line"><th className="px-5 py-2">Turn</th><th>Category</th><th>Memo</th><th className="text-right">Amount</th><th className="px-5 text-right">Balance</th></tr></thead>
              <tbody>
                {d.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-line/40">
                    <td className="px-5 py-1.5 text-muted">{t.turn}</td><td className="text-muted">{t.category}</td><td className="text-cream">{t.memo}</td>
                    <td className={`num text-right ${t.amount >= 0 ? "text-good" : "text-bad"}`}>{money(t.amount, { compact: false })}</td>
                    <td className="num px-5 text-right text-muted">{money(t.balanceAfter, { compact: false })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "company" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Hiring & payroll">
            <ul className="space-y-1 text-sm">
              {d.state.employees.map((e) => {
                const role = d.roles.find((r) => r.id === e.roleId);
                return <li key={e.id} className="flex justify-between"><span className="text-cream">{e.name} <span className="text-faint">· {role?.title}</span></span><span className="num text-muted">{money(role?.salary ?? 0)}/turn · hired T{e.hiredTurn}</span></li>;
              })}
              {d.state.employees.length === 0 && <li className="text-faint">No employees.</li>}
            </ul>
            <p className="mt-3 text-sm text-muted">Payroll {money(m.payroll)}/turn · paid to date {money(d.state.payrollTotal)}</p>
          </Panel>
          <Panel title="Funding">
            <ul className="space-y-2 text-sm">
              {d.state.rounds.map((r) => (
                <li key={r.roundId} className="rounded-lg border border-line/60 p-2">
                  <span className="text-cream">{r.roundId}</span> · {r.investor} · {money(r.amount)} at {money(r.preMoney)} pre · sold {pct(r.ownershipSold, 1)} · T{r.turn}
                  <span className="block text-xs text-faint">{r.terms}</span>
                </li>
              ))}
              {d.state.rounds.length === 0 && <li className="text-faint">Bootstrapped so far.</li>}
            </ul>
            {d.state.obligations.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted">{d.state.obligations.map((o, i) => <li key={i}>{o.investor}: {o.customers} customers by T{o.dueTurn}: <b>{o.status}</b></li>)}</ul>}
          </Panel>
          <Panel title="Company state" className="md:col-span-2">
            <p className="text-sm text-muted">Milestones: {d.state.milestones.join(", ") || "none"}</p>
            <p className="mt-1 text-sm text-muted">Product {d.state.product} · Reputation {Math.round(d.state.reputation)} · Risk {Math.round(d.state.risk)} · Margin {pct(m.grossMargin)} · Churn {pct(m.churnRate, 1)}</p>
            <p className="mt-1 text-sm text-muted">Outcomes: {d.state.stats.profitable} profitable · {d.state.stats.strategic} strategic · {d.state.stats.partial} partial · {d.state.stats.failure} failed · {d.state.stats.events} events · {d.state.stats.pitches} pitches</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
