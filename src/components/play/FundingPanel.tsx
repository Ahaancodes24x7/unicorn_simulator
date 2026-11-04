"use client";

import { useState } from "react";
import type { TeamView } from "@/lib/game";
import { Donut } from "../charts";
import { money, pct } from "../format";
import { Badge, Button, Modal, Term } from "../ui";
import { TERMS } from "./terms";

const INVESTOR_COLORS = ["#e2553b", "#f2a65a", "#7ee08a", "#7aa7ff", "#c58bff", "#f6c56b"];

export function FundingPanel({ view, busy, onPitch, onAccept, onDecline, onSell }: {
  view: TeamView; busy: boolean; onPitch: () => void; onAccept: (offerId: string) => void; onDecline: () => void; onSell: (pct: number) => void;
}) {
  const [confirmPitch, setConfirmPitch] = useState(false);
  const [confirmOffer, setConfirmOffer] = useState<string | null>(null);
  const s = view.state;
  const next = view.funding;
  const active = view.game.status === "running";
  const raised = new Set(s.rounds.map((r) => r.roundId));
  const offer = s.offers.find((o) => o.id === confirmOffer);

  // Cap table: replay rounds and angel sales in order; each new issue dilutes everyone before it.
  const issues = [
    ...s.rounds.map((r) => ({ turn: r.turn, label: r.investor, sold: r.ownershipSold })),
    ...(s.equitySales ?? []).map((e) => ({ turn: e.turn, label: "Angel investors", sold: e.pct })),
  ].sort((a, b) => a.turn - b.turn);
  const holders = new Map<string, number>([["Founders & team", 1]]);
  for (const st of issues) {
    for (const [k, v] of holders) holders.set(k, v * (1 - st.sold));
    holders.set(st.label, (holders.get(st.label) ?? 0) + st.sold);
  }
  const parts = [...holders].map(([label, value], i) => ({ label, value, color: i === 0 ? "#f6e7cf" : INVESTOR_COLORS[(i - 1) % INVESTOR_COLORS.length] }));

  return (
    <div className="space-y-6">
      <EquitySale view={view} busy={busy} active={active && !s.finished} onSell={onSell} />
      {/* round ladder */}
      <ol className="flex flex-wrap gap-2">
        <li><Badge tone="good">✓ Bootstrapping</Badge></li>
        {view.rounds.map((r) => (
          <li key={r.id}>
            <Badge tone={raised.has(r.id) ? "good" : next?.round.id === r.id ? (next.eligible ? "accent" : "warn") : "neutral"}>
              {raised.has(r.id) ? "✓ " : next?.round.id === r.id ? "→ " : ""}{r.name}
            </Badge>
          </li>
        ))}
      </ol>

      {s.offers.length > 0 && (
        <div className="rounded-xl border border-amber/40 bg-amber/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif text-xl text-cream">Term sheets on the table</h3>
            <span className="text-xs text-warn">Offers expire when you take your next turn</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {s.offers.map((o) => (
              <article key={o.id} className="flex flex-col rounded-xl border border-line bg-panel-solid/80 p-4">
                <h4 className="font-medium text-cream">{o.investor}</h4>
                <p className="num mt-1 font-serif text-3xl text-amber">{money(o.amount)}</p>
                <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
                  <dt className="text-faint"><Term label="Pre-money" tip={TERMS.preMoney} /></dt><dd className="num text-right text-cream">{money(o.preMoney)}</dd>
                  <dt className="text-faint"><Term label="Post-money" tip={TERMS.postMoney} /></dt><dd className="num text-right text-cream">{money(o.postMoney)}</dd>
                  <dt className="text-faint"><Term label="Ownership sold" tip={TERMS.dilution} /></dt><dd className="num text-right text-cream">{pct(o.ownershipSold, 1)}</dd>
                  <dt className="text-faint">You keep</dt><dd className="num text-right text-cream">{pct(s.ownership * (1 - o.ownershipSold), 1)}</dd>
                </dl>
                <p className="mt-3 flex-1 text-xs text-muted">{o.terms}</p>
                {o.expectation && <p className="mt-2 text-xs text-warn">Target: {o.expectation.customers} {view.track.customerLabel} by turn {o.expectation.dueTurn}, or −{o.expectation.penaltyReputation} reputation.</p>}
                <p className="mt-1 text-xs text-faint">{o.nextMilestone}</p>
                <Button className="mt-3" disabled={busy} onClick={() => setConfirmOffer(o.id)}>Accept</Button>
              </article>
            ))}
          </div>
          <div className="mt-3 text-right"><Button variant="ghost" disabled={busy} onClick={onDecline}>Decline all</Button></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold tracking-[0.2em] text-muted">{next ? `NEXT ROUND · ${next.round.name.toUpperCase()}` : "ALL ROUNDS RAISED"}</h3>
          {next ? (
            <>
              <ul className="space-y-1.5">
                {next.checks.map((c) => (
                  <li key={c.label} className={`flex items-center gap-2 text-sm ${c.met ? "text-good" : "text-muted"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${c.met ? "border-good bg-good/15" : "border-line-strong"}`}>{c.met ? "✓" : ""}</span>
                    {c.label}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">
                Typical pre-money {money(next.round.preMoneyRange[0])}–{money(next.round.preMoneyRange[1])}, selling {pct(next.round.dilutionRange[0])}–{pct(next.round.dilutionRange[1])}.
                Pitching uses a turn; a strong CEO, finance lead and reputation get better offers.
              </p>
              <Button className="mt-4" disabled={!active || s.finished || busy || !next.eligible} onClick={() => setConfirmPitch(true)}>
                {next.eligible ? `Pitch investors for ${next.round.name} →` : "Not yet eligible"}
              </Button>
            </>
          ) : <p className="text-sm text-muted">You&apos;ve raised every round on offer. Focus on growth.</p>}

          {s.obligations.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold tracking-[0.2em] text-muted">INVESTOR EXPECTATIONS</h4>
              <ul className="space-y-1 text-sm">
                {s.obligations.map((o, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{o.investor}: {o.customers} {view.track.customerLabel} by turn {o.dueTurn}</span>
                    <Badge tone={o.status === "met" ? "good" : o.status === "missed" ? "bad" : "warn"}>{o.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold tracking-[0.2em] text-muted">CAP TABLE</h3>
          <Donut parts={parts} />
          {s.rounds.length > 0 && (
            <table className="mt-4 w-full text-xs">
              <thead className="text-left text-faint"><tr><th className="py-1 font-normal">Round</th><th className="font-normal">Raised</th><th className="font-normal">Post-money</th><th className="text-right font-normal">Sold</th></tr></thead>
              <tbody>
                {s.rounds.map((r) => (
                  <tr key={r.roundId} className="border-t border-line/60 text-muted">
                    <td className="py-1.5 text-cream">{view.rounds.find((x) => x.id === r.roundId)?.name}</td>
                    <td className="num">{money(r.amount)}</td><td className="num">{money(r.postMoney)}</td><td className="num text-right">{pct(r.ownershipSold, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={confirmPitch} onClose={() => setConfirmPitch(false)} title={`Pitch for ${next?.round.name}?`}>
        <p className="text-sm text-muted">Pitching takes this turn (payroll and revenue still post). Depending on your pitch roll you&apos;ll get up to three term sheets, or none.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmPitch(false)}>Cancel</Button>
          <Button disabled={busy} onClick={() => { onPitch(); setConfirmPitch(false); }}>Pitch →</Button>
        </div>
      </Modal>

      <Modal open={!!offer} onClose={() => setConfirmOffer(null)} title={`Accept ${offer?.investor ?? ""}?`}>
        {offer && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">You raise <b className="text-cream">{money(offer.amount)}</b> at a <b className="text-cream">{money(offer.preMoney)}</b> pre-money valuation and sell <b className="text-cream">{pct(offer.ownershipSold, 1)}</b> of the company.</p>
            <p className="text-muted">Founder ownership: {pct(s.ownership, 1)} → <b className="text-cream">{pct(s.ownership * (1 - offer.ownershipSold), 1)}</b></p>
            {offer.expectation && <p className="text-warn">You commit to {offer.expectation.customers} {view.track.customerLabel} by turn {offer.expectation.dueTurn}.</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmOffer(null)}>Cancel</Button>
              <Button disabled={busy} onClick={() => { onAccept(offer.id); setConfirmOffer(null); }}>Sign term sheet</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Quick cash: sell new shares to angel investors at a discount to today's valuation. */
function EquitySale({ view, busy, active, onSell }: { view: TeamView; busy: boolean; active: boolean; onSell: (pct: number) => void }) {
  const q = view.equity;
  const maxPct = Math.floor(q.maxPct * 100);
  const [pctSel, setPctSel] = useState(Math.min(5, Math.max(1, maxPct)));
  const [confirm, setConfirm] = useState(false);
  const p = Math.min(pctSel, maxPct) / 100;
  const amount = Math.round(q.valuation * (1 - q.rules.discount) * p);
  const after = view.state.ownership * (1 - p);
  const blocked = !active ? "Available while the game is running" : q.soldThisTurn ? "Already sold this month. Try again next month." : maxPct < 1 ? `Founders must keep at least ${pct(q.rules.minOwnership)}` : null;

  return (
    <section className="game-card game-card-hot p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="game-title">Quick cash</p>
          <h3 className="mt-1 font-serif text-2xl text-cream">💎 Sell equity to angels</h3>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Sell new shares at a {pct(q.rules.discount)} discount to today&apos;s valuation ({money(q.valuation)}). It doesn&apos;t use a turn, but every
            share you sell lowers your ownership, which counts toward your score. Up to {pct(q.rules.maxPct)} per month.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-faint">You own</p>
          <p className="num font-serif text-2xl text-cream">{pct(view.state.ownership, 1)}</p>
        </div>
      </div>
      {blocked ? <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-muted">{blocked}</p> : (
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="flex items-center justify-between text-sm text-muted" htmlFor="equity-pct"><span>Sell</span><span className="num font-semibold text-amber">{Math.min(pctSel, maxPct)}%</span></label>
            <input id="equity-pct" type="range" min={1} max={maxPct} step={1} value={Math.min(pctSel, maxPct)} onChange={(e) => setPctSel(Number(e.target.value))} className="mt-1 w-full accent-[var(--amber)]" />
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <p className="rounded-lg bg-good/10 px-3 py-2 text-good">+{money(amount)} cash</p>
              <p className="rounded-lg bg-bad/10 px-3 py-2 text-bad">Ownership {pct(view.state.ownership, 1)} → {pct(after, 1)}</p>
            </div>
          </div>
          <button disabled={busy || amount <= 0} onClick={() => setConfirm(true)} className="chunky-btn rounded-xl bg-gradient-to-b from-[#ffd27a] to-[#f2a03c] px-6 py-3 font-semibold text-ink disabled:opacity-40">Sell {Math.min(pctSel, maxPct)}%</button>
        </div>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Sell equity to angels?">
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-faint">You sell</dt><dd className="num text-right text-cream">{Math.min(pctSel, maxPct)}% of the company</dd>
            <dt className="text-faint">Cash in</dt><dd className="num text-right text-good">+{money(amount)}</dd>
            <dt className="text-faint">Founders&apos; ownership</dt><dd className="num text-right text-cream">{pct(view.state.ownership, 1)} → {pct(after, 1)}</dd>
          </dl>
          <p className="text-xs text-faint">This can&apos;t be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button className="chunky-btn" disabled={busy} onClick={() => { onSell(p); setConfirm(false); }}>💎 Sell shares</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
