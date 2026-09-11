import { NextResponse } from "next/server";

/**
 * Reads and decodes recent messages from Hark's HCS payment audit topic
 * (CLAUDE.md section 35) directly off the public Hedera mirror node - proof
 * that the audit trail is real, independent of anything Hark's own API
 * claims. Demo-only observability, not part of the protocol surface.
 */

type MirrorMessage = {
  consensus_timestamp: string;
  sequence_number: number;
  message: string; // base64
};

export type HcsAuditEvent = {
  schema: string;
  event: string;
  agentId: string;
  campaignId: string;
  publisherId: string;
  topic: string;
  amountTinybar: string;
  transactionId: string;
  timestamp: string;
  sequenceNumber: number;
  consensusTimestamp: string;
};

function mirrorNodeBaseUrl(network: string): string {
  return network === "hedera:mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json({ items: [] });
  }

  const base = mirrorNodeBaseUrl(process.env.HEDERA_NETWORK ?? "hedera:testnet");

  try {
    const res = await fetch(
      `${base}/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=25&order=desc`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json({ items: [] });
    }
    const body = (await res.json()) as { messages?: MirrorMessage[] };

    const items: HcsAuditEvent[] = [];
    for (const raw of body.messages ?? []) {
      try {
        const decoded = JSON.parse(Buffer.from(raw.message, "base64").toString("utf-8")) as Record<
          string,
          unknown
        >;
        if (decoded.schema !== "hark.audit.v1") continue;
        items.push({
          schema: String(decoded.schema),
          event: String(decoded.event ?? ""),
          agentId: String(decoded.agentId ?? ""),
          campaignId: String(decoded.campaignId ?? ""),
          publisherId: String(decoded.publisherId ?? ""),
          topic: String(decoded.topic ?? ""),
          amountTinybar: String(decoded.amountTinybar ?? ""),
          transactionId: String(decoded.transactionId ?? ""),
          timestamp: String(decoded.timestamp ?? ""),
          sequenceNumber: raw.sequence_number,
          consensusTimestamp: raw.consensus_timestamp,
        });
      } catch {
        // skip anything that isn't a valid hark.audit.v1 message
      }
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
