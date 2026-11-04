import { z } from "zod";
import { normalizeLeadEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTeam } from "@/lib/game";
import { clientIp, handler, json, rateLimit } from "@/lib/http";
import { devMailFallback, sendAccessCode } from "@/lib/mailer";

const body = z.object({
  name: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} .'&_-]+$/u, "Use letters, numbers and basic punctuation"),
  lead: z.string().max(120),
  trackId: z.string().max(40).optional(),
});

// Register a team: the access code goes to the team lead's Gmail, and everyone enters with
// team name + code. (Limits are generous per IP because a whole campus may share one address.)
export const POST = handler(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 300, 10 * 60_000);
  const input = body.parse(await req.json());
  const lead = normalizeLeadEmail(input.lead);
  rateLimit(`register-lead:${lead}`, 3, 10 * 60_000);
  const { team, code } = await createTeam({ name: input.name, lead, trackId: input.trackId });
  try {
    await sendAccessCode(lead, team.name, code, false);
  } catch (err) {
    await prisma.team.delete({ where: { id: team.id } }); // the lead never got the code: undo
    throw err;
  }
  return json({ ok: true, name: team.name, lead, ...(devMailFallback() ? { devCode: code } : {}) });
});
