"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "../Logo";
import { Modal } from "../ui";
import { Scene } from "./Scene";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Hero({ facts }: { facts: HeroFacts }) {
  const [menu, setMenu] = useState(false);
  const [trailer, setTrailer] = useState(false);
  return (
    <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-[linear-gradient(#2c1a3a,#6a2d4e)]">
      <Scene />
      {/* legibility scrim behind the headline */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_28%_38%,rgba(20,10,20,0.55),transparent_70%)]" />

      <header className="absolute inset-x-0 top-0 z-20 border-b border-[rgba(246,231,207,0.18)] bg-[rgba(22,12,18,0.55)] backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <ul className="hidden items-center gap-8 text-[15px] text-cream/90 md:flex">
            {NAV.map((n) => <li key={n.label}><Link href={n.href} className="transition hover:text-amber">{n.label}</Link></li>)}
          </ul>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/join" className="rounded-lg bg-cream px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white">Enter Simulation →</Link>
          </div>
          <button className="rounded-md border border-line-strong px-3 py-1.5 text-sm md:hidden" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Menu">
            {menu ? "Close" : "Menu"}
          </button>
        </nav>
        {menu && (
          <div className="border-t border-line px-4 pb-4 md:hidden">
            <ul className="flex flex-col gap-1 py-2">
              {NAV.map((n) => <li key={n.label}><Link href={n.href} onClick={() => setMenu(false)} className="block rounded px-2 py-2 hover:bg-white/5">{n.label}</Link></li>)}
            </ul>
            <div className="flex gap-2">
              <Link href="/join" className="flex-1 rounded-lg bg-cream px-3 py-2 text-center text-sm font-semibold text-ink">Enter →</Link>
            </div>
          </div>
        )}
      </header>

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-start px-4 pt-[13svh] sm:px-6 sm:pt-[22svh] md:pt-[17svh] lg:pl-[8%]">
        <h1 className="anim-rise font-serif text-[clamp(2.8rem,7.4vw,6.4rem)] leading-[0.95] text-cream [text-shadow:0_4px_30px_rgba(0,0,0,0.45)]">
          Silicon Valley:
        </h1>
        <div className="anim-rise relative -mt-1 w-fit [animation-delay:150ms]">
          <span className="block -rotate-3 font-script text-[clamp(2.4rem,6.6vw,5.6rem)] leading-tight text-rust [text-shadow:0_3px_20px_rgba(0,0,0,0.35)]">
            Unicorn Simulator
          </span>
          <svg viewBox="0 0 640 40" className="absolute -bottom-3 left-[6%] w-[92%]" aria-hidden="true">
            <path d="M5 30 C 120 12, 260 8, 380 14 L 352 24 C 450 18, 560 14, 635 10" stroke="var(--rust)" strokeWidth="6" fill="none" strokeLinecap="round"
              strokeDasharray="900" style={{ animation: "underline-draw 1.6s 0.6s cubic-bezier(0.6,0,0.2,1) both" }} />
          </svg>
        </div>
        <p className="anim-rise mt-10 text-[clamp(1.2rem,2.2vw,1.85rem)] font-semibold text-cream [animation-delay:300ms] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">
          A startup simulation game.
        </p>
        <p className="anim-rise mt-2 max-w-lg text-[clamp(1rem,1.5vw,1.25rem)] leading-relaxed text-cream/85 [animation-delay:400ms] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">
          Build a company. Hire a team. Make decisions.<br className="hidden sm:block" /> Raise funding. And race to become a unicorn.
        </p>
        <div className="anim-rise mt-8 flex flex-wrap gap-4 [animation-delay:550ms]">
          <Link href="/join" className="rounded-lg bg-cream px-6 py-3 font-serif text-lg text-ink shadow-[0_10px_30px_-10px_rgba(246,231,207,0.7)] transition hover:-translate-y-0.5 hover:bg-white">
            Enter the Simulation →
          </Link>
          <button onClick={() => setTrailer(true)} className="inline-flex items-center gap-3 rounded-lg border border-cream/80 bg-black/10 px-6 py-3 text-lg text-cream backdrop-blur-sm transition hover:bg-cream/10">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" /></svg>
            Watch Trailer
          </button>
        </div>
      </div>

      <Trailer open={trailer} onClose={() => setTrailer(false)} facts={facts} />
    </section>
  );
}

/** Live game facts for the trailer, read from the admin settings. */
export interface HeroFacts { startingCash: number; sets: number; turns: number; roles: string[] }

const frames = (f: HeroFacts) => [
  { cmd: `found_company(cash=${f.startingCash})`, title: `Start with $${f.startingCash.toLocaleString()}`, text: `Every team gets the same budget, one of ${f.sets} real-world problem sets, and ${f.turns} months to play.` },
  { cmd: "hire(crew)", title: "Hire your team", text: `${f.roles.join(", ")}. Every hire adds capability, and every salary burns cash.` },
  { cmd: "choose_path()", title: "Pick your moves", text: "Each month, choose a mission and the crew to run it. Your choices open different missions later on." },
  { cmd: "resolve() → partial_success", title: "Live with the outcome", text: "Profitable wins, strategic unlocks, partial results, failures, and surprise market events all change your path." },
  { cmd: "pitch(investors)", title: "Raise venture capital", text: "Hit milestones, compare term sheets, and trade ownership for growth capital, with investor expectations attached." },
  { cmd: "leaderboard.rank(1)", title: "Become the unicorn", text: "Valuation, unit economics, traction, execution and resilience combine into one live score. Highest score wins." },
];

function Trailer({ open, onClose, facts }: { open: boolean; onClose: () => void; facts: HeroFacts }) {
  const FRAMES = frames(facts);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!open) return;
    setI(0);
    const t = setInterval(() => setI((v) => (v + 1) % FRAMES.length), 3800);
    return () => clearInterval(t);
  }, [open, FRAMES.length]);
  const f = FRAMES[i];
  return (
    <Modal open={open} onClose={onClose} title="How the game plays" wide>
      <div className="overflow-hidden rounded-2xl border-[10px] border-[#cdb68a] bg-[#05140b] p-6 shadow-inner sm:p-10" style={{ animation: "crt-flicker 0.2s infinite" }}>
        <p key={`c${i}`} className="anim-float font-mono text-2xl text-crt">&gt; {f.cmd}<span style={{ animation: "blink 1s steps(1) infinite" }}>█</span></p>
        <h4 key={`t${i}`} className="anim-float mt-6 font-serif text-3xl text-[#c8f7cf] sm:text-4xl">{f.title}</h4>
        <p key={`p${i}`} className="anim-float mt-3 max-w-xl text-base leading-relaxed text-[#9fd8a8]">{f.text}</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {FRAMES.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`Scene ${k + 1}`} className={`h-1.5 flex-1 rounded-full transition ${k === i ? "bg-amber" : k < i ? "bg-amber/40" : "bg-white/10"}`} />
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Link href="/join" className="rounded-lg bg-cream px-5 py-2.5 font-semibold text-ink hover:bg-white">Enter the Simulation →</Link>
      </div>
    </Modal>
  );
}
