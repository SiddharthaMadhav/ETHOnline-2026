import { NextResponse } from "next/server";
import { getFeed, HarkApiError, listCampaigns } from "@/lib/hark-client";

/**
 * FeedDelivery on its own has no creative/topic info to render an ad card
 * with (campaignId is just an id) - join against the public campaign list
 * (already fetched for the Explorer page) rather than adding a new Hark
 * endpoint just for this.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subjectRef: string }> },
) {
  const { subjectRef } = await params;
  try {
    const [deliveries, campaigns] = await Promise.all([getFeed(subjectRef), listCampaigns()]);
    const items = deliveries.map((delivery) => {
      const campaign = campaigns.find((c) => c.id === delivery.campaignId);
      return {
        ...delivery,
        campaignName: campaign?.advertiserName ?? "An advertiser",
        creative: campaign?.creative,
      };
    });
    return NextResponse.json({ items });
  } catch (error) {
    const status = error instanceof HarkApiError ? error.status : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
