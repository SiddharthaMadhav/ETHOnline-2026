"use client";

import { useEffect, useMemo, useState } from "react";
import type { HarkIntent } from "@hark-protocol/protocol";
import { getTopic } from "@hark-protocol/protocol";
import {
  createIntentFromChipAction,
  createIntentFromTextAction,
  refreshIntentAction,
  revokeIntentAction,
  type DemoSubject,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const DEMO_SUBJECTS: DemoSubject[] = ["alex", "sam", "taylor"];

const TOPIC_CHIPS = [
  "electronics.computer.laptop",
  "travel.flight",
  "sports.running",
  "electronics.phone",
  "home.furniture",
].map((id) => ({ id, label: getTopic(id)?.label ?? id }));

type FeedAd = {
  id: string;
  status: string;
  campaignName: string;
  creative?: {
    headline: string;
    body: string;
    ctaLabel: string;
    destinationUrl: string;
  };
  payment: { amountTinybar: string; transactionId?: string };
};

function toHashscanTransactionId(transactionId: string): string {
  const [account, timestamp] = transactionId.split("@");
  if (!timestamp) return transactionId;
  return `${account}-${timestamp.replace(".", "-")}`;
}

function expiresInWords(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function PublisherDemo({ placementId }: { placementId: string | null }) {
  const [subjectRef, setSubjectRef] = useState<DemoSubject>("alex");
  const [intent, setIntent] = useState<HarkIntent | null>(null);
  const [freeText, setFreeText] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ads, setAds] = useState<FeedAd[]>([]);

  const primaryTopicLabel = useMemo(() => {
    const topicId = intent?.topics[0]?.id;
    return topicId ? (getTopic(topicId)?.label ?? topicId) : undefined;
  }, [intent]);

  useEffect(() => {
    // Defined inline (not via a hoisted useCallback) so the effect owns its
    // own poll loop end to end - re-running this effect on subjectRef change
    // tears down the previous interval before starting a new one, so there's
    // no stale-response race to guard against.
    async function poll() {
      try {
        const res = await fetch(`/api/feed/${subjectRef}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { items: FeedAd[] };
        setAds(body.items);
      } catch {
        // Polling failures are silent - the next tick will retry.
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), 4000);
    return () => clearInterval(interval);
  }, [subjectRef]);

  async function handleChipClick(topicId: string, label: string) {
    if (!placementId) return;
    setPending(true);
    setErrorMessage(null);
    try {
      const created = await createIntentFromChipAction({ subjectRef, placementId, topicId, topicLabel: label });
      setIntent(created);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function handleTextSubmit() {
    if (!placementId || !freeText.trim()) return;
    setPending(true);
    setErrorMessage(null);
    try {
      const created = await createIntentFromTextAction({ subjectRef, placementId, text: freeText });
      setIntent(created);
      setFreeText("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function handleRefresh() {
    if (!intent) return;
    setPending(true);
    try {
      setIntent(await refreshIntentAction(intent.id));
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(reason: "fulfilled" | "user_requested") {
    if (!intent) return;
    setPending(true);
    try {
      await revokeIntentAction(intent.id, reason);
      setIntent(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Demo Publisher</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A simulated shopping/recommendation platform. Tell it what you&apos;re interested in - it
          publishes a temporary, anonymous intent to Hark, and advertiser agents pay to reach you if
          it&apos;s relevant.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">Demo user:</span>
        {DEMO_SUBJECTS.map((subject) => (
          <Button
            key={subject}
            size="sm"
            variant={subject === subjectRef ? "default" : "outline"}
            onClick={() => setSubjectRef(subject)}
            className="capitalize"
          >
            {subject}
          </Button>
        ))}
      </div>

      {!intent && (
        <Card>
          <CardHeader>
            <CardTitle>What are you interested in?</CardTitle>
            <CardDescription>Pick a category, or just describe it in your own words.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {TOPIC_CHIPS.map((chip) => (
                <Button
                  key={chip.id}
                  variant="secondary"
                  size="sm"
                  disabled={pending || !placementId}
                  onClick={() => handleChipClick(chip.id, chip.label)}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="I'm starting college and need something lightweight for coding"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                disabled={pending || !placementId}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleTextSubmit();
                }}
              />
              <Button onClick={handleTextSubmit} disabled={pending || !placementId || !freeText.trim()}>
                Go
              </Button>
            </div>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          </CardContent>
        </Card>
      )}

      {intent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Hark Intent</CardTitle>
              <Badge variant="secondary">Confidence {Math.round((intent.topics[0]?.confidence ?? 1) * 100)}%</Badge>
            </div>
            <CardDescription>{primaryTopicLabel}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{intent.semanticSummary}</p>
            <p className="text-xs text-zinc-500">Expires in {expiresInWords(intent.expiresAt)}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={pending}>
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleRevoke("fulfilled")} disabled={pending}>
                Mark fulfilled
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleRevoke("user_requested")} disabled={pending}>
                Revoke
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Home feed</h2>
        {ads.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-zinc-500">
              {intent ? "No ads yet - waiting for an advertiser agent to pay for reach." : "Nothing here yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} topicLabel={primaryTopicLabel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdCard({ ad, topicLabel }: { ad: FeedAd; topicLabel?: string }) {
  if (!ad.creative) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-center gap-2">
          <Badge>Sponsored via Hark</Badge>
          <span className="text-xs text-zinc-500">{ad.campaignName}</span>
        </div>
        <h3 className="text-lg font-semibold">{ad.creative.headline}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{ad.creative.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            nativeButton={false}
            render={<a href={ad.creative.destinationUrl} target="_blank" rel="noopener noreferrer" />}
          >
            {ad.creative.ctaLabel}
          </Button>
          <Dialog>
            <DialogTrigger render={<Button variant="link" size="sm" />}>Why am I seeing this?</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Why am I seeing this?</DialogTitle>
                <DialogDescription render={<div className="flex flex-col gap-2 pt-2 text-left" />}>
                  <p>
                    You have an active {topicLabel ?? "matching"} intent on this platform. This advertiser paid
                    Hark to reach users with matching current intent.
                  </p>
                  <p>The advertiser did not receive your identity from Hark.</p>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </div>
        {ad.payment.transactionId && (
          <a
            className="mt-1 text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
            href={`https://hashscan.io/testnet/transaction/${toHashscanTransactionId(ad.payment.transactionId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View settlement on HashScan
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function PublisherDemoSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
