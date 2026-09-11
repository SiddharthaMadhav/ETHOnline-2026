import { NextResponse } from "next/server";
import { getExplorerSummary } from "@/lib/hark-client";

export async function GET() {
  const summary = await getExplorerSummary();
  return NextResponse.json(summary);
}
