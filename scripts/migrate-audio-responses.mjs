import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

await conn.execute(`
  CREATE TABLE IF NOT EXISTS audio_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(256) NOT NULL,
    triggerPhrases TEXT NOT NULL,
    fileUrl TEXT NOT NULL,
    fileKey VARCHAR(512) NOT NULL,
    mimeType VARCHAR(64) NOT NULL DEFAULT 'audio/mpeg',
    durationSecs INT,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdBy VARCHAR(128)
  )
`);

console.log("✓ audio_responses table created");
await conn.end();
