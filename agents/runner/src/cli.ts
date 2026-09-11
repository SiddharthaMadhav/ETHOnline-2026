/**
 * Advertiser agent CLI (CLAUDE.md sections 16, 22, 26, 30). One run corresponds
 * to one campaign + one Hedera payer wallet, discovering opportunities, scoring
 * relevance, and paying for at most one delivery per run (CLAUDE.md section 30 -
 * "prevents accidental wallet draining"). --once is the only supported mode
 * this pass; --watch (continuous polling) is deferred, see docs/STATUS.md.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { AGENT_CONFIGS, isAgentName } from "./configs/index.js";
import { AdvertiserAgent } from "./agent.js";
import { createAgentFetch } from "./x402-client.js";
import { postDemoEvent } from "./demo-events-client.js";
import { DeterministicScorer } from "./relevance/deterministic-scorer.js";
import { OpenAIRelevanceScorer } from "./relevance/openai-scorer.js";
import type { RelevanceScorer } from "./relevance/scorer.js";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(packageDir, "..", "..", "..", ".env") });

const PLACEHOLDER_ACCOUNT_ID = "0.0.xxxxx";
const PLACEHOLDER_PRIVATE_KEY = "0x...";

function log(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`${timestamp}  ${message}`);
}

function parseArgs(argv: string[]): {
  agent: string;
  once: boolean;
  bulk: boolean;
  maxReaches?: number;
} {
  let agent: string | undefined;
  let once = false;
  let bulk = false;
  let maxReaches: number | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--agent") {
      agent = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--once") {
      once = true;
    } else if (argv[i] === "--bulk") {
      bulk = true;
    } else if (argv[i] === "--max-reaches") {
      const raw = argv[i + 1];
      const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--max-reaches requires a positive integer");
      }
      maxReaches = parsed;
      i += 1;
    }
  }
  if (!agent) {
    throw new Error(
      "Usage: cli.ts --agent <novabook|flylite|pace> [--once] [--bulk] [--max-reaches <n>]",
    );
  }
  return { agent, once, bulk, maxReaches };
}

function requireEnv(name: string, placeholder?: string): string {
  const value = process.env[name] ?? "";
  if (!value || value === placeholder) {
    throw new Error(`${name} is not set to a real value in .env`);
  }
  return value;
}

/**
 * Each agent is configured independently (CLAUDE.md section 16: one agent =
 * one campaign + one Hedera payer wallet) via a `<AGENT>_<SUFFIX>`-prefixed
 * env var, e.g. NOVABOOK_CAMPAIGN_ID. Replaces the single shared AGENT_*
 * vars, which caused every `pnpm agent:*` script to silently query the same
 * campaign's opportunities regardless of which agent's persona was scoring
 * them.
 */
function requireAgentEnv(agentSlug: string, suffix: string, placeholder?: string): string {
  return requireEnv(`${agentSlug.toUpperCase()}_${suffix}`, placeholder);
}

function optionalAgentEnv(agentSlug: string, suffix: string): string | undefined {
  return process.env[`${agentSlug.toUpperCase()}_${suffix}`];
}

async function fetchDiscoveryNetwork(harkApiUrl: string, fallbackNetwork: string): Promise<string> {
  try {
    const res = await fetch(`${harkApiUrl}/.well-known/hark.json`);
    if (!res.ok) return fallbackNetwork;
    const discovery = (await res.json()) as { network?: string };
    return discovery.network ?? fallbackNetwork;
  } catch {
    return fallbackNetwork;
  }
}

