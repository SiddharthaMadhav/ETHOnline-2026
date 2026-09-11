import { z } from "zod";
import { decodePaymentResponseHeader } from "@x402/core/http";
import {
  harkOpportunitySchema,
  campaignSchema,
  createCampaignInputSchema,
  reachConfirmationSchema,
  type HarkOpportunity,
  type Campaign,
  type CreateCampaignInput,
  type ReachConfirmation,
} from "@hark-protocol/protocol";
import { normalizeBaseUrl, requestJson, type HarkClientConfig, type HarkFetch } from "./client.js";

export type DiscoveryDocument = {
  name: string;
  protocolVersion: string;
  description: string;
  network: string;
  paymentProtocol: string;
  asset: string;
  services: Array<{ name: string; method: string; path: string; paid: boolean }>;
};

export type TopicDefinition = { id: string; label: string; parentId?: string };

export type ReachParams = {
  opportunityId: string;
  campaignId: string;
  /** Defaults to a random UUID (CLAUDE.md section 19). */
  idempotencyKey?: string;
};

export type ReachResult = {
  confirmation: ReachConfirmation;
  /** Settled Hedera transaction id, decoded from the x402 payment-response header, when present. */
  transactionId?: string;
};

/**
 * Advertiser-side client (CLAUDE.md section 20). Every method except
 * `reach()` is free and requires no Hark API key at all (CLAUDE.md section
 * 2.8) - it needs no publisher secret, only whatever `fetch` you pass in.
 *
 * `reach()` is x402-gated: pass an x402-capable `fetch` in the constructor
 * (e.g. `@x402/fetch`'s `wrapFetchWithPayment`). This client never owns or
 * touches Hedera keys itself - it only calls whatever `fetch` it was given.
 */
export class HarkAdvertiserClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: HarkFetch;

  constructor(config: HarkClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.fetchImpl = config.fetch ?? fetch;
  }

  discovery = {
    get: async (): Promise<DiscoveryDocument> => {
      const { data } = await requestJson(this.fetchImpl, `${this.baseUrl}/.well-known/hark.json`);
      return data as DiscoveryDocument;
    },
  };

  topics = {
    list: async (): Promise<TopicDefinition[]> => {
      const { data } = await requestJson(this.fetchImpl, `${this.baseUrl}/v1/topics`);
      return z
        .object({
          items: z.array(z.object({ id: z.string(), label: z.string(), parentId: z.string().optional() })),
        })
        .parse(data).items;
    },
  };

  campaigns = {
    create: async (input: CreateCampaignInput): Promise<Campaign> => {
      createCampaignInputSchema.parse(input);
      const { data } = await requestJson(this.fetchImpl, `${this.baseUrl}/v1/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return campaignSchema.parse(data);
    },

    list: async (): Promise<Campaign[]> => {
      const { data } = await requestJson(this.fetchImpl, `${this.baseUrl}/v1/campaigns`);
      return z.object({ items: z.array(campaignSchema) }).parse(data).items;
    },
  };

  opportunities = {
    list: async (campaignId?: string): Promise<HarkOpportunity[]> => {
      const url = new URL(`${this.baseUrl}/v1/opportunities`);
      if (campaignId) url.searchParams.set("campaignId", campaignId);
      const { data } = await requestJson(this.fetchImpl, url.toString());
      return z.object({ items: z.array(harkOpportunitySchema) }).parse(data).items;
    },
  };

  reach = async (params: ReachParams): Promise<ReachResult> => {
    const idempotencyKey = params.idempotencyKey ?? crypto.randomUUID();
    const { data, response } = await requestJson(this.fetchImpl, `${this.baseUrl}/v1/reach`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hark-idempotency-key": idempotencyKey },
      body: JSON.stringify({ opportunityId: params.opportunityId, campaignId: params.campaignId }),
    });

    const paymentResponseHeader =
      response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
    let transactionId: string | undefined;
    if (paymentResponseHeader) {
      try {
        transactionId = decodePaymentResponseHeader(paymentResponseHeader).transaction;
      } catch {
        transactionId = undefined;
      }
    }

    return { confirmation: reachConfirmationSchema.parse(data), transactionId };
  };
}
