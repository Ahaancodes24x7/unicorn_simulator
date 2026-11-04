// Picks the Prisma database provider from DATABASE_URL at build time, so the same code runs on
// SQLite locally and on PostgreSQL in production (Neon, Supabase, Vercel Postgres, Railway…).
// With DIRECT_URL set (a non-pooled connection), schema pushes use it while the app uses the pooled URL.
import { readFileSync, writeFileSync } from "node:fs";
import "dotenv/config";

const url = process.env.DATABASE_URL ?? "";
const path = new URL("../prisma/schema.prisma", import.meta.url);
let schema = readFileSync(path, "utf8");
const postgres = /^postgres(ql)?:\/\//.test(url);
const provider = postgres ? "postgresql" : "sqlite";

schema = schema.replace(/provider = "(sqlite|postgresql)"/, `provider = "${provider}"`);
schema = schema.replace(/\n\s*directUrl\s*=\s*env\("DIRECT_URL"\)/, "");
if (postgres && process.env.DIRECT_URL) {
  schema = schema.replace('url      = env("DATABASE_URL")', 'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")');
}
writeFileSync(path, schema);
console.log(`✓ Prisma provider: ${provider}${postgres && process.env.DIRECT_URL ? " (direct URL for migrations)" : ""}`);
