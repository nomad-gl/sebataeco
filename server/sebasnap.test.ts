import { describe, it, expect } from "vitest";

// Validates that the sebasnap.com API key is set and the endpoint responds correctly.
describe("sebasnap API key", () => {
  it("should have SEBASNAP_API_KEY env var set", () => {
    const key = process.env.SEBASNAP_API_KEY;
    expect(key).toBeTruthy();
    expect(key).toMatch(/^re_/);
  });

  it("should return a valid response from sebasnap presentation.list", async () => {
    const key = process.env.SEBASNAP_API_KEY!;
    const url =
      "https://sebasnap.com/api/trpc/presentation.list?batch=1&input=" +
      encodeURIComponent(JSON.stringify({ "0": { json: {} } }));

    const res = await fetch(url, {
      headers: { "x-api-key": key },
    });
    expect(res.ok).toBe(true);

    const data = (await res.json()) as Array<{
      result?: { data?: { json?: { presentations?: unknown[] } } };
    }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("result");
    const presentations = data[0]?.result?.data?.json?.presentations;
    expect(Array.isArray(presentations)).toBe(true);
  });
});
