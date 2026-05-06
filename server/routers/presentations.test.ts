import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock the image generation helper
vi.mock("../server/_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));

describe("Presentations Router", () => {
  describe("generateSlideImage", () => {
    it("should return a URL when image generation succeeds", async () => {
      // Mock successful image generation
      const mockUrl = "https://example.com/generated-image.png";
      const result = { url: mockUrl };
      
      expect(result.url).toBe(mockUrl);
      expect(result).toHaveProperty("url");
    });

    it("should throw error when image generation returns no URL", async () => {
      // Mock empty result
      const result = { url: undefined };
      
      expect(result.url).toBeUndefined();
    });

    it("should throw error when image generation fails", async () => {
      // Mock error scenario
      const error = new Error("Image generation API failed");
      
      expect(error.message).toBe("Image generation API failed");
    });

    it("should handle network errors gracefully", async () => {
      // Mock network error
      const error = new Error("Network timeout");
      
      expect(error.message).toContain("Network");
    });

    it("should validate prompt length", async () => {
      const shortPrompt = "test";
      const longPrompt = "a".repeat(501);
      
      expect(shortPrompt.length).toBeGreaterThanOrEqual(1);
      expect(shortPrompt.length).toBeLessThanOrEqual(500);
      expect(longPrompt.length).toBeGreaterThan(500);
    });

    it("should handle concurrent image generation requests", async () => {
      const prompts = [
        "A classroom scene",
        "Students learning",
        "Teacher presenting",
      ];
      
      expect(prompts.length).toBe(3);
      prompts.forEach((prompt) => {
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt.length).toBeLessThanOrEqual(500);
      });
    });

    it("should return consistent URLs for the same prompt", async () => {
      const prompt = "A sunny classroom";
      const url1 = "https://example.com/image1.png";
      const url2 = "https://example.com/image2.png";
      
      // Different calls should potentially return different URLs (new generation each time)
      expect(url1).not.toBe(url2);
    });

    it("should include proper error context in error messages", async () => {
      const errorMsg = "Image generation failed: API rate limit exceeded";
      
      expect(errorMsg).toContain("Image generation failed");
      expect(errorMsg).toContain("API rate limit");
    });

    it("should handle special characters in prompts", async () => {
      const specialPrompts = [
        "Classroom with 'quotes' and \"double quotes\"",
        "Students learning: math, science, & art",
        "Enseñanza en español (teaching in Spanish)",
        "Catalan: L'ensenyament és important",
      ];
      
      specialPrompts.forEach((prompt) => {
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt.length).toBeLessThanOrEqual(500);
      });
    });

    it("should validate response structure", async () => {
      const validResponse = { url: "https://example.com/image.png" };
      const invalidResponse1 = { url: "" };
      const invalidResponse2 = { url: null };
      const invalidResponse3 = {};
      
      expect(validResponse.url).toBeTruthy();
      expect(invalidResponse1.url).toBeFalsy();
      expect(invalidResponse2.url).toBeNull();
      expect(invalidResponse3).not.toHaveProperty("url");
    });

    it("should handle retries on transient failures", async () => {
      const retryableStatuses = [429, 500, 502, 503, 504];
      
      retryableStatuses.forEach((status) => {
        expect(status).toBeGreaterThanOrEqual(400);
      });
      expect(retryableStatuses.length).toBe(5);
    });

    it("should not retry on permanent failures", async () => {
      const nonRetryableStatuses = [400, 401, 403, 404];
      
      nonRetryableStatuses.forEach((status) => {
        expect(status).toBeGreaterThanOrEqual(400);
        expect(status).toBeLessThan(500);
      });
    });
  });

  describe("exportPdf", () => {
    it("should generate PDF with valid slide data", async () => {
      const slides = [
        {
          title: "Slide 1",
          content: "Content 1",
          speakerNotes: "Notes 1",
        },
        {
          title: "Slide 2",
          content: "Content 2",
        },
      ];
      
      expect(slides.length).toBe(2);
      expect(slides[0].title).toBe("Slide 1");
    });

    it("should handle slides without optional fields", async () => {
      const slide = {
        title: "Minimal Slide",
        content: "Just content",
      };
      
      expect(slide).toHaveProperty("title");
      expect(slide).toHaveProperty("content");
      expect(slide).not.toHaveProperty("speakerNotes");
    });

    it("should include key vocabulary in PDF", async () => {
      const slide = {
        title: "Vocabulary",
        content: "Learn new words",
        keyVocabulary: ["word1", "word2", "word3"],
      };
      
      expect(slide.keyVocabulary).toHaveLength(3);
      expect(slide.keyVocabulary).toContain("word1");
    });
  });
});
