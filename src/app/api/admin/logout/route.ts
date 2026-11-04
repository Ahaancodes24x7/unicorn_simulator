import { endAdminSession } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const POST = handler(async () => {
  await endAdminSession();
  return json({ ok: true });
});
