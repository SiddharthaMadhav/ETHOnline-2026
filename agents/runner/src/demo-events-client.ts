/**
 * Fire-and-forget POST to Hark's demo-events log (CLAUDE.md section 10's
 * agent.opportunities_fetched/relevance_scored/skipped types). A failed
 * write must never break an agent run, so this only logs on failure.
 */
export async function postDemoEvent(
  harkApiUrl: string,
  type: string,
  actor: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const res = await fetch(`${harkApiUrl}/v1/demo-events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, actor, data }),
    });
    if (!res.ok) {
      console.error(`Failed to post demo event ${type}: ${res.status}`);
    }
  } catch (error) {
    console.error(`Failed to post demo event ${type}:`, error instanceof Error ? error.message : error);
  }
}
