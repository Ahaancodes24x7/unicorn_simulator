import { z } from "zod";
import { defaultSettings } from "@/game/content/defaults";
import { requireAdmin } from "@/lib/auth";
import { getGame, saveSettings } from "@/lib/game";
import { handler, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  const game = await getGame();
  return json({ status: game.status, settings: game.settings, defaults: defaultSettings() });
});

const body = z.object({ settings: z.unknown(), reason: z.string().trim().max(300).optional() });

export const PUT = handler(async (req) => {
  const admin = await requireAdmin();
  const { settings, reason } = body.parse(await req.json());
  return json({ ok: true, settings: await saveSettings(settings, admin.email, reason) });
});
