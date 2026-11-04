// Creates the game config row and the allowlisted admin accounts.
// Reads ADMIN_EMAILS and ADMIN_INITIAL_PASSWORD from the environment (.env) — nothing is hard-coded.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { defaultSettings } from "../src/game/content/defaults";

const prisma = new PrismaClient();

async function main() {
  await prisma.gameConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, status: "lobby", settings: JSON.stringify(defaultSettings()) },
  });
  console.log("✓ Game config ready");

  const emails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).slice(0, 2);
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  if (!emails.length) {
    console.warn("! ADMIN_EMAILS is empty: no admin accounts created");
    return;
  }
  if (password.length < 12) {
    console.warn("! ADMIN_INITIAL_PASSWORD missing or shorter than 12 characters: admin accounts not created/updated");
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  for (const email of emails) {
    await prisma.adminUser.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } });
    console.log(`✓ Admin account ready: ${email}`);
  }
  const removed = await prisma.adminUser.deleteMany({ where: { email: { notIn: emails } } });
  if (removed.count) console.log(`✓ Removed ${removed.count} admin account(s) no longer in ADMIN_EMAILS`);
  console.log("  You can now remove ADMIN_INITIAL_PASSWORD from .env");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
