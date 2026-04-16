import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("DESCRIBE forum_direct_messages");
console.log(JSON.stringify(rows, null, 2));
await conn.end();
