"use client";

import { useEffect, useState } from "react";
import { getTopic } from "@hark-protocol/protocol";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_AGENTS } from "@/lib/demo-agents";

type DemoEvent = {
  id: string;
  type: string;
  actor: string;
  data: unknown;
  createdAt: string;
};

type Campaign = {
  advertiserAgentId: string;
  advertiserName: string;
  advertiserHederaAccountId?: string;
  advertiserHcs14Id?: string;
};

function summarize(event: DemoEvent): string {
  const data = (event.data ?? {}) as Record<string, unknown>;
  switch (event.type) {
    case "agent.opportunities_fetched":
      return `Discovered ${data.count ?? "?"} opportunit${data.count === 1 ? "y" : "ies"}`;
    case "agent.relevance_scored":
      return `Relevance ${typeof data.relevance === "number" ? data.relevance.toFixed(2) : "?"} for ${data.opportunityId ?? "an opportunity"}`;
    case "agent.skipped":
      return `Skipped: ${data.reason ?? "not relevant enough"}`;
    case "reach.payment_verified":
      return `POST /v1/reach - payment verified for campaign ${data.campaignId ?? ""}`;
    case "delivery.queued":
      return `Delivery queued: ${data.deliveryId ?? ""}`;
    case "reach.payment_settled":
      return `Settled - tx ${data.transactionId ?? ""}`;
    case "intent.created":
      return `Intent created (${((data.topics as string[]) ?? []).join(", ")})`;
    case "intent.revoked":
      return `Intent revoked (${data.reason ?? ""})`;
    default:
      return event.type;
  }
}

export function AgentDashboard() {
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [eventsRes, campaignsRes] = await Promise.all([
          fetch("/api/demo-events", { cache: "no-store" }),
          fetch("/api/explorer-summary", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (eventsRes.ok) {
          const body = (await eventsRes.json()) as { items: DemoEvent[] };
          setEvents(body.items);
        }
        if (campaignsRes.ok) {
          const body = (await campaignsRes.json()) as { campaigns: Campaign[] };
          setCampaigns(body.campaigns);
        }
      } catch {
        // silent - retried on next tick
      }
    }
    void poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function actorLabel(actor: string): string {
    const campaign = campaigns.find((c) => c.advertiserAgentId === actor);
    return campaign?.advertiserName ?? actor;
  }

  function campaignForSlug(slug: string): Campaign | undefined {
    // Demo agent slugs (novabook/flylite/pace) match the seeded agent's
    // display-name convention closely enough to look up by campaign name
    // prefix - the live campaigns feed doesn't carry the agent slug itself,
    // only its DB id, name and advertiser display name.
    return campaigns.find((c) => c.advertiserName.toLowerCase().startsWith(slug));
  }

  function truncateMiddle(value: string, keep = 18): string {
    if (value.length <= keep * 2 + 1) return value;
    return `${value.slice(0, keep)}…${value.slice(-keep)}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          The three seeded demo agents and a live feed of their discover -&gt; evaluate -&gt; decide -&gt;
          pay activity, reported by the agent CLI and Hark itself.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {DEMO_AGENTS.map((agent) => {
          const campaign = campaignForSlug(agent.slug);
          return (
            <Card key={agent.slug}>
              <CardHeader>
                <CardTitle className="text-base">{agent.displayName}</CardTitle>
                <CardDescription>{agent.campaignName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {agent.targetTopics.map((topicId) => (
                    <Badge key={topicId} variant="outline">
                      {getTopic(topicId)?.label ?? topicId}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">Min relevance: {agent.minRelevance}</p>
                {campaign?.advertiserHederaAccountId && (
                  <p className="font-mono text-xs text-zinc-400">
                    Wallet: {campaign.advertiserHederaAccountId}
                  </p>
                )}
                {campaign?.advertiserHcs14Id && (
                  <p
                    className="truncate font-mono text-[11px] text-zinc-400"
                    title={campaign.advertiserHcs14Id}
                  >
                    HCS-14: {truncateMiddle(campaign.advertiserHcs14Id)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Live event log</h2>
        {events.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-zinc-500">
              No activity yet - run <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">pnpm agent:novabook</code>{" "}
              (or flylite/pace).
            </CardContent>
          </Card>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {[...events].reverse().map((event) => (
              <li key={event.id} className="flex items-baseline gap-3 border-b border-zinc-100 py-1.5 dark:border-zinc-800">
                <span className="w-20 shrink-0 font-mono text-xs text-zinc-400">
                  {new Date(event.createdAt).toISOString().slice(11, 19)}
                </span>
                <span className="w-28 shrink-0 truncate text-xs text-zinc-500">{actorLabel(event.actor)}</span>
                <span>{summarize(event)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
