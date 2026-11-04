import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; sqliteTuned?: Promise<void> };

const url = process.env.DATABASE_URL ?? "";
const sqlite = url.startsWith("file:");
// SQLite allows one writer at a time: a single connection queues queries in order instead of
// failing on lock contention, and a longer socket timeout rides out bursts of turns.
const sqliteUrl = sqlite && !url.includes("connection_limit") ? `${url}${url.includes("?") ? "&" : "?"}connection_limit=1&socket_timeout=30` : url;

export const prisma = globalForPrisma.prisma ?? new PrismaClient(sqlite ? { datasources: { db: { url: sqliteUrl } } } : undefined);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite (local / single-machine events): write-ahead logging lets dashboards keep reading while a
// turn is being written, and the busy timeout makes concurrent writers wait instead of erroring.
// PostgreSQL needs none of this.
if (sqlite && !globalForPrisma.sqliteTuned) {
  globalForPrisma.sqliteTuned = (async () => {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
  })().catch((e) => console.error(JSON.stringify({ level: "warn", msg: "sqlite tuning failed", err: String(e) })));
}

export const parse = <T>(json: string): T => JSON.parse(json) as T;
