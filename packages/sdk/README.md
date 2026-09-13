# @hark-protocol/sdk

Publisher and advertiser clients for [Hark Protocol](https://github.com/SiddharthaMadhav/ETHOnline-2026) -
an open intent-advertising protocol where platforms publish temporary,
privacy-preserving user intent and autonomous advertising agents pay through
x402 on Hedera to reach matching users.

## Publisher client

Authenticated with a publisher secret - never expose this in browser code.

```ts
import { HarkPublisherClient } from "@hark-protocol/sdk";

const hark = new HarkPublisherClient({
  baseUrl: "https://your-hark-api.example.com",
  publisherKey: process.env.DEMO_PUBLISHER_KEY!,
});

const intent = await hark.intents.create({
  subjectRef: "user-001",
  placementIds: ["plc_..."],
  topics: [{ id: "electronics.computer.laptop", confidence: 0.91 }],
  semanticSummary: "Looking for a lightweight computer for coding.",
});

await hark.intents.update(intent.id, { expiresInSeconds: 2592000 });
await hark.intents.revoke(intent.id, "user_requested");
const feed = await hark.feed.get("user-001");
await hark.deliveries.markServed(feed[0].id);
```

## Advertiser client

Every method except `reach()` is free - no Hark API key required.

```ts
import { HarkAdvertiserClient } from "@hark-protocol/sdk";

const hark = new HarkAdvertiserClient({ baseUrl: "https://your-hark-api.example.com" });

const discovery = await hark.discovery.get();
const opportunities = await hark.opportunities.list(campaignId);
```

`reach()` is x402-gated: pass an x402-capable `fetch` (e.g. `@x402/fetch`'s
`wrapFetchWithPayment`) as the client's `fetch` option. This client never
owns or touches Hedera keys itself.

```ts
const hark = new HarkAdvertiserClient({ baseUrl, fetch: fetchWithPayment });
const { confirmation, transactionId } = await hark.reach({ opportunityId, campaignId });
```

Part of the [Hark Protocol](https://github.com/SiddharthaMadhav/ETHOnline-2026)
monorepo. See that repo for the full protocol spec, API, and demo apps.
