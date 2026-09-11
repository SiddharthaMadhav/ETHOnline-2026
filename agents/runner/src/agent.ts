import { randomUUID } from "node:crypto";
import { decodePaymentResponseHeader } from "@x402/core/http";
import {
  harkOpportunitySchema,
  reachConfirmationSchema,
  tinybarAdd,
  type HarkOpportunity,
  type ReachConfirmation,
} from "@hark-protocol/protocol";
import { canAffordReach, type RunBudgetState } from "./budget.js";
import type { AgentCampaign, RelevanceDecision, RelevanceScorer } from "./relevance/scorer.js";

export type AdvertiserAgentConfig = {
  harkApiUrl: string;
  campaignId: string;
  campaign: AgentCampaign;
  runBudgetTinybar: string;
};

export type ReachResult = {
  confirmation: ReachConfirmation;
  transactionId?: string;
};

/**
 * Implements CLAUDE.md section 16's AdvertisingAgent interface. One instance
 * corresponds to one campaign + one Hedera payer wallet (the payment-wrapped
 * fetch passed in, built by x402-client.ts).
 */
export class AdvertiserAgent {
  private spentTinybar = "0";

  constructor(
    private readonly config: AdvertiserAgentConfig,
    private readonly scorer: RelevanceScorer,
    private readonly fetchWithPayment: typeof fetch,
  ) {}

  async discover(): Promise<HarkOpportunity[]> {
    const url = `${this.config.harkApiUrl}/v1/opportunities?campaignId=${this.config.campaignId}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`GET /v1/opportunities failed: ${res.status}`);
    }
    const body = (await res.json()) as { items: unknown[] };
    return body.items.map((item) => harkOpportunitySchema.parse(item));
  }

  async evaluate(opportunity: HarkOpportunity): Promise<RelevanceDecision> {
    return this.scorer.score(this.config.campaign, opportunity);
  }

  /**
   * The deterministic shouldPay formula (CLAUDE.md section 15): the LLM
   * recommends relevance, but only code enforces money. Never let the scorer
   * bypass any of these checks.
   */
  decide(opportunity: HarkOpportunity, decision: RelevanceDecision): boolean {
    if (!decision.shouldAdvertise) return false;
    if (decision.relevance < this.config.campaign.minRelevance) return false;
    return this.canAffordAnotherReach(opportunity.pricing.amountTinybar);
  }

  /**
   * Budget-only check, independent of relevance - lets a bulk run skip a
   * candidate before spending an LLM call on it once the run budget is
   * already exhausted (CLAUDE.md section 15: only code enforces money).
   */
  canAffordAnotherReach(priceTinybar: string): boolean {
    const state: RunBudgetState = {
      spentTinybar: this.spentTinybar,
      runBudgetTinybar: this.config.runBudgetTinybar,
    };
    return canAffordReach(state, priceTinybar, this.config.campaign.maxPriceTinybar);
  }

  async reach(opportunity: HarkOpportunity): Promise<ReachResult> {
    const idempotencyKey = randomUUID();
    const res = await this.fetchWithPayment(`${this.config.harkApiUrl}/v1/reach`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hark-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ opportunityId: opportunity.id, campaignId: this.config.campaignId }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST /v1/reach failed: ${res.status} ${text}`);
    }

    const paymentResponseHeader = res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
    const transactionId = paymentResponseHeader
      ? decodePaymentResponseHeader(paymentResponseHeader).transaction
      : undefined;

    const confirmation = reachConfirmationSchema.parse(await res.json());
    this.spentTinybar = tinybarAdd(this.spentTinybar, opportunity.pricing.amountTinybar);

    return { confirmation, transactionId };
  }
}
