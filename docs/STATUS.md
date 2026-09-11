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

## Phase 4 - Advertiser intelligence

- [x] `RelevanceScorer` interface + `RelevanceDecision` schema
      (`agents/runner/src/relevance/scorer.ts`)
- [x] Deterministic fallback scorer (topic-distance + keyword-overlap bonus),
      used automatically when `OPENAI_API_KEY` isn't set
- [x] OpenAI-backed scorer using `ai@7`'s `generateText` + `Output.object` (not the
      deprecated `generateObject`, confirmed by reading the installed package's own
      JSDoc) - default-denies on any error or parse failure, never throws
- [x] Agent-side budget gate (`budget.ts`, `BigInt` tinybar math, defense-in-depth
      on top of Hark's own server-side enforcement)
- [x] x402 client wiring factored out of `scripts/live-payment-smoke.ts` into
      `x402-client.ts` (including the HBAR `allowedAssets` spend-control fix)
- [x] `AdvertiserAgent` implementing CLAUDE.md section 16's
      discover/evaluate/decide/reach interface; CLI (`--agent <name> --once`) for
      the three seeded demo agents, fetching `/.well-known/hark.json` first per
      section 34 rather than hardcoding the network
- [x] Tests: deterministic scorer (exact/parent-child/no-overlap/keyword-bonus),
      budget boundaries incl. beyond-safe-integer precision, `decide()`'s four
      independent rejection conditions, OpenAI scorer's success and
      default-deny-on-error paths (17/17 passing in `agents/runner`)
- [x] **Live-verified for real**, using the same real OpenAI key and Hedera testnet
      credentials as Phase 3:
      - `pnpm agent:flylite` and `pnpm agent:pace` against a live laptop-intent
        opportunity: real OpenAI calls returned relevance `0.00`-`0.02` with
        genuinely on-topic reasoning (e.g. "does not match FlyLite Getaways'
        flight and travel package offerings") -> correctly logged `Decision: skip`,
        no payment ever attempted.
      - `pnpm agent:novabook`: real OpenAI call returned relevance `0.92`-`0.96` ->
        `Decision: advertise` -> real signed Hedera payment settled through
        Blocky402. First attempt correctly hit `409 OPPORTUNITY_CONSUMED` against
        an intent already reached in the Phase 3 test - the CLI logs the failed
        attempt and moves to the next candidate rather than aborting the run (a
        real gap found and fixed while testing live) - then succeeded against a
        fresh intent: transaction `0.0.7162784@1789142269.996810205`
        (HashScan: `https://hashscan.io/testnet/transaction/0.0.7162784-1789142269-996810205`),
        independently confirmed via the Hedera mirror node
        (`result: SUCCESS`, `0.0.10475939` debited / `0.0.10476224` credited
        `100000` tinybar), delivery `del_27b66513-1e79-427d-9ef0-70f0eac542a5`
        visible via `GET /v1/feed/sam` with the transaction id backfilled.
      - Also fixed a real bug found in the process: `bestTopicDistance` in the
        deterministic scorer wrongly gated on `isSameOrDescendant` before calling
        `topicDistance`, which excludes sibling topics (e.g. laptop/desktop) that
        share a common ancestor but aren't in an ancestor-descendant relationship
        with each other - `topicDistance` alone is already the correct, complete
        overlap test.

**`--watch` continuous polling mode is deferred** - `--once` (single discover ->
evaluate -> decide -> at most one paid reach) is the only supported mode this pass,
matching CLAUDE.md section 30's "prevents accidental wallet draining."

## Phase 5 - Web demo (NOT STARTED)

- [ ] Demo Publisher UI, agent dashboard, Hark Explorer

## Phase 6/7 - Deployment, submission, bonuses (NOT STARTED)
