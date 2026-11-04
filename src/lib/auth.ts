import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { HttpError } from "./http";

const TEAM_COOKIE = "sv_team";
const ADMIN_COOKIE = "sv_admin";
const TEAM_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days — covers an event weekend
const ADMIN_TTL_MS = 1000 * 60 * 60 * 8; // one working day

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

/** Admin allowlist comes from the environment only — never from the client or the repository. */
export function adminAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 2);
}

async function setCookie(name: string, token: string, ttl: number) {
  (await cookies()).set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ttl / 1000),
  });
}

// ---------------------------------------------------------------- teams

export async function startTeamSession(teamId: string) {
  const token = newToken();
  await prisma.teamSession.create({ data: { id: sha256(token), teamId, expiresAt: new Date(Date.now() + TEAM_TTL_MS) } });
  await setCookie(TEAM_COOKIE, token, TEAM_TTL_MS);
}

export async function currentTeamId(): Promise<string | null> {
  const token = (await cookies()).get(TEAM_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.teamSession.findUnique({ where: { id: sha256(token) } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.teamId;
}

export async function requireTeamId(): Promise<string> {
  const id = await currentTeamId();
  if (!id) throw new HttpError(401, "Join or rejoin a team first");
  return id;
}

export async function endTeamSession() {
  const jar = await cookies();
  const token = jar.get(TEAM_COOKIE)?.value;
  if (token) await prisma.teamSession.deleteMany({ where: { id: sha256(token) } });
  jar.delete(TEAM_COOKIE);
}

// ---------------------------------------------------------------- team leads

/** Team leads register with an email on an allowed domain (LEAD_EMAIL_DOMAINS, default Gmail). */
export function leadDomains(): string[] {
  return (process.env.LEAD_EMAIL_DOMAINS ?? "gmail.com,googlemail.com").split(",").map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

export function normalizeLeadEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !leadDomains().includes(domain)) {
    throw new HttpError(400, `Use a ${leadDomains()[0]} address`);
  }
  return email;
}

// ---------------------------------------------------------------- admins

export async function startAdminSession(adminId: string) {
  const token = newToken();
  await prisma.adminSession.create({ data: { id: sha256(token), adminId, expiresAt: new Date(Date.now() + ADMIN_TTL_MS) } });
  await setCookie(ADMIN_COOKIE, token, ADMIN_TTL_MS);
}

export async function currentAdmin(): Promise<{ id: string; email: string } | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { id: sha256(token) }, include: { admin: true } });
  if (!session || session.expiresAt < new Date()) return null;
  // Re-check the allowlist on every request so removing an email revokes access immediately.
  if (!adminAllowlist().includes(session.admin.email.toLowerCase())) return null;
  return { id: session.admin.id, email: session.admin.email };
}

/** Server-side authorization for every admin API and page. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new HttpError(401, "Admin sign-in required");
  return admin;
}

export async function endAdminSession() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { id: sha256(token) } });
  jar.delete(ADMIN_COOKIE);
}
