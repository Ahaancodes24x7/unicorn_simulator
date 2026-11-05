"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { adminOverview } from "@/lib/admin";
import { money, num, pct, ratio, runway } from "../format";
import { api, Badge, Button, ErrorNote, inputClass, Modal, Panel, Spinner } from "../ui";
import { AddTeam } from "./TeamAccess";

import { Icon } from "@/components/Icon";
type Data = Awaited<ReturnType<typeof adminOverview>>;

export function Overview() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "start" | "pause" | "resume" | "end" | "reopen" | "reset">(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [keepSettings, setKeepSettings] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Data>("/api/admin/overview").then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function run() {
    if (!pending) return;
    setBusy(true);
    try {
      await api("/api/admin/game", pending === "reset" ? { action: "reset", reason, confirm: confirmText, keepSettings } : { action: pending, reason: reason || undefined });
      setPending(null); setReason(""); setConfirmText("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;
  const t = data.teams;
  const active = t.filter((x) => !x.finished).length;
  const avgTurn = t.length ? t.reduce((s, x) => s + x.turn, 0) / t.length : 0;
  const alerts = t.reduce((s, x) => s + x.alerts.length, 0);

  return (
    <div className="space-y-6">
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-cream">{data.eventName}</h1>
          <p className="mt-1 text-sm text-muted">
            Status <Badge tone={data.status === "running" ? "good" : data.status === "ended" ? "neutral" : "warn"}>{data.status}</Badge>
            {data.startedAt && <> · started {new Date(data.startedAt).toLocaleString()}</>}
            {data.endedAt && <> · ended {new Date(data.endedAt).toLocaleString()}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status === "lobby" && <Button onClick={() => setPending("start")}><Icon name="play" inherit className="mr-1.5" />Start game</Button>}
          {data.status === "running" && <Button variant="subtle" onClick={() => setPending("pause")}><Icon name="pause" inherit className="mr-1.5" />Pause</Button>}
          {data.status === "paused" && <Button onClick={() => setPending("resume")}><Icon name="play" inherit className="mr-1.5" />Resume</Button>}
          {(data.status === "running" || data.status === "paused") && <Button variant="danger" onClick={() => setPending("end")}><Icon name="stop" inherit className="mr-1.5" />End game</Button>}
          {data.status === "ended" && <Button variant="subtle" onClick={() => setPending("reopen")}>Reopen</Button>}
          <a href="/api/admin/export?type=leaderboard" className="inline-flex items-center rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-cream hover:bg-white/5"><Icon name="download" className="mr-1.5" />CSV</a>
          <AddTeam tracks={data.tracks} onAdded={load} />
          <Button variant="ghost" onClick={() => setPending("reset")}>Reset…</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Teams", t.length], ["Still playing", active], ["Average turn", `${avgTurn.toFixed(1)} / ${data.turns}`], ["Alerts", alerts]].map(([k, v]) => (
          <div key={k as string} className="glass p-4"><p className="text-xs uppercase tracking-wider text-faint">{k}</p><p className="num mt-1 font-serif text-3xl text-cream">{v}</p></div>
        ))}
      </div>

      <ProblemSets data={data} onChanged={load} onError={setError} />

      <Panel title="Leaderboard & live overview">
        {t.length === 0 ? <p className="text-sm text-faint">No teams yet. Share the site URL; teams join from the landing page.</p> : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  {["#", "Team", "Problem set", "Score", "Valuation", "Cash", "Rev/turn", "Customers", "CAC", "LTV", "LTV:CAC", "Runway", "Turn", "Tasks", "Raised", "Founders", "Alerts"].map((h) => <th key={h} className="px-3 py-2 font-semibold first:pl-5">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {t.map((x) => (
                  <tr key={x.id} className="border-b border-line/50 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5 pl-5 font-serif text-lg text-muted">{x.rank}</td>
                    <td className="px-3"><Link href={`/admin/teams/${x.id}`} className="font-medium text-cream hover:text-amber">{x.name}</Link><span className="block text-xs text-faint">{x.members.length} members · {x.employees} staff</span></td>
                    <td className="px-3"><SetPicker team={x} tracks={data.tracks} onChanged={load} onError={setError} /></td>
                    <td className="num px-3 font-semibold text-cream">{x.score.toFixed(1)}</td>
                    <td className="num px-3 text-amber">{money(x.metrics.valuation)}</td>
                    <td className="num px-3">{money(x.metrics.cash)}</td>
                    <td className="num px-3">{money(x.metrics.revenue)}</td>
                    <td className="num px-3">{num(x.metrics.customers)}</td>
                    <td className="num px-3">{x.metrics.cac ? money(x.metrics.cac, { cents: true }) : "–"}</td>
                    <td className="num px-3">{money(x.metrics.ltv, { cents: true })}</td>
                    <td className="num px-3">{ratio(x.metrics.ltvCac)}</td>
                    <td className="num px-3">{runway(x.metrics.runway)}</td>
                    <td className="num px-3">{x.finished ? <Badge tone="good">done</Badge> : `${x.turn}/${x.turnsTotal}`}</td>
                    <td className="num px-3">{x.completedTasks}</td>
                    <td className="num px-3">{money(x.metrics.fundingRaised)}<span className="block text-xs text-faint">{x.roundsRaised.join(", ")}</span></td>
                    <td className="num px-3">{pct(x.metrics.ownership)}</td>
                    <td className="px-3">{x.alerts.map((a) => <Badge key={a} tone="bad" className="mb-1 mr-1">{a}</Badge>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={!!pending} onClose={() => setPending(null)} title={pending === "reset" ? "Reset the game?" : `${pending?.[0].toUpperCase()}${pending?.slice(1)} game?`}>
        <div className="space-y-4">
          {pending === "reset" ? (
            <>
              <p className="text-sm text-bad">This permanently deletes all {t.length} teams, their timelines and transactions. The audit log is kept.</p>
              <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={keepSettings} onChange={(e) => setKeepSettings(e.target.checked)} /> Keep current configuration</label>
              <input className={inputClass} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <input className={inputClass} placeholder='Type "RESET" to confirm' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                {pending === "start" && "Teams can start taking turns immediately."}
                {pending === "pause" && "All team actions are blocked until you resume. State is preserved."}
                {pending === "resume" && "Teams can act again."}
                {pending === "end" && "Locks all companies. Final scores are what's shown now."}
                {pending === "reopen" && "Re-opens the game so unfinished teams can continue."}
              </p>
              <input className={inputClass} placeholder="Reason (optional, recorded in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant={pending === "reset" || pending === "end" ? "danger" : "primary"} disabled={busy || (pending === "reset" && (confirmText !== "RESET" || reason.trim().length < 3))} onClick={run}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type TeamRow = Data["teams"][number];

async function assign(picks: { id: string; trackId: string }[], autoRest = false) {
  return api<{ assigned: number }>("/api/admin/assign", { picks, autoRest });
}

/** Per-team set dropdown: changeable until the team plays its first month. */
function SetPicker({ team, tracks, onChanged, onError }: { team: TeamRow; tracks: Data["tracks"]; onChanged: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (team.turn > 0) return <span className="text-muted">{team.sector}</span>;
  return (
    <span className="flex items-center gap-2">
      <select disabled={busy} value={team.awaitingTrack ? "" : team.trackId} aria-label={`Problem set for ${team.name}`}
        onChange={async (e) => { setBusy(true); try { await assign([{ id: team.id, trackId: e.target.value }]); onChanged(); } catch (err) { onError((err as Error).message); } finally { setBusy(false); } }}
        className={`rounded-lg border bg-black/30 px-2 py-1 text-sm ${team.awaitingTrack ? "border-warn/60 text-warn" : "border-line text-cream"}`}>
        {team.awaitingTrack && <option value="">Choose a set…</option>}
        {tracks.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.sector}</option>)}
      </select>
    </span>
  );
}

/** Set overview: teams per set, who is still waiting, and one-click balanced assignment. */
function ProblemSets({ data, onChanged, onError }: { data: Data; onChanged: () => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const waiting = data.teams.filter((t) => t.awaitingTrack).length;
  const count = (id: string) => data.teams.filter((t) => !t.awaitingTrack && t.trackId === id).length;
  async function autoAssign() {
    setBusy(true);
    try { await assign([], true); onChanged(); } catch (err) { onError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <Panel title="Problem sets" action={
      <Button disabled={busy || waiting === 0} onClick={autoAssign}>{busy ? "Assigning…" : `Auto-assign ${waiting} waiting team${waiting === 1 ? "" : "s"} (balanced)`}</Button>
    }>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {data.tracks.map((t) => (
          <div key={t.id} className="rounded-xl border border-line bg-black/20 p-3">
            <p className="text-xs font-semibold tracking-widest text-amber">SET {t.code}</p>
            <p className="font-medium text-cream">{t.sector}</p>
            <p className="text-xs text-faint">{t.company}</p>
            <p className="num mt-1 font-serif text-2xl text-cream">{count(t.id)} <span className="text-sm text-muted">teams</span></p>
          </div>
        ))}
        <div className={`rounded-xl border p-3 ${waiting ? "border-warn/50 bg-warn/10" : "border-line bg-black/20"}`}>
          <p className="text-xs font-semibold tracking-widest text-warn">WAITING</p>
          <p className="font-medium text-cream">No set yet</p>
          <p className="text-xs text-faint">Can&apos;t play until assigned</p>
          <p className="num mt-1 font-serif text-2xl text-cream">{waiting} <span className="text-sm text-muted">teams</span></p>
        </div>
      </div>
      <p className="mt-3 text-xs text-faint">
        Change a team&apos;s set with its dropdown below (until it plays its first month). To have every new team wait for you, set
        &quot;Problem-set assignment&quot; to &quot;Organizers assign each team&quot; in Settings. Sets are edited in Settings too.
      </p>
    </Panel>
  );
}
