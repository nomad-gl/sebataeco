/**
 * seed_attendance.mjs
 * Seeds realistic Catalan student names into group_students for the 14 class groups,
 * then seeds attendance records for the past 5 school days.
 * Safe to re-run — skips if attendance records already exist.
 */
import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

// Check if attendance already seeded
const [[{ cnt }]] = await conn.execute(
  "SELECT COUNT(*) AS cnt FROM attendance_records"
);
if (Number(cnt) > 0) {
  console.log(`Skipping — ${cnt} attendance records already exist.`);
  await conn.end();
  process.exit(0);
}

// Get all 2025-26 class groups
const [groups] = await conn.execute(
  "SELECT id, className, studentCount FROM class_groups WHERE academicYear = '2025-26' ORDER BY id"
);

// Catalan first names pool
const firstNames = [
  "Arnau", "Berta", "Carles", "Dolors", "Eduard", "Fina", "Gerard", "Helena",
  "Ignasi", "Júlia", "Laia", "Marc", "Neus", "Oriol", "Paula", "Quim",
  "Rosa", "Sergi", "Teresa", "Víctor", "Xènia", "Yolanda", "Aina", "Bernat",
  "Clàudia", "Dani", "Elsa", "Ferran", "Gina", "Hugo",
];
// Catalan surnames pool
const surnames = [
  "Puig", "Mas", "Soler", "Ferrer", "Vila", "Prat", "Roca", "Bosch",
  "Vidal", "Coll", "Font", "Sala", "Molina", "Camps", "Rovira", "Llopis",
  "Martí", "Casals", "Folch", "Gómez",
];

function randomName(i) {
  const fn = firstNames[i % firstNames.length];
  const sn = surnames[i % surnames.length];
  return `${fn} ${sn}`;
}

// Insert students for each group
const groupStudentMap = {}; // groupId -> [studentId, ...]
let nameIdx = 0;
for (const group of groups) {
  const count = Math.min(group.studentCount || 20, 30);
  const ids = [];
  for (let n = 1; n <= count; n++) {
    const name = randomName(nameIdx++);
    const email = `student${nameIdx}@escola.cat`;
    const [res] = await conn.execute(
      "INSERT INTO group_students (groupId, studentNumber, name, email) VALUES (?, ?, ?, ?)",
      [group.id, n, name, email]
    );
    ids.push(res.insertId);
  }
  groupStudentMap[group.id] = ids;
  console.log(`  Seeded ${count} students for ${group.className}`);
}

// Generate attendance for past 5 school days (Mon–Fri, skip weekends)
function pastSchoolDays(n) {
  const days = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
  }
  return days;
}

const statuses = ["present", "present", "present", "present", "late", "absent", "excused"];
const schoolDays = pastSchoolDays(5);

let attendanceCount = 0;
for (const group of groups) {
  const studentIds = groupStudentMap[group.id] ?? [];
  for (const date of schoolDays) {
    for (const studentId of studentIds) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await conn.execute(
        "INSERT INTO attendance_records (classGroupId, studentId, date, status) VALUES (?, ?, ?, ?)",
        [group.id, studentId, date, status]
      );
      attendanceCount++;
    }
  }
}

console.log(`\nDone. Seeded ${attendanceCount} attendance records across ${groups.length} groups for ${schoolDays.length} days.`);
await conn.end();
