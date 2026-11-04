import { requireTeamId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reissueAccessCode, teamLead } from "@/lib/game";
import { handler, HttpError, json, rateLimit } from "@/lib/http";
import { devMailFallback, sendAccessCode } from "@/lib/mailer";

// From the dashboard: email the team lead a fresh access code.
export const POST = handler(async () => {
  const teamId = await requireTeamId();
  rateLimit(`new-code:${teamId}`, 3, 10 * 60_000);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  const lead = team && teamLead(team);
  if (!lead) throw new HttpError(400, "This team has no lead email. Ask the organizers for a new code.");
  const { code } = await reissueAccessCode(teamId);
  await sendAccessCode(lead, team.name, code, true);
  return json({ ok: true, lead, ...(devMailFallback() ? { devCode: code } : {}) });
});
