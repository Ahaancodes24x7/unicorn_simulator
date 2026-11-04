import { z } from "zod";
import { adjustTeam, adminTeamDetail, deleteTeam } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { audit, reissueAccessCode, teamLead } from "@/lib/game";
import { handler, json } from "@/lib/http";
import { sendAccessCode } from "@/lib/mailer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const reason = z.string().trim().min(3, "A reason is required").max(300);
const body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("score"), delta: z.number().finite().min(-100).max(100), reason }),
  z.object({ kind: z.literal("cash"), delta: z.number().finite().min(-1e9).max(1e9), reason }),
  z.object({ kind: z.literal("track"), trackId: z.string().min(1), reason }),
  z.object({ kind: z.literal("delete"), reason, confirm: z.literal("DELETE") }),
  z.object({ kind: z.literal("code"), reason, emailLead: z.boolean().optional() }),
]);

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  return json(await adminTeamDetail((await params).id));
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const input = body.parse(await req.json());
  if (input.kind === "code") {
    // Fix-it for a team that lost its code: a new code, shown to the organizer (and optionally emailed to the lead).
    const { team, code } = await reissueAccessCode(id);
    const lead = teamLead(team);
    let emailed = false;
    if (lead && input.emailLead) await sendAccessCode(lead, team.name, code, true).then(() => { emailed = true; }, () => {});
    await audit(admin.email, "team.code", { target: `${team.name} (${id})`, reason: input.reason, detail: { emailed } });
    return json({ ok: true, code, lead, emailed });
  }
  if (input.kind === "delete") await deleteTeam(id, admin.email, input.reason);
  else await adjustTeam(id, input, admin.email);
  return json({ ok: true });
});
