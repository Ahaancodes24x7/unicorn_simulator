"use client";

// Animated "Silicon Valley at dusk" hero scene, recreated in SVG from the landing mockup.
// Everything moves: the sky cycles sunset → dusk, clouds drift, the sun sinks and glows, stars and
// office windows twinkle, the tower beacons blink, the plant sways, the coffee steams, layers
// parallax with the pointer, and the CRT runs a galloping pixel unicorn with a live terminal.
//
// Performance: each depth is its own <svg> inside a GPU-composited <div>, so parallax and the
// day/night fade never repaint the scene; there are no live SVG filters (grain and vignette are
// static CSS layers); and the ticking terminal/checklist re-render only their own text nodes.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PixelUnicorn } from "./PixelUnicorn";

import { Icon } from "@/components/Icon";
const W = 1600;
const H = 900;
const CYCLE = 48; // seconds for a full sunset → dusk → sunset loop

// Deterministic pseudo-random so server and client render the same scene.
const rand = (i: number) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const HILL: [number, number][] = [[620, 770], [800, 640], [1000, 505], [1200, 395], [1320, 345], [1460, 292], [1600, 306]];
function hillY(x: number): number {
  for (let i = 0; i < HILL.length - 1; i++) {
    const [x0, y0] = HILL[i];
    const [x1, y1] = HILL[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 770;
}
function smoothPath(pts: [number, number][]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const duskFade: CSSProperties = { animation: `sky-shift ${CYCLE}s ease-in-out infinite`, willChange: "opacity" };

function Layer({ depth = 0, fit, style, children }: { depth?: number; fit: string; style?: CSSProperties; children: ReactNode }) {
  const parallax: CSSProperties = depth
    ? {
        transform: `translate3d(calc(var(--mx, 0) * ${-depth}px), calc(var(--my, 0) * ${-depth / 2}px), 0)`,
        transition: "transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1)",
        willChange: "transform",
      }
    : {};
  return (
    <div className="absolute inset-0" style={{ ...parallax, ...style }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={fit} className="h-full w-full">{children}</svg>
    </div>
  );
}

// Stars and lights twinkle in a few shared groups rather than one animation per dot.
const PHASES = [0, 1, 2];
const twinkleGroup = (k: number, base: number): CSSProperties => ({ animation: `twinkle ${base + k * 1.3}s ${k * 0.9}s ease-in-out infinite` });

// Film grain, rendered once by the browser as a tiled image.
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.8  0 0 0 0.6 0"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>')}")`;

const STARS = Array.from({ length: 70 }, (_, i) => ({ x: rand(i) * W, y: rand(i + 300) * 330, r: 0.6 + rand(i + 600) * 1.4, d: rand(i + 900) * 5 }));
const BUILDINGS = Array.from({ length: 15 }, (_, i) => {
  const w = 55 + rand(i + 40) * 70;
  return { x: 330 + i * 64 + rand(i + 20) * 20, w, h: 45 + rand(i + 60) * 120, tone: rand(i + 80) };
});
const FLICKER_WINDOWS = BUILDINGS.flatMap((b, i) => {
  const top = 765 - b.h, cols = Math.floor((b.w - 10) / 12), rows = Math.floor((b.h - 14) / 14);
  return Array.from({ length: rows * cols }, (_, k) => ({ k, seed: i * 97 + k }))
    .filter(({ seed }) => rand(seed) >= 0.42 && rand(seed + 7) < 0.08)
    .map(({ k, seed }) => ({ x: b.x + 7 + (k % cols) * 12, y: top + 10 + Math.floor(k / cols) * 14, o: 0.65 + rand(seed + 3) * 0.35 }));
});
const PINES = Array.from({ length: 22 }, (_, i) => ({ x: 240 + rand(i + 120) * 1250, base: 700 + rand(i + 140) * 70, h: 70 + rand(i + 160) * 140 }))
  .sort((a, b) => a.base - b.base);
const RIDGE_TREES = Array.from({ length: 60 }, (_, i) => {
  const x = 860 + (i / 59) * 740 + rand(i + 200) * 14;
  return { x, y: hillY(x) - 1 - rand(i + 240) * 4, r: 3 + rand(i + 220) * 5 };
});
const HILL_LIGHTS = Array.from({ length: 90 }, (_, i) => {
  const x = 760 + rand(i + 400) * 840;
  const top = hillY(x) + 30;
  return { x, y: top + rand(i + 450) * (720 - top), d: rand(i + 500) * 6 };
}).filter((l) => l.y < 730);

const COMMANDS = ["build_unicorn();", "hire(engineers=2);", "ship_mvp();", "raise_round('seed');", "scale_to_moon();"];
const NOTE_ITEMS = ["Product", "Team", "Funding", "Growth"];

function Terminal() {
  const text = useTerminal();
  return (
    <text x="1266" y="662" fill="#8df59a" fontSize="26" style={{ fontFamily: "var(--font-vt323)" }}>
      {"> "}{text}
      <tspan style={{ animation: "blink 1s steps(1) infinite" }}>█</tspan>
    </text>
  );
}

function Checklist() {
  const checked = useChecklist();
  return (
    <>
      {NOTE_ITEMS.map((item, i) => (
        <text key={item} x="1516" y={560 + i * 30} fill="#3a2c1c" fontSize="26" style={{ fontFamily: "var(--font-caveat)" }}>
          {item}{i < checked ? <Icon name="check" className="ml-1" /> : null}
        </text>
      ))}
    </>
  );
}

function useTerminal() {
  const [text, setText] = useState(COMMANDS[0]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cmd = 0, i = COMMANDS[0].length, pause = 30, deleting = true;
    const t = setInterval(() => {
      if (pause > 0) { pause--; return; }
      if (deleting) {
        i--;
        if (i <= 0) { deleting = false; cmd = (cmd + 1) % COMMANDS.length; }
      } else {
        i++;
        if (i >= COMMANDS[cmd].length) { deleting = true; pause = 28; }
      }
      setText(COMMANDS[cmd].slice(0, Math.max(0, i)));
    }, 70);
    return () => clearInterval(t);
  }, []);
  return text;
}

function useChecklist() {
  const [n, setN] = useState(4);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setN((v) => (v + 1) % 6), 1400);
    return () => clearInterval(t);
  }, []);
  return Math.min(n, 4);
}

export function Scene() {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(frame); };
  }, []);

  const hillPath = `${smoothPath(HILL)} L 1600 790 L 620 790 Z`;
  const fit = narrow ? "xMaxYMax slice" : "xMidYMax slice";

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden max-sm:top-[30%]" aria-hidden="true">
      {/* shared gradients/patterns, referenced by every layer below */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="sky-sunset" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2c1a3a" />
            <stop offset="0.35" stopColor="#6a2d4e" />
            <stop offset="0.58" stopColor="#c4504a" />
            <stop offset="0.72" stopColor="#ef8c4c" />
            <stop offset="0.84" stopColor="#f8c377" />
          </linearGradient>
          <linearGradient id="sky-dusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0d0a1f" />
            <stop offset="0.4" stopColor="#24183d" />
            <stop offset="0.65" stopColor="#5b2a52" />
            <stop offset="0.84" stopColor="#b5513f" />
          </linearGradient>
          <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff3cf" />
            <stop offset="0.35" stopColor="#ffd88a" />
            <stop offset="1" stopColor="#ffb057" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sun-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffbe6b" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ff8a4c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6e3a3a" />
            <stop offset="0.5" stopColor="#3f2430" />
            <stop offset="1" stopColor="#261722" />
          </linearGradient>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2a06a" stopOpacity="0" />
            <stop offset="1" stopColor="#f2a06a" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b3b22" />
            <stop offset="1" stopColor="#2a160d" />
          </linearGradient>
          <linearGradient id="beige" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#efdcb6" />
            <stop offset="1" stopColor="#bfa173" />
          </linearGradient>
          <radialGradient id="screen" cx="0.5" cy="0.45" r="0.7">
            <stop offset="0" stopColor="#163d22" />
            <stop offset="1" stopColor="#04120a" />
          </radialGradient>
          <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="2" fill="#000" opacity="0.28" />
          </pattern>
          {[["cloud-a", "#f4a07c"], ["cloud-b", "#f7b88e"], ["cloud-c", "#d9707a"]].map(([id, c]) => (
            <radialGradient key={id} id={id} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.35" stopColor={c} />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
          <clipPath id="screen-clip"><rect x="1247" y="480" width="266" height="218" rx="22" /></clipPath>
        </defs>
      </svg>

      {/* ---------- sky ---------- */}
      <Layer fit={fit}><rect width={W} height={H} fill="url(#sky-sunset)" /></Layer>
      <Layer fit={fit} style={duskFade}>
        <rect width={W} height={H} fill="url(#sky-dusk)" />
        {PHASES.map((k) => (
          <g key={k} style={twinkleGroup(k, 2.6)}>
            {STARS.filter((_, i) => i % 3 === k).map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff6e0" />)}
          </g>
        ))}
        <line x1="1250" y1="60" x2="1300" y2="40" stroke="#fff6e0" strokeWidth="2" strokeLinecap="round" style={{ animation: "shooting 11s 4s linear infinite" }} />
      </Layer>

      {/* ---------- sun ---------- */}
      <Layer depth={4} fit={fit}>
          <g style={{ animation: `sun-sink ${CYCLE}s ease-in-out infinite` }}>
            <circle cx="300" cy="580" r="190" fill="url(#sun-halo)" style={{ animation: "sun-glow 6s ease-in-out infinite", transformOrigin: "300px 580px" }} />
            <circle cx="300" cy="580" r="46" fill="url(#sun)" />
          </g>
      </Layer>

      {/* ---------- clouds (soft edges come from gradients, not a blur filter) ---------- */}
      <Layer depth={8} fit={fit}>
          {[{ y: 150, s: 1.3, dur: 140, delay: -30, o: 0.5 }, { y: 250, s: 0.9, dur: 110, delay: -80, o: 0.42 }, { y: 95, s: 0.7, dur: 170, delay: -120, o: 0.35 }, { y: 330, s: 1.1, dur: 125, delay: -10, o: 0.32 }].map((c, i) => (
            <g key={i} style={{ animation: `cloud-drift ${c.dur}s ${c.delay}s linear infinite` }}>
              <g transform={`translate(0 ${c.y}) scale(${c.s})`} opacity={c.o}>
                <ellipse cx="0" cy="0" rx="172" ry="30" fill="url(#cloud-a)" />
                <ellipse cx="70" cy="-12" rx="100" ry="28" fill="url(#cloud-b)" />
                <ellipse cx="-80" cy="6" rx="122" ry="24" fill="url(#cloud-c)" />
              </g>
            </g>
          ))}
      </Layer>

      {/* ---------- far range + haze ---------- */}
      <Layer depth={10} fit={fit}>
          <path d="M0 650 L120 605 L260 628 L420 585 L600 615 L760 572 L900 604 L1050 560 L1200 592 L1350 560 L1600 585 L1600 790 L0 790 Z" fill="#6b3450" opacity="0.75" />
          <path d="M0 690 L180 655 L340 672 L520 640 L700 666 L880 636 L1040 660 L1240 630 L1600 655 L1600 790 L0 790 Z" fill="#552a45" opacity="0.85" />
          <rect x="0" y="540" width={W} height="250" fill="url(#haze)" />
      </Layer>

      {/* ---------- the hill, the sign and the tower ---------- */}
      <Layer depth={16} fit={fit}>
          <path d={hillPath} fill="url(#hill)" />
          {RIDGE_TREES.map((t, i) => <circle key={i} cx={t.x} cy={t.y} r={t.r} fill="#1c1418" />)}
          {PHASES.map((k) => (
            <g key={k} style={twinkleGroup(k, 3.4)}>
              {HILL_LIGHTS.filter((_, i) => i % 3 === k).map((l, i) => <circle key={i} cx={l.x} cy={l.y} r="1.6" fill="#ffd27f" />)}
            </g>
          ))}
          <text x="1085" y="474" transform="rotate(-10 1085 474)" fill="#f3e4cf" fontSize="38" fontWeight="800" letterSpacing="5"
            style={{ fontFamily: "var(--font-inter)" }} opacity="0.92">SILICON VALLEY</text>
          {/* Radio tower */}
          <g stroke="#2a1a1f" strokeWidth="3" fill="none">
            <path d="M1398 296 L1416 150 M1446 296 L1428 150 M1404 250 L1440 250 M1408 205 L1436 205 M1412 170 L1432 170 M1404 250 L1436 205 M1440 250 L1408 205 M1408 205 L1432 170 M1436 205 L1412 170" />
            <path d="M1392 150 L1452 150 M1396 150 L1396 104 M1422 150 L1422 92 M1448 150 L1448 104 M1392 128 L1452 128" />
          </g>
          {[[1396, 102, 0], [1422, 90, 0.6], [1448, 102, 1.2]].map(([x, y, d], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#ff4b3a" style={{ animation: `beacon 2.4s ${d}s linear infinite` }} />
          ))}
      </Layer>

      {/* ---------- office park ---------- */}
      <Layer depth={22} fit={fit}>
          {BUILDINGS.map((b, i) => {
            const top = 765 - b.h;
            const cols = Math.floor((b.w - 10) / 12);
            const rows = Math.floor((b.h - 14) / 14);
            return (
              <g key={i}>
                <rect x={b.x} y={top} width={b.w} height={b.h} fill={b.tone > 0.5 ? "#4a3236" : "#3a2830"} />
                <rect x={b.x} y={top} width={b.w} height="4" fill="#f0a16a" opacity="0.5" />
                {Array.from({ length: rows * cols }, (_, k) => {
                  const r = Math.floor(k / cols), c = k % cols, seed = i * 97 + k;
                  if (rand(seed) < 0.42 || rand(seed + 7) < 0.08) return null;
                  return <rect key={k} x={b.x + 7 + c * 12} y={top + 10 + r * 14} width="7" height="7" fill="#ffcf7d" opacity={0.65 + rand(seed + 3) * 0.35} />;
                })}
              </g>
            );
          })}
          {PHASES.map((k) => (
            <g key={k} style={{ animation: `window-flicker ${5 + k * 2.2}s ${k * 1.7}s infinite` }}>
              {FLICKER_WINDOWS.filter((_, i) => i % 3 === k).map((w, i) => <rect key={i} x={w.x} y={w.y} width="7" height="7" fill="#ffcf7d" opacity={w.o} />)}
            </g>
          ))}
      </Layer>

      {/* ---------- pines ---------- */}
      <Layer depth={28} fit={fit}>
          {PINES.map((p, i) => (
            <g key={i} fill={i % 2 ? "#1d1a19" : "#231f1c"}>
              <rect x={p.x - 3} y={p.base - 14} width="6" height="14" />
              <path d={`M${p.x} ${p.base - p.h} L${p.x + p.h * 0.22} ${p.base - p.h * 0.55} L${p.x + p.h * 0.12} ${p.base - p.h * 0.55} L${p.x + p.h * 0.3} ${p.base - 12} L${p.x - p.h * 0.3} ${p.base - 12} L${p.x - p.h * 0.12} ${p.base - p.h * 0.55} L${p.x - p.h * 0.22} ${p.base - p.h * 0.55} Z`} />
            </g>
          ))}
      </Layer>

      {/* ---------- interior: window frame, sill, desk ---------- */}
      <Layer depth={40} fit={fit}>
          <rect x="0" y="0" width="34" height="760" fill="#160e12" />
          <rect x="176" y="0" width="22" height="760" fill="#1a1115" />
          {!narrow && <rect x="0" y="0" width={W} height="26" fill="#130b0f" />}
          <g opacity="0.85">
            {Array.from({ length: 16 }, (_, i) => <rect key={i} x="34" y={30 + i * 15} width="142" height="9" fill="#2a1b1c" />)}
          </g>
          <rect x="0" y="740" width={W} height="55" fill="#2b1913" />
          <rect x="0" y="740" width={W} height="5" fill="#a8603a" opacity="0.6" />
          <rect x="0" y="790" width={W} height="110" fill="url(#desk)" />

          {/* plant */}
          <g style={{ animation: "sway 7s ease-in-out infinite", transformOrigin: "70px 790px", transformBox: "view-box" }}>
            {[[-60, 0], [-35, 1], [-10, 2], [15, 3], [40, 4], [-80, 5], [65, 6]].map(([angle, k]) => (
              <g key={k} transform={`rotate(${angle} 70 790)`}>
                <path d={`M70 790 Q ${60 + k * 3} 640, 70 ${520 - k * 12}`} stroke="#2e3a22" strokeWidth="4" fill="none" />
                <ellipse cx="70" cy={540 - k * 12} rx="26" ry="50" fill={k % 2 ? "#3f5a2c" : "#4d6b33"} transform={`rotate(${k * 9 - 20} 70 ${540 - k * 12})`} />
              </g>
            ))}
          </g>

          {/* books */}
          {[
            { y: 826, w: 300, fill: "#263b40", t: "Venture Deals", r: -3 },
            { y: 780, w: 288, fill: "#a4532f", t: "Blitzscaling", r: -1 },
            { y: 734, w: 268, fill: "#3b2d29", t: "Zero to One", r: -4 },
            { y: 688, w: 280, fill: "#2e3c31", t: "The Lean Startup", r: -2 },
          ].map((b, i) => (
            <g key={i} transform={`rotate(${b.r} 260 ${b.y})`}>
              <rect x="110" y={b.y} width={b.w} height="46" rx="5" fill={b.fill} />
              <rect x="110" y={b.y + 4} width="10" height="38" fill="#000" opacity="0.2" />
              <text x="140" y={b.y + 32} fill="#efd9b6" fontSize="24" style={{ fontFamily: "var(--font-dm-serif)" }}>{b.t}</text>
            </g>
          ))}

          {/* puzzle cube */}
          <g transform="translate(408 790)">
            <path d="M0 22 L28 0 L128 0 L100 22 Z" fill="#20160f" />
            {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
              <path key={`t${r}${c}`} d={`M${4 + c * 32 + (2 - r) * 8} ${4 + r * 6} l30 0 l-7 5 l-30 0 Z`} fill={["#f2c230", "#e8e2d6", "#2f7fd0"][(r + c) % 3]} />
            )))}
            {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
              <rect key={`f${r}${c}`} x={3 + c * 32} y={25 + r * 30} width="29" height="27" rx="3" fill={["#d8342c", "#2f9b4a", "#f2c230", "#2f7fd0", "#f07d22", "#e8e2d6"][(r * 3 + c * 2) % 6]} />
            )))}
          </g>

          {/* blueprint with rocket sketch */}
          <g transform="rotate(-5 720 860)">
            <rect x="560" y="830" width="380" height="110" fill="#e8dbc2" />
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={560 + i * 42} y1="830" x2={560 + i * 42} y2="940" stroke="#bfae92" strokeWidth="0.8" />)}
            <g stroke="#6f604f" strokeWidth="2" fill="none">
              <path d="M700 905 L760 850 Q790 840 800 846 Q806 856 796 886 L741 940" />
              <path d="M718 888 L700 878 L690 900 M745 915 L755 933 L733 941" />
              <circle cx="775" cy="868" r="7" />
            </g>
          </g>

          {/* mouse */}
          <ellipse cx="985" cy="868" rx="34" ry="18" fill="#e2d2b2" />
          <line x1="985" y1="851" x2="985" y2="866" stroke="#b39d7a" strokeWidth="2" />

          {/* mug + steam */}
          <g>
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M${1100 + i * 16} 735 q -10 -18 0 -34 q 10 -16 0 -32`} stroke="#fff4e0" strokeWidth="5" strokeLinecap="round" fill="none"
                opacity="0" style={{ animation: `steam 4.2s ${i * 1.3}s ease-out infinite`, transformBox: "fill-box", transformOrigin: "bottom" }} />
            ))}
            <path d="M1168 768 q 34 0 34 30 q 0 30 -36 30" stroke="#e6dac4" strokeWidth="11" fill="none" />
            <rect x="1072" y="742" width="104" height="108" rx="12" fill="#eee2cb" />
            <ellipse cx="1124" cy="744" rx="52" ry="9" fill="#5a3a26" />
          </g>

          <g transform="translate(224 126) scale(0.86)">
          {/* keyboard */}
          <path d="M1040 836 L1580 836 L1620 900 L1000 900 Z" fill="url(#beige)" />
          {[0, 1, 2].map((r) => Array.from({ length: 16 }, (_, c) => (
            <rect key={`${r}-${c}`} x={1050 + c * 33 - r * 9 + (r === 2 ? 0 : 0)} y={846 + r * 17} width="27" height="12" rx="2" fill="#d9c49d" stroke="#a88d63" strokeWidth="1" />
          )))}

          {/* CRT computer */}
          <rect x="1222" y="788" width="316" height="54" rx="8" fill="#c3a777" />
          <rect x="1380" y="806" width="110" height="8" rx="3" fill="#7a6446" />
          <rect x="1190" y="432" width="380" height="366" rx="28" fill="url(#beige)" />
          <rect x="1225" y="460" width="310" height="262" rx="22" fill="#b19670" />
          <rect x="1247" y="480" width="266" height="218" rx="22" fill="url(#screen)" />
          <g clipPath="url(#screen-clip)" style={{ animation: "crt-flicker 0.18s infinite" }}>
            <PixelUnicorn x={1305} y={505} px={6} />
            <Terminal />
            <rect x="1247" y="480" width="266" height="218" fill="url(#scanlines)" />
            <rect x="1247" y="480" width="266" height="50" fill="#8df59a" opacity="0.05" style={{ animation: "scan 5s linear infinite" }} />
            <rect x="1247" y="480" width="266" height="218" fill="#8df59a" opacity="0.04" />
          </g>
          <ellipse cx="1330" cy="520" rx="70" ry="22" fill="#fff" opacity="0.05" />
          <text x="1255" y="770" fill="#8f7754" fontSize="16" fontWeight="700" letterSpacing="3" style={{ fontFamily: "var(--font-inter)" }}>SV-1</text>
          <circle cx="1520" cy="764" r="5" fill="#8df59a" style={{ animation: "twinkle 2.6s ease-in-out infinite" }} />

          {/* sticky note */}
          <g transform="rotate(7 1560 600)">
            <rect x="1505" y="520" width="118" height="158" fill="#f4d57a" />
            <rect x="1540" y="512" width="46" height="16" fill="#e8dcc0" opacity="0.8" />
            <Checklist />
          </g>
          </g>
      </Layer>

      {/* ---------- grade: static CSS layers ---------- */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_75%_at_50%_45%,transparent_60%,rgba(0,0,0,0.55))]" />
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
