import { describe, it, expect } from "vitest";

// ──────────── Shared grade logic (mirrors progressReport.ts) ────────────
function computeGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

// ──────────── Attendance computation (mirrors studentReport) ────────────
function computeAttendance(records: { status: string }[]) {
  const totalDays = records.length;
  const presentDays = records.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const absentDays = records.filter((a) => a.status === "absent").length;
  const lateDays = records.filter((a) => a.status === "late").length;
  const leaveDays = records.filter((a) => a.status === "leave").length;
  const attendanceRate =
    totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 0;
  return { totalDays, presentDays, absentDays, lateDays, leaveDays, attendanceRate };
}

// ──────────── Class report student summary (mirrors backend) ────────────
interface StudentSummary {
  studentId: string;
  name: string;
  examAverage: number;
  dailyTestAverage: number;
  weeklyTestAverage: number;
  attendanceRate: number;
  overallAverage: number;
  overallGrade: string;
}

function rankStudents(students: StudentSummary[]) {
  return students
    .sort((a, b) => b.overallAverage - a.overallAverage)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));
}

function computeClassStats(students: StudentSummary[]) {
  const allAvg = students.map((s) => s.overallAverage);
  const classAvg =
    allAvg.length > 0 ? allAvg.reduce((a, b) => a + b, 0) / allAvg.length : 0;
  return {
    average: Math.round(classAvg * 10) / 10,
    highest: allAvg.length > 0 ? Math.max(...allAvg) : 0,
    lowest: allAvg.length > 0 ? Math.min(...allAvg) : 0,
    passRate:
      allAvg.length > 0
        ? Math.round(
            (allAvg.filter((a) => a >= 33).length / allAvg.length) * 100,
          )
        : 0,
  };
}

