# 📯 Hark Protocol — CLAUDE.md

> This file is the canonical build specification for Hark Protocol.
> Read it completely before changing architecture, adding dependencies, or implementing features.
> When implementation details in a fast-moving dependency differ from examples here, preserve the behavior and architecture defined here, inspect the installed package types/current official docs, and adapt the code. Do not invent library APIs.

---

## 0. Mission

Build **Hark Protocol**, an open, off-chain intent advertising protocol with on-chain machine payments on Hedera.

Hark lets a platform publish temporary, pseudonymous commercial intent on behalf of its users. Advertising agents discover anonymous advertising opportunities, decide whether an opportunity is relevant to their campaign, and pay Hark programmatically through **x402 on Hedera** to reach that user.

The human does **not** pay.

The advertising agent pays.

Hark should demonstrate a new advertising model:

```text
traditional advertising
behavior tracking -> infer interest -> target user

Hark
temporary intent -> advertiser agent evaluates relevance -> x402 payment -> relevant ad
```

The core value proposition is:

> **Platforms expose temporary user intent. Advertising agents pay programmatically to reach matching users.**

Hark is not a blockchain database. Hark is not a user identity network. Hark is not a marketplace where users manually list exact purchasing requirements.

**All Hark APIs and business logic are off-chain. Only x402 payment settlement is on Hedera.**

---

## 1. Hackathon target

This project is being built for the **ETHOnline 2026 Hedera AI & Agentic Payments track**.

The implementation MUST satisfy these qualification requirements:

- Host a **live x402-gated service** on Hedera testnet or mainnet.
- Settlement MUST happen through the **Blocky402 facilitator**.
- Build a platform or agent that consumes the service.
- Complete at least one **real paid request end-to-end**.
- Maintain a public GitHub repository.
- README must explain setup, architecture, and payment flow.
- Demo video must be <= 5 minutes and visibly show the paid request.

Hark's qualifying paid service is:

```text
POST /v1/reach
```

An advertiser agent calls it to deliver an advertisement to an anonymous user with an eligible active intent.

The first request receives HTTP 402.

The advertiser agent automatically signs the Hedera x402 payment and retries.

Blocky402 verifies/settles the payment on Hedera testnet.

Hark then queues the ad delivery.

This exact flow must work before optional bonus features are attempted.

### Bonus features, only after core flow works

In this priority order:

1. HCS payment/action audit trail.
2. On-chain advertiser agent identity using HCS-14.
3. Better agent/service discovery.
4. HTS payment asset support.
5. Multi-agent bidding/negotiation.
6. Scheduled/recurring payments.

Do not implement bonus features before the mandatory paid HBAR flow passes a live end-to-end test.

---

## 2. Product principles

These are architectural invariants.

### 2.1 Intent is temporary

Hark represents what a user appears to care about **now**, not a permanent advertising profile.

Every intent MUST have:

- `createdAt`
- `expiresAt`

Expired intents are never eligible for advertising.

An intent can be revoked early.

### 2.2 Intent can be high-level

A valid intent can be as simple as:

```json
{
  "topic": "electronics.computer.laptop"
}
```

Do not require:

- budget
- exact product
- exact specs
- purchase date
- brand preference

Optional semantic context can improve matching, but the protocol must work without it.

### 2.3 Hark does not decide how intent was detected

A publisher may derive intent from:

- explicit user selection
- search activity
- browsing context
- a conversation with an AI assistant
- a recommendation workflow
- another internal signal

Hark standardizes the intent object after the platform has decided to publish it.

### 2.4 Human verification is outside Hark core

World or any other liveness/personhood mechanism belongs at the **publisher platform layer**, not as a protocol requirement.

A publisher MAY attach optional assurance metadata such as:

```json
{
  "type": "human_liveness",
  "provider": "world",
  "level": "low"
}
```

Hark treats this as publisher-supplied metadata.

Hark must not directly depend on World.

### 2.5 Publisher identity is visible to advertisers

Advertiser agents SHOULD know:

- which platform published the opportunity
- placement
- supported creative format
- topic
- sanitized semantic summary if present
- confidence if present
- price
- expiration
- aggregate or publisher-level reputation in future versions

Advertiser agents MUST NOT receive:

- name
- email
- phone
- IP address
- wallet address of the human
- publisher's internal user ID
- raw browsing history
- raw private conversation
- stable cross-platform identifier

### 2.6 The advertiser buys reach, not identity

The paid action is permission to deliver an advertisement to an eligible anonymous subject.

The paid response must not reveal the user's identity.

### 2.7 Hark is off-chain

Never put user intents directly on Hedera.

Do not deploy smart contracts for the MVP.

Use Hedera for:

- x402 payment settlement
- payment transaction proof
- optional HCS audit logs later
- optional HCS-14 agent identity later

### 2.8 No API key is required for the paid advertiser service

`POST /v1/reach` must be consumable via x402 without a Hark subscription or advertiser API key.

Publisher mutation APIs may use publisher authentication because publisher administration is a different trust boundary.

---

## 3. Roles

Hark has four conceptual actors.

### Subject

The human whose temporary commercial intent exists.

The subject is identified inside Hark only by an opaque publisher-scoped reference.

### Publisher

The platform that detected intent and sent it to Hark.

Examples:

- search platform
- social platform
- shopping app
- browser
- AI assistant
- marketplace
- demo publisher app

### Advertiser Agent

An autonomous or semi-autonomous agent representing an advertiser or campaign.

Responsibilities:

- discover opportunities
- evaluate semantic relevance
- obey budget constraints
- decide whether to advertise
- call the paid Hark endpoint
- handle HTTP 402 automatically
- pay on Hedera
- receive delivery confirmation

### Hark

Hark provides:

- protocol schemas
- intent registry
- campaign registry
- opportunity generation
- matching metadata
- x402-gated reach endpoint
- ad delivery queue
- SDK
- service discovery
- demo observability

---

## 4. Core user story

The primary demo flow is:

```text
1. Human interacts with Demo Publisher.

2. Demo Publisher detects:
   "This user appears interested in laptops."

3. Publisher normalizes and publishes:
   electronics.computer.laptop

4. Hark stores the temporary intent.

5. Advertiser agents discover an anonymous opportunity:
   publisher = Demo Publisher
   topic = electronics.computer.laptop
   summary = "Looking for something lightweight for college coding"
   placement = home-feed
   user identity = NOT exposed

6. Laptop advertiser agent evaluates relevance using an LLM.

7. Irrelevant advertiser agents skip the opportunity.

8. Laptop agent decides relevance is high enough and budget allows it.

9. Laptop agent calls:
   POST /v1/reach

10. Hark returns:
    HTTP 402 Payment Required

11. Agent automatically signs and retries using x402.

12. Blocky402 settles the payment on Hedera testnet.

13. Hark creates the delivery.

14. Demo Publisher's user feed shows the relevant advertisement.

15. UI shows:
    "Why am I seeing this?"
    "Because you have an active Laptop intent."

16. UI displays the Hedera transaction ID / HashScan link.
```

