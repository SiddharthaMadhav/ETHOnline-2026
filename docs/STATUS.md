# Hark Protocol - build status

Tracks what's implemented against CLAUDE.md's phase order (section 52). Live vs.
mocked Hedera behavior is called out explicitly per CLAUDE.md section 54.

## Phase 1 - Foundation

- [x] pnpm workspace + strict TS base config
- [x] `packages/protocol`: Zod schemas (publisher, placement, assurance, intent,
      campaign, opportunity, delivery), taxonomy (`isSameOrDescendant`,
      `topicDistance`), constants, PII heuristic
- [x] `packages/db`: Drizzle schema for all tables in CLAUDE.md section 10,
      migrations, seed script (Demo Publisher, Home Feed placement, 3 demo
      subjects, 3 advertiser agents + campaigns)
- [x] Express API skeleton + `/health`

## Phase 2 - Hark core

- [x] Publisher auth middleware (scrypt-hashed secrets, `Authorization: Bearer`)
- [x] Intent create / patch / revoke (`/v1/intents`)
- [x] Campaign create (open dev endpoint, `/v1/campaigns`)
- [x] Opportunity generation (`/v1/opportunities`) - excludes `subjectRef`,
      reuses unconsumed/unexpired opportunities, topic-overlap prefilter
- [x] Feed / delivery read model (`/v1/feed/:subjectRef`,
      `/v1/deliveries/:id/served`) - no writer yet (see Phase 3)
- [x] `/.well-known/hark.json`, `/v1/topics`, `/v1/publishers`, `/v1/demo-events`
- [x] Error contract (section 39), rate limiting on free discovery endpoints
- [x] Unit tests: taxonomy, PII heuristic, intent schema validation, intent
      expiry/revocation
- [x] Integration tests: intent -> opportunity, subjectRef never exposed,
      revoked/expired intent yields no opportunity, wrong publisher secret
      rejected, cross-publisher feed access denied, queued delivery read

## Phase 3 - x402 mandatory payment path

- [x] Blocky `/supported` startup check (`pnpm check:blocky`) - live-tested against
      `https://api.testnet.blocky402.com`, confirms `hedera:testnet`/`exact` and
      prints the facilitator's fee payer (`0.0.7162784` as of this writing)
- [x] x402 Hedera resource server (`ExactHederaScheme` from `@x402/hedera/exact/server`,
      `apps/api/src/x402/resource-server.ts`), `POST /v1/reach` protected via
      `@x402/express`'s `paymentMiddleware` (`apps/api/src/x402/payment-middleware.ts`)
- [x] Reach business logic (`apps/api/src/services/payment-service.ts`): idempotent
      replay, opportunity/campaign validation, `BigInt` tinybar budget checks,
      atomic opportunity-consume + delivery/payment creation, campaign spend tracking
- [x] Settlement backfill via `onAfterSettle` hook (transaction id/payer written onto
      the payment row once the facilitator actually settles - see
      `docs/PAYMENT_FLOW.md` for why this can't happen synchronously in the handler)
- [x] Standalone advertiser x402 client (`scripts/live-payment-smoke.ts`, gated behind
      `LIVE_HEDERA_TESTS=1`)
- [x] Unit + integration tests: tinybar budget math, idempotency replay, budget
      exhaustion, opportunity double-consume, unpaid `POST /v1/reach` returns x402's
      own 402 (not Hark's error JSON) - 23/23 passing, live-verified manually against
      the real Blocky402 testnet facilitator (real 402 challenge with a real
      `PAYMENT-REQUIRED` header observed)
- [x] **First live HBAR paid request against Blocky402 testnet - DONE.** Ran
      `LIVE_HEDERA_TESTS=1 pnpm test:live-payment` against the live API + the real
      Blocky402 testnet facilitator with a funded testnet payer account. Result:
      - Transaction: `0.0.7162784@1789141024.449717008`
        (HashScan: `https://hashscan.io/testnet/transaction/0.0.7162784-1789141024-449717008`)
      - Independently confirmed via the public Hedera testnet mirror node
        (`GET /api/v1/transactions/...`): `result: SUCCESS`, transfers show
        `0.0.10475939` (advertiser agent) debited `100000` tinybar and
        `0.0.10476224` (`HEDERA_PAY_TO_ACCOUNT_ID`) credited `100000` tinybar -
        this is not just "our API said success," it's verified against Hedera's
        own public ledger data, independent of Hark.
      - Delivery `del_6de6a56d-ef8b-489d-9620-b4538d6d8d75` queued, payment row
        backfilled with the real `transactionId`/`payerAccountId`, campaign
        `spentTinybar` incremented to `100000`, and the full event sequence
        (`intent.created` -> `reach.payment_verified` -> `delivery.queued` ->
        `reach.payment_settled`) shows up in `GET /v1/demo-events` and the
        delivery is visible via `GET /v1/feed/alex`.
      - Fixed a real bug found in the process: `packages/db/src/seed.ts` created
        campaigns but never inserted their `campaign_topics` rows, so
        `GET /v1/opportunities?campaignId=...` always returned empty for seeded
        campaigns (campaign-topic filtering degrades to "no topics -> no match").
        Also added `allowedAssets` spend-control config to the smoke client -
        `@x402/fetch`'s client-side spend guard only recognizes each network's
        "default" asset (Hedera's is USDC) unless HBAR is explicitly allow-listed.

**The mandatory hackathon qualification flow is now proven end-to-end with a real
Blocky402-settled Hedera testnet transaction**, independently verified on-chain.

## Phase 4 - Advertiser intelligence (NOT STARTED)

- [ ] `RelevanceScorer` interface, deterministic scorer, OpenAI-backed scorer
- [ ] Agent CLI (`agents/runner`), budget enforcement, three demo agents

## Phase 5 - Web demo (NOT STARTED)

- [ ] Demo Publisher UI, agent dashboard, Hark Explorer

## Phase 6/7 - Deployment, submission, bonuses (NOT STARTED)
