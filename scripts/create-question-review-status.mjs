import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const conn = await createConnection(url);
await conn.execute(`
  CREATE TABLE IF NOT EXISTS question_review_status (
    questionId VARCHAR(16) NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewedBy INT,
    notes TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT (NOW()),
    reviewedAt TIMESTAMP,
    CONSTRAINT question_review_status_questionId PRIMARY KEY (questionId)
  )
`);
console.log("question_review_status table created (or already exists).");
await conn.end();
