import { createConnection } from '../node_modules/mysql2/promise.js';
import { readFileSync } from 'fs';

const sql = readFileSync(new URL('../drizzle/0065_teacher_profiles.sql', import.meta.url), 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));

const conn = await createConnection(process.env.DATABASE_URL);
for (const stmt of statements) {
  console.log('Executing:', stmt.slice(0, 80) + '...');
  await conn.execute(stmt);
}
await conn.end();
console.log('Migration 0065 applied successfully');
