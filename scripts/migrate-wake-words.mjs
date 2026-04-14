import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Create table — MySQL strict mode does not allow DEFAULT on TEXT columns
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`wake_words\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    \`word\` varchar(64) NOT NULL,
    \`phoneticVariants\` text NOT NULL,
    \`isPrimary\` boolean NOT NULL DEFAULT false,
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now())
  )
`);
console.log("✓ wake_words table created (or already exists)");

// Seed defaults only if empty
const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM wake_words");
if (rows[0].cnt === 0) {
  await conn.execute(
    "INSERT INTO wake_words (word, phoneticVariants, isPrimary, isActive) VALUES (?, ?, ?, ?)",
    ["aina", JSON.stringify(["ayna", "anna", "haina", "ina", "ay-na"]), true, true]
  );
  await conn.execute(
    "INSERT INTO wake_words (word, phoneticVariants, isPrimary, isActive) VALUES (?, ?, ?, ?)",
    ["clara", JSON.stringify(["klara", "clarita", "klar"]), false, true]
  );
  await conn.execute(
    "INSERT INTO wake_words (word, phoneticVariants, isPrimary, isActive) VALUES (?, ?, ?, ?)",
    ["nana", JSON.stringify(["nanna", "nena"]), false, true]
  );
  console.log("✓ Seeded 3 default wake words: aina (primary), clara, nana");
} else {
  console.log("ℹ  wake_words already has rows — skipping seed");
}

await conn.end();
console.log("Migration complete.");
