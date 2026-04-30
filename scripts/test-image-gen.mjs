/**
 * Quick smoke-test for the image generation Forge endpoint.
 * Run: node scripts/test-image-gen.mjs
 */
import { config } from "dotenv";
config({ path: ".env" });

const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;

if (!forgeApiUrl || !forgeApiKey) {
  console.error("Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY");
  process.exit(1);
}

const baseUrl = forgeApiUrl.endsWith("/") ? forgeApiUrl : `${forgeApiUrl}/`;
const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

console.log("Testing image generation at:", fullUrl);

try {
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: "A simple red circle on a white background",
      original_images: [],
    }),
  });

  console.log("Status:", response.status, response.statusText);
  const text = await response.text();
  if (response.ok) {
    const json = JSON.parse(text);
    console.log("Success! image.mimeType:", json.image?.mimeType);
    console.log("b64Json length:", json.image?.b64Json?.length ?? 0);

    // Now test the storagePut step
    const buffer = Buffer.from(json.image.b64Json, "base64");
    const storageBaseUrl = forgeApiUrl.endsWith("/") ? forgeApiUrl : `${forgeApiUrl}/`;
    const uploadUrl = new URL("v1/storage/upload", storageBaseUrl);
    uploadUrl.searchParams.set("path", `generated/test-${Date.now()}.png`);
    const formData = new FormData();
    const blob = new Blob([buffer], { type: json.image.mimeType });
    formData.append("file", blob, "test.png");
    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${forgeApiKey}` },
      body: formData,
    });
    console.log("Upload status:", uploadResp.status, uploadResp.statusText);
    if (uploadResp.ok) {
      const uploadResult = await uploadResp.json();
      console.log("Uploaded URL:", uploadResult.url);
    } else {
      const errText = await uploadResp.text().catch(() => "");
      console.error("Upload error:", errText.slice(0, 300));
    }
  } else {
    console.error("Error response body:", text.slice(0, 500));
  }
} catch (err) {
  console.error("Fetch error:", err.message);
}
