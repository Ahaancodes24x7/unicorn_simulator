"use client";

import { useEffect, useState } from "react";
import type { PublicBoard } from "@/lib/publicBoard";

const POLL_MS = 5_000;

/**
 * Live public leaderboard. Polls an endpoint that Vercel's CDN caches for a few seconds, so many
 * screens cost the server almost nothing (no long-lived streaming functions). Pauses in hidden tabs.
 */
export function useLiveBoard(): PublicBoard | null {
  const [board, setBoard] = useState<PublicBoard | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      fetch("/api/leaderboard").then((r) => (r.ok ? r.json() : null)).then((b) => { if (alive && b) setBoard(b); }).catch(() => {});
    };
    load();
    const t = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", load); };
  }, []);
  return board;
}
