import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config();

const url = process.env.DATABASE_URL;
// Parse: mysql://user:pass@host:port/db?ssl=...
const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
const [, user, password, host, port, database] = m;

const conn = await createConnection({
  host, port: Number(port), user, password, database,
  ssl: { rejectUnauthorized: false },
});

try {
  // Add columns if they don't already exist
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forum_messages'`,
    [database]
  );
  const colNames = cols.map(c => c.COLUMN_NAME);

  if (!colNames.includes("messageType")) {
    await conn.query(`ALTER TABLE forum_messages ADD COLUMN messageType varchar(10) NOT NULL DEFAULT 'text'`);
    console.log("Added messageType to forum_messages");
  } else {
    console.log("forum_messages.messageType already exists");
  }
  if (!colNames.includes("audioUrl")) {
    await conn.query(`ALTER TABLE forum_messages ADD COLUMN audioUrl text`);
    console.log("Added audioUrl to forum_messages");
  } else {
    console.log("forum_messages.audioUrl already exists");
  }

  const [cols2] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forum_direct_messages'`,
    [database]
  );
  const colNames2 = cols2.map(c => c.COLUMN_NAME);

  if (!colNames2.includes("messageType")) {
    await conn.query(`ALTER TABLE forum_direct_messages ADD COLUMN messageType varchar(10) NOT NULL DEFAULT 'text'`);
    console.log("Added messageType to forum_direct_messages");
  } else {
    console.log("forum_direct_messages.messageType already exists");
  }
  if (!colNames2.includes("audioUrl")) {
    await conn.query(`ALTER TABLE forum_direct_messages ADD COLUMN audioUrl text`);
    console.log("Added audioUrl to forum_direct_messages");
  } else {
    console.log("forum_direct_messages.audioUrl already exists");
  }

  console.log("Migration complete.");
} finally {
  await conn.end();
}
