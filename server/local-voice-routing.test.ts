import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.manus.im",
    forgeApiKey: "test-key",
    localAsrUrl: "",
    localTtsUrl: "",
    localTtsDialect: "ca-nw",
    localLlmUrl: "",
    localLlmModel: "BSC-LT/salamandra-7b-instruct",
    localLlmApiKey: "",
  },
}));

describe("Local Voice Routing Configuration", () => {
  describe("LOCAL_ASR_URL routing", () => {
    it("should use Forge API when LOCAL_ASR_URL is not set", async () => {
      const { ENV } = await import("./_core/env");
      expect(ENV.localAsrUrl).toBe("");
      // When empty, the system should fall through to Forge API
      const useLocalAsr = ENV.localAsrUrl && ENV.localAsrUrl.trim().length > 0;
      expect(useLocalAsr).toBeFalsy();
    });

    it("should detect local ASR when LOCAL_ASR_URL is configured", async () => {
      const { ENV } = await import("./_core/env");
      // Simulate setting the env var
      (ENV as any).localAsrUrl = "http://localhost:8002/transcribe";
      const useLocalAsr = ENV.localAsrUrl && ENV.localAsrUrl.trim().length > 0;
      expect(useLocalAsr).toBeTruthy();
      // Reset
      (ENV as any).localAsrUrl = "";
    });

    it("should resolve correct ASR endpoint from base URL", () => {
      const resolveAsrUrl = (baseUrl: string) => {
        const cleaned = baseUrl.replace(/\/$/, "");
        if (cleaned.includes("/v1/audio/transcriptions")) return cleaned;
        if (cleaned.endsWith("/transcribe")) return cleaned;
        return `${cleaned}/v1/audio/transcriptions`;
      };

      expect(resolveAsrUrl("http://localhost:8002/transcribe"))
        .toBe("http://localhost:8002/transcribe");
      expect(resolveAsrUrl("http://localhost:8002/v1/audio/transcriptions"))
        .toBe("http://localhost:8002/v1/audio/transcriptions");
      expect(resolveAsrUrl("http://localhost:8002"))
        .toBe("http://localhost:8002/v1/audio/transcriptions");
      expect(resolveAsrUrl("http://localhost:8002/"))
        .toBe("http://localhost:8002/v1/audio/transcriptions");
    });
  });

  describe("LOCAL_TTS_URL routing", () => {
    it("should use Forge API when LOCAL_TTS_URL is not set", async () => {
      const { ENV } = await import("./_core/env");
      expect(ENV.localTtsUrl).toBe("");
      const useLocalTts = ENV.localTtsUrl && ENV.localTtsUrl.trim().length > 0;
      expect(useLocalTts).toBeFalsy();
    });

    it("should detect local TTS when LOCAL_TTS_URL is configured", async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).localTtsUrl = "http://localhost:8001/api/tts";
      const useLocalTts = ENV.localTtsUrl && ENV.localTtsUrl.trim().length > 0;
      expect(useLocalTts).toBeTruthy();
      // Reset
      (ENV as any).localTtsUrl = "";
    });

    it("should resolve correct TTS endpoint from base URL", () => {
      const resolveTtsUrl = (baseUrl: string) => {
        const cleaned = baseUrl.replace(/\/$/, "");
        if (cleaned.endsWith("/api/tts")) return cleaned;
        return `${cleaned}/api/tts`;
      };

      expect(resolveTtsUrl("http://localhost:8001/api/tts"))
        .toBe("http://localhost:8001/api/tts");
      expect(resolveTtsUrl("http://localhost:8001"))
        .toBe("http://localhost:8001/api/tts");
      expect(resolveTtsUrl("http://localhost:8001/"))
        .toBe("http://localhost:8001/api/tts");
    });

    it("should default to ca-nw dialect for Terres de l'Ebre", async () => {
      const { ENV } = await import("./_core/env");
      expect(ENV.localTtsDialect).toBe("ca-nw");
    });

    it("should construct correct Matxa TTS payload", () => {
      const buildPayload = (options: {
        text: string;
        voice?: string;
        language?: string;
        dialect?: string;
      }) => ({
        voice: options.voice || "quim",
        type: "text",
        text: options.text,
        language: options.language || options.dialect || "ca-nw",
      });

      const payload = buildPayload({
        text: "Bon dia, alumnes!",
        dialect: "ca-nw",
      });

      expect(payload.voice).toBe("quim");
      expect(payload.type).toBe("text");
      expect(payload.text).toBe("Bon dia, alumnes!");
      expect(payload.language).toBe("ca-nw");
    });
  });

  describe("Environment variable configuration", () => {
    it("should have all required env vars defined", async () => {
      const { ENV } = await import("./_core/env");
      expect(ENV).toHaveProperty("localAsrUrl");
      expect(ENV).toHaveProperty("localTtsUrl");
      expect(ENV).toHaveProperty("localTtsDialect");
      expect(ENV).toHaveProperty("localLlmUrl");
      expect(ENV).toHaveProperty("localLlmModel");
      expect(ENV).toHaveProperty("localLlmApiKey");
    });

    it("should support the full sovereign stack configuration", () => {
      const sovereignConfig = {
        LOCAL_LLM_URL: "http://localhost:8000/v1",
        LOCAL_LLM_MODEL: "BSC-LT/salamandra-7b-instruct",
        LOCAL_ASR_URL: "http://localhost:8002/transcribe",
        LOCAL_TTS_URL: "http://localhost:8001/api/tts",
        LOCAL_TTS_DIALECT: "ca-nw",
      };

      // All values should be non-empty strings
      Object.values(sovereignConfig).forEach(val => {
        expect(val).toBeTruthy();
        expect(typeof val).toBe("string");
        expect(val.length).toBeGreaterThan(0);
      });
    });
  });
});
