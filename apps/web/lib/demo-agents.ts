/**
 * Static, non-sensitive display info for the three seeded demo agents,
 * mirroring agents/runner/src/configs/*.ts and packages/db/src/seed.ts the
 * same intentionally-duplicated way those two already mirror each other -
 * this app, the agent runner, and Hark's seed script are conceptually
 * separate parties in the demo, not one shared codebase.
 */
export const DEMO_AGENTS = [
  {
    slug: "novabook",
    displayName: "NovaBook Agent",
    campaignName: "NovaBook Air",
    targetTopics: ["electronics.computer.laptop", "education.student-technology"],
    minRelevance: 0.8,
  },
  {
    slug: "flylite",
    displayName: "FlyLite Agent",
    campaignName: "FlyLite Getaways",
    targetTopics: ["travel", "travel.flight", "travel.package"],
    minRelevance: 0.75,
  },
  {
    slug: "pace",
    displayName: "Pace Agent",
    campaignName: "Pace Running Gear",
    targetTopics: ["sports.running", "fitness"],
    minRelevance: 0.75,
  },
] as const;
