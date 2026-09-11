import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { advertiserAgents, campaigns, placements, publishers } from "./schema.js";
import { generateId } from "./ids.js";
import { hashSecret } from "./secrets.js";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const demoPublisherKey = process.env.DEMO_PUBLISHER_KEY ?? "replace-me";

// Demo subject refs used by the Demo Publisher app. These are opaque,
// publisher-scoped conventions only - they are never persisted as their own
// database rows (CLAUDE.md section 29).
export const DEMO_SUBJECT_REFS = ["alex", "sam", "taylor"] as const;

async function upsertPublisher(db: ReturnType<typeof createDb>) {
  const existing = await db.query.publishers.findFirst({
    where: eq(publishers.slug, "demo-publisher"),
  });
  if (existing) return existing;

  const apiKeyHash = await hashSecret(demoPublisherKey);
  const [publisher] = await db
    .insert(publishers)
    .values({
      id: generateId("publisher"),
      slug: "demo-publisher",
      name: "Demo Publisher",
      description: "Simulated consumer platform used for the Hark Protocol demo",
      apiKeyHash,
      active: true,
    })
    .returning();
  return publisher!;
}

async function upsertPlacement(db: ReturnType<typeof createDb>, publisherId: string) {
  const existing = await db.query.placements.findFirst({
    where: (fields, { and, eq: eqOp }) =>
      and(eqOp(fields.publisherId, publisherId), eqOp(fields.slug, "home-feed")),
  });
  if (existing) return existing;

  const [placement] = await db
    .insert(placements)
    .values({
      id: generateId("placement"),
      publisherId,
      slug: "home-feed",
      name: "Home Feed",
      format: "card",
      active: true,
    })
    .returning();
  return placement!;
}

type DemoAgentSeed = {
  slug: string;
  displayName: string;
  campaignName: string;
  productSummary: string;
  targetTopics: string[];
  minRelevance: number;
  maxPriceTinybar: string;
  totalBudgetTinybar: string;
  creative: {
    headline: string;
    body: string;
    ctaLabel: string;
    destinationUrl: string;
  };
};

const DEMO_AGENTS: DemoAgentSeed[] = [
  {
    slug: "novabook",
    displayName: "NovaBook Agent",
    campaignName: "NovaBook Air",
    productSummary: "Lightweight laptop aimed at students and developers.",
    targetTopics: ["electronics.computer.laptop", "education.student-technology"],
    minRelevance: 0.8,
    maxPriceTinybar: "150000",
    totalBudgetTinybar: "10000000",
    creative: {
      headline: "NovaBook Air",
      body: "Light enough for campus. Powerful enough for code.",
      ctaLabel: "Explore",
      destinationUrl: "https://example.com/novabook",
    },
  },
  {
    slug: "flylite",
    displayName: "FlyLite Agent",
    campaignName: "FlyLite Getaways",
    productSummary: "Budget flight and travel package deals.",
    targetTopics: ["travel", "travel.flight", "travel.package"],
    minRelevance: 0.75,
    maxPriceTinybar: "150000",
    totalBudgetTinybar: "10000000",
    creative: {
      headline: "FlyLite Getaways",
      body: "Book your next trip for less.",
      ctaLabel: "See deals",
      destinationUrl: "https://example.com/flylite",
    },
  },
  {
    slug: "pace",
    displayName: "Pace Agent",
    campaignName: "Pace Running Gear",
    productSummary: "Running shoes and fitness gear for everyday athletes.",
    targetTopics: ["sports.running", "fitness"],
    minRelevance: 0.75,
    maxPriceTinybar: "150000",
    totalBudgetTinybar: "10000000",
    creative: {
      headline: "Pace Running Gear",
      body: "Gear built for your next run.",
      ctaLabel: "Shop now",
      destinationUrl: "https://example.com/pace",
    },
  },
];

async function upsertAgentAndCampaign(db: ReturnType<typeof createDb>, agent: DemoAgentSeed) {
  const existingAgent = await db.query.advertiserAgents.findFirst({
    where: eq(advertiserAgents.slug, agent.slug),
  });

  const agentRow =
    existingAgent ??
    (
      await db
        .insert(advertiserAgents)
        .values({
          id: generateId("agent"),
          slug: agent.slug,
          displayName: agent.displayName,
          active: true,
        })
        .returning()
    )[0]!;

  const existingCampaign = await db.query.campaigns.findFirst({
    where: (fields, { eq: eqOp }) => eqOp(fields.advertiserAgentId, agentRow.id),
  });
  if (existingCampaign) return { agent: agentRow, campaign: existingCampaign };

  const [campaign] = await db
    .insert(campaigns)
    .values({
      id: generateId("campaign"),
      advertiserAgentId: agentRow.id,
      name: agent.campaignName,
      productSummary: agent.productSummary,
      minRelevance: agent.minRelevance,
      maxPriceTinybar: agent.maxPriceTinybar,
      totalBudgetTinybar: agent.totalBudgetTinybar,
      spentTinybar: "0",
      creativeJson: agent.creative,
      active: true,
    })
    .returning();

  return { agent: agentRow, campaign: campaign! };
}

async function main() {
  const db = createDb(databaseUrl!);

  const publisher = await upsertPublisher(db);
  const placement = await upsertPlacement(db, publisher.id);

  console.log(`Demo Publisher: ${publisher.id} (${publisher.slug})`);
  console.log(`Home Feed placement: ${placement.id}`);
  console.log(`Demo subjects (convention only, not rows): ${DEMO_SUBJECT_REFS.join(", ")}`);

  for (const agent of DEMO_AGENTS) {
    const { agent: agentRow, campaign } = await upsertAgentAndCampaign(db, agent);
    console.log(`${agentRow.displayName}: agent=${agentRow.id} campaign=${campaign.id}`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