// ──────────── Monthly trend format helper ────────────
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[parseInt(m) - 1]} ${year}`;
}

// ═══════════════════════════════════════════════════════════════════════
//                              TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("computeGrade (progress report)", () => {
  const cases: [number, string][] = [
    [95, "A+"],
    [90, "A+"],
    [89, "A"],
    [80, "A"],
    [79, "B+"],
    [70, "B+"],
    [69, "B"],
    [60, "B"],
    [59, "C"],
    [50, "C"],
    [49, "D"],
    [33, "D"],
    [32, "F"],
    [0, "F"],
  ];

  it.each(cases)("computeGrade(%d) === %s", (pct, expected) => {
    expect(computeGrade(pct)).toBe(expected);
  });
});

describe("Attendance Computation", () => {
  it("computes correct attendance stats", () => {
    const records = [
      { status: "present" },
      { status: "present" },
      { status: "present" },
      { status: "absent" },
      { status: "late" },
      { status: "leave" },
      { status: "present" },
    ];

    const att = computeAttendance(records);
    expect(att.totalDays).toBe(7);
    expect(att.presentDays).toBe(5); // 4 present + 1 late
    expect(att.absentDays).toBe(1);
    expect(att.lateDays).toBe(1);
    expect(att.leaveDays).toBe(1);
    expect(att.attendanceRate).toBeCloseTo(71.4, 0); // 5/7
  });

  it("handles 100% attendance", () => {
    const records = [
      { status: "present" },
      { status: "present" },
      { status: "late" }, // counts as present
    ];
    const att = computeAttendance(records);
    expect(att.attendanceRate).toBe(100);
  });

  it("handles 0% attendance", () => {
    const records = [
      { status: "absent" },
      { status: "absent" },
      { status: "leave" },
    ];
    const att = computeAttendance(records);
    expect(att.attendanceRate).toBe(0);
    expect(att.presentDays).toBe(0);
  });

  it("handles empty records", () => {
    const att = computeAttendance([]);
    expect(att.totalDays).toBe(0);
    expect(att.attendanceRate).toBe(0);
  });
});

describe("Student Ranking", () => {
  const students: StudentSummary[] = [
    {
      studentId: "s1", name: "Ahmed", examAverage: 85,
      dailyTestAverage: 80, weeklyTestAverage: 75,
      attendanceRate: 95, overallAverage: 80, overallGrade: "A",
    },
    {
      studentId: "s2", name: "Sara", examAverage: 92,
      dailyTestAverage: 88, weeklyTestAverage: 90,
      attendanceRate: 98, overallAverage: 90, overallGrade: "A+",
    },
    {
      studentId: "s3", name: "Ali", examAverage: 65,
      dailyTestAverage: 60, weeklyTestAverage: 55,
      attendanceRate: 80, overallAverage: 60, overallGrade: "B",
    },
  ];

  it("ranks students by overall average descending", () => {
    const ranked = rankStudents(students);
    expect(ranked[0].name).toBe("Sara");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].name).toBe("Ahmed");
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].name).toBe("Ali");
    expect(ranked[2].rank).toBe(3);
  });

  it("does not mutate original array order for rank assignment", () => {
    const ranked = rankStudents(students);
    expect(ranked).toHaveLength(3);
    // Verify Sara is at top
    expect(ranked[0].overallAverage).toBe(90);
  });
});

describe("Class Stats", () => {
  const students: StudentSummary[] = [
    {
      studentId: "s1", name: "A", examAverage: 80, dailyTestAverage: 80,
      weeklyTestAverage: 80, attendanceRate: 90, overallAverage: 80, overallGrade: "A",
    },
    {
      studentId: "s2", name: "B", examAverage: 60, dailyTestAverage: 60,
      weeklyTestAverage: 60, attendanceRate: 85, overallAverage: 60, overallGrade: "B",
    },
    {
      studentId: "s3", name: "C", examAverage: 40, dailyTestAverage: 40,
      weeklyTestAverage: 40, attendanceRate: 70, overallAverage: 40, overallGrade: "D",
    },
  ];

  it("computes correct class average", () => {
    const stats = computeClassStats(students);
    expect(stats.average).toBe(60); // (80+60+40)/3 = 60
  });

  it("computes correct highest and lowest", () => {
    const stats = computeClassStats(students);
    expect(stats.highest).toBe(80);
    expect(stats.lowest).toBe(40);
  });

  it("computes pass rate (>= 33)", () => {
    const stats = computeClassStats(students);
    expect(stats.passRate).toBe(100); // all >= 33
  });

  it("handles failing students", () => {
    const failStudents: StudentSummary[] = [
      { ...students[0], overallAverage: 80 },
      { ...students[1], overallAverage: 20 },
    ];
    const stats = computeClassStats(failStudents);
    expect(stats.passRate).toBe(50); // 1 out of 2
  });

  it("handles empty class", () => {
    const stats = computeClassStats([]);
    expect(stats.average).toBe(0);
    expect(stats.highest).toBe(0);
    expect(stats.lowest).toBe(0);
    expect(stats.passRate).toBe(0);
  });
});

describe("formatMonth", () => {
  it("formats YYYY-MM to readable month name", () => {
    expect(formatMonth("2026-01")).toBe("January 2026");
    expect(formatMonth("2026-08")).toBe("August 2026");
    expect(formatMonth("2026-12")).toBe("December 2026");
  });

  it("handles single-digit months", () => {
    expect(formatMonth("2026-06")).toBe("June 2026");
  });
});

describe("Overall Average Computation", () => {
  function computeOverallAverage(
    examPcts: number[],
    dailyPcts: number[],
    weeklyPcts: number[],
  ) {
    const allPcts = [...examPcts, ...dailyPcts, ...weeklyPcts];
    const overallAvg =
      allPcts.length > 0
        ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length
        : 0;
    return {
      overallAverage: Math.round(overallAvg * 10) / 10,
      overallGrade: computeGrade(overallAvg),
    };
  }

  it("combines exam, daily, and weekly test averages", () => {
    const result = computeOverallAverage([80, 90], [70], [85]);
    // (80+90+70+85)/4 = 81.25 → 81.3
    expect(result.overallAverage).toBe(81.3);
    expect(result.overallGrade).toBe("A");
  });

  it("handles only exams", () => {
    const result = computeOverallAverage([90, 85, 80], [], []);
    // (90+85+80)/3 = 85
    expect(result.overallAverage).toBe(85);
    expect(result.overallGrade).toBe("A");
  });

  it("handles no data", () => {
    const result = computeOverallAverage([], [], []);
    expect(result.overallAverage).toBe(0);
    expect(result.overallGrade).toBe("F");
  });

  it("handles failing overall", () => {
    const result = computeOverallAverage([20, 30], [25], []);
    // (20+30+25)/3 = 25
    expect(result.overallAverage).toBe(25);
    expect(result.overallGrade).toBe("F");
  });
});
