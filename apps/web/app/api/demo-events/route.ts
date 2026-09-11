import { NextResponse } from "next/server";
import { listDemoEvents } from "@/lib/hark-client";

export async function GET() {
  const items = await listDemoEvents(200);
  return NextResponse.json({ items });
}
