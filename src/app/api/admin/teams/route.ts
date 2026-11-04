import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { audit, createTeam } from "@/lib/game";
import { handler, json } from "@/lib/http";
import { sendAccessCode } from "@/lib/mailer";

const body = z.object({
  name: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} .'&_-]+$/u, "Use letters, numbers and basic punctuation"),
  lead: z.string().trim().toLowerCase().email().max(120).optional().or(z.literal("")),
  trackId: z.string().max(40).optional(),
  emailLead: z.boolean().optional(),
  reason: z.string().trim().min(3, "A reason is required").max(300),
});

// Manual entry: an organizer registers a team (any time, any email) and gets its access code on screen.
export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const input = body.parse(await req.json());
  const lead = input.lead || undefined;
  const { team, code } = await createTeam({ name: input.name, lead, trackId: input.trackId || undefined, byAdmin: true });
  let emailed = false;
  if (lead && input.emailLead) {
    await sendAccessCode(lead, team.name, code, false).then(() => { emailed = true; }, () => {});
  }
  await audit(admin.email, "team.create", { target: `${team.name} (${team.id})`, reason: input.reason, detail: { lead: lead ?? null, trackId: team.trackId, emailed } });
  return json({ ok: true, id: team.id, name: team.name, code, emailed });
});