async function main(): Promise<void> {
  const { agent: agentArg, bulk, maxReaches } = parseArgs(process.argv.slice(2));
  if (!isAgentName(agentArg)) {
    throw new Error(`Unknown agent "${agentArg}". Expected one of: ${Object.keys(AGENT_CONFIGS).join(", ")}`);
  }
  const campaign = AGENT_CONFIGS[agentArg];

  const harkApiUrl = process.env.HARK_API_URL ?? "http://localhost:4021";
  const accountId = requireAgentEnv(agentArg, "HEDERA_ACCOUNT_ID", PLACEHOLDER_ACCOUNT_ID);
  const privateKey = requireAgentEnv(agentArg, "HEDERA_PRIVATE_KEY", PLACEHOLDER_PRIVATE_KEY);
  const campaignId = requireAgentEnv(agentArg, "CAMPAIGN_ID");
  const maxPriceTinybar = optionalAgentEnv(agentArg, "MAX_PRICE_TINYBAR") ?? campaign.maxPriceTinybar;
  const runBudgetTinybar = optionalAgentEnv(agentArg, "RUN_BUDGET_TINYBAR") ?? "1000000";

  console.log(`Agent: ${agentArg} - ${campaign.name} (campaign: ${campaignId}, wallet: ${accountId})`);

  // Discovery-first, per CLAUDE.md section 34, rather than hardcoding the network.
  const network = await fetchDiscoveryNetwork(harkApiUrl, process.env.HEDERA_NETWORK ?? "hedera:testnet");

  const scorer: RelevanceScorer = process.env.OPENAI_API_KEY
    ? new OpenAIRelevanceScorer()
    : new DeterministicScorer();
  log(`Using ${process.env.OPENAI_API_KEY ? "OpenAI" : "deterministic"} relevance scorer`);

  const fetchWithPayment = createAgentFetch({
    accountId,
    privateKey,
    network,
    maxPriceTinybar: campaign.maxPriceTinybar,
  });

  const agent = new AdvertiserAgent(
    { harkApiUrl, campaignId, campaign: { ...campaign, maxPriceTinybar }, runBudgetTinybar },
    scorer,
    fetchWithPayment,
  );

  const opportunities = await agent.discover();
  await postDemoEvent(harkApiUrl, "agent.opportunities_fetched", agentArg, { count: opportunities.length });
  if (opportunities.length === 0) {
    log("No opportunities discovered. Nothing to evaluate.");
    return;
  }

  // Default (CLAUDE.md section 30): stop after the first successful paid
  // reach, to prevent accidental wallet draining. --bulk opts into reaching
  // every relevant, affordable candidate discovered this run instead - still
  // capped by the same run/campaign budget checks, plus an optional explicit
  // --max-reaches ceiling.
  const reachLimit = bulk ? (maxReaches ?? Number.POSITIVE_INFINITY) : 1;
  let reachCount = 0;

  for (const opportunity of opportunities) {
    log(`Discovered opportunity from ${opportunity.publisher.name}`);
    log(`Topic: ${opportunity.intent.topics.map((topic) => topic.id).join(", ")}`);

    if (!agent.canAffordAnotherReach(opportunity.pricing.amountTinybar)) {
      log("Run budget exhausted - skipping remaining candidates without scoring them.");
      break;
    }

    const decision = await agent.evaluate(opportunity);
    log(`Relevance: ${decision.relevance.toFixed(2)} (${decision.reason})`);
    await postDemoEvent(harkApiUrl, "agent.relevance_scored", agentArg, {
      opportunityId: opportunity.id,
      relevance: decision.relevance,
      shouldAdvertise: decision.shouldAdvertise,
    });

    const shouldPay = agent.decide(opportunity, decision);
    log(`Decision: ${shouldPay ? "advertise" : "skip"}`);
    if (!shouldPay) {
      await postDemoEvent(harkApiUrl, "agent.skipped", agentArg, {
        opportunityId: opportunity.id,
        reason: decision.reason,
      });
      continue;
    }

    log("POST /v1/reach");
    log("signing Hedera x402 payment");
    try {
      const { confirmation, transactionId } = await agent.reach(opportunity);
      reachCount += 1;
      log(`Settled: ${confirmation.payment.amountTinybar} tinybar`);
      if (transactionId) log(`Tx: ${transactionId}`);
      log(`Delivery queued: ${confirmation.deliveryId}`);

      if (reachCount >= reachLimit) {
        log(
          bulk
            ? `Reached --max-reaches cap (${reachLimit}). Stopping.`
            : "Stopping after first paid reach (default mode - pass --bulk to reach every affordable candidate).",
        );
        return;
      }
    } catch (error) {
      // A rejected reach attempt (e.g. this campaign already reached this
      // exact intent) is a business outcome, not a fatal error - try the
      // next candidate instead of aborting the whole run.
      log(`Reach attempt failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  log(
    reachCount > 0
      ? `Run complete: ${reachCount} paid reach(es) out of ${opportunities.length} discovered.`
      : "No opportunity met the relevance/budget bar for a paid reach this run.",
  );
}

main().catch((error) => {
  console.error("Agent run failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
