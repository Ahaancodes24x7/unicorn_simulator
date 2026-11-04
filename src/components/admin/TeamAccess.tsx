"use client";

import { useState } from "react";
import { api, Button, ErrorNote, inputClass, Modal, Panel } from "../ui";

/** Big, copyable access code for an organizer to read out or hand over. */
export function CodeReveal({ team, code, note }: { team: string; code: string; note?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Access code for <span className="text-cream">{team}</span>. It&apos;s shown only now; the old code (if any) no longer works.</p>
      <p className="select-all rounded-xl border border-crt/40 bg-[#05140b] py-5 text-center font-mono text-4xl tracking-[0.2em] text-crt">{code}</p>
      {note && <p className="text-sm text-good">{note}</p>}
    </div>
  );
}

/** Team page: issue a new access code for a team that lost theirs. */
export function TeamAccess({ id, team, lead }: { id: string; team: string; lead: string | null }) {
  const [reason, setReason] = useState("");
  const [emailLead, setEmailLead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; emailed: boolean } | null>(null);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api<{ code: string; emailed: boolean }>(`/api/admin/teams/${id}`, { kind: "code", reason, emailLead }));
      setReason("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Team access" className="no-print">
      <p className="text-sm text-muted">Team lead: <span className="text-cream">{lead ?? "none (created by an organizer)"}</span>. Teammates enter with the team name and access code; people already inside stay signed in when the code changes.</p>
      <form onSubmit={issue} className="mt-3 grid gap-3 md:grid-cols-[2fr_auto_auto] md:items-end">
        <label className="block text-sm"><span className="mb-1 block text-muted">Reason (logged)</span>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} placeholder="e.g. lead lost the email" />
        </label>
        {lead && (
          <label className="flex items-center gap-2 pb-2 text-sm text-muted">
            <input type="checkbox" checked={emailLead} onChange={(e) => setEmailLead(e.target.checked)} className="accent-[var(--amber)]" /> Also email the lead
          </label>
        )}
        <Button type="submit" disabled={busy}>{busy ? "Issuing…" : "Issue new access code"}</Button>
      </form>
      {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      <Modal open={!!result} onClose={() => setResult(null)} title="New access code">
        {result && <CodeReveal team={team} code={result.code} note={result.emailed ? `Also emailed to ${lead}.` : undefined} />}
      </Modal>
    </Panel>
  );
}

/** Overview: register a team by hand (any time, any email or none) and get its code on screen. */
export function AddTeam({ tracks, onAdded }: { tracks: { id: string; sector: string; company: string }[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", lead: "", trackId: "", reason: "", emailLead: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; code: string; emailed: boolean } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api<{ name: string; code: string; emailed: boolean }>("/api/admin/teams", { ...form, trackId: form.trackId || undefined }));
      setForm({ name: "", lead: "", trackId: "", reason: "", emailLead: false });
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const close = () => { setOpen(false); setResult(null); setError(null); };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>+ Add team manually</Button>
      <Modal open={open} onClose={close} title={result ? "Team created" : "Add a team manually"}>
        {result ? (
          <div className="space-y-4">
            <CodeReveal team={result.name} code={result.code} note={result.emailed ? "Also emailed to the team lead." : undefined} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResult(null)}>Add another</Button>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-3">
            <p className="text-sm text-muted">Works any time, even when registration is closed. You get the access code on screen to give the team.</p>
            <label className="block text-sm"><span className="mb-1 block text-muted">Team name</span>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={40} />
            </label>
            <label className="block text-sm"><span className="mb-1 block text-muted">Team lead&apos;s email (optional, any address)</span>
              <input className={inputClass} type="email" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} />
            </label>
            {form.lead && (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={form.emailLead} onChange={(e) => setForm({ ...form, emailLead: e.target.checked })} className="accent-[var(--amber)]" /> Also email the code to the lead
              </label>
            )}
            <label className="block text-sm"><span className="mb-1 block text-muted">Track</span>
              <select className={inputClass} value={form.trackId} onChange={(e) => setForm({ ...form, trackId: e.target.value })}>
                <option value="">Automatic (same rule as self-registration)</option>
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.sector} · {t.company}</option>)}
              </select>
            </label>
            <label className="block text-sm"><span className="mb-1 block text-muted">Reason (logged)</span>
              <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required minLength={3} placeholder="e.g. walk-in team at the help desk" />
            </label>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create team"}</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
