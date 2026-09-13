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

## Phase 5 - Web demo

New `apps/web` (`@hark-protocol/web`): Next.js 16 (App Router, Turbopack) +
Tailwind v4 + shadcn/ui, scaffolded via the official `create-next-app`/`shadcn init`
CLIs rather than hand-authored config (both have changed setup mechanics
significantly since training).

- [x] `lib/hark-client.ts` (server-only fetch wrapper; the `DEMO_PUBLISHER_KEY`
      secret never reaches the browser - every Hark call goes through this or a
      thin same-origin Next.js Route Handler) and `lib/classifier.ts` (the vague
      intent classifier, section 14/30: OpenAI `generateText` + `Output.object`,
      the same current API proven in `agents/runner`, with a deterministic
      keyword-fallback and topic-id validation against the shared taxonomy)
- [x] Demo Publisher screen (`/`): persona switch (alex/sam/taylor), topic chips +
      free-text classification, active-intent panel (refresh/mark
      fulfilled/revoke), ad slot polling a same-origin feed route, "Sponsored via
      Hark" + "Why am I seeing this?" modal, HashScan link once settled
- [x] Agent Dashboard (`/agents`): the three demo agents' static info plus a live,
      polled event log
- [x] Hark Explorer (`/explorer`): publishers, campaigns, active intent counts by
      topic, anonymous opportunities, sanitized recent deliveries - never a
      `subjectRef`, verified by both an automated test and manual inspection
- [x] Backend additions this phase required: `POST /v1/demo-events` (open,
      enum-validated write endpoint - agents now post their own
      `agent.opportunities_fetched`/`relevance_scored`/`skipped` events, closing a
      real gap where the Agent Dashboard would otherwise have had no source for
      that data), `GET /v1/campaigns` (public list), `GET /v1/explorer/summary`
      (new `explorer-service.ts`), and embedding active placements in
      `GET /v1/publishers` (the web app had no way to discover a real placement id
      to attach to an intent)
- [x] **Live-verified in a real browser** (`chrome-devtools` skill, per the
      standing instruction to check frontend changes in-browser, not just
      typecheck them): created a fresh intent for "taylor" via free text - real
      OpenAI call returned 98% confidence on "Laptops" with a clean, sanitized
      summary; refresh/revoke both worked; the ad slot correctly showed the real
      settled deliveries (with real HashScan links) already sitting in the DB from
      the Phase 3/4 live payment tests for "alex" and "sam"; the Agent Dashboard's
      live log showed the full history of both real payments end to end; the
      Explorer rendered all sections with no `subjectRef` anywhere in the page.
- [x] Real infra issue found and fixed: Turbopack (unlike `tsx`/`vitest`) doesn't
      resolve TypeScript's `NodeNext`-style `.js`-import-to-`.ts`-file convention
      for a source-only workspace package - `transpilePackages` alone didn't fix
      it. Fix was to actually build `packages/protocol` to real `.js`/`.d.ts`
      output (`pnpm --filter @hark-protocol/protocol build`) and point its
      `exports` at `dist/` - the one package in this monorepo that now needs a
      build step before other packages pick up its changes, since it's the only
      one consumed by a bundler rather than run directly via `tsx`. **Anyone
      editing `packages/protocol` must rebuild it before `apps/web`'s dev server
      will see the change** (`apps/api`/`agents/runner`/`scripts` are unaffected -
      they still run it directly via `tsx`).
- [x] Also fixed: a `react-hooks` v7 lint rule (`set-state-in-effect`) flagged a
      polling `useEffect` that called a memoized `useCallback` fetcher; the fix
      (matching the pattern already used elsewhere in this app) is to define the
      poll function inline inside the effect rather than hoisting it out, which
      also removes the need for any stale-closure guard when the effect re-runs.

**Update (post-Phase-5):** the `@hark-protocol/sdk` package now exists (see
below) and `apps/web`'s `lib/hark-client.ts` was refactored to use it - the
note above describing it as out of scope no longer applies.

## Post-Phase-5 fixes and Phase 7 bonuses (in progress)

