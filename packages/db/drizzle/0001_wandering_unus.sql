CREATE TABLE "publisher_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"total_tinybar" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transaction_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "publisher_share_tinybar" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "protocol_share_tinybar" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "publisher_payout_id" text;--> statement-breakpoint
ALTER TABLE "publishers" ADD COLUMN "payout_hedera_account_id" text;--> statement-breakpoint
ALTER TABLE "publisher_payouts" ADD CONSTRAINT "publisher_payouts_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_publisher_payout_id_publisher_payouts_id_fk" FOREIGN KEY ("publisher_payout_id") REFERENCES "public"."publisher_payouts"("id") ON DELETE no action ON UPDATE no action;