import { redirect } from "next/navigation";
import { BootGate } from "@/components/play/BootGate";
import { Dashboard } from "@/components/play/Dashboard";
import { currentTeamId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Unicorn Simulator" };

export default async function PlayPage() {
  if (!(await currentTeamId())) redirect("/join");
  return <BootGate><Dashboard /></BootGate>;
}
