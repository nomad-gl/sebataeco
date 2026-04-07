import mysql from "mysql2/promise";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = `CREATE TABLE IF NOT EXISTS \`dpa_acceptances\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`dpaVersion\` varchar(16) NOT NULL DEFAULT '1.0',
  \`acceptedAt\` timestamp NOT NULL DEFAULT (now()),
  \`ipAddress\` varchar(64),
  CONSTRAINT \`dpa_acceptances_pk\` PRIMARY KEY(\`id\`)
);`;

const conn = await mysql.createConnection(url);
try {
  await conn.execute(sql);
  console.log("✅ dpa_acceptances table created (or already exists)");
} finally {
  await conn.end();
}
