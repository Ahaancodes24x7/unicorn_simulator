import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { resetGame, setStatus } from "@/lib/game";
import { handler, json } from "@/lib/http";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["start", "pause", "resume", "end", "reopen"]), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("reset"), reason: z.string().trim().min(3).max(300), confirm: z.literal("RESET"), keepSettings: z.boolean() }),
]);

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const input = body.parse(await req.json());
  if (input.action === "reset") {
    await resetGame(admin.email, input.reason, input.keepSettings);
  } else {
    const target = { start: "running", resume: "running", reopen: "running", pause: "paused", end: "ended" } as const;
    await setStatus(target[input.action], admin.email, input.reason);
  }
  return json({ ok: true });
});
