import type { AgentCampaign } from "../relevance/scorer.js";
import { flyliteCampaign } from "./flylite.js";
import { novabookCampaign } from "./novabook.js";
import { paceCampaign } from "./pace.js";

export const AGENT_CONFIGS = {
  novabook: novabookCampaign,
  flylite: flyliteCampaign,
  pace: paceCampaign,
} satisfies Record<string, AgentCampaign>;

export type AgentName = keyof typeof AGENT_CONFIGS;

export function isAgentName(value: string): value is AgentName {
  return value in AGENT_CONFIGS;
}
