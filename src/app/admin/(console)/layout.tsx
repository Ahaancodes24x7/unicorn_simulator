import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { Logo } from "@/components/Logo";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Unicorn Simulator", robots: { index: false } };

// Every console page is gated server-side; APIs re-check independently.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <header className="no-print sticky top-0 z-30 -mx-4 mb-6 border-b border-line bg-ink/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Logo href="/admin" />
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/admin" className="hover:text-cream">Overview</Link>
              <Link href="/admin/config" className="hover:text-cream">Configuration</Link>
              <Link href="/admin/audit" className="hover:text-cream">Audit log</Link>
              <Link href="/admin/report" className="hover:text-cream">Final report</Link>
              <Link href="/leaderboard" target="_blank" className="hover:text-cream">Public board ↗</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-faint">
            {admin.email}
            <AdminSignOut />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
