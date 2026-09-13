<p align="center">
  <img src="docs/assets/hark-logo.png" alt="Hark" width="420" />
</p>

<p align="center">
  <b>Ads that listen first.</b>
</p>

<p align="center">
  Submission to ETHOnline 2026 (Hedera AI &amp; Agentic Payments track).
</p>

---

## What is Hark Protocol

Hark is an open, off-chain intent-advertising protocol with on-chain machine
payments on Hedera.

A publisher (a search app, a social feed, an AI assistant, a shopping app)
detects that one of its users has a temporary commercial interest — "looking
for a laptop" — and publishes that intent to Hark as a normalized, anonymous,
short-lived signal. Autonomous advertiser agents discover these anonymous
opportunities, decide for themselves whether the opportunity is relevant to
their campaign, and — if it is — pay Hark programmatically through **x402 on
Hedera** for the right to reach that user. The human never pays, and the
human's identity never leaves the publisher.

```
traditional advertising:  behavior tracking -> infer interest -> target user
Hark:                     temporary intent -> agent evaluates relevance -> x402 payment -> relevant ad
```

Hark is not a blockchain database, not a user-identity network, and not a
marketplace where users manually list exact purchasing requirements. All Hark
business logic and APIs are off-chain; only x402 payment settlement happens
on Hedera.

## How it works

```
Human --------------------------> Publisher Platform
                                     |  detects + normalizes temporary intent
                                     v
                                   Hark API  <---- anonymous opportunity ---- Advertiser Agent
                                     |                                             |
                                     |                     POST /v1/reach ---------+
                                     |  <--- HTTP 402 Payment Required ------------|
                                     |                     x402 payment (HBAR) ----+
                                     v
                              Blocky402 Facilitator --------> Hedera Testnet
                                     |
                                     v
                               Delivery queued
                                     |
                                     v
                               Publisher shows the ad to the user
```

**Roles**: a *subject* (the anonymous human), a *publisher* (the platform
that detected intent), an *advertiser agent* (autonomous, budget-constrained,
does its own relevance reasoning with an LLM), and *Hark* itself (schemas,
intent/campaign registries, the x402-gated reach endpoint, delivery queue).

**Privacy boundary**: advertiser agents see the publisher's identity,
placement, topic, a sanitized semantic summary, and price. They never see the
user's name, wallet, IP, publisher-internal user ID, or raw conversation —
the paid action is reach to an eligible anonymous subject, not identity.

## Protocol addresses (Hedera testnet)

| | |
|---|---|
| Network | `hedera:testnet` |
| Payment asset | native HBAR (`0.0.0`, 8 decimals) |
| Default reach price | `100000` tinybar (0.001 HBAR), configurable via `HARK_REACH_PRICE_TINYBAR` |
| Facilitator | [Blocky402](https://api.testnet.blocky402.com) (`exact` scheme) |
| Facilitator fee payer | `0.0.7162784` |
| Hark reach-payment receiver | `0.0.10476224` |
| HCS audit trail topic | [`0.0.10486387`](https://hashscan.io/testnet/topic/0.0.10486387) |
| Example settled reach payment | [`0.0.7162784@1789171232.994132558`](https://hashscan.io/testnet/transaction/0.0.7162784-1789171232-994132558) |

Every transaction above is independently verifiable against the public
Hedera testnet mirror node, not just Hark's own API.

## Live deployments

| | |
|---|---|
| Web demo (Demo Publisher, Agent Dashboard, Explorer) | https://web-sigma-dusky-37.vercel.app |
| API | https://hark-protocol-api-production.up.railway.app |
| Discovery document | https://hark-protocol-api-production.up.railway.app/.well-known/hark.json |
| Health check | https://hark-protocol-api-production.up.railway.app/health |

## Packages

Published to the public npm registry:

| Package | | |
|---|---|---|
| `@hark-protocol/protocol` | shared Zod schemas, taxonomy, tinybar helpers | https://www.npmjs.com/package/@hark-protocol/protocol |
| `@hark-protocol/sdk` | `HarkPublisherClient` / `HarkAdvertiserClient` | https://www.npmjs.com/package/@hark-protocol/sdk |

```bash
pnpm add @hark-protocol/sdk @hark-protocol/protocol
```

## Repository layout

```
apps/api        Hark API (Express, Drizzle/Postgres, x402 resource server)
apps/web        Demo Publisher, Agent Dashboard, Hark Explorer (Next.js)
agents/runner   Advertiser agent CLI (relevance scoring, x402 client, budget)
packages/protocol   Shared schemas + taxonomy (published to npm)
packages/sdk        Publisher/advertiser client (published to npm)
packages/db          Drizzle schema, migrations, seed
docs/                Protocol, architecture, payment-flow docs, pitch deck
```

See [`docs/PAYMENT_FLOW.md`](docs/PAYMENT_FLOW.md) for why settlement is
backfilled asynchronously.

## Pitch deck

[`docs/PITCH_DECK.html`](docs/PITCH_DECK.html) — open in a browser.

## License

MIT
