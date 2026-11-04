"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, Button, ErrorNote, inputClass, Panel } from "./ui";

interface Info {
  status: string;
  assignment: string;
  startingCash: number;
  domain: string;
  tracks: { id: string; code: string; sector: string; problem: string }[];
}

// Everyone enters with team name + access code. A team lead registers the team once with their email,
// and the code is emailed there. In local test mode (no email set up) the code is shown on screen.
export function JoinForms({ info }: { info: Info }) {
  const [teamName, setTeamName] = useState("");
  const [mode, setMode] = useState<"register" | "lost">("register");

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <EnterTeam name={teamName} setName={setTeamName} />
      {mode === "register"
        ? <RegisterTeam info={info} onLost={() => setMode("lost")} onRegistered={setTeamName} />
        : <LostCode domain={info.domain} onBack={() => setMode("register")} />}
    </div>
  );
}

function EnterTeam({ name, setName }: { name: string; setName: (v: string) => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/team/rejoin", { name: name.trim(), code: code.trim() });
      router.push("/play");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Panel title="Enter your team" className="h-fit">
      <form onSubmit={enter} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Team name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" placeholder="e.g. Garage Dreamers" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Access code (your team lead has it)</span>
          <input className={`${inputClass} font-mono text-lg uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" placeholder="ABCD-EFGH" />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={busy} className="w-full py-3 text-base">{busy ? "Entering…" : "Enter the simulation →"}</Button>
      </form>
    </Panel>
  );
}

function DevNotice({ code }: { code: string }) {
  return (
    <p className="rounded-lg border border-amber/50 bg-amber/10 p-3 text-sm text-amber">
      Test mode (email isn&apos;t set up yet). The emailed code would be: <span className="select-all font-mono text-base text-cream">{code}</span>
    </p>
  );
}

function RegisterTeam({ info, onLost, onRegistered }: { info: Info; onLost: () => void; onRegistered: (name: string) => void }) {
  const [name, setName] = useState("");
  const [lead, setLead] = useState("");
  const [trackId, setTrackId] = useState(info.tracks[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; lead: string; devCode?: string } | null>(null);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ name: string; lead: string; devCode?: string }>("/api/team/join", {
        name: name.trim(), lead: lead.trim(), ...(info.assignment === "choice" ? { trackId } : {}),
      });
      setDone(res);
      onRegistered(res.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Panel title="Team registered" className="h-fit">
        <p className="text-sm text-muted">
          The access code for <span className="text-cream">{done.name}</span> was emailed to <span className="text-cream">{done.lead}</span>. Check spam if it doesn&apos;t arrive.
        </p>
        {done.devCode && <div className="mt-3"><DevNotice code={done.devCode} /></div>}
        <p className="mt-3 text-sm text-muted">Share the team name and code with your teammates, then enter on the left. The team name is already filled in.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Team lead? Register your team" className="h-fit">
      <form onSubmit={register} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Team name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} placeholder="e.g. Garage Dreamers" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Team lead&apos;s email, @{info.domain} (the access code is sent here)</span>
          <input className={inputClass} type="email" value={lead} onChange={(e) => setLead(e.target.value)} required autoComplete="email" placeholder={`yourname@${info.domain}`} />
        </label>
        {info.assignment === "choice" ? (
          <fieldset>
            <legend className="mb-2 text-sm text-muted">Choose your problem track</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {info.tracks.map((t) => (
                <label key={t.id} className={`cursor-pointer rounded-xl border p-3 transition ${trackId === t.id ? "border-amber bg-amber/10" : "border-line hover:border-line-strong"}`}>
                  <input type="radio" name="track" value={t.id} checked={trackId === t.id} onChange={() => setTrackId(t.id)} className="sr-only" />
                  <span className="block text-xs font-semibold tracking-widest text-amber">TRACK {t.code}</span>
                  <span className="block font-medium text-cream">{t.sector}</span>
                  <span className="block text-xs text-faint">{t.problem}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="rounded-lg border border-line bg-black/15 p-3 text-sm text-muted">
            You start with ${info.startingCash.toLocaleString()}. Your problem track is {info.assignment === "random" ? "drawn at random" : "assigned to keep tracks balanced"} from {info.tracks.length} tracks.
          </p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" variant="ghost" disabled={busy || info.status === "ended"} className="w-full py-3 text-base">{busy ? "Registering…" : "Register & email me the code"}</Button>
        <button type="button" onClick={onLost} className="w-full text-sm text-muted hover:text-cream">Lost your code? Get a new one</button>
      </form>
    </Panel>
  );
}

function LostCode({ domain, onBack }: { domain: string; onBack: () => void }) {
  const [name, setName] = useState("");
  const [lead, setLead] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await api<{ devCode?: string }>("/api/team/lost-code", { name: name.trim(), lead: lead.trim() }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Lost your access code?" className="h-fit">
      {sent ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">If <span className="text-cream">{lead}</span> leads <span className="text-cream">{name}</span>, a new code is on its way. The old code no longer works; anyone already playing stays signed in.</p>
          {sent.devCode && <DevNotice code={sent.devCode} />}
          <p className="text-sm text-muted">Still stuck? Ask an organizer: they can issue a code for you.</p>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm text-muted">We&apos;ll email a new code to the team lead.</p>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Team name" aria-label="Team name" />
          <input className={inputClass} type="email" value={lead} onChange={(e) => setLead(e.target.value)} required placeholder={`Team lead's email (@${domain})`} aria-label="Team lead's email" />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Email a new code"}</Button>
        </form>
      )}
      <button type="button" onClick={onBack} className="mt-3 w-full text-sm text-muted hover:text-cream">← Back to registration</button>
    </Panel>
  );
}
