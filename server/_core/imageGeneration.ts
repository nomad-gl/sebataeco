/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

/** Transient HTTP status codes that warrant an automatic retry */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
/** Maximum number of attempts (1 initial + 2 retries) */
const MAX_ATTEMPTS = 3;
/** Base delay in ms for exponential back-off: attempt 2 → 200 ms, attempt 3 → 400 ms */
const BACKOFF_BASE_MS = 200;

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Build the full URL by appending the service path to the base URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/GenerateImage",
    baseUrl
  ).toString();

  let lastError: Error = new Error("Image generation failed after all retries");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Exponential back-off before each retry (not before the first attempt)
    if (attempt > 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, BACKOFF_BASE_MS * 2 ** (attempt - 2))
      );
    }

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "connect-protocol-version": "1",
          authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          prompt: options.prompt,
          original_images: options.originalImages || [],
        }),
      });
    } catch (networkErr) {
      // Network-level failure (DNS, TCP reset, etc.) — always retry
      lastError =
        networkErr instanceof Error
          ? networkErr
          : new Error(String(networkErr));
      console.warn(
        `[generateImage] Network error on attempt ${attempt}/${MAX_ATTEMPTS}:`,
        lastError.message
      );
      continue;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      lastError = new Error(
        `Image generation request failed (${response.status} ${response.statusText})${
          detail ? `: ${detail.slice(0, 200)}` : ""
        }`
      );
      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
        console.warn(
          `[generateImage] Retryable error ${response.status} on attempt ${attempt}/${MAX_ATTEMPTS} — retrying...`
        );
        continue;
      }
      throw lastError;
    }

    // Success — parse result and upload to S3
    const result = (await response.json()) as {
      image: {
        b64Json: string;
        mimeType: string;
      };
    };
    const base64Data = result.image.b64Json;
    const buffer = Buffer.from(base64Data, "base64");

    // Save to S3
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      result.image.mimeType
    );
    return { url };
  }

  // All attempts exhausted
  throw lastError;
}