This flow is the definition of done for the MVP.

---

## 5. Technology stack

Use TypeScript for the full critical path.

Do NOT add Python to the MVP unless there is a concrete feature that cannot reasonably be done in TypeScript.

### Runtime and monorepo

- Node.js 20+
- TypeScript
- pnpm workspaces
- ESM
- `tsx` for development scripts

### Hark API

- Express
- Zod
- Drizzle ORM
- PostgreSQL
- `pg`

### Demo web app

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### AI / advertiser reasoning

- Vercel AI SDK compatible architecture
- OpenAI provider for the initial demo
- Zod-validated structured outputs
- provider implementation hidden behind a local `RelevanceScorer` interface

Do not couple protocol types to an LLM provider.

### Hedera

- `@hiero-ledger/sdk`
- ECDSA Hedera testnet accounts for advertiser agents

### Hedera Agent Kit

Use current v4 packages if/when agent Hedera tooling or HCS features are needed:

- `@hashgraph/hedera-agent-kit`
- `@hashgraph/hedera-agent-kit-ai-sdk`

Do not make the first x402 payment depend on Agent Kit. The x402 Hedera signer is enough for the mandatory flow.

### x402

Use x402 protocol v2.

Use matching versions of:

- `@x402/core`
- `@x402/express`
- `@x402/fetch`
- `@x402/hedera`

As of 2026-09-11, `@x402/hedera` and `@x402/fetch` have a current 2.25.0 release. Keep all `@x402/*` packages on the same compatible version.

Before implementation, inspect installed package exports/types. x402 is actively evolving. Do not copy old v1 examples.

### Facilitator

Mandatory:

```text
https://api.testnet.blocky402.com
```

Network:

```text
hedera:testnet
```

Initial asset:

```text
HBAR
asset id: 0.0.0
decimals: 8
```

Initial demo reach price:

```text
0.001 HBAR
100000 tinybar
```

Make the price configurable by environment variable.

---

## 6. Repository layout

Create this structure:

```text
hark/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   ├── config.ts
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   ├── discovery.ts
│   │   │   │   ├── publishers.ts
│   │   │   │   ├── intents.ts
│   │   │   │   ├── campaigns.ts
│   │   │   │   ├── opportunities.ts
│   │   │   │   ├── reach.ts
│   │   │   │   ├── feed.ts
│   │   │   │   └── demo-events.ts
│   │   │   ├── services/
│   │   │   │   ├── intent-service.ts
│   │   │   │   ├── campaign-service.ts
│   │   │   │   ├── opportunity-service.ts
│   │   │   │   ├── delivery-service.ts
│   │   │   │   └── payment-service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── publisher-auth.ts
│   │   │   │   ├── error-handler.ts
│   │   │   │   └── rate-limit.ts
│   │   │   └── x402/
│   │   │       ├── facilitator.ts
│   │   │       ├── resource-server.ts
│   │   │       └── payment-middleware.ts
│   │   └── package.json
│   │
│   └── web/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── publisher/
│       │   ├── agents/
│       │   └── explorer/
│       ├── components/
│       ├── lib/
│       └── package.json
│
├── agents/
│   ├── runner/
│   │   ├── src/
│   │   │   ├── cli.ts
│   │   │   ├── agent.ts
│   │   │   ├── relevance/
│   │   │   │   ├── scorer.ts
│   │   │   │   ├── openai-scorer.ts
│   │   │   │   └── deterministic-scorer.ts
│   │   │   ├── budget.ts
│   │   │   ├── x402-client.ts
│   │   │   └── configs/
│   │   └── package.json
│
├── packages/
│   ├── protocol/
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   ├── taxonomy.ts
│   │   │   ├── constants.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── sdk/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── publisher.ts
│   │   │   ├── advertiser.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── db/
│       ├── src/
│       │   ├── schema.ts
│       │   ├── client.ts
│       │   └── seed.ts
│       ├── drizzle/
│       └── package.json
│
├── scripts/
│   ├── check-blocky.ts
│   ├── create-testnet-config.ts
│   └── live-payment-smoke.ts
│
├── docs/
│   ├── PROTOCOL.md
│   ├── ARCHITECTURE.md
│   ├── PAYMENT_FLOW.md
│   └── DEMO.md
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── README.md
└── CLAUDE.md
```

Do not add Turborepo unless a concrete need appears.

---

## 7. Protocol package

`packages/protocol` contains all shared Hark schemas.

It must not depend on:

- Express
- React
- Drizzle
- OpenAI
- Hedera SDK

It may depend on:

- Zod

All API apps and SDKs import these schemas.

---

## 8. Canonical taxonomy

Start with a small hierarchical taxonomy.

Do not attempt to build a universal commercial ontology during the hackathon.

Initial taxonomy:

```text
electronics
electronics.computer
electronics.computer.laptop
electronics.computer.desktop
electronics.phone
electronics.tablet

travel
travel.flight
travel.hotel
travel.package

automotive
automotive.car
automotive.motorcycle

finance
finance.insurance
finance.credit-card
finance.loan

sports
sports.running
sports.cycling

fitness
fitness.gym

home
home.furniture
home.renovation

education
education.course
education.student-technology
```

Represent taxonomy as code for v0.1.

Each topic has:

```ts
type TopicDefinition = {
  id: string;
  label: string;
  parentId?: string;
};
```

Support:

```ts
isSameOrDescendant(candidate, target)
```

and:

```ts
topicDistance(a, b)
```

Keep this deterministic.

No blockchain registry for topics in MVP.

---

## 9. Core protocol schemas

Use Zod and derive TypeScript types.

### Publisher

```ts
type Publisher = {
  id: string;
  slug: string;
  name: string;
  domain?: string;
  description?: string;
  active: boolean;
  createdAt: string;
};
```

### Placement

A publisher may expose one or more advertising placements.

```ts
type Placement = {
  id: string;
  publisherId: string;
  slug: string;
  name: string;
  format: "card" | "banner" | "text";
  description?: string;
  active: boolean;
};
```

### Assurance

Optional metadata supplied by publisher.

```ts
type Assurance = {
  type: string;
  provider: string;
  level?: string;
  issuedAt?: string;
  expiresAt?: string;
};
```

Hark does not independently verify these in v0.1.

### Intent

```ts
type HarkIntent = {
  id: string;

  publisherId: string;

  // Opaque, publisher-scoped reference.
  // NEVER return this to advertiser endpoints.
  subjectRef: string;

  placementIds: string[];

  topics: Array<{
    id: string;
    confidence?: number;
  }>;

  // Sanitized commercial meaning only.
  // Never raw private conversation.
  semanticSummary?: string;

  assurances?: Assurance[];

  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revokeReason?: "fulfilled" | "user_requested" | "issuer_invalidated" | "other" | null;
};
```

Rules:

- at least one topic required
- confidence, if present, between 0 and 1
- `semanticSummary` max 280 characters
- default TTL: 30 days
- maximum TTL: 90 days
- publisher may refresh intent
- expired/revoked intent is ineligible

### Campaign

