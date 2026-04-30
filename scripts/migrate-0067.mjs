import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const sql = readFileSync('./drizzle/0067_security_events.sql', 'utf8');
const stmts = sql.split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

for (const stmt of stmts) {
  await conn.query(stmt);
  console.log('OK:', stmt.slice(0, 70));
}
await conn.end();
console.log('Migration 0067 applied.');
