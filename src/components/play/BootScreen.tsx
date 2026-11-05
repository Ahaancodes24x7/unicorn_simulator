"use client";

// Mandatory boot sequence shown before a team's simulation opens: a tiny runner game (jump for
// coins, hop over bugs) while the company "boots", with rotating motivational quotes. The start
// button unlocks only when the sequence completes. Coins are just for fun and never affect the game.
import { useCallback, useEffect, useRef, useState } from "react";
import { PixelUnicorn } from "../landing/PixelUnicorn";

import { Icon } from "@/components/Icon";
const BOOT_MS = 8000;
const STAGES = [
  "Incorporating your company",
  "Wiring up the bank account",
  "Recruiting the talent pool",
  "Calibrating market demand",
  "Waking up the investors",
  "Simulation ready",
];

const QUOTES: { q: string; by: string }[] = [
  { q: "The best way to predict the future is to invent it.", by: "Alan Kay" },
  { q: "Make something people want.", by: "Paul Graham" },
  { q: "If you are not embarrassed by the first version of your product, you've launched too late.", by: "Reid Hoffman" },
  { q: "Stay hungry. Stay foolish.", by: "Whole Earth Catalog, via Steve Jobs" },
  { q: "It's not about ideas. It's about making ideas happen.", by: "Scott Belsky" },
  { q: "Ideas are easy. Implementation is hard.", by: "Guy Kawasaki" },
  { q: "Your most unhappy customers are your greatest source of learning.", by: "Bill Gates" },
  { q: "Fall in love with the problem, not the solution.", by: "Uri Levine" },
  { q: "Runway is oxygen. Spend it like you can count it.", by: "SV-1" },
  { q: "Every unicorn was once a spreadsheet with a typo.", by: "SV-1" },
  { q: "Hire slow, ship fast, listen always.", by: "SV-1" },
];

// Game geometry, in fractions of the track width (x) and pixels (y).
const UNICORN_X = 0.12;
const UNICORN_W = 0.09;
const SPEED = 0.32; // track widths per second
const GRAVITY = 2600;
const JUMP_V = 820;
const COIN_HEIGHT = 92;

