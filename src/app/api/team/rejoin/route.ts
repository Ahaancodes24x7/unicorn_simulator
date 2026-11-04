import { z } from "zod";
import { startTeamSession } from "@/lib/auth";
import { findTeamByCode } from "@/lib/game";
import { clientIp, handler, HttpError, json, rateLimit } from "@/lib/http";

const body = z.object({ name: z.string().trim().min(1).max(40), code: z.string().trim().min(4).max(20) });

// Enter a team with its name and access code (team lead and teammates alike).
export const POST = handler(async (req) => {
  rateLimit(`enter:${clientIp(req)}`, 600, 60_000);
  const { name, code } = body.parse(await req.json());
  rateLimit(`enter-team:${name.toLowerCase()}`, 15, 10 * 60_000);
  const team = await findTeamByCode(name, code);
  if (!team) throw new HttpError(401, "Team name or access code is incorrect");
  await startTeamSession(team.id);
  return json({ ok: true });
});
