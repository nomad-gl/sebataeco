import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

try { dotenv.config({ path: '.env' }); } catch {}
try { dotenv.config({ path: '.env.local' }); } catch {}

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// List all tables
console.log('\n=== ALL TABLES ===');
const [tables] = await conn.execute('SHOW TABLES');
console.log(tables.map(t => Object.values(t)[0]).join('\n'));

console.log('\n=== class_groups rows ===');
const [groups] = await conn.execute('SELECT * FROM class_groups ORDER BY id DESC');
console.log(JSON.stringify(groups, null, 2));

// Check for a students/group_students table
const tableNames = tables.map(t => Object.values(t)[0]);
const studentTable = tableNames.find(t => t.includes('student'));
if (studentTable) {
  console.log(`\n=== ${studentTable} COLUMNS ===`);
  const [cols] = await conn.execute(`SHOW COLUMNS FROM \`${studentTable}\``);
  console.log(cols.map(c => `${c.Field} (${c.Type})`).join('\n'));
  
  console.log(`\n=== ${studentTable} rows (last 50) ===`);
  const [rows] = await conn.execute(`SELECT * FROM \`${studentTable}\` ORDER BY id DESC LIMIT 50`);
  console.log(JSON.stringify(rows, null, 2));
}

await conn.end();
