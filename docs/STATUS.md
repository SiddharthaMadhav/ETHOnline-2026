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

**Not yet built (deferred to a follow-up pass):**

## Phase 3 - x402 mandatory payment path (NOT STARTED)

- [ ] Blocky `/supported` startup check (`pnpm check:blocky`)
- [ ] x402 Hedera resource server, `POST /v1/reach` protection
- [ ] Standalone advertiser x402 client
- [ ] First live HBAR paid request against Blocky402 testnet
- [ ] Idempotency + payment/delivery persistence

No payment code exists yet - nothing in this repo has moved real or test HBAR.
Do not claim the hackathon qualification requirement is satisfied until a real
Blocky402-settled testnet payment has completed end to end.

## Phase 4 - Advertiser intelligence (NOT STARTED)

- [ ] `RelevanceScorer` interface, deterministic scorer, OpenAI-backed scorer
- [ ] Agent CLI (`agents/runner`), budget enforcement, three demo agents

## Phase 5 - Web demo (NOT STARTED)

- [ ] Demo Publisher UI, agent dashboard, Hark Explorer

## Phase 6/7 - Deployment, submission, bonuses (NOT STARTED)
