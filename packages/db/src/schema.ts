import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// --- publishers ---------------------------------------------------------

export const publishers = pgTable("publishers", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain"),
  description: text("description"),
  apiKeyHash: text("api_key_hash").notNull(),
  // Hedera account that revenue-share payouts are sent to. Nullable - a
  // publisher without one configured just accrues an unpaid balance until
  // they set one (CLAUDE.md-adjacent bonus: publisher revenue share).
  payoutHederaAccountId: text("payout_hedera_account_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- placements ----------------------------------------------------------

export const placements = pgTable(
  "placements",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    format: text("format", { enum: ["card", "banner", "text"] }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("placements_publisher_slug_unique").on(table.publisherId, table.slug)],
);

// --- intents ---------------------------------------------------------------

export const revokeReasonEnum = ["fulfilled", "user_requested", "issuer_invalidated", "other"] as const;

export const intents = pgTable(
  "intents",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    subjectRef: text("subject_ref").notNull(),
    semanticSummary: text("semantic_summary"),
    assurancesJson: jsonb("assurances_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason", { enum: revokeReasonEnum }),
  },
  (table) => [
    index("intents_publisher_subject_idx").on(table.publisherId, table.subjectRef),
    index("intents_expires_at_idx").on(table.expiresAt),
  ],
);

export const intentTopics = pgTable(
  "intent_topics",
  {
    intentId: text("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    topicId: text("topic_id").notNull(),
    confidence: real("confidence"),
  },
  (table) => [
    primaryKey({ columns: [table.intentId, table.topicId] }),
    index("intent_topics_topic_idx").on(table.topicId),
  ],
);

export const intentPlacements = pgTable(
  "intent_placements",
  {
    intentId: text("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    placementId: text("placement_id")
      .notNull()
      .references(() => placements.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.intentId, table.placementId] })],
);

// --- advertiser agents / campaigns ------------------------------------------

export const advertiserAgents = pgTable("advertiser_agents", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  hederaAccountId: text("hedera_account_id"),
  hcs14Id: text("hcs14_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  advertiserAgentId: text("advertiser_agent_id")
    .notNull()
    .references(() => advertiserAgents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  productSummary: text("product_summary").notNull(),
  minRelevance: real("min_relevance").notNull().default(0.7),
  maxPriceTinybar: text("max_price_tinybar").notNull(),
  totalBudgetTinybar: text("total_budget_tinybar").notNull(),
  spentTinybar: text("spent_tinybar").notNull().default("0"),
  creativeJson: jsonb("creative_json").notNull(),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignTopics = pgTable(
  "campaign_topics",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    topicId: text("topic_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.campaignId, table.topicId] }),
    index("campaign_topics_topic_idx").on(table.topicId),
  ],
);

// --- opportunities / deliveries / payments ---------------------------------

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    intentId: text("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    placementId: text("placement_id")
      .notNull()
      .references(() => placements.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("opportunities_intent_placement_idx").on(table.intentId, table.placementId),
    index("opportunities_expires_at_idx").on(table.expiresAt),
  ],
);

export const deliveryStatusEnum = ["queued", "served", "dismissed"] as const;

export const payoutStatusEnum = ["pending", "paid", "failed"] as const;

// Batch payout runs - one row per (publisher, payout run), not per payment.
// Real HBAR transfer to a publisher's payoutHederaAccountId, executed by
// scripts/run-publisher-payouts.ts, never per-reach (CLAUDE.md-adjacent
// bonus: publisher revenue share; see docs/STATUS.md).
export const publisherPayouts = pgTable("publisher_payouts", {
  id: text("id").primaryKey(),
  publisherId: text("publisher_id")
    .notNull()
    .references(() => publishers.id, { onDelete: "cascade" }),
  totalTinybar: text("total_tinybar").notNull(),
  status: text("status", { enum: payoutStatusEnum }).notNull().default("pending"),
  transactionId: text("transaction_id"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  network: text("network").notNull(),
  asset: text("asset").notNull(),
  amountTinybar: text("amount_tinybar").notNull(),
  // Revenue split, computed once at creation from the configured share ratio
  // (HARK_PUBLISHER_SHARE_BPS) - always sums back to amountTinybar exactly.
  publisherShareTinybar: text("publisher_share_tinybar"),
  protocolShareTinybar: text("protocol_share_tinybar"),
  // Set once this payment's publisher share has been included in a payout run.
  publisherPayoutId: text("publisher_payout_id").references(() => publisherPayouts.id),
  transactionId: text("transaction_id").unique(),
  payerAccountId: text("payer_account_id"),
  rawMetadataJson: jsonb("raw_metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveries = pgTable(
  "deliveries",
  {
    id: text("id").primaryKey(),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    intentId: text("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publishers.id, { onDelete: "cascade" }),
    placementId: text("placement_id")
      .notNull()
      .references(() => placements.id, { onDelete: "cascade" }),
    subjectRef: text("subject_ref").notNull(),
    status: text("status", { enum: deliveryStatusEnum }).notNull().default("queued"),
    paymentId: text("payment_id").references(() => payments.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    servedAt: timestamp("served_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Only one delivery per (intent, campaign) - CLAUDE.md section 13.
    unique("deliveries_intent_campaign_unique").on(table.intentId, table.campaignId),
    index("deliveries_publisher_subject_idx").on(table.publisherId, table.subjectRef),
  ],
);

// --- demo observability ------------------------------------------------------

export const demoEvents = pgTable("demo_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actor: text("actor").notNull(),
  dataJson: jsonb("data_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