```ts
type Campaign = {
  id: string;

  advertiserAgentId: string;
  advertiserName: string;

  name: string;
  productSummary: string;

  targetTopics: string[];

  minRelevance: number;

  maxPriceTinybar: string;
  totalBudgetTinybar: string;

  creative: {
    headline: string;
    body: string;
    imageUrl?: string;
    ctaLabel: string;
    destinationUrl: string;
  };

  active: boolean;
  startsAt?: string;
  endsAt?: string;

  createdAt: string;
};
```

### Opportunity

This is the advertiser-visible anonymous object.

```ts
type HarkOpportunity = {
  id: string;

  publisher: {
    id: string;
    name: string;
    domain?: string;
  };

  placement: {
    id: string;
    name: string;
    format: "card" | "banner" | "text";
  };

  intent: {
    topics: Array<{
      id: string;
      confidence?: number;
    }>;
    semanticSummary?: string;
    assurances?: Assurance[];
    expiresAt: string;
  };

  pricing: {
    network: "hedera:testnet";
    asset: "0.0.0";
    amountTinybar: string;
  };

  expiresAt: string;
};
```

`HarkOpportunity` MUST NOT contain:

- `subjectRef`
- internal intent database ID if it enables correlation
- PII

Opportunity IDs should be opaque.

### Delivery

```ts
type Delivery = {
  id: string;
  campaignId: string;
  publisherId: string;
  placementId: string;

  // Internal only.
  intentId: string;
  subjectRef: string;

  status: "queued" | "served" | "dismissed";

  payment: {
    network: "hedera:testnet";
    asset: "0.0.0";
    amountTinybar: string;
    transactionId?: string;
    payerAccountId?: string;
  };

  createdAt: string;
  servedAt?: string;
};
```

Never serialize internal `subjectRef` to advertiser-facing responses.

---

## 10. Database schema

Use PostgreSQL and Drizzle.

Tables:

### `publishers`

Fields:

- `id` uuid pk
- `slug` unique
- `name`
- `domain`
- `description`
- `api_key_hash`
- `active`
- timestamps

Never store publisher API keys plaintext.

### `placements`

- `id`
- `publisher_id`
- `slug`
- `name`
- `format`
- `description`
- `active`
- timestamps

Unique `(publisher_id, slug)`.

### `intents`

- `id`
- `publisher_id`
- `subject_ref`
- `semantic_summary`
- `assurances_json`
- `created_at`
- `expires_at`
- `revoked_at`
- `revoke_reason`

Index:

- `(publisher_id, subject_ref)`
- `expires_at`

### `intent_topics`

- `intent_id`
- `topic_id`
- `confidence`

Index `topic_id`.

### `intent_placements`

- `intent_id`
- `placement_id`

### `advertiser_agents`

- `id`
- `slug`
- `display_name`
- `hedera_account_id`
- optional `hcs14_id`
- active
- timestamps

### `campaigns`

- `id`
- `advertiser_agent_id`
- `name`
- `product_summary`
- `min_relevance`
- `max_price_tinybar`
- `total_budget_tinybar`
- `spent_tinybar`
- `creative_json`
- active
- `starts_at`
- `ends_at`
- timestamps

### `campaign_topics`

- `campaign_id`
- `topic_id`

### `opportunities`

For the MVP, materialize short-lived opportunities so agent decisions can reference a stable opaque ID.

- `id`
- `intent_id`
- `placement_id`
- `expires_at`
- `consumed_at`
- timestamps

Do not expose `intent_id`.

Opportunity TTL should be short, e.g. 5 minutes.

### `deliveries`

- `id`
- `opportunity_id`
- `intent_id`
- `campaign_id`
- `publisher_id`
- `placement_id`
- `subject_ref`
- `status`
- `payment_id`
- timestamps

### `payments`

- `id`
- `idempotency_key`
- `network`
- `asset`
- `amount_tinybar`
- `transaction_id`
- `payer_account_id`
- raw payment response metadata if safe
- timestamps

Unique:

- `idempotency_key`
- `transaction_id` when present

Do not store secrets or private keys.

### `demo_events`

For demo observability only.

- `id`
- `type`
- `actor`
- `data_json`
- `created_at`

Example events:

- `intent.created`
- `agent.opportunities_fetched`
- `agent.relevance_scored`
- `agent.skipped`
- `reach.payment_required`
- `reach.payment_settled`
- `delivery.queued`
- `delivery.served`

---

## 11. Publisher authentication

Publisher write/read APIs are authenticated.

Use:

```http
Authorization: Bearer <publisher-secret>
```

Store only a secure hash of publisher secrets.

For demo seed, create one publisher:

```text
Demo Publisher
slug: demo-publisher
```

and one placement:

```text
home-feed
format: card
```

Advertiser discovery and paid reach MUST NOT require a Hark API key.

---

## 12. API surface

All JSON APIs are under:

```text
/v1
```

### Health

```http
GET /health
```

Return:

```json
{
  "status": "ok",
  "service": "hark-api"
}
```

### Protocol/service discovery

```http
GET /.well-known/hark.json
```

Return protocol information, supported network, asset, paid resource, and schema version.

Example:

```json
{
  "name": "Hark Protocol",
  "protocolVersion": "0.1.0",
  "description": "Intent-aware advertising for autonomous advertiser agents",
  "network": "hedera:testnet",
  "paymentProtocol": "x402",
  "asset": "0.0.0",
  "services": [
    {
      "name": "reach",
      "method": "POST",
      "path": "/v1/reach",
      "paid": true
    }
  ]
}
```

### Topics

```http
GET /v1/topics
```

Return taxonomy.

### Create intent

Publisher authenticated.

```http
POST /v1/intents
```

Body:

```json
{
  "subjectRef": "user-demo-001",
  "placementIds": ["<home-feed-id>"],
  "topics": [
    {
      "id": "electronics.computer.laptop",
      "confidence": 0.91
    }
  ],
  "semanticSummary": "Looking for something lightweight for college coding.",
  "expiresInSeconds": 2592000,
  "assurances": []
}
```

Response contains Hark intent ID and expiry.

### Refresh/update intent

```http
PATCH /v1/intents/:intentId
```

Allow:

- topics
- confidence
- summary
- expiry refresh
- placements

Publisher must own intent.

### Revoke intent

```http
DELETE /v1/intents/:intentId
```

Body:

```json
{
  "reason": "fulfilled"
}
```

Do not physically delete. Mark revoked.

### Create campaign

```http
POST /v1/campaigns
```

For the demo this can be an open development endpoint or locally seeded.

Body:

```json
{
  "advertiserAgentId": "agent-novabook",
  "advertiserName": "NovaBook",
  "name": "NovaBook Air",
  "productSummary": "Lightweight laptop aimed at students and developers.",
  "targetTopics": [
    "electronics.computer.laptop"
  ],
  "minRelevance": 0.8,
  "maxPriceTinybar": "150000",
  "totalBudgetTinybar": "10000000",
  "creative": {
    "headline": "NovaBook Air",
    "body": "Light enough for campus. Powerful enough for code.",
    "ctaLabel": "Explore",
    "destinationUrl": "https://example.com/novabook"
  }
}
```

