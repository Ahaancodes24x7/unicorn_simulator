import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminAllowlist, startAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/game";
import { clientIp, handler, HttpError, json, rateLimit } from "@/lib/http";

const body = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });
// Compared against when the account doesn't exist, so timing doesn't reveal which emails are admins.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-password", 12);

export const POST = handler(async (req) => {
  const ip = clientIp(req);
  rateLimit(`admin-login:${ip}`, 5, 60_000);
  const { email, password } = body.parse(await req.json());
  const normalized = email.toLowerCase();
  rateLimit(`admin-login-email:${normalized}`, 10, 15 * 60_000);

  const allowed = adminAllowlist().includes(normalized);
  const admin = allowed ? await prisma.adminUser.findUnique({ where: { email: normalized } }) : null;
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!allowed || !admin || !ok) {
    await audit(normalized, "admin.login_failed", { detail: { ip } });
    throw new HttpError(401, "Invalid credentials");
  }
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await startAdminSession(admin.id);
  await audit(admin.email, "admin.login", { detail: { ip } });
  return json({ ok: true });
});
