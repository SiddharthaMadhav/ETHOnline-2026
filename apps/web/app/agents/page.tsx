import { AgentDashboard } from "@/components/hark/agent-dashboard";
import "@/lib/hark-client"; // ensures the root .env is loaded before reading process.env below

export default function AgentsPage() {
  return <AgentDashboard walletAccountId={process.env.AGENT_HEDERA_ACCOUNT_ID} />;
}
