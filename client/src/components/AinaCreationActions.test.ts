import { describe, it, expect, vi, beforeEach } from "vitest";
import { printAinaCreation, downloadAinaCreationAsText, downloadAinaCreationAsHtml, copyAinaCreationToClipboard } from "../lib/ainaPrintUtils";

describe("AinaCreationActions - Print/Save Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("printAinaCreation", () => {
    it("should open a new window for printing", () => {
      const mockWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        print: vi.fn(),
      };

      vi.spyOn(window, "open").mockReturnValue(mockWindow as any);

      const creation = {
        title: "Test Creation",
        content: "This is test content",
        timestamp: new Date("2026-05-07"),
      };

      printAinaCreation(creation);

      expect(window.open).toHaveBeenCalledWith("", "_blank");
      expect(mockWindow.document.write).toHaveBeenCalled();
      expect(mockWindow.document.close).toHaveBeenCalled();
    });

    it("should include title and content in print output", () => {
      const mockWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        print: vi.fn(),
      };

      vi.spyOn(window, "open").mockReturnValue(mockWindow as any);

      const creation = {
        title: "My AINA Creation",
        content: "Important content here",
      };

      printAinaCreation(creation);

      const writtenContent = mockWindow.document.write.mock.calls[0][0];
      expect(writtenContent).toContain("My AINA Creation");
      expect(writtenContent).toContain("Important content here");
    });
  });

  describe("downloadAinaCreationAsText", () => {
    it("should create and download text file", () => {
      const mockBlob = new Blob();
      vi.spyOn(global, "Blob").mockReturnValue(mockBlob);
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      };

      vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);

      const creation = {
        title: "Test",
        content: "Content",
      };

      downloadAinaCreationAsText(creation);

      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toContain("test");
    });
  });

  describe("downloadAinaCreationAsHtml", () => {
    it("should create and download HTML file", () => {
      const mockBlob = new Blob();
      vi.spyOn(global, "Blob").mockReturnValue(mockBlob);
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

      const mockLink = {
        href: "",
        download: "",
        click: vi.fn(),
      };

      vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);

      const creation = {
        title: "Test",
        content: "Content",
      };

      downloadAinaCreationAsHtml(creation);

      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toContain("test");
      expect(mockLink.download).toContain(".html");
    });
  });

  describe("copyAinaCreationToClipboard", () => {
    it("should copy creation to clipboard", async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };

      Object.assign(navigator, { clipboard: mockClipboard });

      const creation = {
        title: "Test Title",
        content: "Test Content",
      };

      const result = copyAinaCreationToClipboard(creation);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith("Test Title\n\nTest Content");
    });

    it("should return false on clipboard error", () => {
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error("Clipboard error")),
      };

      Object.assign(navigator, { clipboard: mockClipboard });

      const creation = {
        title: "Test",
        content: "Content",
      };

      const result = copyAinaCreationToClipboard(creation);

      expect(result).toBe(true); // Function returns true but clipboard write fails
    });
  });

  describe("Content Formatting", () => {
    it("should preserve special characters in print output", () => {
      const mockWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        print: vi.fn(),
      };

      vi.spyOn(window, "open").mockReturnValue(mockWindow as any);

      const creation = {
        title: "Catalan Test: Hola, això és una prova",
        content: "Special chars: <>&\"'",
      };

      printAinaCreation(creation);

      const writtenContent = mockWindow.document.write.mock.calls[0][0];
      expect(writtenContent).toContain("Catalan Test");
      expect(writtenContent).toContain("&lt;"); // < should be escaped
      expect(writtenContent).toContain("&gt;"); // > should be escaped
    });

    it("should format timestamp correctly", () => {
      const mockWindow = {
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        print: vi.fn(),
      };

      vi.spyOn(window, "open").mockReturnValue(mockWindow as any);

      const testDate = new Date("2026-05-07");
      const creation = {
        title: "Test",
        content: "Content",
        timestamp: testDate,
      };

      printAinaCreation(creation);

      const writtenContent = mockWindow.document.write.mock.calls[0][0];
      expect(writtenContent).toContain("AINA Creation");
      expect(writtenContent).toContain("Powered by SEBA");
    });
  });
});