### List opportunities

```http
GET /v1/opportunities?campaignId=<id>
```

This endpoint is free.

It returns anonymous short-lived opportunities.

It MAY prefilter by topic intersection/ancestor relation to avoid wasting LLM calls.

Do not over-filter. Semantic reasoning belongs to the advertiser agent.

Response:

```json
{
  "items": [
    {
      "id": "opp_xxx",
      "publisher": {
        "id": "pub_xxx",
        "name": "Demo Publisher"
      },
      "placement": {
        "id": "plc_xxx",
        "name": "Home Feed",
        "format": "card"
      },
      "intent": {
        "topics": [
          {
            "id": "electronics.computer.laptop",
            "confidence": 0.91
          }
        ],
        "semanticSummary": "Looking for something lightweight for college coding.",
        "expiresAt": "..."
      },
      "pricing": {
        "network": "hedera:testnet",
        "asset": "0.0.0",
        "amountTinybar": "100000"
      },
      "expiresAt": "..."
    }
  ]
}
```

Never return subject identity.

### Paid reach

```http
POST /v1/reach
```

This route MUST be protected by x402.

Body:

```json
{
  "opportunityId": "opp_xxx",
  "campaignId": "cmp_xxx"
}
```

Client SHOULD send:

```http
X-Hark-Idempotency-Key: <uuid>
```

Behavior:

1. x402 middleware challenges unpaid request.
2. client pays/retries.
3. handler validates opportunity and campaign.
4. handler atomically marks opportunity consumed.
5. create payment record.
6. create delivery linked to the internal intent/subject.
7. increment campaign spend.
8. return advertiser-safe confirmation.

Response:

```json
{
  "deliveryId": "del_xxx",
  "status": "queued",
  "publisher": {
    "id": "pub_xxx",
    "name": "Demo Publisher"
  },
  "placement": {
    "id": "plc_xxx",
    "name": "Home Feed"
  },
  "payment": {
    "network": "hedera:testnet",
    "asset": "0.0.0",
    "amountTinybar": "100000",
    "transactionId": "..."
  }
}
```

Do not return:

- subjectRef
- intent DB ID
- PII

### Publisher feed

Publisher authenticated.

```http
GET /v1/feed/:subjectRef
```

Return active queued/served ads for that publisher-owned subject.

This endpoint is how the Demo Publisher retrieves ads for a user.

Marking as served can happen via:

```http
POST /v1/deliveries/:deliveryId/served
```

Publisher authenticated.

### Demo event stream

For UI observability, either:

```http
GET /v1/demo-events
```

with polling, or SSE if simple.

Prefer polling first.

---

## 13. Opportunity generation

Do not expose the intent table directly.

`OpportunityService` creates ephemeral advertiser-facing objects.

Rules:

- intent is active
- `expiresAt > now`
- not revoked
- placement active
- publisher active
- opportunity not already consumed
- do not create excessive duplicate opportunities for the same intent/placement
- opportunity TTL: 5 minutes

An advertiser agent learns publisher identity and commercial intent, not user identity.

For demo simplicity, the same intent may be shown to more than one advertiser agent as separate opportunities, but only one delivery per `(intent, campaign)` should be allowed unless explicitly configured.

Add uniqueness to prevent the same campaign spamming the same intent.

---

## 14. Intent classification

The Hark protocol requires normalized `topics`.

It does NOT require Hark itself to infer those topics.

The Demo Publisher should demonstrate vague intent classification.

Example human input:

```text
"I'm starting college and need something lightweight for coding."
```

Publisher-side classifier output:

```json
{
  "topics": [
    {
      "id": "electronics.computer.laptop",
      "confidence": 0.91
    },
    {
      "id": "education.student-technology",
      "confidence": 0.72
    }
  ],
  "semanticSummary": "Looking for a lightweight computer suitable for college programming."
}
```

Important:

- raw text may be used transiently by the publisher classifier
- raw text is not persisted in Hark
- publisher sends only normalized commercial intent
- summary must exclude unnecessary personal or sensitive context

For the demo app, implement classifier server-side.

Use an LLM with structured output validated by Zod.

If no LLM key is configured, provide a deterministic development fallback mapping common phrases to demo topics.

The real demo should use the LLM path.

---

## 15. Advertiser relevance reasoning

Advertiser agents decide whether an opportunity is relevant.

Use a two-stage process.

### Stage 1: cheap prefilter

Use canonical topic overlap/hierarchy.

Example:

```text
campaign target:
electronics.computer.laptop

opportunity topic:
electronics.computer.laptop

=> candidate
```

Also allow semantically adjacent candidates if configured.

### Stage 2: LLM relevance scorer

The LLM sees:

- campaign name
- product summary
- target topics
- publisher identity
- placement
- opportunity topics
- confidence
- sanitized semantic summary
- delivery price

The LLM returns structured JSON:

```ts
type RelevanceDecision = {
  relevance: number; // 0..1
  shouldAdvertise: boolean;
  reason: string;
};
```

Use a concise prompt.

Do not send private keys, account IDs unnecessarily, or payment secrets to the LLM.

The final pay decision is deterministic:

```ts
shouldPay =
  llmDecision.shouldAdvertise &&
  llmDecision.relevance >= campaign.minRelevance &&
  opportunity.price <= campaign.maxPrice &&
  campaign.remainingBudget >= opportunity.price;
```

The LLM recommends relevance.

Code enforces money constraints.

Never let the LLM bypass budget checks.

---

## 16. Advertiser agent interface

Implement:

```ts
interface AdvertisingAgent {
  discover(): Promise<HarkOpportunity[]>;
  evaluate(opportunity: HarkOpportunity): Promise<RelevanceDecision>;
  decide(opportunity: HarkOpportunity, decision: RelevanceDecision): boolean;
  reach(opportunity: HarkOpportunity): Promise<DeliveryConfirmation>;
}
```

One agent instance corresponds to one campaign + Hedera payer wallet.

---

## 17. Sample demo agents

Seed at least three.

### Agent A — NovaBook

Target:

```text
electronics.computer.laptop
education.student-technology
```

Product:

```text
NovaBook Air
Lightweight laptop for students and developers
```

Expected behavior:

- high score for college coding / laptop intent
- pays and advertises

### Agent B — FlyLite

Target:

```text
travel
travel.flight
travel.package
```

Expected behavior:

- low score for laptop intent
- does not pay

### Agent C — Pace

Target:

```text
sports.running
fitness
```

Expected behavior:

- low score for laptop intent
- does not pay

Add a second demo intent for travel so FlyLite can also perform a paid request if needed.

---

## 18. x402 architecture

The mandatory payment path is:

```text
Advertiser Agent
    |
    | POST /v1/reach
    v
Hark Resource Server
    |
    | HTTP 402 + payment requirements
    v
Advertiser Agent x402 Client
    |
    | signs Hedera payment
    | retries request
    v
Hark Resource Server
    |
    | verify / settle
    v
Blocky402 Facilitator
    |
    v
Hedera Testnet
    |
    | settlement proof
    v
Hark handler executes
    |
    v
Delivery queued
```

