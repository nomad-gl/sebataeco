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
  CREATE TABLE IF NOT EXISTS question_answers (
    id INT AUTO_INCREMENT NOT NULL,
    questionId VARCHAR(16) NOT NULL,
    competency VARCHAR(16) NOT NULL,
    yearGroup VARCHAR(16) NOT NULL,
    isCorrect BOOLEAN NOT NULL,
    userId INT,
    createdAt TIMESTAMP NOT NULL DEFAULT (now()),
    CONSTRAINT question_answers_id PRIMARY KEY (id)
  )
`);

console.log("question_answers table created (or already exists)");
await conn.end();
