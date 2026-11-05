"use client";

import { useMemo, useRef, useState } from "react";
import { capabilityFor, crewLimit, suggestCrew } from "@/game/engine";
import { clamp, teamSkills } from "@/game/metrics";
import type { Employee, GameSettings, Skill, TeamState } from "@/game/types";
import type { RewardKind, TeamView } from "@/lib/game";
import { money } from "../format";
import { missionXp } from "./gamify";
import { PageHero } from "./PageHero";
import { Badge, Button, Modal } from "../ui";

import { Icon } from "@/components/Icon";
type BoardItem = TeamView["board"][number];
type Task = BoardItem["task"];
type Role = TeamView["roles"][number];

/** A role's icon name from the settings (falls back to a generic person). */
export const roleIcon = (roles: { id: string; icon?: string }[], id: string) => roles.find((r) => r.id === id)?.icon ?? "person";

export function fitFor(task: Pick<Task, "skills" | "difficulty">, skills: Record<Skill, number>) {
  const cap = capabilityFor(task.skills, skills);
  const est = clamp(40 + 40 * cap - (task.difficulty - 50) * 0.6, 0, 100);
  return { cap, label: est >= 66 ? "Strong fit" : est >= 52 ? "Decent fit" : est >= 40 ? "Shaky fit" : "Poor fit", tone: est >= 66 ? "good" : est >= 52 ? "crt" : est >= 40 ? "warn" : "bad" } as const;
}

const skillsOf = (crew: Employee[], roles: Role[]) => teamSkills({ employees: crew } as TeamState, { roles } as GameSettings);

const CATEGORY_ART: Record<string, { bg: string; main: string; extra: string[] }> = {
  research: { bg: "from-[#3b2a6b] to-[#1b2a4a]", main: "search", extra: ["chat", "clipboard"] },
  product: { bg: "from-[#5b2a8a] to-[#24305e]", main: "phone", extra: ["wrench", "sparkles"] },
  growth: { bg: "from-[#8a2c3a] to-[#3b1f5c]", main: "megaphone", extra: ["growth", "users"] },
  ops: { bg: "from-[#2c4a5e] to-[#1f1a3a]", main: "settings", extra: ["crane", "package"] },
  compliance: { bg: "from-[#2c5e4a] to-[#1f2a3a]", main: "shield", extra: ["scroll", "check-circle"] },
  partnership: { bg: "from-[#7a4a1f] to-[#3b1f3a]", main: "handshake", extra: ["scroll", "globe"] },
  finance: { bg: "from-[#6b5a1f] to-[#2a1f3a]", main: "cash", extra: ["tag", "chart"] },
  recovery: { bg: "from-[#4a3a5e] to-[#1f1a2a]", main: "bandage", extra: ["coffee", "repeat"] },
};

const REWARD_LABEL: Record<RewardKind, string> = {
  cash: "Cash", customers: "", product: "Product level", reputation: "Reputation", arpuPct: "Revenue per customer",
  marginPts: "Gross margin", risk: "Risk", churnPts: "Churn", milestones: "Milestone",
};

type Filter = "ready" | "locked" | "done";

