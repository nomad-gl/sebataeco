/**
 * Storage adapter for SEBA.
 *
 * Two modes, selected automatically by env vars:
 *
 * ── Self-hosted / sovereign mode ──────────────────────────────────────────
 * Set these env vars to use your own S3-compatible storage
 * (MinIO, Hetzner Object Storage, OVHcloud, Scaleway, etc.):
 *
 *   LOCAL_STORAGE_ENDPOINT   e.g. http://localhost:9000  or  https://fsn1.your-objectstorage.com
 *   LOCAL_STORAGE_BUCKET     e.g. seba-storage
 *   LOCAL_STORAGE_ACCESS_KEY your access key / username
 *   LOCAL_STORAGE_SECRET_KEY your secret key / password
 *   LOCAL_STORAGE_REGION     e.g. eu-west-1  (any string for MinIO)
 *   LOCAL_STORAGE_PUBLIC_URL (optional) public base URL if different from endpoint,
 *                            e.g. https://storage.yourschool.cat
 *
 * ── Manus Forge mode (default) ────────────────────────────────────────────
 * When LOCAL_STORAGE_ENDPOINT is not set, falls back to the Manus-managed
 * storage proxy (original behaviour — no changes needed).
 */

import { ENV } from "./_core/env";

// ─── helpers ────────────────────────────────────────────────────────────────

function useLocalStorage(): boolean {
  return !!(ENV.localStorageEndpoint && ENV.localStorageEndpoint.trim().length > 0);
}

// ─── Manus Forge adapter (original implementation) ──────────────────────────

type StorageConfig = { baseUrl: string; apiKey: string };

function getForgeConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function forgeGet(relKey: string): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return { key, url: (await response.json()).url };
}

// ─── S3-compatible adapter (self-hosted / sovereign) ────────────────────────

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    endpoint: ENV.localStorageEndpoint,
    region: ENV.localStorageRegion || "auto",
    credentials: {
      accessKeyId: ENV.localStorageAccessKey,
      secretAccessKey: ENV.localStorageSecretKey,
    },
    // Required for MinIO and most non-AWS S3-compatible servers
    forcePathStyle: true,
  });
}

function buildPublicUrl(key: string): string {
  const base = (
    ENV.localStoragePublicUrl ||
    ENV.localStorageEndpoint
  ).replace(/\/+$/, "");
  const bucket = ENV.localStorageBucket;
  return `${base}/${bucket}/${normalizeKey(key)}`;
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3Client();
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await client.send(
    new PutObjectCommand({
      Bucket: ENV.localStorageBucket,
      Key: key,
      Body: body as Buffer,
      ContentType: contentType,
      // ACL: "public-read" — uncomment if your bucket requires per-object ACLs
    })
  );
  return { key, url: buildPublicUrl(key) };
}

async function s3Get(relKey: string): Promise<{ key: string; url: string }> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await getS3Client();
  const key = normalizeKey(relKey);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: ENV.localStorageBucket, Key: key }),
    { expiresIn: 3600 }
  );
  return { key, url };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Upload a file to storage.
 * Routes to your own S3-compatible server when LOCAL_STORAGE_ENDPOINT is set,
 * otherwise falls back to Manus Forge (AWS S3).
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (useLocalStorage()) {
    return s3Put(relKey, data, contentType);
  }
  return forgePut(relKey, data, contentType);
}

/**
 * Get a URL for a stored file.
 * Returns a presigned URL for self-hosted storage, or a Forge download URL.
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  if (useLocalStorage()) {
    return s3Get(relKey);
  }
  return forgeGet(relKey);
}
