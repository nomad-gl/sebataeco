import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

// Get all plans with a lessonDate, grouped by calendar, ordered by date
const [plans] = await conn.execute(`
  SELECT lp.id, lp.lessonDate, sce.calendarId
  FROM lesson_plans lp
  JOIN school_calendar_events sce ON lp.calendarEventId = sce.id
  WHERE lp.lessonDate IS NOT NULL
  ORDER BY sce.calendarId ASC, lp.lessonDate ASC, lp.id ASC
`);

// Group by calendarId
const byCalendar = new Map();
for (const p of plans) {
  if (!byCalendar.has(p.calendarId)) byCalendar.set(p.calendarId, []);
  byCalendar.get(p.calendarId).push(p);
}

let total = 0;
for (const [calId, calPlans] of byCalendar.entries()) {
  for (let i = 0; i < calPlans.length; i++) {
    const num = String(i + 1);
    await conn.execute("UPDATE lesson_plans SET lessonNumber = ? WHERE id = ?", [num, calPlans[i].id]);
    total++;
  }
  console.log(`Calendar ${calId}: assigned ${calPlans.length} lesson numbers`);
}

console.log(`Done: ${total} plans updated across ${byCalendar.size} calendars`);
await conn.end();
