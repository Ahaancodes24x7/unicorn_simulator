"use client";

import { useEffect, useState } from "react";
import { SCORE_LABELS } from "@/game/scoring";
import type { GameSettings, ScoreWeights } from "@/game/types";
import { money } from "../format";
import { api, Button, ErrorNote, inputClass, Panel, Spinner } from "../ui";

export function ConfigEditor() {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [defaults, setDefaults] = useState<GameSettings | null>(null);
  const [status, setStatus] = useState("");
  const [json, setJson] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ status: string; settings: GameSettings; defaults: GameSettings }>("/api/admin/config")
      .then((d) => { setSettings(d.settings); setDefaults(d.defaults); setStatus(d.status); })
      .catch((e) => setError(e.message));
  }, []);

  if (!settings) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;
  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => setSettings({ ...settings, [k]: v });
  const totalWeight = Object.values(settings.weights).reduce((a, b) => a + b, 0) || 1;

  async function save() {
    setBusy(true); setError(null); setMsg(null);
    try {
      let next = settings!;
      if (json !== null) next = JSON.parse(json);
      const res = await api<{ settings: GameSettings }>("/api/admin/config", { settings: next, reason: reason || undefined }, "PUT");
      setSettings(res.settings);
      setJson(null);
      setMsg("Configuration saved and audited.");
    } catch (e) {
      setError(e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const numField = (label: string, k: keyof GameSettings, opts: { step?: number; min?: number; max?: number } = {}) => (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <input type="number" className={inputClass} value={settings[k] as number} step={opts.step ?? 1} min={opts.min} max={opts.max}
        onChange={(e) => set(k, Number(e.target.value) as never)} />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl text-cream">Configuration</h1>
          <p className="text-sm text-muted">Game is <b>{status}</b>. Changes apply immediately to every team; turn-limit changes update in-flight teams.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputClass} w-64`} placeholder="Reason for change (audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save configuration"}</Button>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {msg && <p className="text-sm text-good">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Event & rules">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2"><span className="mb-1 block text-muted">Event name</span>
              <input className={inputClass} value={settings.eventName} onChange={(e) => set("eventName", e.target.value)} /></label>
            {numField("Turns per team", "turns", { min: 1, max: 60 })}
            {numField("Starting cash ($)", "startingCash", { min: 0, step: 100 })}
            {numField("Max teams", "maxTeams", { min: 1 })}
            {numField("Max team size", "maxTeamSize", { min: 1 })}
            {numField("Randomness ± points", "variance", { min: 0, max: 40 })}
            {numField("Critical event chance (0–1)", "eventChance", { min: 0, max: 1, step: 0.01 })}
            <label className="block text-sm"><span className="mb-1 block text-muted">Problem-set assignment</span>
              <select className={inputClass} value={settings.assignment} onChange={(e) => set("assignment", e.target.value as GameSettings["assignment"])}>
                <option value="admin">Organizers assign each team</option><option value="balanced">Balanced (even spread)</option><option value="random">Random</option><option value="choice">Team chooses</option>
              </select></label>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={settings.allowLateJoin} onChange={(e) => set("allowLateJoin", e.target.checked)} /> Allow joining after start</label>
              <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={settings.overdraft} onChange={(e) => set("overdraft", e.target.checked)} /> Allow overdraft (negative cash)</label>
            </div>
          </div>
        </Panel>

        <Panel title="Score weights">
          <ul className="space-y-2">
            {(Object.keys(SCORE_LABELS) as (keyof ScoreWeights)[]).map((k) => (
              <li key={k} className="grid grid-cols-[1fr_90px_48px] items-center gap-3 text-sm">
                <span className="text-muted">{SCORE_LABELS[k]}</span>
                <input type="number" min={0} className={inputClass} value={settings.weights[k]} onChange={(e) => set("weights", { ...settings.weights, [k]: Number(e.target.value) })} />
                <span className="num text-right text-cream">{Math.round((settings.weights[k] / totalWeight) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">Weights are normalised to 100%. Total entered: {totalWeight}.</p>
        </Panel>
      </div>

      <Panel title="Problem tracks">
        <div className="grid gap-4 md:grid-cols-2">
          {settings.tracks.map((t, i) => {
            const upd = (patch: Partial<typeof t>) => set("tracks", settings.tracks.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={t.id} className="space-y-2 rounded-xl border border-line p-4">
                <p className="text-xs font-semibold tracking-widest text-amber">TRACK {t.code} · {t.tasks.length} tasks · {t.events.length} events</p>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} value={t.sector} onChange={(e) => upd({ sector: e.target.value })} aria-label="Sector" />
                  <input className={inputClass} value={t.company} onChange={(e) => upd({ company: e.target.value })} aria-label="Company" />
                </div>
                <input className={inputClass} value={t.problem} onChange={(e) => upd({ problem: e.target.value })} aria-label="Problem statement" />
                <input className={inputClass} value={t.tagline} onChange={(e) => upd({ tagline: e.target.value })} aria-label="Tagline" />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label><span className="text-faint">Revenue/customer</span><input type="number" className={inputClass} value={t.arpu} onChange={(e) => upd({ arpu: Number(e.target.value) })} /></label>
                  <label><span className="text-faint">Gross margin</span><input type="number" step={0.01} className={inputClass} value={t.grossMargin} onChange={(e) => upd({ grossMargin: Number(e.target.value) })} /></label>
                  <label><span className="text-faint">Base churn</span><input type="number" step={0.005} className={inputClass} value={t.baseChurn} onChange={(e) => upd({ baseChurn: Number(e.target.value) })} /></label>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Hiring catalog">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-faint"><tr><th className="px-5 py-2">Role</th><th>Hire cost</th><th>Salary/turn</th><th>Max</th><th>Skills</th></tr></thead>
            <tbody>
              {settings.roles.map((r, i) => {
                const upd = (patch: Partial<typeof r>) => set("roles", settings.roles.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={r.id} className="border-t border-line/50">
                    <td className="px-5 py-2 text-cream">{r.title}</td>
                    <td><input type="number" className={`${inputClass} w-24`} value={r.hireCost} onChange={(e) => upd({ hireCost: Number(e.target.value) })} /></td>
                    <td><input type="number" className={`${inputClass} w-24`} value={r.salary} onChange={(e) => upd({ salary: Number(e.target.value) })} /></td>
                    <td><input type="number" className={`${inputClass} w-16`} value={r.max} onChange={(e) => upd({ max: Number(e.target.value) })} /></td>
                    <td className="text-xs text-muted">{Object.entries(r.skills).map(([k, v]) => `${k} +${v}`).join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Funding rounds">
        <ul className="space-y-2 text-sm">
          {settings.rounds.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-line/60 p-3">
              <span className="text-cream">{r.name}</span>
              <span className="text-muted">pre-money {money(r.preMoneyRange[0])}–{money(r.preMoneyRange[1])} · sells {Math.round(r.dilutionRange[0] * 100)}–{Math.round(r.dilutionRange[1] * 100)}%</span>
              <span className="w-full text-xs text-faint">Criteria: {JSON.stringify(r.criteria)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">Edit round criteria, task catalogs, outcomes and events in the advanced editor below.</p>
      </Panel>

      <Panel title="Advanced: full configuration JSON" action={
        <div className="flex gap-2">
          {json === null ? <Button variant="subtle" onClick={() => setJson(JSON.stringify(settings, null, 2))}>Open editor</Button>
            : <Button variant="subtle" onClick={() => setJson(null)}>Discard JSON edits</Button>}
          {defaults && <Button variant="ghost" onClick={() => setJson(JSON.stringify(defaults, null, 2))}>Load defaults</Button>}
        </div>
      }>
        {json === null ? (
          <p className="text-sm text-muted">Tasks (cost, difficulty, skills, prerequisites, outcome branches), critical events, milestone values and round criteria. Validated on save.</p>
        ) : (
          <textarea className={`${inputClass} h-[520px] font-mono text-xs`} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
        )}
      </Panel>
    </div>
  );
}
