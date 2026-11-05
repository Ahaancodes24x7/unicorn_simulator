import type { CSSProperties } from "react";
import {
  ArrowBigUpDash, Award, Bandage, Banknote, Bomb, Briefcase, Building2, Calculator, ChartColumn, ChartLine,
  ChevronDown, ChevronUp, Circle, CircleCheck, CircleDollarSign, ClipboardList, Coffee, Compass, Construction,
  Crown, Dices, Download, Filter, Flag, Flame, FolderKanban, Footprints, Gem, Globe, Handshake, Heart, Hourglass,
  House, Laptop, Leaf, Lightbulb, Lock, Map as MapIcon, Medal, Megaphone, MessageSquare, Mic, Newspaper, Package,
  Palette, PartyPopper, Play, Puzzle, Radar, Repeat, Rocket, Scale, ScrollText, Search, Settings, ShieldCheck,
  Siren, Smartphone, Sparkles, Sprout, Square, Star, Tag, Target, TrendingUp, Trophy, User, UserMinus, UserRound,
  Users, Wallet, Wrench, Zap, Check, Timer, Pause, type LucideIcon,
} from "lucide-react";

/**
 * One icon set for the whole app (Lucide SVGs). Each icon has a default accent colour so screens stay
 * vivid; pass `inherit` to use the surrounding text colour instead. Icons scale with font size (1em),
 * so existing `text-2xl`-style classes keep working.
 */
const ICONS: Record<string, [LucideIcon, string]> = {
  home: [House, "#fbbf24"],
  target: [Target, "#f87171"],
  users: [Users, "#60a5fa"],
  user: [User, "#93c5fd"],
  person: [UserRound, "#93c5fd"],
  wallet: [Wallet, "#4ade80"],
  chart: [ChartColumn, "#a78bfa"],
  "chart-line": [ChartLine, "#4ade80"],
  trophy: [Trophy, "#fbbf24"],
  "level-up": [ArrowBigUpDash, "#4ade80"],
  medal: [Medal, "#fbbf24"],
  flag: [Flag, "#f0abfc"],
  siren: [Siren, "#f87171"],
  folder: [FolderKanban, "#fbbf24"],
  gem: [Gem, "#c084fc"],
  dice: [Dices, "#fbbf24"],
  check: [Check, "#4ade80"],
  "check-circle": [CircleCheck, "#4ade80"],
  circle: [Circle, "#6b7280"],
  play: [Play, "currentColor"],
  stop: [Square, "currentColor"],
  download: [Download, "currentColor"],
  growth: [TrendingUp, "#4ade80"],
  flame: [Flame, "#fb923c"],
  heart: [Heart, "#f472b6"],
  cash: [Banknote, "#4ade80"],
  dollar: [CircleDollarSign, "#4ade80"],
  hourglass: [Hourglass, "#fbbf24"],
  scale: [Scale, "#a78bfa"],
  funnel: [Filter, "#60a5fa"],
  calculator: [Calculator, "#93c5fd"],
  repeat: [Repeat, "#f472b6"],
  handshake: [Handshake, "#fbbf24"],
  shield: [ShieldCheck, "#34d399"],
  leaf: [Leaf, "#fbbf24"],
  radar: [Radar, "#22d3ee"],
  idea: [Lightbulb, "#fde047"],
  rocket: [Rocket, "#f472b6"],
  compass: [Compass, "#22d3ee"],
  balance: [Scale, "#fbbf24"],
  boom: [Bomb, "#f87171"],
  zap: [Zap, "#fde047"],
  briefcase: [Briefcase, "#fbbf24"],
  leave: [UserMinus, "#f87171"],
  mic: [Mic, "#f472b6"],
  clipboard: [ClipboardList, "#93c5fd"],
  wrench: [Wrench, "#93c5fd"],
  news: [Newspaper, "#d1d5db"],
  star: [Star, "#fde047"],
  lock: [Lock, "#9ca3af"],
  search: [Search, "#22d3ee"],
  chat: [MessageSquare, "#93c5fd"],
  phone: [Smartphone, "#c084fc"],
  sparkles: [Sparkles, "#f0abfc"],
  megaphone: [Megaphone, "#fb923c"],
  settings: [Settings, "#93c5fd"],
  building: [Building2, "#93c5fd"],
  crane: [Construction, "#fbbf24"],
  package: [Package, "#fbbf24"],
  scroll: [ScrollText, "#fde68a"],
  globe: [Globe, "#22d3ee"],
  tag: [Tag, "#f472b6"],
  bandage: [Bandage, "#fda4af"],
  coffee: [Coffee, "#d6a26b"],
  crown: [Crown, "#fbbf24"],
  boot: [Footprints, "#d6a26b"],
  sprout: [Sprout, "#4ade80"],
  puzzle: [Puzzle, "#a78bfa"],
  map: [MapIcon, "#34d399"],
  party: [PartyPopper, "#f472b6"],
  laptop: [Laptop, "#60a5fa"],
  palette: [Palette, "#f472b6"],
  award: [Award, "#fbbf24"],
  timer: [Timer, "#fbbf24"],
  pause: [Pause, "currentColor"],
  up: [ChevronUp, "currentColor"],
  down: [ChevronDown, "currentColor"],
};

