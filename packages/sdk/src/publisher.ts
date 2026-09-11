import { z } from "zod";
import {
  createIntentInputSchema,
  updateIntentInputSchema,
  harkIntentSchema,
  feedDeliverySchema,
  type CreateIntentInput,
  type UpdateIntentInput,
  type RevokeReason,
  type HarkIntent,
  type FeedDelivery,
} from "@hark-protocol/protocol";
import { normalizeBaseUrl, requestJson, type HarkClientConfig, type HarkFetch } from "./client.js";

export type HarkPublisherClientConfig = HarkClientConfig & {
  /** The publisher's own secret (CLAUDE.md section 11) - sent as a Bearer token. */
  publisherKey: string;
};

/**
 * Publisher-side client (CLAUDE.md section 20). Every call is authenticated
 * with the publisher's own secret - never expose an instance of this client,
 * or the key passed into it, to untrusted/browser code.
 */
export class HarkPublisherClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: HarkFetch;
  private readonly publisherKey: string;

  constructor(config: HarkPublisherClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.fetchImpl = config.fetch ?? fetch;
    this.publisherKey = config.publisherKey;
  }

  private authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.publisherKey}` };
  }

  intents = {
    create: async (input: CreateIntentInput): Promise<HarkIntent> => {
      createIntentInputSchema.parse(input);
      const { data } = await requestJson(this.fetchImpl, `${this.baseUrl}/v1/intents`, {
        method: "POST",
        headers: { "content-type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(input),
      });
      return harkIntentSchema.parse(data);
    },

    update: async (intentId: string, input: UpdateIntentInput): Promise<HarkIntent> => {
      updateIntentInputSchema.parse(input);
      const { data } = await requestJson(
        this.fetchImpl,
        `${this.baseUrl}/v1/intents/${encodeURIComponent(intentId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", ...this.authHeaders() },
          body: JSON.stringify(input),
        },
      );
      return harkIntentSchema.parse(data);
    },

    revoke: async (intentId: string, reason: RevokeReason = "other"): Promise<HarkIntent> => {
      const { data } = await requestJson(
        this.fetchImpl,
        `${this.baseUrl}/v1/intents/${encodeURIComponent(intentId)}`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json", ...this.authHeaders() },
          body: JSON.stringify({ reason }),
        },
      );
      return harkIntentSchema.parse(data);
    },
  };

  feed = {
    get: async (subjectRef: string): Promise<FeedDelivery[]> => {
      const { data } = await requestJson(
        this.fetchImpl,
        `${this.baseUrl}/v1/feed/${encodeURIComponent(subjectRef)}`,
        { headers: this.authHeaders() },
      );
      return z.object({ items: z.array(feedDeliverySchema) }).parse(data).items;
    },
  };

  deliveries = {
    markServed: async (deliveryId: string): Promise<FeedDelivery> => {
      const { data } = await requestJson(
        this.fetchImpl,
        `${this.baseUrl}/v1/deliveries/${encodeURIComponent(deliveryId)}/served`,
        { method: "POST", headers: this.authHeaders() },
      );
      return feedDeliverySchema.parse(data);
    },
  };
}
