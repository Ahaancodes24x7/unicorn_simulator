"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, Button, ErrorNote, inputClass, Panel } from "@/components/ui";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/login", { email, password });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <Logo />
      <Panel title="Organizer console" className="w-full max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Email</span>
            <input type="email" autoComplete="username" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Password</span>
            <input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
          <p className="text-center text-xs text-faint">Restricted to allowlisted organizer accounts.</p>
        </form>
      </Panel>
    </main>
  );
}
