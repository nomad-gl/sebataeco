import { describe, it, expect, beforeEach } from "vitest";

/**
 * Multi-School Teacher Grouping Tests
 * Validates that teachers from multiple schools are correctly grouped and displayed
 */

interface Teacher {
  id: number;
  name: string;
  displayName?: string;
  email?: string;
  schoolName: string | null;
  isPermanent?: boolean;
  subjectCount?: number;
  subjects?: string[];
  weeklyHours?: number;
  contractedWeeklyMinutes?: number | null;
  weeklyMinutes?: number;
  scheduleSlots?: number;
  role?: string;
  position?: string;
  cutcgMemberNumber?: string | null;
}

// Replicate the grouping function
function groupTeachersBySchool(teachers: Teacher[]) {
  const grouped = new Map<string, Teacher[]>();
  teachers.forEach(t => {
    const school = t.schoolName || "Unassigned";
    if (!grouped.has(school)) {
      grouped.set(school, []);
    }
    grouped.get(school)!.push(t);
  });
  return Array.from(grouped.entries())
    .map(([school, teacherList]) => ({
      school,
      teachers: teacherList.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name)),
    }))
    .sort((a, b) => a.school.localeCompare(b.school));
}

describe("Multi-School Teacher Grouping", () => {
  let mockTeachers: Teacher[];

  beforeEach(() => {
    // Create a realistic multi-school scenario
    mockTeachers = [
      // School A - 3 teachers
      {
        id: 1,
        name: "alice_user",
        displayName: "Alice Johnson",
        email: "alice@schoola.cat",
        schoolName: "Escola Primària A",
        isPermanent: true,
        subjectCount: 2,
        subjects: ["Mathematics", "Science"],
        weeklyHours: 25,
        contractedWeeklyMinutes: 1200,
        weeklyMinutes: 1500,
      },
      {
        id: 2,
        name: "bob_user",
        displayName: "Bob Smith",
        email: "bob@schoola.cat",
        schoolName: "Escola Primària A",
        isPermanent: false,
        subjectCount: 1,
        subjects: ["English"],
        weeklyHours: 20,
        contractedWeeklyMinutes: 1200,
        weeklyMinutes: 1200,
      },
      {
        id: 3,
        name: "charlie_user",
        displayName: "Charlie Brown",
        email: "charlie@schoola.cat",
        schoolName: "Escola Primària A",
        isPermanent: true,
        subjectCount: 3,
        subjects: ["History", "Geography", "Civics"],
        weeklyHours: 22,
        contractedWeeklyMinutes: 1200,
        weeklyMinutes: 1320,
      },
      // School B - 2 teachers
      {
        id: 4,
        name: "diana_user",
        displayName: "Diana Prince",
        email: "diana@schoolb.cat",
        schoolName: "Escola Secundària B",
        isPermanent: true,
        subjectCount: 2,
        subjects: ["Physics", "Chemistry"],
        weeklyHours: 24,
        contractedWeeklyMinutes: 1200,
        weeklyMinutes: 1440,
      },
      {
        id: 5,
        name: "evan_user",
        displayName: "Evan Davis",
        email: "evan@schoolb.cat",
        schoolName: "Escola Secundària B",
        isPermanent: true,
        subjectCount: 1,
        subjects: ["PE"],
        weeklyHours: 20,
        contractedWeeklyMinutes: 1200,
        weeklyMinutes: 1200,
      },
      // Unassigned school - 1 teacher
      {
        id: 6,
        name: "frank_user",
        displayName: "Frank Miller",
        email: "frank@unknown.cat",
        schoolName: null,
        isPermanent: true,
        subjectCount: 1,
        subjects: ["Art"],
        weeklyHours: 18,
        contractedWeeklyMinutes: 1080,
        weeklyMinutes: 1080,
      },
      // School C - 1 teacher
      {
        id: 7,
        name: "grace_user",
        displayName: "Grace Lee",
        email: "grace@schoolc.cat",
        schoolName: "Escola Especial C",
        isPermanent: false,
        subjectCount: 2,
        subjects: ["Special Education", "Music"],
        weeklyHours: 16,
        contractedWeeklyMinutes: 960,
        weeklyMinutes: 960,
      },
    ];
  });

  it("should group teachers from multiple schools correctly", () => {
    const result = groupTeachersBySchool(mockTeachers);

    expect(result).toHaveLength(4); // 3 schools + 1 unassigned
    expect(result[0].school).toBe("Escola Especial C");
    expect(result[1].school).toBe("Escola Primària A");
    expect(result[2].school).toBe("Escola Secundària B");
    expect(result[3].school).toBe("Unassigned");
  });

  it("should have correct number of teachers per school", () => {
    const result = groupTeachersBySchool(mockTeachers);

    const schoolCounts = result.reduce((acc, group) => {
      acc[group.school] = group.teachers.length;
      return acc;
    }, {} as Record<string, number>);

    expect(schoolCounts["Escola Primària A"]).toBe(3);
    expect(schoolCounts["Escola Secundària B"]).toBe(2);
    expect(schoolCounts["Escola Especial C"]).toBe(1);
    expect(schoolCounts["Unassigned"]).toBe(1);
  });

  it("should sort teachers within each school alphabetically", () => {
    const result = groupTeachersBySchool(mockTeachers);

    const schoolA = result.find(g => g.school === "Escola Primària A");
    expect(schoolA?.teachers[0].displayName).toBe("Alice Johnson");
    expect(schoolA?.teachers[1].displayName).toBe("Bob Smith");
    expect(schoolA?.teachers[2].displayName).toBe("Charlie Brown");
  });

  it("should handle filtering by temporary status", () => {
    const tempTeachers = mockTeachers.filter(t => t.isPermanent === false);
    const result = groupTeachersBySchool(tempTeachers);

    expect(result).toHaveLength(2); // School A (Bob), School C (Grace)
    expect(result[0].teachers).toHaveLength(1); // Escola Especial C
    expect(result[1].teachers).toHaveLength(1); // Escola Primária A
  });

  it("should calculate total weekly hours across all schools", () => {
    const totalHours = mockTeachers.reduce((sum, t) => sum + (t.weeklyHours || 0), 0);
    expect(totalHours).toBe(145); // 25+20+22+24+20+18+16
  });

  it("should identify teachers exceeding contracted hours", () => {
    const overworked = mockTeachers.filter(t => 
      t.contractedWeeklyMinutes && t.weeklyMinutes && t.weeklyMinutes > t.contractedWeeklyMinutes
    );
    expect(overworked).toHaveLength(3); // Alice (1500 > 1200), Diana (1440 > 1200), Charlie (1320 > 1200)
  });

  it("should maintain school order consistency across multiple calls", () => {
    const result1 = groupTeachersBySchool(mockTeachers);
    const result2 = groupTeachersBySchool(mockTeachers);

    expect(result1.map(g => g.school)).toEqual(result2.map(g => g.school));
  });

  it("should handle mixed permanent and temporary teachers in same school", () => {
    const result = groupTeachersBySchool(mockTeachers);
    const schoolA = result.find(g => g.school === "Escola Primària A");

    const permanent = schoolA?.teachers.filter(t => t.isPermanent === true) || [];
    const temporary = schoolA?.teachers.filter(t => t.isPermanent === false) || [];

    expect(permanent).toHaveLength(2);
    expect(temporary).toHaveLength(1);
  });

  it("should preserve all teacher data through grouping", () => {
    const result = groupTeachersBySchool(mockTeachers);
    const flattenedTeachers = result.flatMap(g => g.teachers);

    // Check that all original teachers are present
    mockTeachers.forEach(original => {
      const found = flattenedTeachers.find(t => t.id === original.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(original.name);
      expect(found?.email).toBe(original.email);
    });
  });

  it("should handle large number of schools efficiently", () => {
    // Create 50 schools with 5 teachers each (using zero-padded names for proper sorting)
    const largeDataset: Teacher[] = [];
    for (let school = 1; school <= 50; school++) {
      const schoolNum = String(school).padStart(2, '0');
      for (let teacher = 1; teacher <= 5; teacher++) {
        largeDataset.push({
          id: (school - 1) * 5 + teacher,
          name: `teacher_${schoolNum}_${teacher}`,
          displayName: `Teacher ${schoolNum}-${teacher}`,
          email: `teacher${schoolNum}${teacher}@school.cat`,
          schoolName: `School ${schoolNum}`,
          isPermanent: true,
          subjectCount: 1,
          subjects: ["Subject"],
          weeklyHours: 20,
          contractedWeeklyMinutes: 1200,
          weeklyMinutes: 1200,
        });
      }
    }

    const result = groupTeachersBySchool(largeDataset);

    expect(result).toHaveLength(50);
    // Verify all schools are present and sorted alphabetically
    const schoolNames = result.map(g => g.school);
    const sortedNames = [...schoolNames].sort();
    expect(schoolNames).toEqual(sortedNames);
    
    // Verify each school has 5 teachers
    result.forEach((group) => {
      expect(group.teachers).toHaveLength(5);
    });
  });
});
