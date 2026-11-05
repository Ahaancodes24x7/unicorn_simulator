"use client";

import { useState } from "react";
import { SKILL_CAP } from "@/game/metrics";
import { SKILLS, type RoleDef, type Skill } from "@/game/types";
import type { TeamView } from "@/lib/game";
import { money, runway } from "../format";
import { api, Button, ErrorNote, Modal } from "../ui";
import { PageHero } from "./PageHero";
import { roleIcon } from "./TaskBoard";

import { Icon } from "@/components/Icon";
// Role filters are derived from each role's strongest skill, so custom roles slot in automatically.
const SKILL_GROUP: Record<Skill, { label: string; icon: string }> = {
  strategy: { label: "Leadership", icon: "briefcase" }, tech: { label: "Engineering", icon: "laptop" }, sales: { label: "Growth", icon: "megaphone" },
  marketing: { label: "Growth", icon: "megaphone" }, product: { label: "Product", icon: "palette" }, ops: { label: "Operations", icon: "settings" },
  finance: { label: "Finance", icon: "cash" },
};
const groupOf = (r: RoleDef) => {
  const top = (Object.entries(r.skills) as [Skill, number][]).sort((x, y) => y[1] - x[1])[0]?.[0];
  return top ? SKILL_GROUP[top] : { label: "Other", icon: "sparkles" };
};

