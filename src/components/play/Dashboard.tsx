"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaskOutcome } from "@/game/engine";
import { teamSkills } from "@/game/metrics";
import type { GameSettings } from "@/game/types";
import type { TeamView } from "@/lib/game";
import { UnicornMark } from "../Logo";
import { money } from "../format";
import { api, ErrorNote, Spinner } from "../ui";
import { Analytics, ScorePanel } from "./Analytics";
import { FundingPanel } from "./FundingPanel";
import { Confetti, Meter } from "./fx";
import { achievements, founderRank, levelFor, xpFor, type Achievement } from "./gamify";
import { HQ } from "./HQ";
import { ResultModal } from "./ResultModal";
import { TaskBoard } from "./TaskBoard";
import { TeamPanel } from "./TeamPanel";

const TABS = [
  { id: "HQ", icon: "🏠", label: "HQ" },
  { id: "Missions", icon: "🎯", label: "Missions" },
  { id: "Crew", icon: "👥", label: "Crew" },
  { id: "Funding", icon: "💰", label: "Funding" },
  { id: "Analytics", icon: "📊", label: "Analytics" },
  { id: "Score", icon: "🏆", label: "Score" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const STATUS = {
  lobby: { label: "Waiting to start", cls: "bg-warn/15 text-warn" },
  running: { label: "Live", cls: "bg-good/15 text-good" },
  paused: { label: "Paused", cls: "bg-warn/15 text-warn" },
  ended: { label: "Game over", cls: "bg-white/10 text-cream" },
} as const;

type Celebration = { id: number; icon: string; title: string; text: string };

export function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<TeamView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("HQ");
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [confetti, setConfetti] = useState(0);
  const seen = useRef<{ badges: Set<string>; level: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await api<TeamView>("/api/team/state"));
      setError(null);
    } catch (e) {
      if ((e as { status?: number }).status === 401) router.replace("/join");
      else setError((e as Error).message);
    }
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Achievement unlocks and level-ups pop up (and throw confetti) when they happen.
  useEffect(() => {
    if (!view) return;
    const unlocked = achievements(view.state, view.metrics).filter((a) => a.unlocked);
    const level = levelFor(xpFor(view.state)).level;
    const prev = seen.current;
    seen.current = { badges: new Set(unlocked.map((a) => a.id)), level };
    if (!prev) return; // first load: don't celebrate what was already earned
    const fresh: Celebration[] = unlocked.filter((a: Achievement) => !prev.badges.has(a.id))
      .map((a) => ({ id: Date.now() + Math.random(), icon: a.icon, title: "Achievement unlocked", text: a.title }));
    if (level > prev.level) fresh.unshift({ id: Date.now(), icon: "⬆️", title: "Level up!", text: `You reached level ${level}` });
    if (fresh.length) {
      setCelebrations((c) => [...c, ...fresh]);
      setConfetti((n) => n + 1);
    }
  }, [view]);

  useEffect(() => {
    if (!celebrations.length) return;
    const t = setTimeout(() => setCelebrations((c) => c.slice(1)), 3800);
    return () => clearTimeout(t);
  }, [celebrations]);

  const act = useCallback(async (body: Record<string, unknown>, message?: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await api<{ outcome?: TaskOutcome }>("/api/team/action", body);
      if (res.outcome) setOutcome(res.outcome);
      else if (message) setToast(message);
      await load();
    } catch (e) {
      setActionError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }, [load]);

  const skills = useMemo(
    () => (view ? teamSkills(view.state, { roles: view.roles } as GameSettings) : null),
    [view],
  );

  if (!view || !skills) {
    return <main className="game-bg flex min-h-screen items-center justify-center p-6">{error ? <ErrorNote>{error}</ErrorNote> : <Spinner label="Loading your company…" />}</main>;
  }

  const m = view.metrics;
  const s = view.state;
  const lvl = levelFor(xpFor(s));
  const rank = founderRank(m.valuation);
  const status = STATUS[view.game.status];
  const shown: Tab | null = s.awaitingTrack ? null : tab;
  const hire = (roleId: string) => act({ type: "hire", roleId }, "Welcome aboard! New hire added.");
  const signOut = async () => { try { sessionStorage.removeItem("sv_booted"); } catch {} await api("/api/team/logout", {}); router.push("/"); };
  const dot = (id: Tab) => (id === "Funding" && (s.offers.length > 0 || view.funding?.eligible)) || (id === "Missions" && view.board.some((b) => b.available) && view.game.status === "running" && !s.finished);

  return (
    <div className="game-bg min-h-screen">
      {/* sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 bg-black/30 p-4 backdrop-blur-md lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2 text-cream">
          <UnicornMark className="h-9 w-9" />
          <span className="leading-none">
            <span className="block font-serif text-lg">Unicorn</span>
            <span className="block text-[9px] font-semibold tracking-[0.35em] text-amber">SIMULATOR</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${tab === t.id ? "bg-gradient-to-r from-amber/90 to-rust/80 text-ink shadow-[0_8px_24px_-10px_rgba(242,166,90,0.8)]" : "text-muted hover:bg-white/5 hover:text-cream"}`}>
              <span aria-hidden="true">{t.icon}</span>{t.label}
              {dot(t.id) && <span className={`ml-auto h-2 w-2 rounded-full ${tab === t.id ? "bg-ink" : "bg-amber anim-glow"}`} />}
            </button>
          ))}
          <Link href="/leaderboard" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-white/5 hover:text-cream">
            <span aria-hidden="true">🥇</span>Leaderboard ↗
          </Link>
        </nav>
        <div className="mt-auto rounded-2xl border border-amber/30 bg-gradient-to-b from-amber/15 to-transparent p-4 text-center">
          <p className="text-3xl" aria-hidden="true">{rank.icon}</p>
          <p className="mt-1 font-semibold text-amber">{rank.title}</p>
          <p className="text-xs text-faint">{rank.next ? `Next: ${rank.next.title}` : "Top rank reached!"}</p>
          <Meter value={rank.progress} className="mt-2" height="h-1.5" />
        </div>
        <button onClick={signOut} className="mt-3 text-xs text-faint hover:text-cream">Sign out</button>
      </aside>

      <div className="lg:pl-60">
        {/* HUD top bar */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#170d22]/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-xl text-cream">{s.awaitingTrack ? "Problem set pending" : view.track.company}</p>
              <p className="truncate text-xs text-faint">Team {view.team.name}{s.awaitingTrack ? "" : ` · Set ${view.track.code} · ${view.track.sector}`}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.cls}`}>{view.game.status === "running" && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-good anim-glow" />}{status.label}</span>
            <div className="w-40">
              <div className="flex justify-between text-[11px] text-muted"><span className="font-semibold text-cream">Lv {lvl.level}</span><span className="num">{lvl.into}/{lvl.span} XP</span></div>
              <Meter value={lvl.progress} className="mt-1" height="h-2" />
            </div>
            <div className="w-32">
              <div className="flex justify-between text-[11px] text-muted"><span>Month</span><span className="num text-cream">{s.turn}/{s.turnsTotal}</span></div>
              <Meter value={s.turn / s.turnsTotal} className="mt-1" height="h-2" bar="bg-gradient-to-r from-rust to-amber" />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-right">
              <p className="text-[10px] uppercase tracking-wider text-faint">Cash</p>
              <p className={`num font-semibold ${m.cash < m.burn ? "text-bad" : "text-good"}`}>{money(m.cash)}</p>
            </div>
            {view.team.rank && (
              <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase tracking-wider text-faint">Rank</p>
                <p className="num font-semibold text-amber">#{view.team.rank}<span className="text-faint">/{view.game.teamCount}</span></p>
              </div>
            )}
            <button onClick={signOut} className="text-xs text-faint hover:text-cream lg:hidden">Sign out</button>
          </div>
          {/* tabs (mobile) */}
          <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto lg:hidden">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-amber text-ink" : "bg-white/5 text-muted"}`}>
                <span aria-hidden="true">{t.icon}</span>{t.label}{dot(t.id) && " •"}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6">
          <div className="mb-4 space-y-2">
            {view.game.status === "lobby" && <Banner tone="warn">⏳ The organizers haven&apos;t started the game yet. Explore your HQ; missions unlock when the game begins.</Banner>}
            {view.game.status === "paused" && <Banner tone="warn">⏸ The game is paused by the organizers. Your company is safe; play resumes shortly.</Banner>}
            {view.game.status === "ended" && <Banner tone="neutral">🏁 Game over! Final score <b>{view.breakdown.total.toFixed(1)}</b>{view.team.rank ? <>, rank <b>#{view.team.rank}</b></> : null}.</Banner>}
            {s.finished && view.game.status !== "ended" && <Banner tone="good">🏁 All {s.turnsTotal} months played. Final score <b>{view.breakdown.total.toFixed(1)}</b>, rank #{view.team.rank}. Results lock when the organizers end the game.</Banner>}
            {m.runway < 2 && !s.finished && <Banner tone="bad">🚨 Low fuel: under 2 months of runway. Cut costs, take a consulting sprint, or raise money.</Banner>}
            {actionError && <ErrorNote>{actionError}</ErrorNote>}
          </div>

          {s.awaitingTrack && (
            <section className="game-card mx-auto max-w-2xl p-8 text-center">
              <p className="anim-bob text-6xl" aria-hidden="true">🗂️</p>
              <h2 className="mt-4 font-serif text-3xl text-cream">Your problem set is on its way</h2>
              <p className="mt-2 text-muted">The organizers assign each team one of {view.game.trackCount} problem sets. This page updates by itself as soon as yours is assigned.</p>
            </section>
          )}
          {shown === "HQ" && <HQ view={view} busy={busy} onTab={setTab} onPitch={() => act({ type: "pitch" })}
            onAccept={(offerId) => act({ type: "accept", offerId }, "Term sheet signed. Cash is in the bank!")}
            onDecline={() => act({ type: "decline" }, "Offers declined.")} />}
          {shown === "Missions" && <TaskBoard view={view} busy={busy} onRun={(taskId, crew) => act({ type: "task", taskId, crew })} onHire={hire} />}
          {shown === "Crew" && <TeamPanel view={view} skills={skills} busy={busy} onHire={hire} onFire={(employeeId) => act({ type: "fire", employeeId }, "Employee let go.")} />}
          {shown === "Analytics" && <Analytics view={view} />}
          {shown === "Score" && <ScorePanel view={view} />}
          {shown === "Funding" && (
            <section className="game-card p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl text-cream">
                <span aria-hidden="true">{TABS.find((t) => t.id === tab)?.icon}</span>{tab}
              </h2>
              {shown === "Funding" && <FundingPanel view={view} busy={busy}
                onPitch={() => act({ type: "pitch" })}
                onAccept={(offerId) => act({ type: "accept", offerId }, "Term sheet signed. Cash is in the bank!")}
                onDecline={() => act({ type: "decline" }, "Offers declined.")}
                onSell={(pct) => act({ type: "sell", pct }, "💎 Shares sold. Cash is in the bank!")} />}
            </section>
          )}
        </main>
      </div>

      <ResultModal outcome={outcome} customerLabel={view.track.customerLabel} rounds={view.rounds} onClose={() => setOutcome(null)} />
      <Confetti fire={confetti} />
      {celebrations[0] && (
        <div key={celebrations[0].id} role="status" className="anim-pop fixed left-1/2 top-24 z-[55] flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-amber/60 bg-gradient-to-b from-[#3b1f4d] to-[#1d1029] px-6 py-4 shadow-[0_20px_60px_-15px_rgba(242,166,90,0.6)]">
          <span className="text-4xl" aria-hidden="true">{celebrations[0].icon}</span>
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-amber">{celebrations[0].title}</span>
            <span className="block font-serif text-xl text-cream">{celebrations[0].text}</span>
          </span>
        </div>
      )}
      {toast && <div role="status" className="anim-pop fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-good/40 bg-[#1d1029] px-5 py-2.5 text-sm text-good shadow-xl">{toast}</div>}
      {busy && <div className="fixed right-5 top-20 z-50 rounded-full border border-amber/40 bg-[#1d1029] px-4 py-2 text-xs text-amber">🎲 Rolling…</div>}
    </div>
  );
}

function Banner({ tone, children }: { tone: "good" | "bad" | "warn" | "neutral"; children: React.ReactNode }) {
  const cls = { good: "border-good/35 bg-good/8 text-good", bad: "border-bad/40 bg-bad/10 text-bad", warn: "border-warn/40 bg-warn/10 text-warn", neutral: "border-line-strong bg-white/5 text-cream" }[tone];
  return <div className={`rounded-xl border px-4 py-2.5 text-sm ${cls}`}>{children}</div>;
}
