import { defaultSettings } from "@/game/content/defaults";
import { Hero, type HeroFacts } from "@/components/landing/Hero";
import { getGame } from "@/lib/game";

// Pre-rendered and refreshed at most once a minute, so the landing page stays fast under load.
export const revalidate = 60;

export default async function Home() {
  let settings = defaultSettings();
  try {
    settings = (await getGame()).settings;
  } catch {
    // database not reachable (e.g. during the build): fall back to the default content
  }
  const facts: HeroFacts = {
    startingCash: settings.startingCash, sets: settings.tracks.length, turns: settings.turns,
    roles: settings.roles.map((r) => r.title.split(" / ")[0]),
  };
  return (
    <main>
      <Hero facts={facts} />
    </main>
  );
}
