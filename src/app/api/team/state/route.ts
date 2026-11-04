import { requireTeamId } from "@/lib/auth";
import { teamView } from "@/lib/game";
import { handler, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json(await teamView(await requireTeamId())));
