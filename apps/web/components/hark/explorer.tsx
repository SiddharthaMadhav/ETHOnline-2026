"use client";

import { useEffect, useState } from "react";
import { getTopic } from "@hark-protocol/protocol";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ExplorerSummary } from "@/lib/hark-client";

function toHashscanTransactionId(transactionId: string): string {
  const [account, timestamp] = transactionId.split("@");
  if (!timestamp) return transactionId;
  return `${account}-${timestamp.replace(".", "-")}`;
}

export function Explorer() {
  const [summary, setSummary] = useState<ExplorerSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/explorer-summary", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        setSummary(await res.json());
      } catch {
        // silent - retried on next tick
      }
    }
    void poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!summary) {
    return <div className="mx-auto max-w-4xl px-6 py-10 text-sm text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hark Explorer</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Public, aggregate, anonymous system state - never a subject reference, publisher secret, or
          private key.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {summary.publishers.map((publisher) => (
              <div key={publisher.id}>{publisher.name}</div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active intent topics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {summary.activeIntentTopicCounts.length === 0 && (
              <span className="text-sm text-zinc-500">No active intents right now.</span>
            )}
            {summary.activeIntentTopicCounts.map((row) => (
              <Badge key={row.topicId} variant="outline">
                {getTopic(row.topicId)?.label ?? row.topicId} ({row.count})
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {summary.campaigns.map((campaign) => (
            <div key={campaign.id} className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{campaign.name}</span>
                <span className="text-zinc-500">by {campaign.advertiserName}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {campaign.targetTopics.map((topicId) => (
                  <Badge key={topicId} variant="secondary">
                    {getTopic(topicId)?.label ?? topicId}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                Max {campaign.maxPriceTinybar} tinybar / reach - budget {campaign.totalBudgetTinybar} tinybar
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anonymous opportunities ({summary.opportunities.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {summary.opportunities.length === 0 && <span className="text-zinc-500">None right now.</span>}
          {summary.opportunities.map((opportunity) => (
            <div key={opportunity.id} className="flex items-center justify-between">
              <span>
                {opportunity.publisher.name} / {opportunity.placement.name} -{" "}
                {opportunity.intent.topics.map((t) => getTopic(t.id)?.label ?? t.id).join(", ")}
              </span>
              <span className="text-zinc-400">{opportunity.pricing.amountTinybar} tinybar</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {summary.recentDeliveries.length === 0 && <span className="text-zinc-500">None yet.</span>}
          {summary.recentDeliveries.map((delivery) => (
            <div key={delivery.id}>
              <Separator className="mb-2" />
              <div className="flex items-center justify-between">
                <span>
                  {delivery.status} - {delivery.payment.amountTinybar} tinybar
                </span>
                {delivery.payment.transactionId ? (
                  <a
                    className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
                    href={`https://hashscan.io/testnet/transaction/${toHashscanTransactionId(delivery.payment.transactionId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {delivery.payment.transactionId}
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400">settling...</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
