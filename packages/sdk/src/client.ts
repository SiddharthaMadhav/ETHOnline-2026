/**
 * Shared HTTP plumbing for both Hark clients (CLAUDE.md section 20).
 * Deliberately has no Hedera/x402 signing logic of its own - callers pass in
 * whatever `fetch` they want (plain fetch for free endpoints, an x402-wrapped
 * fetch for the advertiser client's paid `reach()`).
 */
export type HarkFetch = typeof fetch;

export type HarkClientConfig = {
  baseUrl: string;
  /** Defaults to the global `fetch`. */
  fetch?: HarkFetch;
};

/** Mirrors the error contract in CLAUDE.md section 39. */
export class HarkApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Performs the request and returns the parsed JSON body alongside the raw
 * `Response` (needed by `reach()` to read the x402 payment-response header).
 * Throws `HarkApiError` for any non-2xx response, using the error body's
 * `error.message`/`error.code` when present.
 */
export async function requestJson(
  fetchImpl: HarkFetch,
  url: string,
  init: RequestInit = {},
): Promise<{ data: unknown; response: Response }> {
  const response = await fetchImpl(url, init);
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorBody = data as { error?: { message?: string; code?: string } };
    throw new HarkApiError(
      response.status,
      errorBody?.error?.message ?? `Hark API error: ${response.status}`,
      errorBody?.error?.code,
    );
  }
  return { data, response };
}
