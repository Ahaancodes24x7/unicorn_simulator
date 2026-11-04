"use client";

import type { TeamView } from "@/lib/game";
import { PixelUnicorn } from "../landing/PixelUnicorn";
import { money, num, pct, ratio, runway } from "../format";
import { Term } from "../ui";
import { Delta, Meter, Ring } from "./fx";
import { achievements, deltaSincePrevious, founderRank, health, missionXp, RANKS, unicornProgress } from "./gamify";
import { TERMS } from "./terms";

export type HqTab = "Missions" | "Crew" | "Funding";

const NEWS_ICON: Record<string, string> = {
  task: "🎯", event: "⚡", funding: "💼", hire: "🤝", fire: "👋", pitch: "🎤", score: "📊", obligation: "📋", admin: "🛠️",
};

export function HQ({ view, busy, onTab, onPitch, onAccept, onDecline }: {
  view: TeamView; busy: boolean; onTab: (t: HqTab) => void; onPitch: () => void; onAccept: (offerId: string) => void; onDecline: () => void;
}) {
  const m = view.metrics;
  const s = view.state;
  const rank = founderRank(m.valuation);
  const hp = health(m);
  const badges = achievements(s, m);
  const unlocked = badges.filter((b) => b.unlocked).length;
  const playable = view.game.status === "running" && !s.finished;

  const tiles = [
    { icon: "💵", label: "Cash", value: money(m.cash), delta: deltaSincePrevious(s, "cash", m.cash), fmt: (v: number) => money(v), tip: TERMS.cash },
    { icon: "🦄", label: "Valuation", value: money(m.valuation), delta: deltaSincePrevious(s, "valuation", m.valuation), fmt: (v: number) => money(v), tip: TERMS.valuation },
    { icon: "👥", label: view.track.customerLabel, value: num(m.customers), delta: deltaSincePrevious(s, "customers", m.customers), fmt: (v: number) => num(v), tip: TERMS.customers },
    { icon: "📈", label: "Revenue / turn", value: money(m.revenue), delta: deltaSincePrevious(s, "revenue", m.revenue), fmt: (v: number) => money(v), tip: TERMS.revenue },
  ];
  const small = [
    { icon: "⏳", label: "Runway", value: runway(m.runway), tip: TERMS.runway, bad: m.runway < 2 },
    { icon: "🔥", label: "Burn / turn", value: money(m.burn), tip: "Total cash going out each turn: payroll plus direct costs.", bad: false },
    { icon: "⚖️", label: "LTV : CAC", value: m.cac ? ratio(m.ltvCac) : "–", tip: `${TERMS.ltv} ${TERMS.cac}`, bad: !!m.cac && m.ltvCac < 1 },
    { icon: "⭐", label: "Reputation", value: `${Math.round(m.reputation)}`, tip: TERMS.reputation, bad: m.reputation < 35 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        {/* welcome hero */}
        <section className="game-card game-card-hot overflow-hidden p-6 sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,rgba(242,166,90,0.35),transparent_55%),radial-gradient(ellipse_at_70%_110%,rgba(226,85,59,0.35),transparent_60%)]" />
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-70" aria-hidden="true">
            <path d="M0 120 L0 80 L30 80 L30 60 L55 60 L55 75 L80 75 L80 40 L100 40 L100 70 L130 70 L130 55 L160 55 L160 85 L190 85 L190 50 L215 50 L215 30 L235 30 L235 65 L265 65 L265 78 L300 78 L300 45 L325 45 L325 70 L350 70 L350 58 L375 58 L375 82 L400 82 L400 120 Z" fill="#1a0e22" />
          </svg>
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="game-title">Month {s.turn} of {s.turnsTotal} · {view.track.sector}</p>
              <h2 className="mt-2 font-serif text-3xl text-cream sm:text-4xl">Welcome back, Founder!</h2>
              <p className="mt-1 text-muted">You&apos;re running <span className="text-cream">{view.track.company}</span>: “{view.track.tagline}”</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-black/30 px-3 py-1.5 text-sm">
                <span className="text-lg" aria-hidden="true">{rank.icon}</span>
                <span className="font-semibold text-amber">{rank.title}</span>
                {rank.next && <span className="text-faint">→ {rank.next.title} at {money(rank.next.min)}</span>}
              </div>
              <div className="mt-5 max-w-md">
                <div className="mb-1 flex justify-between text-xs text-muted"><span>Road to Unicorn</span><span className="num text-cream">{pct(unicornProgress(m.valuation))}</span></div>
                <Meter value={unicornProgress(m.valuation)} height="h-3" />
                <div className="mt-1 flex justify-between text-[10px] text-faint">{RANKS.map((r) => <span key={r.title} title={r.title}>{r.icon}</span>)}</div>
              </div>
              <button onClick={() => onTab("Missions")} className="chunky-btn mt-5 rounded-xl bg-gradient-to-b from-[#ffbe73] to-[#f08a3c] px-5 py-2.5 font-semibold text-ink">
                {playable ? "Start next mission ▶" : "View missions"}
              </button>
            </div>
            <div className="anim-bob mx-auto w-44 shrink-0 rounded-2xl border-[6px] border-[#cdb68a] bg-[radial-gradient(ellipse_at_50%_45%,#163d22,#04120a)] p-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] sm:w-52">
              <svg viewBox="0 0 160 120" className="w-full overflow-visible" aria-hidden="true"><PixelUnicorn x={8} y={4} px={5.6} /></svg>
              <p className="mt-1 text-center font-mono text-sm text-crt">&gt; build_unicorn();</p>
            </div>
          </div>
        </section>

        {/* startup health */}
        <section className="game-card flex flex-col items-center p-5 text-center">
          <p className="game-title self-start">Startup health</p>
          <div className="mt-3"><Ring value={hp.value / 100} color={hp.tone} size={132}>
            <span className="num font-serif text-4xl text-cream">{hp.value}%</span>
            <span className="text-xs font-semibold" style={{ color: hp.tone }}>{hp.label}</span>
          </Ring></div>
          <dl className="mt-4 w-full space-y-2 text-left text-xs">
            {[
              ["Runway", m.netBurn <= 0 ? 1 : Math.min(1, m.runway / 6), runway(m.runway)],
              ["Reputation", m.reputation / 100, Math.round(m.reputation)],
              ["Low risk", 1 - m.risk / 100, Math.round(100 - m.risk)],
            ].map(([k, v, label]) => (
              <div key={k as string}>
                <div className="flex justify-between text-muted"><dt>{k}</dt><dd className="num text-cream">{label}</dd></div>
                <Meter value={v as number} height="h-1.5" bar="bg-gradient-to-r from-rust to-crt" />
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key metrics">
        {tiles.map((t) => (
          <div key={t.label} className="game-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 text-2xl ring-1 ring-white/10" aria-hidden="true">{t.icon}</span>
              <div className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-wider text-faint"><Term label={t.label} tip={t.tip} /></p>
                <p className="num truncate font-serif text-2xl text-cream">{t.value}</p>
              </div>
            </div>
            <div className="mt-2"><Delta value={t.delta} fmt={t.fmt} /></div>
          </div>
        ))}
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {small.map((t) => (
          <div key={t.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
            <span aria-hidden="true">{t.icon}</span>
            <span className="flex-1 text-xs text-muted"><Term label={t.label} tip={t.tip} /></span>
            <span className={`num font-semibold ${t.bad ? "text-bad" : "text-cream"}`}>{t.value}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* news */}
        <section className="game-card p-5">
          <p className="game-title">Latest news</p>
          {view.events.length === 0 ? <p className="mt-3 text-sm text-faint">Quiet so far. Your first move makes the headlines.</p> : (
            <ol className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {view.events.slice(0, 12).map((e) => (
                <li key={e.id} className="flex gap-3 rounded-lg bg-black/20 p-2.5">
                  <span className="text-lg" aria-hidden="true">{NEWS_ICON[e.type] ?? "📰"}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-cream">{e.title}</span>
                    <span className="block text-[11px] text-faint">Month {e.turn}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* next decision */}
        <NextDecision view={view} busy={busy} playable={playable} onTab={onTab} onPitch={onPitch} onAccept={onAccept} onDecline={onDecline} />

        {/* goal + quest */}
        <section className="game-card p-5">
          <p className="game-title">Your goal</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="anim-bob text-5xl" aria-hidden="true">🏆</span>
            <div>
              <p className="font-serif text-xl text-cream">Become a Unicorn</p>
              <p className="text-xs text-muted">Reach a $1B valuation, or finish with the top score.</p>
            </div>
          </div>
          <Meter value={unicornProgress(m.valuation)} className="mt-4" />
          {view.funding && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Quest: raise {view.funding.round.name}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {view.funding.checks.map((c) => (
                  <li key={c.label} className={c.met ? "text-good" : "text-muted"}>{c.met ? "✅" : "⬜"} {c.label}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* achievements */}
      <section className="game-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="game-title">Achievements</p>
          <span className="text-sm text-muted"><b className="text-amber">{unlocked}</b> / {badges.length} unlocked</span>
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {badges.map((b) => (
            <li key={b.id} title={`${b.title}: ${b.desc}`}
              className={`flex flex-col items-center rounded-xl border p-2.5 text-center transition ${b.unlocked ? "shine border-amber/50 bg-gradient-to-b from-amber/20 to-transparent" : "border-white/10 bg-black/20 opacity-45 grayscale"}`}>
              <span className="text-2xl" aria-hidden="true">{b.icon}</span>
              <span className="mt-1 text-[11px] font-semibold leading-tight text-cream">{b.title}</span>
              <span className="mt-0.5 hidden text-[10px] leading-tight text-faint sm:block">{b.desc}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NextDecision({ view, busy, playable, onTab, onPitch, onAccept, onDecline }: {
  view: TeamView; busy: boolean; playable: boolean; onTab: (t: HqTab) => void; onPitch: () => void; onAccept: (id: string) => void; onDecline: () => void;
}) {
  const s = view.state;
  const best = [...s.offers].sort((a, b) => b.amount - a.amount)[0];
  const mission = view.board.find((b) => b.available && b.task.category !== "recovery") ?? view.board.find((b) => b.available);
  const needsHire = view.board.find((b) => !b.available && b.reasons.length > 0 && b.reasons.every((r) => r.startsWith("Hire ")));

  let body: React.ReactNode;
  if (!playable) {
    body = <p className="text-sm text-muted">{s.finished ? "All turns used. Watch the leaderboard!" : view.game.status === "lobby" ? "The game hasn't started yet. Plan your first hires!" : "The game is paused."}</p>;
  } else if (best) {
    body = (
      <>
        <p className="text-sm text-muted"><span className="text-cream">{best.investor}</span> offers</p>
        <p className="num font-serif text-3xl text-good">{money(best.amount)}</p>
        <p className="text-sm text-muted">for {pct(best.ownershipSold)} of your company · {best.terms}</p>
        <div className="mt-4 flex gap-2">
          <button disabled={busy} onClick={() => onAccept(best.id)} className="chunky-btn flex-1 rounded-xl bg-gradient-to-b from-[#a3f0ad] to-[#4fc766] px-4 py-2 font-semibold text-ink disabled:opacity-50">Accept</button>
          <button disabled={busy} onClick={onDecline} className="flex-1 rounded-xl border border-white/20 px-4 py-2 text-cream hover:bg-white/5 disabled:opacity-50">Decline all</button>
        </div>
        {s.offers.length > 1 && <button onClick={() => onTab("Funding")} className="mt-2 text-xs text-muted underline">Compare all {s.offers.length} offers</button>}
      </>
    );
  } else if (view.funding?.eligible) {
    body = (
      <>
        <p className="font-serif text-2xl text-cream">Pitch for {view.funding.round.name}</p>
        <p className="mt-1 text-sm text-muted">You meet every requirement. Investors are listening. Pitching uses a turn.</p>
        <button disabled={busy} onClick={onPitch} className="chunky-btn mt-4 w-full rounded-xl bg-gradient-to-b from-[#ffbe73] to-[#f08a3c] px-4 py-2.5 font-semibold text-ink disabled:opacity-50">🎤 Pitch investors</button>
      </>
    );
  } else if (mission) {
    body = (
      <>
        <p className="font-serif text-2xl text-cream">{mission.task.title}</p>
        <p className="mt-1 text-sm text-muted">{mission.task.objective}</p>
        <p className="mt-2 text-sm"><span className="text-amber">{mission.task.cost ? money(mission.task.cost) : "Free"}</span> · <span className="text-crt">+{missionXp(mission.task.kind)} XP</span></p>
        <button onClick={() => onTab("Missions")} className="chunky-btn mt-4 w-full rounded-xl bg-gradient-to-b from-[#ffbe73] to-[#f08a3c] px-4 py-2.5 font-semibold text-ink">Pick your crew ▶</button>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-sm text-muted">{needsHire ? `Next up: hire for “${needsHire.task.title}”.` : "No mission is ready yet."}</p>
        <button onClick={() => onTab(needsHire ? "Missions" : "Crew")} className="chunky-btn mt-4 w-full rounded-xl bg-gradient-to-b from-[#ffbe73] to-[#f08a3c] px-4 py-2.5 font-semibold text-ink">{needsHire ? "Hire the crew ▶" : "Open crew"}</button>
      </>
    );
  }

  return (
    <section className={`game-card p-5 ${best || view.funding?.eligible ? "game-card-hot anim-glow" : ""}`}>
      <p className="game-title">Next decision</p>
      <div className="mt-3">{body}</div>
    </section>
  );
}
