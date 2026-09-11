CREATE TABLE "advertiser_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"hedera_account_id" text,
	"hcs14_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advertiser_agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campaign_topics" (
	"campaign_id" text NOT NULL,
	"topic_id" text NOT NULL,
	CONSTRAINT "campaign_topics_campaign_id_topic_id_pk" PRIMARY KEY("campaign_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"advertiser_agent_id" text NOT NULL,
	"name" text NOT NULL,
	"product_summary" text NOT NULL,
	"min_relevance" real DEFAULT 0.7 NOT NULL,
	"max_price_tinybar" text NOT NULL,
	"total_budget_tinybar" text NOT NULL,
	"spent_tinybar" text DEFAULT '0' NOT NULL,
	"creative_json" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"intent_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"publisher_id" text NOT NULL,
	"placement_id" text NOT NULL,
	"subject_ref" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"served_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_intent_campaign_unique" UNIQUE("intent_id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "demo_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"data_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_placements" (
	"intent_id" text NOT NULL,
	"placement_id" text NOT NULL,
	CONSTRAINT "intent_placements_intent_id_placement_id_pk" PRIMARY KEY("intent_id","placement_id")
);
--> statement-breakpoint
CREATE TABLE "intent_topics" (
	"intent_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"confidence" real,
	CONSTRAINT "intent_topics_intent_id_topic_id_pk" PRIMARY KEY("intent_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"subject_ref" text NOT NULL,
	"semantic_summary" text,
	"assurances_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"intent_id" text NOT NULL,
	"placement_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"network" text NOT NULL,
	"asset" text NOT NULL,
	"amount_tinybar" text NOT NULL,
	"transaction_id" text,
	"payer_account_id" text,
	"raw_metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payments_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"format" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placements_publisher_slug_unique" UNIQUE("publisher_id","slug")
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"description" text,
	"api_key_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "campaign_topics" ADD CONSTRAINT "campaign_topics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_agent_id_advertiser_agents_id_fk" FOREIGN KEY ("advertiser_agent_id") REFERENCES "public"."advertiser_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_placements" ADD CONSTRAINT "intent_placements_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_placements" ADD CONSTRAINT "intent_placements_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_topics" ADD CONSTRAINT "intent_topics_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intents" ADD CONSTRAINT "intents_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_placement_id_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_topics_topic_idx" ON "campaign_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "deliveries_publisher_subject_idx" ON "deliveries" USING btree ("publisher_id","subject_ref");--> statement-breakpoint
CREATE INDEX "intent_topics_topic_idx" ON "intent_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "intents_publisher_subject_idx" ON "intents" USING btree ("publisher_id","subject_ref");--> statement-breakpoint
CREATE INDEX "intents_expires_at_idx" ON "intents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "opportunities_intent_placement_idx" ON "opportunities" USING btree ("intent_id","placement_id");--> statement-breakpoint
CREATE INDEX "opportunities_expires_at_idx" ON "opportunities" USING btree ("expires_at");