interface Item { id: number; x: number; kind: "coin" | "bug"; hit: boolean }

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [quotes, setQuotes] = useState(QUOTES); // shuffled after mount so server and client HTML match
  const [qi, setQi] = useState(0);
  const [, setFrame] = useState(0);
  const [coins, setCoins] = useState(0);
  const [bugs, setBugs] = useState(0);
  const game = useRef({ y: 0, vy: 0, items: [] as Item[], nextId: 0, spawnIn: 0.6 });
  const ready = progress >= 1;

  const jump = useCallback(() => {
    const g = game.current;
    if (g.y <= 0.5) g.vy = JUMP_V;
  }, []);

  // Boot progress runs on wall-clock time, independent of frame rate.
  useEffect(() => {
    setQuotes(shuffled(QUOTES));
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / BOOT_MS);
      setProgress(p);
      if (p >= 1) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, []);

  // Game loop.
  useEffect(() => {
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = game.current;
      g.vy -= GRAVITY * dt;
      g.y = Math.max(0, g.y + g.vy * dt);
      if (g.y === 0) g.vy = 0;
      g.spawnIn -= dt;
      if (g.spawnIn <= 0) {
        g.items.push({ id: g.nextId++, x: 1.05, kind: Math.random() < 0.62 ? "coin" : "bug", hit: false });
        g.spawnIn = 0.75 + Math.random() * 0.8;
      }
      for (const it of g.items) {
        it.x -= SPEED * dt;
        const overlaps = it.x < UNICORN_X + UNICORN_W && it.x + 0.03 > UNICORN_X;
        if (!it.hit && overlaps) {
          if (it.kind === "coin" && g.y > COIN_HEIGHT - 50) { it.hit = true; setCoins((c) => c + 1); }
          if (it.kind === "bug" && g.y < 26) { it.hit = true; setBugs((b) => b + 1); }
        }
      }
      g.items = g.items.filter((it) => it.x > -0.1 && !(it.hit && it.kind === "coin"));
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setQi((i) => (i + 1) % quotes.length), 3600);
    return () => clearInterval(t);
  }, [quotes.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
      if (e.code === "Enter" && ready) onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, onDone, ready]);

  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor(progress * (STAGES.length - 1)))];
  const quote = quotes[qi];
  const g = game.current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_30%,#2c1a3a,#120a14_70%)] p-4" role="dialog" aria-modal="true" aria-label="Starting the simulation">
      <div className="w-full max-w-3xl">
        <p className="text-center text-xs font-semibold tracking-[0.4em] text-amber">SV-1 BOOT SEQUENCE</p>
        <h1 className="mt-2 text-center font-serif text-3xl text-cream sm:text-4xl">Spinning up your startup</h1>

        {/* the runner */}
        <div
          className="relative mt-6 h-56 cursor-pointer select-none overflow-hidden rounded-2xl border-[8px] border-[#cdb68a] bg-[radial-gradient(ellipse_at_50%_45%,#163d22,#04120a)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => { e.preventDefault(); jump(); }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(transparent_0_2px,rgba(0,0,0,0.25)_2px_4px)]" />
          <div className="absolute left-3 top-2 font-mono text-lg text-crt">COINS {String(coins).padStart(2, "0")}</div>
          <div className="absolute right-3 top-2 font-mono text-lg text-[#ff8f7a]">BUGS {String(bugs).padStart(2, "0")}</div>
          <div className="absolute inset-x-0 bottom-10 border-t-2 border-dashed border-crt/40" />
          {g.items.map((it) => (
            <div key={it.id} className="absolute font-mono text-2xl" style={{ left: `${it.x * 100}%`, bottom: it.kind === "coin" ? 40 + COIN_HEIGHT : 40 }}>
              {it.kind === "coin"
                ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f7d774] bg-[#e0b23a] text-sm font-bold text-[#5a3a00]">$</span>
                : <span className={`inline-block h-6 w-7 rounded-sm ${it.hit ? "bg-[#ff8f7a]/40" : "bg-[#ff5f4a]"} [clip-path:polygon(15%_0,85%_0,100%_40%,85%_100%,15%_100%,0_40%)]`} title="bug" />}
            </div>
          ))}
          <svg viewBox="0 0 150 114" className="absolute h-[76px] w-[100px] overflow-visible" style={{ left: `${UNICORN_X * 100}%`, bottom: 40 + g.y }} aria-hidden="true">
            <PixelUnicorn x={0} y={0} px={6} />
          </svg>
          <p className="absolute inset-x-0 bottom-2 text-center font-mono text-sm text-crt/70">TAP OR PRESS SPACE TO JUMP · GRAB COINS · DODGE BUGS</p>
        </div>

        {/* progress */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between font-mono text-crt">
            <span>&gt; {stage}{!ready && <span style={{ animation: "blink 1s steps(1) infinite" }}>_</span>}</span>
            <span className="num">{Math.round(progress * 100)}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-rust via-amber to-crt" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>

        {/* quote */}
        <figure key={qi} className="anim-float mx-auto mt-8 min-h-28 max-w-xl text-center">
          <blockquote className="font-serif text-xl leading-snug text-cream sm:text-2xl">“{quote.q}”</blockquote>
          <figcaption className="mt-2 text-sm text-muted">— {quote.by}</figcaption>
        </figure>

        <div className="mt-4 flex justify-center">
          <button
            onClick={onDone}
            disabled={!ready}
            className="rounded-lg bg-cream px-8 py-3 font-serif text-lg text-ink shadow-[0_10px_30px_-10px_rgba(246,231,207,0.7)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ready ? <>Start the simulation <Icon name="play" className="ml-1" /></> : "Booting…"}
          </button>
        </div>
        {ready && <p className="mt-2 text-center text-xs text-faint">or press Enter{coins > 0 ? ` · ${coins} coin${coins === 1 ? "" : "s"} collected. Nice reflexes!` : ""}</p>}
      </div>
    </div>
  );
}
