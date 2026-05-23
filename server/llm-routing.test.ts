import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("LLM Routing Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use Forge API when LOCAL_LLM_URL is not set", async () => {
    process.env.LOCAL_LLM_URL = "";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.manus.im";
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";

    const { ENV } = await import("./_core/env");
    expect(ENV.localLlmUrl).toBe("");
    expect(ENV.forgeApiUrl).toBe("https://forge.manus.im");
  });

  it("should configure local LLM when LOCAL_LLM_URL is set", async () => {
    process.env.LOCAL_LLM_URL = "http://localhost:8000";
    process.env.LOCAL_LLM_MODEL = "BSC-LT/salamandra-7b-instruct";
    process.env.LOCAL_LLM_API_KEY = "local-key";

    const { ENV } = await import("./_core/env");
    expect(ENV.localLlmUrl).toBe("http://localhost:8000");
    expect(ENV.localLlmModel).toBe("BSC-LT/salamandra-7b-instruct");
    expect(ENV.localLlmApiKey).toBe("local-key");
  });

  it("should default LOCAL_LLM_MODEL to Salamandra when not specified", async () => {
    process.env.LOCAL_LLM_URL = "http://localhost:11434";
    delete process.env.LOCAL_LLM_MODEL;

    const { ENV } = await import("./_core/env");
    expect(ENV.localLlmModel).toBe("BSC-LT/salamandra-7b-instruct");
  });

  it("should default LOCAL_LLM_API_KEY to empty string when not specified", async () => {
    process.env.LOCAL_LLM_URL = "http://localhost:11434";
    delete process.env.LOCAL_LLM_API_KEY;

    const { ENV } = await import("./_core/env");
    expect(ENV.localLlmApiKey).toBe("");
  });
});