- [x] **Fixed a real bug found while demoing**: all three `pnpm agent:*`
      scripts shared one `AGENT_CAMPAIGN_ID`/wallet in `.env`, so
      `agent:flylite`/`agent:pace` were silently querying *NovaBook's* real
      seeded campaign (laptop opportunities) and just re-scoring them under a
      different product persona - they never saw their own seeded campaigns'
      real target-topic opportunities (e.g. FlyLite never saw a travel
      intent). Fixed by moving to per-agent env vars
      (`NOVABOOK_/FLYLITE_/PACE_` + `_HEDERA_ACCOUNT_ID`/`_HEDERA_PRIVATE_KEY`/
      `_CAMPAIGN_ID`/`_MAX_PRICE_TINYBAR`/`_RUN_BUDGET_TINYBAR`), read via
      `requireAgentEnv`/`optionalAgentEnv` in `agents/runner/src/cli.ts`. All
      three currently still share one funded testnet wallet (only the
      campaign id differs) - a deliberate deviation from CLAUDE.md section 26's
      single shared `AGENT_*` block, since we don't have three separately
      funded testnet accounts. Live-verified: `pnpm agent:flylite` now
      correctly discovers and pays for a real `travel.flight` intent
      end-to-end (tx `0.0.7162784@1789162167.441328177`), instead of only
      ever seeing laptop opportunities.
- [x] **`agents/runner`'s CLI gained a `--bulk` mode** (plus optional
      `--max-reaches <n>`) alongside the existing default (stop after the
      first successful paid reach, CLAUDE.md section 30). `--bulk` keeps
      paying for every relevant, affordable candidate discovered in one run,
      bounded by the same agent-side run budget and server-side campaign
      budget checks - `AdvertiserAgent.canAffordAnotherReach()` is now
      checked *before* each LLM relevance call too, so a budget-exhausted run
      stops scoring candidates rather than wasting OpenAI calls on
      unaffordable ones. New `pnpm agent:<name>:bulk` scripts. 17/17
      `agents/runner` tests still pass.
