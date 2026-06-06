export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  sebasnapApiKey: process.env.SEBASNAP_API_KEY ?? "",
  // SMTP email delivery (optional — invite emails are skipped if not configured)
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "",
  smtpSecure: process.env.SMTP_SECURE === "true",
  // Local Salamandra LLM (optional — routes to self-hosted instance when configured)
  localLlmUrl: process.env.LOCAL_LLM_URL ?? "",
  localLlmModel: process.env.LOCAL_LLM_MODEL ?? "BSC-LT/salamandra-7b-instruct",
  localLlmApiKey: process.env.LOCAL_LLM_API_KEY ?? "",
  // Self-hosted / sovereign storage (optional — routes to your own S3-compatible server when configured)
  // Supported: MinIO, Hetzner Object Storage, OVHcloud, Scaleway, Backblaze B2, etc.
  localStorageEndpoint: process.env.LOCAL_STORAGE_ENDPOINT ?? "",
  localStorageBucket: process.env.LOCAL_STORAGE_BUCKET ?? "seba-storage",
  localStorageAccessKey: process.env.LOCAL_STORAGE_ACCESS_KEY ?? "",
  localStorageSecretKey: process.env.LOCAL_STORAGE_SECRET_KEY ?? "",
  localStorageRegion: process.env.LOCAL_STORAGE_REGION ?? "auto",
  // Optional: public base URL for files if different from the endpoint
  // e.g. https://storage.yourschool.cat  (leave blank to derive from endpoint)
  localStoragePublicUrl: process.env.LOCAL_STORAGE_PUBLIC_URL ?? "",
  // Local ASR endpoint (optional — routes to self-hosted Faster-Whisper when configured)
  localAsrUrl: process.env.LOCAL_ASR_URL ?? "",
  // Local TTS endpoint (optional — routes to self-hosted Matxa TTS when configured)
  localTtsUrl: process.env.LOCAL_TTS_URL ?? "",
  localTtsDialect: process.env.LOCAL_TTS_DIALECT ?? "ca-nw",
};
