"use client";

import { useEffect, useState } from "react";
import type { PublicBoard } from "@/lib/publicBoard";

/** Subscribes to the SSE leaderboard stream; falls back to polling if SSE is unavailable. */
export function useLiveBoard(): PublicBoard | null {
  const [board, setBoard] = useState<PublicBoard | null>(null);
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    const load = () => fetch("/api/leaderboard", { cache: "no-store" }).then((r) => r.json()).then(setBoard).catch(() => {});
    if (typeof EventSource === "undefined") {
      load();
      poll = setInterval(load, 4000);
      return () => clearInterval(poll);
    }
    const es = new EventSource("/api/stream");
    es.addEventListener("leaderboard", (e) => setBoard(JSON.parse((e as MessageEvent).data)));
    // A planned stream end also fires onerror; the browser reconnects by itself, so only fall back
    // to polling if the connection is really gone.
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED && !poll) { load(); poll = setInterval(load, 5000); }
    };
    es.onopen = () => { if (poll) { clearInterval(poll); poll = undefined; } };
    return () => { es.close(); if (poll) clearInterval(poll); };
  }, []);
  return board;
}
