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

function parseArgs(argv: string[]): { agent: string; once: boolean } {
  let agent: string | undefined;
  let once = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--agent") {
      agent = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--once") {
      once = true;
    }
  }
  if (!agent) {
    throw new Error("Usage: cli.ts --agent <novabook|flylite|pace> [--once]");
  }
  return { agent, once };
}

function requireEnv(name: string, placeholder?: string): string {
  const value = process.env[name] ?? "";
  if (!value || value === placeholder) {
    throw new Error(`${name} is not set to a real value in .env`);
  }
  return value;
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
  const { agent: agentArg } = parseArgs(process.argv.slice(2));
  if (!isAgentName(agentArg)) {
    throw new Error(`Unknown agent "${agentArg}". Expected one of: ${Object.keys(AGENT_CONFIGS).join(", ")}`);
  }
  const campaign = AGENT_CONFIGS[agentArg];

  const harkApiUrl = process.env.HARK_API_URL ?? "http://localhost:4021";
  const accountId = requireEnv("AGENT_HEDERA_ACCOUNT_ID", PLACEHOLDER_ACCOUNT_ID);
  const privateKey = requireEnv("AGENT_HEDERA_PRIVATE_KEY", PLACEHOLDER_PRIVATE_KEY);
  const campaignId = requireEnv("AGENT_CAMPAIGN_ID");
  const maxPriceTinybar = process.env.AGENT_MAX_PRICE_TINYBAR ?? campaign.maxPriceTinybar;
  const runBudgetTinybar = process.env.AGENT_RUN_BUDGET_TINYBAR ?? "1000000";

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
  if (opportunities.length === 0) {
    log("No opportunities discovered. Nothing to evaluate.");
    return;
  }

  for (const opportunity of opportunities) {
    log(`Discovered opportunity from ${opportunity.publisher.name}`);
    log(`Topic: ${opportunity.intent.topics.map((topic) => topic.id).join(", ")}`);

    const decision = await agent.evaluate(opportunity);
    log(`Relevance: ${decision.relevance.toFixed(2)} (${decision.reason})`);

    const shouldPay = agent.decide(opportunity, decision);
    log(`Decision: ${shouldPay ? "advertise" : "skip"}`);
    if (!shouldPay) continue;

    log("POST /v1/reach");
    log("signing Hedera x402 payment");
    try {
      const { confirmation, transactionId } = await agent.reach(opportunity);
      log(`Settled: ${confirmation.payment.amountTinybar} tinybar`);
      if (transactionId) log(`Tx: ${transactionId}`);
      log(`Delivery queued: ${confirmation.deliveryId}`);

      // CLAUDE.md section 30: at most one paid reach per run.
      return;
    } catch (error) {
      // A rejected reach attempt (e.g. this campaign already reached this
      // exact intent) is a business outcome, not a fatal error - try the
      // next candidate instead of aborting the whole run.
      log(`Reach attempt failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  log("No opportunity met the relevance/budget bar for a paid reach this run.");
}

main().catch((error) => {
  console.error("Agent run failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
