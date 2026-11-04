import { z } from "zod";
import { assignSets } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/http";

const body = z.object({
  picks: z.array(z.object({ id: z.string().min(1).max(40), trackId: z.string().min(1).max(40) })).max(500),
  autoRest: z.boolean().optional(),
});

// Organizers assign problem sets to teams (one or many), optionally auto-balancing everyone still waiting.
export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const { picks, autoRest } = body.parse(await req.json());
  return json({ ok: true, ...(await assignSets(picks, !!autoRest, admin.email)) });
});
