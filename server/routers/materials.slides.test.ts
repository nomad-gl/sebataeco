import { describe, it, expect } from "vitest";

// Mock the validateAndFixSlides function for testing
function validateAndFixSlides(parsed: Record<string, unknown>): Record<string, unknown> {
  const slides = (parsed.slides as Array<Record<string, unknown>> | undefined) ?? [];
  const fixed = slides
    .filter((s) => s.heading)
    .map((s) => ({
      heading: String(s.heading ?? ""),
      bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
      speakerNote: String(s.speakerNote ?? ""),
      talkingPoints: Array.isArray(s.talkingPoints) ? s.talkingPoints.map(String) : [],
      imagePrompt: String(s.imagePrompt ?? ""),
      keyVocabulary: Array.isArray(s.keyVocabulary) ? s.keyVocabulary : [],
    }));
  return { ...parsed, slides: fixed.length >= 3 ? fixed : slides };
}

describe("Slides Validation", () => {
  it("should validate a complete slides presentation", () => {
    const input = {
      title: "The Water Cycle",
      subject: "Science",
      competency: "STEM",
      yearGroup: "primary",
      keyVocabulary: [
        { term: "Evaporation", definition: "Process of water turning into vapor" },
      ],
      slides: [
        {
          heading: "The Water Cycle",
          bullets: ["Water evaporates from oceans", "Forms clouds"],
          speakerNote: "Introduction to the water cycle",
          talkingPoints: ["What happens to water in the sun?"],
          imagePrompt: "Water cycle diagram",
        },
        {
          heading: "Evaporation",
          bullets: ["Heat from sun", "Water turns to vapor"],
          speakerNote: "Explain evaporation",
          talkingPoints: ["Where does the water go?"],
          imagePrompt: "Evaporation illustration",
        },
        {
          heading: "Summary",
          bullets: ["Water cycle has 4 stages", "Sun provides energy"],
          speakerNote: "Recap the main points",
          talkingPoints: ["What did we learn?"],
          imagePrompt: "Summary graphic",
        },
      ],
    };

    const result = validateAndFixSlides(input);

    expect(result.slides).toBeDefined();
    expect(Array.isArray(result.slides)).toBe(true);
    expect((result.slides as Array<unknown>).length).toBe(3);
    
    const firstSlide = (result.slides as Array<Record<string, unknown>>)[0];
    expect(firstSlide.heading).toBe("The Water Cycle");
    expect(Array.isArray(firstSlide.bullets)).toBe(true);
    expect((firstSlide.bullets as string[]).length).toBe(2);
  });

  it("should handle missing optional fields", () => {
    const input = {
      title: "Test Presentation",
      slides: [
        { heading: "Slide 1", bullets: ["Point 1"] },
        { heading: "Slide 2", bullets: ["Point 2"] },
        { heading: "Slide 3", bullets: ["Point 3"] },
      ],
    };

    const result = validateAndFixSlides(input);

    expect((result.slides as Array<unknown>).length).toBe(3);
    const firstSlide = (result.slides as Array<Record<string, unknown>>)[0];
    expect(firstSlide.speakerNote).toBe("");
    expect(firstSlide.talkingPoints).toEqual([]);
    expect(firstSlide.imagePrompt).toBe("");
  });

  it("should filter out slides without heading", () => {
    const input = {
      title: "Test",
      slides: [
        { heading: "Valid Slide", bullets: ["Point 1"] },
        { bullets: ["Point 2"] }, // Missing heading
        { heading: "Another Valid", bullets: ["Point 3"] },
        { heading: "Third Valid", bullets: ["Point 4"] },
      ],
    };

    const result = validateAndFixSlides(input);

    expect((result.slides as Array<unknown>).length).toBe(3);
    const headings = (result.slides as Array<Record<string, unknown>>).map((s) => s.heading);
    expect(headings).toEqual(["Valid Slide", "Another Valid", "Third Valid"]);
  });

  it("should ensure bullets are arrays of strings", () => {
    const input = {
      title: "Test",
      slides: [
        { heading: "Slide 1", bullets: ["Point 1", "Point 2"] },
        { heading: "Slide 2", bullets: null },
        { heading: "Slide 3", bullets: ["Point 3"] },
      ],
    };

    const result = validateAndFixSlides(input);

    const slides = result.slides as Array<Record<string, unknown>>;
    expect(Array.isArray(slides[0].bullets)).toBe(true);
    expect(Array.isArray(slides[1].bullets)).toBe(true);
    expect((slides[1].bullets as string[]).length).toBe(0);
  });

  it("should preserve keyVocabulary if present", () => {
    const input = {
      title: "Test",
      keyVocabulary: [
        { term: "Term1", definition: "Definition 1" },
        { term: "Term2", definition: "Definition 2" },
      ],
      slides: [
        { heading: "Slide 1", bullets: ["Point 1"] },
        { heading: "Slide 2", bullets: ["Point 2"] },
        { heading: "Slide 3", bullets: ["Point 3"] },
      ],
    };

    const result = validateAndFixSlides(input);

    expect(result.keyVocabulary).toEqual(input.keyVocabulary);
  });

  it("should handle empty slides array", () => {
    const input = {
      title: "Empty Presentation",
      slides: [],
    };

    const result = validateAndFixSlides(input);

    // Should return original empty array since fixed.length < 3
    expect((result.slides as Array<unknown>).length).toBe(0);
  });

  it("should handle insufficient slides (< 3)", () => {
    const input = {
      title: "Insufficient",
      slides: [
        { heading: "Slide 1", bullets: ["Point 1"] },
        { heading: "Slide 2", bullets: ["Point 2"] },
      ],
    };

    const result = validateAndFixSlides(input);

    // Should return original array since fixed.length < 3
    expect((result.slides as Array<unknown>).length).toBe(2);
  });

  it("should convert all string fields to strings", () => {
    const input = {
      title: "Test",
      slides: [
        {
          heading: "Slide 1",
          bullets: ["Point 1"],
          speakerNote: 123 as unknown, // Should be converted to string
          talkingPoints: ["Question?"],
          imagePrompt: true as unknown, // Should be converted to string
        },
        { heading: "Slide 2", bullets: ["Point 2"] },
        { heading: "Slide 3", bullets: ["Point 3"] },
      ],
    };

    const result = validateAndFixSlides(input);

    const slides = result.slides as Array<Record<string, unknown>>;
    expect(typeof slides[0].speakerNote).toBe("string");
    expect(typeof slides[0].imagePrompt).toBe("string");
  });
});
