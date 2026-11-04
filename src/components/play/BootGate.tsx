"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BootScreen } from "./BootScreen";

const KEY = "sv_booted";

/** Shows the boot sequence once per browser tab before the dashboard; it can't be skipped. */
export function BootGate({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) setBooting(false);
    } catch {
      // storage unavailable: show the boot screen
    }
  }, []);

  function done() {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    setBooting(false);
  }

  return (
    <>
      {children}
      {booting && <BootScreen onDone={done} />}
    </>
  );
}
