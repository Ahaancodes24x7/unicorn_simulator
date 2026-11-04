import { z } from "zod";
import { normalizeLeadEmail } from "@/lib/auth";
import { findTeamByName, reissueAccessCode, teamLead } from "@/lib/game";
import { clientIp, handler, json, rateLimit } from "@/lib/http";
import { devMailFallback, sendAccessCode } from "@/lib/mailer";

const body = z.object({ name: z.string().trim().min(1).max(40), lead: z.string().max(120) });

// Lost code: if the email is the team's lead, a new code is emailed to it. The reply is the same
// either way, so this can't be used to discover which teams or emails exist.
export const POST = handler(async (req) => {
  rateLimit(`lost:${clientIp(req)}`, 100, 10 * 60_000);
  const input = body.parse(await req.json());
  const lead = normalizeLeadEmail(input.lead);
  rateLimit(`lost-lead:${lead}`, 3, 10 * 60_000);
  const team = await findTeamByName(input.name);
  if (!team || teamLead(team) !== lead) return json({ ok: true });
  const { code } = await reissueAccessCode(team.id);
  await sendAccessCode(lead, team.name, code, true);
  return json({ ok: true, ...(devMailFallback() ? { devCode: code } : {}) });
});