### x402 rules

- protocol v2
- network `hedera:testnet`
- exact scheme
- initial asset native HBAR
- asset ID `0.0.0`
- amount uses tinybar
- facilitator is Blocky402 testnet
- advertiser payer account uses ECDSA private key
- Hark receiver is a Hedera account ID
- no advertiser Hark API key

### Blocky startup check

At API startup:

1. call Blocky `/supported`
2. assert `hedera:testnet` exists
3. capture advertised Hedera fee payer if required by current package flow
4. fail fast with a useful error if unsupported

Add:

```text
pnpm check:blocky
```

to run this independently.

### Server-side x402

Use current x402 v2 primitives.

Conceptually:

```ts
const facilitator = new HTTPFacilitatorClient({
  url: env.BLOCKY402_FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitator);

resourceServer.register(
  "hedera:*",
  new ExactHederaServerScheme({
    defaultAssets: {
      "hedera:testnet": {
        asset: "0.0.0",
        decimals: 8
      }
    }
  })
);
```

Then protect `POST /v1/reach` with `@x402/express`.

Exact constructor/helper names may change. Inspect installed types and official current examples before coding. Preserve the specified behavior.

### Client-side x402

Conceptually:

```ts
const signer = createClientHederaSigner(
  accountId,
  PrivateKey.fromStringECDSA(privateKey),
  { network: "hedera:testnet" }
);

const client = new x402Client().register(
  "hedera:*",
  new ExactHederaClientScheme(signer)
);

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
```

Then:

```ts
await fetchWithPayment(`${HARK_API_URL}/v1/reach`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-hark-idempotency-key": crypto.randomUUID()
  },
  body: JSON.stringify({
    opportunityId,
    campaignId
  })
});
```

The demo MUST visibly log:

```text
requesting reach
received 402
signing payment
retrying paid request
payment settled
transaction id
delivery queued
```

Do not fake these states.

Instrument actual x402 transitions where possible.

---

## 19. Payment persistence and idempotency

Payment/delivery logic must be idempotent.

Client sends:

```http
X-Hark-Idempotency-Key
```

If the same key is retried after a successful payment:

- return the existing delivery
- do not create another delivery
- do not double-count campaign spend

Store the settlement transaction ID when available.

Use DB transactions around:

- opportunity consume
- payment record
- campaign spend
- delivery create

If an opportunity has already been consumed, return `409 Conflict`.

Production-grade reservation/refund behavior is out of scope for the hackathon. Document the race condition in `docs/ARCHITECTURE.md`.

---

## 20. Hark SDK

Create package:

```text
@hark-protocol/sdk
```

It should expose two clients.

### Publisher client

```ts
const hark = new HarkPublisherClient({
  baseUrl,
  publisherKey
});

await hark.intents.create({
  subjectRef: "user-001",
  placementIds: ["..."],
  topics: [
    { id: "electronics.computer.laptop", confidence: 0.91 }
  ],
  semanticSummary: "Looking for a lightweight computer for coding."
});
```

Functions:

- `intents.create`
- `intents.update`
- `intents.revoke`
- `feed.get`
- `deliveries.markServed`

### Advertiser client

Free methods:

- `discovery.get`
- `topics.list`
- `campaigns.create`
- `opportunities.list`

Paid method:

- `reach`

The SDK must allow passing an x402-capable fetch rather than owning keys internally.

Example:

```ts
const hark = new HarkAdvertiserClient({
  baseUrl,
  fetch: fetchWithPayment
});

await hark.reach({
  opportunityId,
  campaignId,
  idempotencyKey: crypto.randomUUID()
});
```

This makes the SDK portable.

---

## 21. Demo Publisher app

The web UI is a simulated publisher/platform.

Do not make the UI look like a crypto wallet or DeFi app.

It should look like a normal modern consumer feed/search/recommendation product.

### Publisher demo screen

Show a persona:

```text
Demo user: Alex
```

Allow either:

- selecting a high-level interest chip
- entering a vague natural-language interest

Examples:

```text
"Laptops"
```

and:

```text
"I need something lightweight for college coding"
```

The second path demonstrates LLM classification.

After classification, show:

```text
Active Hark Intent

Laptop
electronics.computer.laptop
Confidence 91%
Expires in 30 days
```

Allow:

- refresh
- revoke
- mark fulfilled

### Ad slot

The page polls Hark's publisher feed for the demo subject.

When a paid delivery appears, render the creative.

Show a small label:

```text
Sponsored via Hark
```

Add:

```text
Why am I seeing this?
```

Modal:

```text
You have an active Laptop intent on this platform.
This advertiser paid Hark to reach users with matching current intent.
The advertiser did not receive your identity from Hark.
```

### Important demo behavior

Before a relevant paid delivery:

- no laptop ad appears

After payment:

- the laptop ad appears

After intent is revoked:

- no new laptop opportunity should be generated

---

## 22. Agent dashboard

The web app should include an Agent Dashboard.

Display:

- agent name
- campaign
- target topics
- Hedera account ID
- remaining budget
- last discovered opportunities
- LLM relevance scores
- decision
- payment status
- transaction ID
- delivery ID

Show events in chronological order.

Example:

```text
NovaBook Agent

14:02:11  Discovered opportunity from Demo Publisher
14:02:12  Topic: electronics.computer.laptop
14:02:13  Relevance: 0.94
14:02:13  Decision: advertise
14:02:14  POST /v1/reach
14:02:14  HTTP 402 Payment Required
14:02:15  Signing Hedera x402 payment
14:02:17  Settled: 0.001 HBAR
14:02:17  Tx: 0.0.x@...
14:02:18  Delivery queued
```

This page is for the hackathon demo and developer observability, not part of the protocol.

---

## 23. Hark Explorer

Add a developer/explorer page showing non-sensitive system state:

- publishers
- active intent counts by topic
- campaigns
- anonymous opportunities
- deliveries
- payment transaction IDs

Do not expose:

- subjectRef
- publisher secret
- raw internal intent IDs if avoidable
- private keys

---

## 24. Privacy requirements

These are mandatory.

### Never expose subjectRef to advertiser APIs

Add tests for this.

### Never persist raw private conversation by default

Only persist sanitized `semanticSummary`.

### Reject obvious PII in semantic summaries

At minimum, add simple detection for:

- email addresses
- phone numbers

If found, reject with validation error or sanitize.

Do not claim this is a complete PII detection system.

### No stable cross-platform user ID

`subjectRef` is publisher-scoped.

The same human on two publishers should not be linkable through Hark.

### Advertiser sees publisher

This is intentional.

Publisher identity is part of the commercial context.

### Do not log secrets

Never log:

- private keys
- publisher keys
- full authorization headers
- raw x402 payment signatures
- LLM API keys

---

## 25. Advertiser wallet safety

Agent private keys live only in environment variables.

