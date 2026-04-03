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
  CREATE TABLE IF NOT EXISTS generated_questions (
    id INT AUTO_INCREMENT NOT NULL,
    questionId VARCHAR(16) NOT NULL,
    competency VARCHAR(16) NOT NULL,
    yearGroup VARCHAR(16) NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correctIndex INT NOT NULL,
    explanation TEXT NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewedBy INT,
    notes TEXT,
    reviewedAt TIMESTAMP,
    createdAt TIMESTAMP NOT NULL DEFAULT (NOW()),
    CONSTRAINT generated_questions_id PRIMARY KEY (id),
    CONSTRAINT generated_questions_questionId_unique UNIQUE (questionId)
  )
`);
console.log("generated_questions table created (or already exists).");
await conn.end();
