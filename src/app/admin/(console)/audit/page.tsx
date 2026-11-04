import { Panel } from "@/components/ui";
import { prisma } from "@/lib/db";

export default async function AuditPage() {
  // The console layout has already verified the admin session.
  const logs = await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 500 });
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl text-cream">Audit log</h1>
      <Panel>
        {logs.length === 0 ? <p className="text-sm text-faint">No entries yet.</p> : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-faint">
                <tr className="border-b border-line"><th className="px-5 py-2">Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th><th className="px-5">Detail</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-line/40 align-top">
                    <td className="whitespace-nowrap px-5 py-2 text-muted">{l.createdAt.toLocaleString()}</td>
                    <td className="text-cream">{l.actor}</td>
                    <td className={l.action.includes("failed") || l.action.includes("reset") || l.action.includes("delete") ? "text-bad" : "text-amber"}>{l.action}</td>
                    <td className="text-muted">{l.target ?? "–"}</td>
                    <td className="text-muted">{l.reason ?? "–"}</td>
                    <td className="max-w-xs truncate px-5 font-mono text-[11px] text-faint" title={l.detail}>{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
