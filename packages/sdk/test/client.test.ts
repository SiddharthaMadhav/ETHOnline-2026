import { describe, expect, it, vi } from "vitest";
import { HarkApiError, requestJson } from "../src/client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("requestJson", () => {
  it("returns the parsed body for a 2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" }));
    const { data } = await requestJson(fetchImpl, "https://example.test/v1/thing");
    expect(data).toEqual({ hello: "world" });
  });

  it("throws HarkApiError with the API's error contract on a non-2xx response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { error: { code: "INTENT_NOT_FOUND", message: "no such intent" } }));

    await expect(requestJson(fetchImpl, "https://example.test/v1/intents/int_x")).rejects.toMatchObject({
      status: 404,
      message: "no such intent",
      code: "INTENT_NOT_FOUND",
    });
  });

  it("falls back to a generic message when the error body is missing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    try {
      await requestJson(fetchImpl, "https://example.test/v1/thing");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HarkApiError);
      expect((error as HarkApiError).message).toBe("Hark API error: 500");
    }
  });
});
