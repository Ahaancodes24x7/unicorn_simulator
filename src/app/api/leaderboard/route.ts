import { handler, json } from "@/lib/http";
import { publicLeaderboard } from "@/lib/publicBoard";

export const dynamic = "force-dynamic";

// Public data only, so Vercel's CDN may share it between viewers for a few seconds: any number of
// leaderboard screens then costs about one function call every 3 seconds.
export const GET = handler(async () => json(await publicLeaderboard(), {
  headers: {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "public, s-maxage=3, stale-while-revalidate=30",
  },
}));