Never place Hedera keys in:

- browser bundle
- Next.js client components
- database
- logs
- demo events

Validate all configured keys at agent startup without printing them.

Agent budget constraints are mandatory.

Each agent has:

```text
MAX_PRICE_TINYBAR
RUN_BUDGET_TINYBAR
```

Before paid reach:

```ts
if (price > maxPrice) skip;
if (spent + price > runBudget) skip;
```

The LLM cannot override these.

---

## 26. Environment variables

Root `.env.example` should document all variables.

### Shared

```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hark
HARK_API_URL=http://localhost:4021
WEB_URL=http://localhost:3000
```

### API

```bash
API_PORT=4021

BLOCKY402_FACILITATOR_URL=https://api.testnet.blocky402.com

HEDERA_NETWORK=hedera:testnet
HEDERA_PAY_TO_ACCOUNT_ID=0.0.xxxxx

HARK_REACH_PRICE_TINYBAR=100000

DEMO_PUBLISHER_KEY=replace-me
```

The Hark receiver account does not require its private key in the API for simply receiving x402 payments unless the current x402 implementation explicitly requires something additional.

Do not add receiver private key unnecessarily.

### Demo Publisher classifier

```bash
OPENAI_API_KEY=
OPENAI_MODEL=
```

Make model configurable.

### Advertiser agent

```bash
AGENT_NAME=NovaBook Agent
AGENT_HEDERA_ACCOUNT_ID=0.0.xxxxx
AGENT_HEDERA_PRIVATE_KEY=0x...
AGENT_CAMPAIGN_ID=...
AGENT_MAX_PRICE_TINYBAR=150000
AGENT_RUN_BUDGET_TINYBAR=1000000

OPENAI_API_KEY=
OPENAI_MODEL=
```

Use separate account credentials for each concurrently demonstrated agent if practical.

---

## 27. Package/version policy

Because x402 and Hedera Agent Kit are moving quickly:

1. Lock dependencies with `pnpm-lock.yaml`.
2. Keep all `@x402/*` packages on matching versions.
3. Do not mix old `x402-*` package names with modern scoped `@x402/*` packages.
4. Use `@hiero-ledger/sdk`, not legacy `@hashgraph/sdk`, for new code.
5. Use Agent Kit v4 `@hashgraph/*` scoped packages.
6. Before writing imports, inspect:
   - installed package `exports`
   - TypeScript definitions
   - current official examples
7. If README snippets conflict with installed package types, follow installed current package types and document the deviation.

Do not guess package APIs.

---

## 28. Local development

Root commands:

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Expected ports:

```text
web: 3000
api: 4021
postgres: 5432
```

Also add:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:blocky
pnpm agent:novabook
pnpm agent:flylite
pnpm agent:pace
```

Add an environment-gated command:

```bash
LIVE_HEDERA_TESTS=1 pnpm test:live-payment
```

Never run real/mainnet payments in ordinary test suites.

---

## 29. Database seed

Seed:

### Publisher

```text
Demo Publisher
```

### Placement

```text
Home Feed
slug: home-feed
format: card
```

### Demo subjects

```text
alex
sam
taylor
```

Do not store real personal information.

### Agents

```text
NovaBook Agent
FlyLite Agent
Pace Agent
```

### Campaigns

One corresponding campaign each.

Do not seed active intents automatically unless needed for tests. The main demo should visibly create the intent.

---

## 30. Agent runner

The CLI should support:

```bash
pnpm agent:novabook --once
```

and optionally:

```bash
pnpm agent:novabook --watch
```

`--once` is required for deterministic demo behavior.

Flow:

```text
load campaign
fetch opportunities
for each candidate:
  score relevance
  record demo event
  enforce budget
  if approved:
    call paid reach via x402
    record tx + delivery
    stop after first successful delivery unless configured otherwise
```

Default demo mode:

- maximum one paid reach per run

This prevents accidental wallet draining.

---

## 31. Relevance prompt behavior

Keep prompt compact.

System intent:

```text
You are evaluating whether a commercial advertising campaign is relevant to an anonymous, temporary purchasing-interest signal.

Return a relevance score from 0 to 1 and whether the advertiser should attempt to reach this user.

