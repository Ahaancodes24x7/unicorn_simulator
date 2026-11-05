import { requireTeamId } from "@/lib/auth";
import { teamViewSince } from "@/lib/game";
import { handler, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// `?since=<etag>` returns { same: true, rank, teamCount } when nothing else changed.
export const GET = handler(async (req) => {
  const teamId = await requireTeamId();
  return json(await teamViewSince(teamId, new URL(req.url).searchParams.get("since")));
});
