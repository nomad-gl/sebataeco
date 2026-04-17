/**
 * Tests for the aina router — image generation, file upload, save-to-library,
 * and document text extraction procedures.
 *
 * External helpers (generateImage, storagePut, db) are mocked so tests run
 * fully offline without real S3, Forge API, or database calls.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock external dependencies before importing the router ──────────────────

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({
  saveMaterial: vi.fn(),
}));

import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { saveMaterial } from "./db";
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

function createAuthContext(userId = "user-1"): TrpcContext {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com", role: "user", openId: "oid-1", avatarUrl: null, ttsVoice: null, position: null },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── generateImage ────────────────────────────────────────────────────────────

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

// ─── uploadFile ───────────────────────────────────────────────────────────────

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

// ─── saveGeneratedImage ───────────────────────────────────────────────────────

describe("aina.saveGeneratedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    const caller = ainaRouter.createCaller(createPublicContext());

    await expect(
      caller.saveGeneratedImage({
        imageUrl: "https://cdn.example.com/img.png",
        prompt: "A classroom",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("saves the image to My Materials and returns id + title", async () => {
    vi.mocked(saveMaterial).mockResolvedValueOnce(42);

    const caller = ainaRouter.createCaller(createAuthContext());
    const result = await caller.saveGeneratedImage({
      imageUrl: "https://cdn.example.com/img.png",
      prompt: "A sunny classroom",
      title: "My classroom image",
    });

    expect(result.id).toBe(42);
    expect(result.title).toBe("My classroom image");
    expect(saveMaterial).toHaveBeenCalledOnce();
  });

  it("uses prompt as title when no title is provided", async () => {
    vi.mocked(saveMaterial).mockResolvedValueOnce(99);

    const caller = ainaRouter.createCaller(createAuthContext());
    const result = await caller.saveGeneratedImage({
      imageUrl: "https://cdn.example.com/img.png",
      prompt: "A very long prompt that should be truncated to 60 characters maximum",
    });

    expect(result.title).toContain("Generated image:");
  });
});

// ─── extractDocumentText ──────────────────────────────────────────────────────

describe("aina.extractDocumentText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts plain text from a .txt file", async () => {
    const caller = ainaRouter.createCaller(createPublicContext());
    const text = "Hello, this is a test document.";
    const base64 = Buffer.from(text).toString("base64");

    const result = await caller.extractDocumentText({
      fileBase64: base64,
      mimeType: "text/plain",
      fileName: "test.txt",
    });

    expect(result.text).toBe(text);
    expect(result.truncated).toBe(false);
    expect(result.error).toBeNull();
  });

  it("returns empty text for unsupported binary types (no error, just no context)", async () => {
    const caller = ainaRouter.createCaller(createPublicContext());
    const base64 = Buffer.from("binary data").toString("base64");

    const result = await caller.extractDocumentText({
      fileBase64: base64,
      mimeType: "application/zip",
      fileName: "archive.zip",
    });

    expect(result.text).toBe("");
    // Unsupported types return null error (graceful degradation, not an error state)
    expect(result.error).toBeNull();
  });
});
