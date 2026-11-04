import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 500 });
  return json({ logs });
});