- [x] **`@hark-protocol/sdk`** now exists (`packages/sdk`), implementing
      CLAUDE.md section 20's `HarkPublisherClient` (`intents.create/update/
      revoke`, `feed.get`, `deliveries.markServed`) and `HarkAdvertiserClient`
      (free `discovery.get`/`topics.list`/`campaigns.create/list`/
      `opportunities.list`, paid `reach()` - takes any x402-capable `fetch`,
      never owns Hedera keys). 12/12 unit tests. `apps/web/lib/hark-client.ts`
      was refactored to delegate to it (still server-only - `DEMO_PUBLISHER_KEY`
      never reaches the browser); `listPublishers`/`listDemoEvents`/
      `getExplorerSummary` stay as raw fetches since they're Hark-specific
      demo/observability endpoints with no SDK-spec equivalent. **Live-verified
      in a real browser** (chrome-devtools skill): create/refresh/revoke
      intent (Sam, "Furniture" chip), feed polling, and campaign-joined ad
      rendering (Alex/Sam's real NovaBook deliveries) all worked with zero
      console errors and all-200 network requests through the SDK-backed path.
- [x] **HCS-14 advertiser identity** (bonus #2): `packages/protocol/src/hcs14.ts`
      (`computeHcs14Id`, exported via the `@hark-protocol/protocol/hcs14`
      subpath - deliberately *not* in the main barrel, since that barrel is
      bundled into `apps/web` client components and this uses `node:crypto`)
      computes a syntactically-valid `uaid:aid:{base58(sha384(canonicalJson))}
      ;uid=...;registry=...;proto=...;nativeId=...` id per the published
      grammar at hol.org/docs/standards/hcs-14. **This is not registered with
      or resolvable via any live HCS-14 registry** - `registry=hark-protocol`/
      `proto=hark-x402` are Hark's own self-declared values, computed locally,
      exactly matching CLAUDE.md section 36's framing of HCS-14 as optional
      and non-blocking. `packages/db/src/seed.ts` now populates
      `advertiser_agents.hederaAccountId`/`hcs14Id` for all three seeded
      agents (backfilling existing rows too); `campaignSchema` gained optional
      `advertiserHederaAccountId`/`advertiserHcs14Id`, threaded through
      `campaign-service.ts`'s existing agent-row join. Displayed in the Agent
      Dashboard (`apps/web/components/hark/agent-dashboard.tsx`), replacing a
      stale single shared `AGENT_HEDERA_ACCOUNT_ID` display that broke when
      the env vars above were split per-agent. 4/4 new protocol unit tests;
      live-verified in-browser showing three distinct HCS-14 ids.
- [x] **HCS payment/action audit trail** (bonus #1, CLAUDE.md section 35):
      `apps/api/src/hcs/{client,topic,audit}.ts`. The API needed its own
      Hedera-keyed operator for this (it previously held none - x402 payments
      never required the API to hold a private key); reuses the
      `HEDERA_PAY_TO_ACCOUNT_ID` account via a new `HEDERA_PAY_TO_PRIVATE_KEY`
      env var, supplied by the user specifically for this purpose. Topic is
      lazily created on first settlement (not at boot, so a Hedera hiccup here
      can never delay startup or the mandatory payment path) and cached
      in-memory; `HARK_HCS_TOPIC_ID` pins it across restarts. Wired into
      `payment-service.ts`'s `finalizeSettledPayment`, entirely best-effort
      (try/catch, logs and moves on - never throws into the settlement path).
      Payload is exactly CLAUDE.md's suggested shape
      (`schema/event/agentId/campaignId/publisherId/topic/amountTinybar/
      transactionId/timestamp`) - no `subjectRef`, no `semanticSummary`, no
      user identity, ever. **Live-verified end-to-end**: real topic
      `0.0.10486387` created on Hedera testnet
      (https://hashscan.io/testnet/topic/0.0.10486387), a real settlement
      (`0.0.7162784@1789165369.826772935`) produced a real HCS message,
      independently confirmed via the public testnet mirror node
      (`GET /api/v1/topics/0.0.10486387/messages`) - decoded payload matched
      exactly, with no PII. Two new API tests (mocking `hcs/audit.js` so the
      regular test suite never makes a real Hedera call, per CLAUDE.md section
      28) assert: no audit event when the intent has no topic recorded, and
      the exact non-PII payload shape when it does. 23/23 `apps/api` tests
      still pass.

- [x] **Explorer UI surfaces both bonus features** for demo purposes (they
      were previously only visible via server logs or manually querying
      HashScan/the mirror node): each campaign card now shows its
      `advertiserHcs14Id`; a new "HCS payment audit trail" card shows the
      audit topic's HashScan link plus recent settled events, fetched live by
      a new `apps/web/app/api/hcs-audit/route.ts` route handler that reads
      and decodes messages directly from the public Hedera testnet mirror
      node (`GET /api/v1/topics/:topicId/messages`) - independent
      confirmation, not just Hark's own claim. `apps/api`'s
      `hcs/topic.ts` gained `getCachedAuditTopicId()` (read-only, never
      triggers topic creation) so the frequently-polled `/v1/explorer/summary`
      endpoint can display the topic id without ever spending real HBAR on a
      page view. Live-verified in-browser: real topic link, real decoded
      audit event (`#1`, NovaBook Agent, Laptops, 100000 tinybar, working
      HashScan tx link), zero console errors.

## Phase 6 - Deployment (live)

- [x] **Neon** (Postgres) - migrated and seeded.
- [x] **Railway** (API) - https://hark-protocol-api-production.up.railway.app.
      Two real deploy-time bugs found and fixed: `apps/api` only listened on
      `API_PORT`, not Railway's injected `PORT`; `@hark-protocol/db` was
      source-only (no build step), so the compiled server crashed importing
      a `.ts` file at runtime under plain `node` - given the same `tsc` build
      step `packages/protocol` already had.
- [x] **Vercel** (web) - https://web-sigma-dusky-37.vercel.app. Root
      Directory set to `apps/web` with `pnpm install --frozen-lockfile` so
      the pnpm workspace resolves correctly from a monorepo deploy. A UTF-8
      BOM silently corrupted env var values piped in through Windows
      PowerShell (`"value" | vercel env add ...`) - fixed by piping through
      Bash instead.