/** Emoji kept in older saved settings (e.g. role icons) still render as proper icons. */
const EMOJI: Record<string, string> = {
  "🏠": "home", "🎯": "target", "👥": "users", "💰": "wallet", "📊": "chart", "🏆": "trophy", "⬆️": "level-up",
  "🥇": "medal", "🏁": "flag", "🚨": "siren", "🗂️": "folder", "💎": "gem", "🎲": "dice", "📈": "growth", "🔥": "flame",
  "❤️": "heart", "🦄": "gem", "💵": "cash", "⏳": "hourglass", "⚖️": "balance", "🔻": "funnel", "🧮": "calculator",
  "👤": "user", "🔁": "repeat", "💹": "chart-line", "✅": "check-circle", "🤝": "handshake", "🛡️": "shield",
  "🌿": "leaf", "🏅": "medal", "🕸️": "radar", "💡": "idea", "🚀": "rocket", "🧭": "compass", "💥": "boom", "⚡": "zap",
  "💼": "briefcase", "👋": "leave", "🎤": "mic", "📋": "clipboard", "🛠️": "wrench", "📰": "news", "⭐": "star",
  "🌟": "star", "🔒": "lock", "🔎": "search", "💬": "chat", "📱": "phone", "✨": "sparkles", "📣": "megaphone",
  "⚙️": "settings", "🏗️": "crane", "📦": "package", "📜": "scroll", "🌐": "globe", "🏷️": "tag", "🩹": "bandage",
  "☕": "coffee", "🔧": "wrench", "🥾": "boot", "🌱": "sprout", "👑": "crown", "🛠": "wrench", "🗺️": "map",
  "🧩": "puzzle", "🎉": "party", "👔": "briefcase", "💻": "laptop", "🎨": "palette", "🧑‍💼": "person", "💸": "dollar",
  "⬜": "circle", "✓": "check", "▶": "play", "■": "stop", "⬇": "download", "★": "star", "▲": "up", "▼": "down", "⏱": "timer", "⏸": "pause",
};

export const iconNames = Object.keys(ICONS);

export function Icon({ name, className = "", inherit, style, label }: {
  name?: string | null; className?: string; inherit?: boolean; style?: CSSProperties; label?: string;
}) {
  const key = name ? (ICONS[name] ? name : EMOJI[name] ?? EMOJI[name.replace(/️/g, "")]) : undefined;
  const entry = key ? ICONS[key] : undefined;
  if (!entry) return name ? <span className={className} aria-hidden={!label} aria-label={label}>{name}</span> : null;
  const [Svg, color] = entry;
  return (
    <Svg
      size="1em"
      strokeWidth={2.2}
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      style={{ ...(inherit ? {} : { color }), ...style }}
      aria-hidden={!label}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
