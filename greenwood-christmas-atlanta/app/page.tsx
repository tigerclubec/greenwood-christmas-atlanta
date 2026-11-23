import { Experience } from "@/components/Experience";
import { events } from "@/config/party";
import { getPublicTree } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const trees = Object.fromEntries(
    await Promise.all(events.map(async (e) => [e.id, (await getPublicTree(e.id)).ornaments] as const)),
  );
  return <Experience initialTrees={trees} initialEventId={events[0].id} />;
}
