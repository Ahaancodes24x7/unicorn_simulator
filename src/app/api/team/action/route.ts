import { z } from "zod";
import { requireTeamId } from "@/lib/auth";
import { performAction } from "@/lib/game";
import { handler, json, rateLimit } from "@/lib/http";

const id = z.string().min(1).max(80);
const body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hire"), roleId: id }),
  z.object({ type: z.literal("fire"), employeeId: id }),
  z.object({ type: z.literal("task"), taskId: id, crew: z.array(id).max(20).optional() }),
  z.object({ type: z.literal("pitch") }),
  z.object({ type: z.literal("accept"), offerId: id }),
  z.object({ type: z.literal("decline") }),
  z.object({ type: z.literal("sell"), pct: z.number().min(0.005).max(0.5) }),
]);

export const POST = handler(async (req) => {
  const teamId = await requireTeamId();
  rateLimit(`action:${teamId}`, 30, 60_000);
  const action = body.parse(await req.json());
  return json(await performAction(teamId, action));
});
