import { handler, json } from "@/lib/http";
import { publicLeaderboard } from "@/lib/publicBoard";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json(await publicLeaderboard()));
