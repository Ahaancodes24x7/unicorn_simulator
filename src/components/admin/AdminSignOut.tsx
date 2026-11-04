"use client";

import { useRouter } from "next/navigation";
import { api } from "../ui";

export function AdminSignOut() {
  const router = useRouter();
  return (
    <button className="rounded-md border border-line px-2 py-1 hover:text-cream" onClick={async () => { await api("/api/admin/logout", {}); router.replace("/admin/login"); }}>
      Sign out
    </button>
  );
}