Use only the supplied commercial intent.
Do not infer sensitive traits.
Do not infer identity.
Do not broaden targeting beyond the supplied intent.
```

Input includes campaign + opportunity.

Output validated against Zod.

If structured output parsing fails:

- do not pay
- log failure
- continue safely

Default-deny on AI errors.

---

## 32. Deterministic development scorer

Implement a fallback scorer for tests/local development.

Rules can use:

- exact topic match
- parent/child topic match
- keyword overlap in sanitized summary

It must implement the same `RelevanceScorer` interface.

Do not use the deterministic scorer in the final recorded AI-agent demo unless the LLM provider fails unexpectedly.

---

## 33. Payment transaction extraction

After a successful x402 request, inspect the current payment response header returned by the x402 library/facilitator.

Persist:

- transaction ID
- amount
- asset
- payer account if safely available
- network

Expose transaction ID in the demo.

Add a HashScan testnet link helper.

If transaction IDs require URL-safe transformation, implement it once in a utility and test it.

Do not fake a transaction link.

---

## 34. Service discovery

Expose:

```text
/.well-known/hark.json
```

Also make the paid resource compatible with current x402 discovery conventions when practical.

The advertiser runner should begin by fetching Hark discovery metadata rather than hardcoding every capability.

The runner may still receive `HARK_API_URL`.

Expected flow:

```text
agent knows Hark base URL
-> GET /.well-known/hark.json
-> sees reach service
-> sees hedera:testnet + HBAR
-> discovers opportunities
-> decides
-> pays
```

Optional future work:

- UCP-compatible directory entry

Do not block MVP on UCP.

---

## 35. HCS audit trail — bonus phase

Only implement after paid reach works.

Goal:

Write an HCS message for paid advertiser actions.

Suggested message:

```json
{
  "schema": "hark.audit.v1",
  "event": "reach.settled",
  "agentId": "agent-novabook",
  "campaignId": "cmp_xxx",
  "publisherId": "pub_xxx",
  "topic": "electronics.computer.laptop",
  "amountTinybar": "100000",
  "transactionId": "...",
  "timestamp": "..."
}
```

Never put:

- subjectRef
- semantic summary
- user identity

into HCS.

HCS is public and permanent enough that privacy discipline matters.

---

## 36. HCS-14 agent identity — bonus phase

Only after core flow.

Allow `advertiser_agents.hcs14_id`.

Display it in Agent Dashboard.

Hark must continue functioning if HCS-14 support is disabled.

Do not make draft identity standards a hard dependency of protocol v0.1.

---

## 37. HTS asset support — bonus phase

Start with native HBAR.

After HBAR works, optionally allow an HTS token.

When using HTS:

- configure correct token ID
- use correct decimals
- ensure payer and recipient token association
- test through Blocky402
- keep HBAR path working

Do not replace the known-good HBAR demo path.

---

## 38. Multi-agent bidding — optional future phase

Do not build until core is complete.

Possible design:

```text
opportunity
-> multiple agents submit private max bid / relevance
-> Hark selects winner
-> winner pays via x402
-> delivery queued
```

For hackathon MVP there is no auction requirement.

Agents may independently discover and reach opportunities.

---

## 39. Error contract

All non-x402 application errors should use:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Important codes:

```text
VALIDATION_ERROR
UNAUTHORIZED_PUBLISHER
INTENT_NOT_FOUND
INTENT_EXPIRED
INTENT_REVOKED
CAMPAIGN_NOT_FOUND
CAMPAIGN_INACTIVE
OPPORTUNITY_NOT_FOUND
OPPORTUNITY_EXPIRED
OPPORTUNITY_CONSUMED
BUDGET_EXCEEDED
IDEMPOTENCY_CONFLICT
PAYMENT_METADATA_MISSING
INTERNAL_ERROR
```

Do not replace x402's own 402 response with a custom JSON format that breaks x402 clients.

---

## 40. Logging

Use structured logs.

Recommended fields:

- requestId
- route
- actor type
- publisherId
- campaignId
- opportunityId
- deliveryId
- transactionId
- durationMs

Never log sensitive values.

Use readable pretty logging in dev.

JSON logs in production.

---

## 41. Tests

Use Vitest.

### Unit tests

Required:

- topic hierarchy
- intent expiry
- intent revocation
- semantic summary validation
- PII validation
- budget enforcement
- deterministic scorer
- opportunity serialization excludes subjectRef
- advertiser delivery response excludes subjectRef
- campaign spend calculation
- idempotency

### API integration tests

Required:

1. publisher creates intent
2. intent appears as anonymous opportunity
3. advertiser cannot see subjectRef
4. revoked intent no longer produces opportunities
5. expired intent no longer produces opportunities
6. unpaid `POST /v1/reach` returns 402 when x402 layer enabled
7. publisher feed returns queued delivery
8. wrong publisher cannot access another publisher's feed

Use a test DB.

### Live Hedera integration test

Environment-gated.

Must:

1. call live Hark paid endpoint
2. receive 402
3. automatically pay using advertiser testnet ECDSA wallet
4. settle through Blocky402
5. receive 2xx response
6. assert transaction ID exists
7. assert delivery created

Do not mock Blocky402 in the live test.

---

## 42. CI

GitHub Actions should run:

```text
install
lint
typecheck
unit tests
integration tests excluding live Hedera
build
```

Live Hedera tests are manual/workflow-dispatch only unless secrets are securely configured.

Never expose testnet private keys in logs.

---

## 43. Deployment

Preferred simple deployment:

### Database

Neon PostgreSQL.

### API

Railway, Render, Fly.io, or another Node-friendly host.

Must expose a stable HTTPS URL.

### Web

Vercel.

### Agent

For demo:

- local CLI is acceptable if Hark API is live
- deployed worker is better if easy

Do not spend hackathon time on Kubernetes.

### Mandatory live checks

Before submission:

```text
GET /health
GET /.well-known/hark.json
GET Blocky /supported
unpaid POST /v1/reach -> 402
paid agent call -> 2xx
transaction visible on Hedera testnet
ad visible on Demo Publisher
```

---

## 44. README structure

README must include:

1. Hark one-line pitch
2. Problem
3. How Hark works
4. Architecture diagram
5. Actors
6. Intent privacy model
7. Tech stack
8. x402 + Hedera payment flow
9. Blocky402 role
10. Local setup
11. Testnet account setup
12. Environment variables
13. Run Demo Publisher
14. Run advertiser agent
15. Example 402 paid request
16. HashScan verification
17. API overview
18. Project structure
19. Hackathon qualification mapping
20. Optional Hedera bonus features
21. Security/privacy notes
22. Limitations / future work

Do not market Hark as storing user data on-chain.

---

## 45. Architecture diagram for README

Use Mermaid.

```mermaid
flowchart LR
    U[User] --> P[Publisher Platform]
    P -->|temporary normalized intent| H[Hark API]
    A[Advertiser Agent] -->|discover anonymous opportunities| H
    A -->|POST /v1/reach| H
    H -->|HTTP 402| A
    A -->|x402 payment| H
    H --> B[Blocky402 Facilitator]
    B --> D[Hedera Testnet]
    H -->|paid ad delivery| P
    P -->|relevant ad| U
