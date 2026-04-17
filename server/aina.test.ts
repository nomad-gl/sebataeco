/**
 * Tests for the aina router — image generation and file upload procedures.
 *
 * These tests mock the external helpers (generateImage, storagePut) so they
 * run fully offline without real S3 or Forge API calls.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock external dependencies before importing the router ──────────────────

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { ainaRouter } from "./routers/aina";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("aina.generateImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a URL when image generation succeeds", async () => {
    vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/generated.png" });

    const caller = ainaRouter.createCaller(createPublicContext());
    const result = await caller.generateImage({ prompt: "A sunny classroom" });

    expect(result).toEqual({ url: "https://cdn.example.com/generated.png" });
    expect(generateImage).toHaveBeenCalledWith({ prompt: "A sunny classroom" });
  });

  it("throws INTERNAL_SERVER_ERROR when image generation fails", async () => {
    vi.mocked(generateImage).mockRejectedValueOnce(new Error("Forge API timeout"));

    const caller = ainaRouter.createCaller(createPublicContext());

    await expect(caller.generateImage({ prompt: "A map of Spain" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("rejects empty prompts", async () => {
    const caller = ainaRouter.createCaller(createPublicContext());

    await expect(caller.generateImage({ prompt: "" })).rejects.toThrow();
  });
});

describe("aina.uploadFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a file and returns its URL and metadata", async () => {
    vi.mocked(storagePut).mockResolvedValueOnce({ url: "https://cdn.example.com/aina-uploads/test.pdf", key: "aina-uploads/test.pdf" });

    const caller = ainaRouter.createCaller(createPublicContext());
    const base64 = Buffer.from("hello world").toString("base64");

    const result = await caller.uploadFile({
      fileBase64: base64,
      fileName: "test.pdf",
      mimeType: "application/pdf",
    });

    expect(result.url).toBe("https://cdn.example.com/aina-uploads/test.pdf");
    expect(result.fileName).toBe("test.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(storagePut).toHaveBeenCalledOnce();
  });

  it("sanitises dangerous characters in the file name", async () => {
    vi.mocked(storagePut).mockResolvedValueOnce({ url: "https://cdn.example.com/aina-uploads/safe.png", key: "aina-uploads/safe.png" });

    const caller = ainaRouter.createCaller(createPublicContext());
    const base64 = Buffer.from("img").toString("base64");

    const result = await caller.uploadFile({
      fileBase64: base64,
      fileName: "../../etc/passwd.png",
      mimeType: "image/png",
    });

    // The returned fileName is the original (for display), but storagePut
    // receives a sanitised key — verify storagePut was called with a safe key
    expect(result.fileName).toBe("../../etc/passwd.png");
    const storagePutCall = vi.mocked(storagePut).mock.calls[0];
    expect(storagePutCall?.[0]).not.toContain("..");
    expect(storagePutCall?.[0]).not.toContain("/etc/");
  });

  it("rejects files exceeding the 16 MB limit", async () => {
    const caller = ainaRouter.createCaller(createPublicContext());

    await expect(
      caller.uploadFile({
        fileBase64: "dGVzdA==",
        fileName: "big.bin",
        mimeType: "application/octet-stream",
        fileSize: 17 * 1024 * 1024, // 17 MB
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
