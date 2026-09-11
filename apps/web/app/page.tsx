import { PublisherDemo } from "@/components/hark/publisher-demo";
import { listPublishers } from "@/lib/hark-client";

export default async function Home() {
  const publishers = await listPublishers();
  const demoPublisher = publishers.find((p) => p.slug === "demo-publisher") ?? publishers[0];
  const homeFeedPlacement = demoPublisher?.placements.find((p) => p.slug === "home-feed") ?? demoPublisher?.placements[0];

  return <PublisherDemo placementId={homeFeedPlacement?.id ?? null} />;
}