```

Also include a privacy boundary diagram.

---

## 46. Demo script

Target 3-4 minutes.

### Scene 1 — problem, 20 seconds

Explain:

```text
Ad platforms usually infer what users want from behavior.
Hark lets platforms publish temporary intent and lets advertiser agents pay to reach only relevant users.
```

### Scene 2 — create vague intent, 30 seconds

On Demo Publisher:

```text
"I'm starting college and need something lightweight for coding."
```

Show classifier output:

```text
electronics.computer.laptop
confidence 0.91
```

Show no identity is exposed.

### Scene 3 — agent discovery, 40 seconds

Agent dashboard:

```text
NovaBook Agent discovers:
Publisher: Demo Publisher
Topic: Laptop
Summary: lightweight computer for college coding
Price: 0.001 HBAR
```

Show FlyLite/Pace skip.

Show NovaBook LLM score, e.g. 0.94.

### Scene 4 — x402 payment, 60 seconds

Run paid request.

Visibly show:

```text
POST /v1/reach
402 Payment Required
signing Hedera payment
Blocky402 settlement
200 OK
transaction id
```

Open/display HashScan transaction.

### Scene 5 — ad delivery, 30 seconds

Return to Demo Publisher.

NovaBook ad appears.

Open:

```text
Why am I seeing this?
```

Explain advertiser knew:

- platform
- laptop intent
- placement

Advertiser did not know:

- name
- email
- publisher subject ID

### Scene 6 — close, 20 seconds

Pitch:

```text
Hark is an open intent layer for advertising.
Platforms publish temporary user intent.
Advertising agents interpret opportunity.
x402 lets agents buy eligible reach programmatically on Hedera.
```

---

## 47. Definition of MVP complete

Do not call MVP complete until all are true:

- [ ] PostgreSQL schema exists and migrations work.
- [ ] Demo Publisher can publish an intent.
- [ ] Intent expires/revokes correctly.
- [ ] Advertiser can discover an anonymous opportunity.
- [ ] Opportunity reveals publisher and placement.
- [ ] Opportunity never reveals subjectRef.
- [ ] LLM advertiser scorer works.
- [ ] Budget enforcement works.
- [ ] `POST /v1/reach` is truly x402 protected.
- [ ] Unpaid request returns HTTP 402.
- [ ] Advertiser agent automatically pays using x402.
- [ ] Payment settles through Blocky402.
- [ ] Settlement occurs on Hedera testnet.
- [ ] Real transaction ID is stored and displayed.
- [ ] Delivery is queued.
- [ ] Demo Publisher retrieves and renders ad.
- [ ] "Why am I seeing this?" works.
- [ ] Public README documents architecture/payment.
- [ ] Live API deployed.
- [ ] Public GitHub repo builds from README instructions.
- [ ] <=5 minute demo can be recorded without manual database edits.

---

## 48. Non-goals for hackathon MVP

Do NOT build:

- full advertising auction exchange
- Google Ads replacement
- user identity graph
- cross-platform user tracking
- permanent behavioral profiles
- real billing invoices
- fiat settlement
- smart contracts
- mainnet deployment
- mobile apps
- production ad moderation
- attribution tracking
- conversion pixels
- ML training pipeline
- complex embeddings infrastructure
- World integration
- publisher revenue sharing
- recurring subscriptions
- custom token before HBAR works

If tempted, finish the paid demo first.

---

## 49. Optional Python service

Python is explicitly NOT part of MVP.

If a later feature needs it, create:

```text
services/semantic/
```

using:

- Python 3.12+
- FastAPI
- Pydantic

Appropriate uses:

- local embedding model
- large-scale semantic indexing
- specialized classifier
- offline experimentation

Do not move x402 payment logic or core Hark APIs into Python during the hackathon.

TypeScript remains the source of truth for protocol and payment flow.

---

## 50. Coding conventions

- strict TypeScript
- no `any` unless isolated and justified
- Zod at network boundaries
- service layer owns business logic
- route handlers stay thin
- database queries live in service/repository layer
- UTC timestamps, ISO 8601 over API
- UUIDs or stable opaque prefixed IDs
- never leak DB models directly as API responses
- explicit DTO serialization
- no secret values in client bundles
- no giant files
- meaningful errors
- tests next to business logic or under consistent test directories
- favor boring code over clever abstractions

Prefix public IDs where useful:

```text
pub_
plc_
int_
opp_
agt_
cmp_
del_
pay_
```

---

## 51. Security checklist

Before demo/deploy:

- [ ] all secrets are in environment variables
- [ ] `.env` ignored
- [ ] private Hedera keys are server/agent-only
- [ ] publisher keys hashed in DB
- [ ] no subjectRef in advertiser responses
- [ ] no raw user prompt in Hark DB
- [ ] no PII in HCS
- [ ] no PII in logs
- [ ] rate limits on free discovery endpoints
- [ ] Zod validation on all mutation endpoints
- [ ] URLs in creatives validated
- [ ] max semantic summary length enforced
- [ ] x402 package versions aligned
- [ ] testnet/mainnet impossible to confuse accidentally
- [ ] default network is testnet
- [ ] live mainnet code path disabled unless explicitly enabled

---

## 52. Implementation order

Follow this order unless blocked.

### Phase 1 — foundation

1. Initialize pnpm monorepo.
2. Add TypeScript config.
3. Add protocol schemas.
4. Add taxonomy.
5. Add Postgres + Drizzle.
6. Add migrations + seed.
7. Add Express API + health.

### Phase 2 — Hark core

8. Publisher auth.
9. Intent create/update/revoke.
10. Placement support.
11. Campaigns.
12. Opportunity generation.
13. Feed/delivery model.
14. Privacy serializer tests.

### Phase 3 — x402 mandatory path

15. Blocky `/supported` check.
16. Configure x402 Hedera resource server.
17. Protect `POST /v1/reach`.
18. Build standalone advertiser x402 client.
19. Complete first live HBAR paid request.
20. Persist real transaction ID.
21. Add idempotency.

Do not proceed until this works.

### Phase 4 — advertiser intelligence

22. RelevanceScorer interface.
23. Deterministic scorer.
24. OpenAI structured scorer.
25. Budget rules.
26. Agent CLI.
27. Three demo agents.
28. Agent demo events.

### Phase 5 — web demo

29. Publisher UI.
30. Vague intent classifier.
31. Active intent panel.
32. Feed/ad slot.
33. Why-this-ad modal.
34. Agent dashboard.
35. Transaction display.
36. Explorer.

### Phase 6 — deployment and submission

37. Deploy Postgres.
38. Deploy API.
39. Deploy web.
40. Run live payment against deployed API.
41. Verify Hedera tx.
42. Finish README.
43. Write demo script.
44. Record <=5 minute video.

### Phase 7 — bonuses

45. HCS audit trail.
46. HCS-14 identity.
47. HTS support.
48. Additional discovery/UCP.
49. Multi-agent bidding only if time remains.

---

## 53. Critical architectural decisions — do not casually change

### Decision: Hark intent data is off-chain

Reason:
privacy, speed, cost, deletion/revocation semantics.

### Decision: only payments are on-chain in MVP

Reason:
Hedera is used where it adds value: autonomous settlement.

### Decision: publisher identity is visible to advertiser

Reason:
advertiser needs context and placement quality information.

### Decision: human identity is not visible to advertiser

Reason:
advertiser is purchasing eligible reach, not user data.

### Decision: advertiser agent performs relevance reasoning

Reason:
different advertisers have different products, thresholds, budgets, and semantics.

### Decision: Hark still provides canonical topics

Reason:
cheap deterministic prefiltering avoids every agent running an LLM over every possible signal.

### Decision: World is publisher-side

Reason:
Hark should not mandate one personhood provider.

### Decision: TypeScript is the payment-critical language

Reason:
best alignment with current Hedera x402 examples and packages.

### Decision: native HBAR first

Reason:
minimize token association and settlement complexity.

### Decision: no smart contract

Reason:
not needed for the track or product.

---

## 54. What Claude should do when coding

When asked to build this repository:

1. Read this entire file.
2. Inspect existing code before modifying.
3. Preserve architecture unless the user explicitly changes it.
4. Implement in the phase order above.
5. Use small commits/logical changes.
6. Run typecheck/tests after each meaningful phase.
7. Do not silently replace x402/Blocky402 with a fake payment implementation.
8. Do not mock the final Hedera payment demo.
9. If a current x402 package API differs from pseudocode here, inspect official current package types and adapt.
10. Keep a `docs/STATUS.md` checklist of what is working.
11. Mark live Hedera behavior separately from mocked/local behavior.
12. Never claim the qualification requirement is satisfied until a real Blocky402-settled testnet payment has completed.

---

## 55. Short product pitch

Use this wording as the default project description:

> **Hark Protocol is an open intent advertising protocol where platforms publish temporary, privacy-preserving user intent and autonomous advertising agents pay through x402 on Hedera to reach matching users.**

Shorter:

> **Hark lets advertiser agents pay for relevant attention instead of guessing who is interested.**

---

## 56. Core tagline

```text
📯 Hark
Ads that listen first.
```

---

## 57. Final build priority

When trade-offs appear, prioritize in this order:

```text
real x402 payment
> correct privacy boundary
> working end-to-end demo
> agent reasoning
> clean SDK/API
> attractive UI
> bonus-chain features
```

A simple Hark demo with a real autonomous Hedera payment is better than a huge architecture diagram where the money never moves.

Build the smallest credible protocol that proves:

```text
intent exists
-> agent understands it
-> agent chooses to advertise
-> agent pays through x402
-> Hedera settles it
-> relevant ad appears
```

That is Hark v0.1.
