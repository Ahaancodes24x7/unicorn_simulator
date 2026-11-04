import { redirect } from "next/navigation";
import { JoinForms } from "@/components/JoinForms";
import { Logo } from "@/components/Logo";
import { currentTeamId, leadDomains } from "@/lib/auth";
import { lobbyInfo } from "@/lib/publicBoard";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  if (await currentTeamId()) redirect("/play"); // already signed in on this device
  const info = await lobbyInfo();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex justify-center"><Logo /></div>
      <h1 className="mt-10 text-center font-serif text-4xl text-cream sm:text-5xl">Enter the simulation</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">
        Everyone on a team enters with the team name and access code. Team leads: register your team once and the code is emailed to you.
        {info.status === "lobby" && " The game hasn't started yet; you can get set up now."}
        {info.status === "paused" && " The game is currently paused."}
      </p>
      <JoinForms info={{ ...info, domain: leadDomains()[0] }} />
    </main>
  );
}
