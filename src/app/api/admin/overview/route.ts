import { adminOverview } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  return json(await adminOverview());
});
