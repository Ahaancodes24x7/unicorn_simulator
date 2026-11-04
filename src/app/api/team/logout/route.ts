import { endTeamSession } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const POST = handler(async () => {
  await endTeamSession();
  return json({ ok: true });
});