export function TaskBoard({ view, busy, onRun, onHire }: {
  view: TeamView; busy: boolean; onRun: (taskId: string, crew: string[]) => void; onHire: (roleId: string) => void;
}) {
  const [confirm, setConfirm] = useState<BoardItem | null>(null);
  const [filter, setFilter] = useState<Filter>("ready");
  const rail = useRef<HTMLDivElement>(null);
  const playable = view.game.status === "running" && !view.state.finished;
  const { available, locked, done } = useMemo(() => {
    const a: BoardItem[] = [], l: BoardItem[] = [], d: BoardItem[] = [];
    for (const b of view.board) {
      if (b.available) a.push(b);
      else if (b.completedCount > 0 && !b.task.repeatable) d.push(b);
      else l.push(b);
    }
    // the main mission is the next step in the story, not the fallback consulting gig
    a.sort((x, y) => Number(x.task.category === "recovery") - Number(y.task.category === "recovery"));
    return { available: a, locked: l, done: d };
  }, [view.board]);
  // Missions waiting only on a hire are real options too: show them in the Ready rail with Hire buttons.
  const hireable = locked.filter((b) => b.reasons.length > 0 && b.reasons.every((r) => r.startsWith("Hire ")));
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  const lists = { ready: available, locked, done };

  return (
    <div className="space-y-5">
      <PageHero title="Missions" subtitle="Pick a mission, assign your crew, and roll for it. Each mission uses one month."
        right={
          <div className="flex shrink-0 items-center gap-3 rounded-full border border-amber/50 bg-black/40 px-4 py-2 backdrop-blur-sm">
            <span className="text-sm text-cream">Month</span>
            <span className="flex gap-1" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => {
                const pos = view.state.turn / view.state.turnsTotal;
                return <span key={i} className={`h-3 w-3 rounded-full ${pos > i / 5 ? "bg-amber shadow-[0_0_8px_var(--amber)]" : "bg-white/15"}`} />;
              })}
            </span>
            <span className="num font-semibold text-cream">{view.state.turn} / {view.state.turnsTotal}</span>
          </div>
        }>
        <div className="flex flex-wrap gap-2" role="tablist">
          {([["ready", `Ready (${available.length}${hireable.length ? ` + ${hireable.length} to staff` : ""})`], ["locked", `Locked (${locked.length})`], ["done", `Completed (${done.length})`]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur-sm transition ${filter === id ? "bg-amber text-ink shadow-[0_6px_20px_-6px_var(--amber)]" : "border border-white/20 bg-black/30 text-cream hover:bg-black/50"}`}>
              {label}
            </button>
          ))}
        </div>
      </PageHero>

      {filter === "ready" && (
        available.length + hireable.length === 0 ? (
          <p className="game-card p-6 text-center text-muted">
            {playable ? "No mission is ready. Check the Locked tab: most need a role you haven't hired yet." : "Missions open when the game is running."}
          </p>
        ) : (
          <div className="relative">
            <div ref={rail} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
              {available.map((b, i) => (
                <MissionCard key={b.task.id} item={b} view={view} main={i === 0} onPick={() => setConfirm(b)} onHire={onHire} disabled={!playable || busy} />
              ))}
              {hireable.map((b) => <MissionCard key={b.task.id} item={b} view={view} needsHire onHire={onHire} disabled={!playable || busy} />)}
            </div>
            {available.length + hireable.length > 3 && (
              <>
                <button onClick={() => scroll(-1)} aria-label="Previous missions" className="absolute -left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#1d1029] text-cream shadow-lg hover:border-amber md:flex">‹</button>
                <button onClick={() => scroll(1)} aria-label="More missions" className="absolute -right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#1d1029] text-cream shadow-lg hover:border-amber md:flex">›</button>
              </>
            )}
          </div>
        )
      )}

      {filter !== "ready" && (
        lists[filter].length === 0 ? <p className="game-card p-6 text-center text-muted">{filter === "done" ? "No missions completed yet." : "Nothing locked. Every mission is open!"}</p> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lists[filter].map((b) => <MissionCard key={b.task.id} item={b} view={view} locked={filter === "locked"} done={filter === "done"} onHire={onHire} disabled={!playable || busy} />)}
          </div>
        )
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.task.title ?? ""} wide>
        {confirm && <CrewPicker key={confirm.task.id} item={view.board.find((b) => b.task.id === confirm.task.id) ?? confirm} view={view} busy={busy} onCancel={() => setConfirm(null)} onHire={onHire}
          onCommit={(crew) => { onRun(confirm.task.id, crew); setConfirm(null); }} />}
      </Modal>
    </div>
  );
}

function RoleNeeds({ task, view, onHire, disabled }: { task: Task; view: TeamView; onHire: (roleId: string) => void; disabled?: boolean }) {
  const needs = task.crew ?? [];
  if (!needs.length) return <p className="text-xs text-faint">No specific role needed</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {needs.map((roleId) => {
        const role = view.roles.find((r) => r.id === roleId);
        const have = view.state.employees.some((e) => e.roleId === roleId);
        return (
          <li key={roleId} className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-2 text-xs ${have ? "border-good/40 bg-good/10 pr-2 text-good" : "border-bad/40 bg-bad/10 pr-0.5 text-bad"}`}>
            <Icon name={roleIcon(view.roles, roleId)} />
            {role?.title.split(" / ")[0] ?? roleId}
            {have ? <Icon name="check" inherit /> : role && (
              <button onClick={() => onHire(roleId)} disabled={disabled || view.state.cash < role.hireCost}
                className="rounded-full bg-cream px-2 py-0.5 font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                title={`One-off ${money(role.hireCost)}, then ${money(role.salary)} per turn`}>
                Hire {money(role.hireCost)}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MissionCard({ item, view, main, locked, done, needsHire, onPick, onHire, disabled }: {
  item: BoardItem; view: TeamView; main?: boolean; locked?: boolean; done?: boolean; needsHire?: boolean; onPick?: () => void; onHire: (roleId: string) => void; disabled?: boolean;
}) {
  const t = item.task;
  const art = CATEGORY_ART[t.category] ?? CATEGORY_ART.recovery;
  const fit = fitFor(t, skillsOf(suggestCrew(view.state.employees, view, t), view.roles));
  const otherReasons = item.reasons.filter((r) => !r.startsWith("Hire "));
  const turns = t.turns ?? 1;
  return (
    <article className={`group flex w-[290px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition sm:w-[300px] ${
      main ? "border-amber/80 bg-[#26142f] shadow-[0_0_0_1px_rgba(242,166,90,0.4),0_20px_50px_-18px_rgba(242,166,90,0.7)]"
        : locked || done ? "w-auto border-white/10 bg-[#1b1022] sm:w-auto" : "border-[rgba(201,150,255,0.25)] bg-[#21122a] hover:-translate-y-1 hover:border-amber/60 hover:shadow-[0_18px_40px_-18px_rgba(242,166,90,0.6)]"}`}>
      {/* illustration */}
      <div className={`relative h-32 overflow-hidden bg-gradient-to-br ${art.bg} ${locked ? "grayscale-[0.7]" : ""}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,200,120,0.35),transparent_60%)]" />
        <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full opacity-60" aria-hidden="true">
          <path d="M0 40 L0 26 L20 26 L20 14 L40 14 L40 22 L60 22 L60 8 L80 8 L80 20 L110 20 L110 12 L130 12 L130 28 L160 28 L160 10 L185 10 L185 24 L210 24 L210 16 L240 16 L240 26 L270 26 L270 18 L300 18 L300 40 Z" fill="#12091a" />
        </svg>
        <span className={`absolute right-6 top-4 text-6xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition group-hover:scale-110 ${main ? "anim-bob" : ""}`} aria-hidden="true"><Icon name={locked ? "lock" : done ? "check-circle" : art.main} /></span>
        <span className="absolute left-24 top-12 text-2xl opacity-80" aria-hidden="true"><Icon name={art.extra[0]} /></span>
        <span className="absolute right-28 top-3 text-xl opacity-70" aria-hidden="true"><Icon name={art.extra[1]} /></span>
        {main && <span className="absolute left-3 top-3 rounded-md bg-gradient-to-r from-[#ff8a5c] to-[#f2a65a] px-2 py-1 text-[11px] font-extrabold tracking-wider text-ink">MAIN MISSION</span>}
        {needsHire && <span className="absolute left-3 top-3 rounded-md bg-[#7a3cff] px-2 py-1 text-[11px] font-extrabold tracking-wider text-white">NEEDS A HIRE</span>}
        {!main && !needsHire && t.repeatable && !locked && <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-[11px] font-bold tracking-wider text-cream">REPEATABLE</span>}
        {t.choiceGroup && !done && <span className="absolute bottom-2 left-3 rounded-md bg-warn/90 px-2 py-1 text-[11px] font-extrabold tracking-wider text-ink">CHOOSE ONE PATH</span>}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-snug text-cream">{t.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{t.objective}</p>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-cream"><Icon name="users" className="mr-1" />{(t.crew?.length || 1)}–{crewLimit(t)}</span>
          <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-cream"><Icon name="timer" className="mr-1" />{turns} month{turns > 1 ? "s" : ""}</span>
          <span className={`rounded-full border px-2.5 py-1 ${t.risk === "high" ? "border-bad/40 text-bad" : t.risk === "medium" ? "border-warn/40 text-warn" : "border-good/40 text-good"}`}>{t.risk} risk</span>
          {!locked && !done && !needsHire && <Badge tone={fit.tone}>{fit.label}</Badge>}
        </div>

        <ul className="mt-3 space-y-1 text-sm">
          {item.rewards.slice(0, 3).map((k) => (
            <li key={k} className="flex items-center gap-2 font-medium text-good">
              <Icon name={k === "milestones" ? "star" : k === "risk" || k === "churnPts" ? "down" : "up"} inherit />
              {k === "customers" ? `More ${view.track.customerLabel}` : k === "risk" || k === "churnPts" ? `Lower ${REWARD_LABEL[k].toLowerCase()}` : REWARD_LABEL[k]}
            </li>
          ))}
          <li className="flex items-center gap-2 font-medium text-bad"><Icon name="down" inherit />{t.cost ? `${money(t.cost)} cost` : "Free to run"}</li>
        </ul>

        <div className="mt-3"><RoleNeeds task={t} view={view} onHire={onHire} disabled={disabled} /></div>
        {locked && otherReasons.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-warn/90">{otherReasons.slice(0, 3).map((r) => <li key={r}>• {r}</li>)}</ul>}

        <div className="mt-auto pt-4">
          {needsHire && <p className="rounded-xl border border-dashed border-[#7a3cff]/60 px-4 py-2.5 text-center text-sm text-cream">Hire the role above to unlock</p>}
          {!locked && !done && !needsHire && (
            <button onClick={onPick} disabled={disabled}
              className={`chunky-btn flex w-full items-center justify-between rounded-xl px-4 py-2.5 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-45 ${main ? "bg-gradient-to-b from-[#ffd27a] to-[#f2a03c]" : "bg-gradient-to-b from-[#f6e7cf] to-[#d9c3a0]"}`}>
              <span>Take mission →</span><span className="text-xs font-bold text-[#7a3cff]">+{missionXp(t.kind)} XP</span>
            </button>
          )}
          {done && <p className="text-sm text-good">Completed {item.completedCount}×</p>}
        </div>
      </div>
    </article>
  );
}

function CrewPicker({ item, view, busy, onCancel, onCommit, onHire }: {
  item: BoardItem; view: TeamView; busy: boolean; onCancel: () => void; onCommit: (crew: string[]) => void; onHire: (roleId: string) => void;
}) {
  const task = item.task;
  const limit = crewLimit(task);
  const employees = view.state.employees;
  const [picked, setPicked] = useState<string[]>(() => suggestCrew(employees, view, task).map((e) => e.id));
  const crew = employees.filter((e) => picked.includes(e.id));
  const fit = fitFor(task, skillsOf(crew, view.roles));
  const missing = (task.crew ?? []).filter((r) => !crew.some((e) => e.roleId === r));
  const net = view.metrics.revenue - view.metrics.burn;
  const roleOf = (id: string) => view.roles.find((r) => r.id === id);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < limit ? [...p, id] : p));
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">{task.objective}</p>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-serif text-lg text-cream">Assign your crew</h4>
          <span className="text-sm text-muted">{crew.length}/{limit} selected · <Badge tone={fit.tone}>{fit.label}</Badge></span>
        </div>
        <p className="mt-1 text-xs text-faint">
          Only the people you assign count toward the roll. Required: {(task.crew ?? []).map((r) => `${roleOf(r)?.title ?? r}`).join(", ") || "none"}.
        </p>
        {employees.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line bg-black/15 p-3 text-sm text-muted">No employees yet: the founders handle this one alone.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {employees.map((e) => {
              const role = roleOf(e.roleId);
              const on = picked.includes(e.id);
              const full = !on && picked.length >= limit;
              const relevant = Object.keys(role?.skills ?? {}).filter((k) => k in task.skills);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => toggle(e.id)} disabled={full} aria-pressed={on}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${on ? "border-amber bg-amber/10" : "border-line hover:border-line-strong"} disabled:cursor-not-allowed disabled:opacity-45`}>
                    <span className="text-xl" aria-hidden="true"><Icon name={roleIcon(view.roles, e.roleId)} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-cream">{e.name}</span>
                      <span className="block text-xs text-muted">{role?.title ?? e.roleId}</span>
                      <span className={`block text-xs ${relevant.length ? "text-good" : "text-faint"}`}>
                        {relevant.length ? `Helps with ${relevant.join(", ")}` : "No relevant skills"}
                      </span>
                    </span>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${on ? "border-amber bg-amber text-ink" : "border-line-strong"}`}>{on ? <Icon name="check" inherit /> : null}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {missing.length > 0 && (
          <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
            Assign {missing.map((r) => roleOf(r)?.title ?? r).join(" and ")} to start this task.
            {missing.filter((r) => !employees.some((e) => e.roleId === r)).map((r) => {
              const role = roleOf(r);
              return role && (
                <Button key={r} variant="ghost" className="ml-2 mt-2" disabled={busy || view.state.cash < role.hireCost} onClick={() => onHire(r)}>
                  Hire {role.title} ({money(role.hireCost)})
                </Button>
              );
            })}
          </div>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-2 border-t border-line pt-4 text-sm">
        <dt className="text-faint">Task cost</dt><dd className="num text-right text-cream">{money(task.cost)}</dd>
        <dt className="text-faint">Net this turn (revenue − burn)</dt><dd className={`num text-right ${net >= 0 ? "text-good" : "text-bad"}`}>{money(net)}</dd>
        <dt className="text-faint">Estimated cash after</dt><dd className="num text-right font-semibold text-cream">{money(view.state.cash - task.cost + net)}</dd>
        <dt className="text-faint">Turns used</dt><dd className="text-right text-cream">{view.state.turn} → {view.state.turn + (task.turns ?? 1)} of {view.state.turnsTotal}</dd>
      </dl>
      {view.state.offers.length > 0 && <p className="rounded-lg border border-warn/40 bg-warn/10 p-2 text-sm text-warn">Your open investor offers will expire if you take this turn.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button className="chunky-btn" disabled={busy || missing.length > 0 || !item.available} onClick={() => onCommit(picked)}><Icon name="dice" inherit className="mr-1.5" />Launch mission</Button>
      </div>
    </div>
  );
}