export function TeamPanel({ view, skills, busy, onHire, onFire }: {
  view: TeamView; skills: Record<Skill, number>; busy: boolean; onHire: (roleId: string) => void; onFire: (employeeId: string) => void;
}) {
  const [hireRole, setHireRole] = useState<RoleDef | null>(null);
  const [fireId, setFireId] = useState<string | null>(null);
  const [group, setGroup] = useState("All roles");
  const active = view.game.status === "running" && !view.state.finished;
  const m = view.metrics;
  const payroll = m.payroll;
  const employees = view.state.employees;
  const firing = employees.find((e) => e.id === fireId);
  const firingRole = view.roles.find((r) => r.id === firing?.roleId);
  const capacity = view.roles.reduce((n, r) => n + r.max, 0);
  const groups = [{ label: "All roles", icon: "sparkles" }, ...view.roles.map(groupOf).filter((g, i, all) => all.findIndex((x) => x.label === g.label) === i)];
  const roles = view.roles.filter((r) => group === "All roles" || groupOf(r).label === group);
  // Missions that are waiting only on this role: hiring it is what unlocks them.
  const unlocks = (roleId: string) => view.board.filter((b) => !b.available && (b.task.crew ?? []).includes(roleId)
    && !employees.some((e) => e.roleId === roleId) && b.reasons.every((r) => r.startsWith("Hire "))).length;

  const stats = [
    { icon: "users", label: "Team size", value: `${employees.length} / ${capacity}` },
    { icon: "dollar", label: "Payroll / turn", value: money(payroll) },
    { icon: "flame", label: "Burn / turn", value: money(m.burn) },
    { icon: "hourglass", label: "Runway", value: runway(m.runway), bad: m.runway < 2 },
  ];

  return (
    <div className="space-y-5">
      <PageHero title="Build Your Team" subtitle="Hire the right talent, balance your costs, and execute faster. Hiring doesn't use a turn; salaries post every month.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-sm">
              <span className="text-2xl" aria-hidden="true"><Icon name={s.icon} /></span>
              <span>
                <span className="block text-[11px] uppercase tracking-wider text-faint">{s.label}</span>
                <span className={`num block font-serif text-xl ${s.bad ? "text-bad" : "text-cream"}`}>{s.value}</span>
              </span>
            </div>
          ))}
        </div>
      </PageHero>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter roles">
            {groups.map((g) => (
              <button key={g.label} role="tab" aria-selected={group === g.label} onClick={() => setGroup(g.label)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${group === g.label ? "bg-amber text-ink shadow-[0_6px_20px_-6px_var(--amber)]" : "border border-white/15 bg-black/25 text-cream hover:border-amber/50"}`}>
                <span aria-hidden="true"><Icon name={g.icon} /></span>{g.label}
              </button>
            ))}
          </div>

          <ul className="space-y-3">
            {roles.map((r) => {
              const count = employees.filter((e) => e.roleId === r.id).length;
              const full = count >= r.max;
              const broke = view.state.cash < r.hireCost;
              const opens = unlocks(r.id);
              return (
                <li key={r.id} className={`game-card flex flex-col gap-4 p-4 transition hover:border-amber/50 sm:flex-row sm:items-center ${opens ? "game-card-hot" : ""}`}>
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber/30 bg-gradient-to-b from-amber/20 to-black/30 text-3xl" aria-hidden="true"><Icon name={roleIcon(view.roles, r.id)} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-cream">{r.title}</h3>
                      {opens > 0 && <span className="anim-glow rounded-full bg-amber px-2 py-0.5 text-[11px] font-bold text-ink">Unlocks {opens} mission{opens > 1 ? "s" : ""}</span>}
                    </div>
                    <p className="text-sm text-muted">{r.blurb}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(r.skills).map(([k, v]) => (
                        <span key={k} className="rounded-full border border-white/15 bg-black/30 px-2.5 py-0.5 text-xs capitalize text-cream">{k} +{v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <p className="num text-lg font-semibold text-amber">{money(r.hireCost)} <span className="text-xs font-normal text-faint">to hire</span></p>
                    <p className="num text-sm text-muted">{money(r.salary)} / turn</p>
                    <p className="flex gap-1" aria-label={`${count} of ${r.max} hired`}>
                      {Array.from({ length: r.max }, (_, i) => <span key={i} className={`h-2 w-4 rounded-full ${i < count ? "bg-good shadow-[0_0_6px_var(--good)]" : "bg-white/15"}`} />)}
                    </p>
                  </div>
                  <button disabled={!active || busy || full || broke} onClick={() => setHireRole(r)}
                    className="chunky-btn shrink-0 rounded-xl bg-gradient-to-b from-[#ffd27a] to-[#f2a03c] px-6 py-2.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">
                    {full ? "Full" : broke ? "Can't afford" : "Hire"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="space-y-5">
          <section className="game-card p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-2xl text-cream">Your Team</h3>
              <span className="text-sm text-muted">{employees.length} member{employees.length === 1 ? "" : "s"}</span>
            </div>
            {employees.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-sm text-faint">Just the founders so far. Most missions need a specific role, so make your first hire.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {employees.map((e) => {
                  const role = view.roles.find((r) => r.id === e.roleId);
                  return (
                    <li key={e.id} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-xl" aria-hidden="true"><Icon name={roleIcon(view.roles, e.roleId)} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-cream">{e.name}</span>
                        <span className="block truncate text-xs text-faint">{role?.title} · {money(role?.salary ?? 0)}/turn</span>
                      </span>
                      <button disabled={!active || busy} onClick={() => setFireId(e.id)} className="text-xs text-faint opacity-0 transition hover:text-bad group-hover:opacity-100 focus:opacity-100 disabled:hidden">Let go</button>
                      <span className="h-2.5 w-2.5 rounded-full bg-good shadow-[0_0_8px_var(--good)]" title="Active" />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="game-card p-5">
            <h3 className="font-serif text-xl text-cream">Team capability</h3>
            <ul className="mt-3 space-y-2.5">
              {SKILLS.map((s) => (
                <li key={s} className="grid grid-cols-[80px_1fr_34px] items-center gap-3 text-sm">
                  <span className="capitalize text-muted">{s}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                    <span className={`block h-full rounded-full transition-[width] duration-700 ${skills[s] >= SKILL_CAP ? "bg-gradient-to-r from-crt to-good" : "bg-gradient-to-r from-rust to-amber"}`} style={{ width: `${Math.min(100, (skills[s] / SKILL_CAP) * 100)}%` }} />
                  </span>
                  <span className="num text-right text-cream">{skills[s].toFixed(1)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Each skill counts up to {SKILL_CAP} on a mission roll, and only for the crew you assign.</p>
          </section>
        </aside>
      </div>

      <Modal open={!!hireRole} onClose={() => setHireRole(null)} title={`Hire ${hireRole?.title ?? ""}?`}>
        {hireRole && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="anim-pop flex h-16 w-16 items-center justify-center rounded-2xl border border-amber/40 bg-amber/15 text-4xl" aria-hidden="true"><Icon name={roleIcon(view.roles, hireRole.id)} /></span>
              <p className="text-sm text-muted">{hireRole.blurb}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-faint">Hiring fee (one-off)</dt><dd className="num text-right text-cream">{money(hireRole.hireCost)}</dd>
              <dt className="text-faint">Payroll / turn</dt><dd className="num text-right text-cream">{money(payroll)} → {money(payroll + hireRole.salary)}</dd>
              <dt className="text-faint">Cash after</dt><dd className="num text-right font-semibold text-cream">{money(view.state.cash - hireRole.hireCost)}</dd>
            </dl>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setHireRole(null)}>Cancel</Button>
              <Button className="chunky-btn" disabled={busy} onClick={() => { onHire(hireRole.id); setHireRole(null); }}><Icon name="handshake" inherit className="mr-1.5" />Confirm hire</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!firing} onClose={() => setFireId(null)} title={`Let go ${firing?.name ?? ""}?`}>
        {firing && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Severance is one turn of salary ({money(firingRole?.salary ?? 0)}). Reputation −1. Saves {money(firingRole?.salary ?? 0)} per turn after that.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFireId(null)}>Keep</Button>
              <Button variant="danger" disabled={busy} onClick={() => { onFire(firing.id); setFireId(null); }}>Let go</Button>
            </div>
          </div>
        )}
      </Modal>
      <Teammates view={view} />
    </div>
  );
}

/** How teammates get in, plus a way to email the team lead a fresh access code. */
function Teammates({ view }: { view: TeamView }) {
  const lead = view.team.members[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function newCode() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ lead: string; devCode?: string }>("/api/team/new-code", {});
      setNotice(`A new code was emailed to ${res.lead}. The old code no longer works; everyone already playing stays signed in.${res.devCode ? ` (Test mode code: ${res.devCode})` : ""}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="game-card p-5">
      <h3 className="mb-2 game-title">Bring your teammates in</h3>
      <p className="max-w-2xl text-sm text-muted">
        Teammates open the Join page and enter the team name <span className="text-cream">{view.team.name}</span> with the access code
        {lead ? <> emailed to your team lead (<span className="text-cream">{lead}</span>)</> : " the organizers gave you"}.
      </p>
      {lead && (
        <Button variant="ghost" className="mt-3" disabled={busy} onClick={newCode}>{busy ? "Sending…" : "Email the team lead a new code"}</Button>
      )}
      {error && <div className="mt-2 max-w-xl"><ErrorNote>{error}</ErrorNote></div>}
      {notice && <p className="mt-2 max-w-xl text-sm text-good">{notice}</p>}
    </section>
  );
}