- [x] **Live-verified end-to-end against the deployed stack** (not just
      localhost): created an intent through the deployed web app, ran
      `pnpm agent:novabook` against the deployed API, and got a real settled
      Hedera testnet payment - tx `0.0.7162784@1789171232.994132558` -
      visible as a live ad on the deployed site with a working HashScan link.
      This satisfies CLAUDE.md section 43's mandatory live-deployment checks.

## Publisher revenue share (bonus, beyond CLAUDE.md's original spec)

Design question raised during the build: currently 100% of every reach
payment goes to one Hedera account (`HEDERA_PAY_TO_ACCOUNT_ID`) - the
publisher who supplied the actual audience gets nothing. CLAUDE.md lists
"publisher revenue sharing" as an explicit MVP non-goal (section 48), but
since it came up, this implements a real (not aspirational) version:

- [x] **Split computed once, at payment-creation time** (`payment-service.ts`),
      via `splitTinybarByBps` (`packages/protocol/src/tinybar.ts`) - integer
      BigInt division, share + remainder always sum back to the exact price,
      no rounding loss. Default `HARK_PUBLISHER_SHARE_BPS=8000` (80%
      publisher / 20% protocol) - chosen deliberately publisher-favorable,
      since publishers are the harder side of this marketplace to bootstrap
      and Hark's own per-transaction value-add (matching + payment rail) is
      thin compared to what a heavier take rate would imply.
- [x] **New schema**: `publishers.payout_hedera_account_id`,
      `payments.publisher_share_tinybar` / `protocol_share_tinybar` /
      `publisher_payout_id`, and a `publisher_payouts` table (one row per
      batch payout run, not per reach).
- [x] **Payouts are batched, not per-reach** (`payout-service.ts`,
      `apps/api/src/jobs/run-publisher-payouts.ts`, `pnpm payout:run`) - a
      real `TransferTransaction` (not `payTo` from the mandatory x402 flow,
      which stays untouched) from the operator account to the publisher's
      registered payout account, only once the accrued balance clears
      `HARK_PAYOUT_MIN_TINYBAR` (default 0.01 HBAR - avoids paying more in
      Hedera fees than the payout is worth). Payments are only linked to the
      payout row *after* a successful transfer - a failed transfer marks the
      payout row `failed` but leaves the underlying payments unpaid and
      eligible for a future retry, so a Hedera hiccup can never silently
      lose track of money owed to a publisher.
- [x] `GET /v1/publishers/me/balance` (publisher-authenticated) - accrued
      unpaid balance, for visibility.
- [x] 8 new API unit tests (`payout-service.test.ts`, mocking
      `@hiero-ledger/sdk` so the regular suite never makes a real transfer,
      same principle as the HCS audit tests) plus 6 new protocol tests for
      `splitTinybarByBps`. 31/31 `apps/api` and 35/35 `packages/protocol`
      unit tests pass.
- [x] **Live-verified end-to-end, twice** (local Postgres and the live Neon
      DB): fresh intent -> real NovaBook settlement -> `GET
      /v1/publishers/me/balance` showed the correct accrued 80% share ->
      `pnpm payout:run` executed a real `TransferTransaction` -> independently
      confirmed via the Hedera testnet mirror node (`result: SUCCESS`,
      `0.0.10475939` credited exactly `80000` tinybar) -> balance endpoint
      correctly dropped back to `0`.
- **Not built** (explicitly out of scope per the design discussion): paying
  the *user* directly. Hark's privacy model depends on `subjectRef` being an
  opaque, publisher-scoped string with no linked wallet/identity - Hark
  paying a "user" would mean either breaking that guarantee or delegating the
  actual payout entirely to the publisher's own systems, which is a
  publisher-side business decision outside the protocol's boundary, not
  something Hark itself should execute.

## Remaining (NOT STARTED)

README, demo script/video, CI, HTS asset support, multi-agent bidding, better
discovery/UCP.
