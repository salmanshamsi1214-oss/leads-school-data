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

// ──────────── Simulated test list data ────────────
interface TestRecord {
  _id: string;
  classId: string;
  section: string;
  subject: string;
  title?: string;
  date: string;
  totalMarks: number;
  createdBy: string;
  createdAt: number;
  className: string;
  createdByName: string;
  markCount: number;
  averagePct: number;
  highestPct: number;
  lowestPct: number;
}

function makeTest(overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    _id: "test1",
    classId: "cls1",
    section: "A",
    subject: "Mathematics",
    date: "2026-08-15",
    totalMarks: 20,
    createdBy: "user1",
    createdAt: Date.now(),
    className: "Class 5",
    createdByName: "Admin",
    markCount: 30,
    averagePct: 72.5,
    highestPct: 95,
    lowestPct: 20,
    ...overrides,
  };
}

// ──────────── Filter logic (mirrors TestList useMemo) ────────────
function filterTests(
  tests: TestRecord[],
  filterClass: string,
  filterSection: string,
  filterSubject: string,
): TestRecord[] {
  let result = tests;
  if (filterClass) result = result.filter((t) => t.classId === filterClass);
  if (filterSection) result = result.filter((t) => t.section === filterSection.toUpperCase());
  if (filterSubject) result = result.filter((t) => t.subject === filterSubject);
  return result;
}

// ──────────── Subject stats logic (mirrors backend) ────────────
interface MarkRecord {
  testId: string;
  studentId: string;
  obtained: number;
}
interface TestBasic {
  _id: string;
  subject: string;
  totalMarks: number;
  classId: string;
  section: string;
}

function computeSubjectStats(
  tests: TestBasic[],
  marks: MarkRecord[],
  filterClass?: string,
  filterSection?: string,
) {
  let filtered = tests;
  if (filterClass) filtered = filtered.filter((t) => t.classId === filterClass);
  if (filterSection) {
    const s = filterSection.trim().toUpperCase();
    filtered = filtered.filter((t) => t.section === s);
  }

  const marksByTest = new Map<string, MarkRecord[]>();
  for (const m of marks) {
    const arr = marksByTest.get(m.testId) ?? [];
    arr.push(m);
    marksByTest.set(m.testId, arr);
  }

  const subjectMap = new Map<string, { count: number; totalPct: number; totalStudents: number }>();
  for (const t of filtered) {
    const testMarks = marksByTest.get(t._id) ?? [];
    const existing = subjectMap.get(t.subject) ?? { count: 0, totalPct: 0, totalStudents: 0 };
    existing.count += 1;
    existing.totalStudents += testMarks.length;
    if (testMarks.length > 0) {
      existing.totalPct +=
        testMarks.reduce((s, m) => s + (m.obtained / (t.totalMarks || 1)) * 100, 0) /
        testMarks.length;
    }
    subjectMap.set(t.subject, existing);
  }

  return Array.from(subjectMap.entries())
    .map(([subject, data]) => ({
      subject,
      testCount: data.count,
      averagePct: data.count > 0 ? Math.round((data.totalPct / data.count) * 10) / 10 : 0,
      totalEntries: data.totalStudents,
    }))
    .sort((a, b) => b.averagePct - a.averagePct);
}

// ──────────── Trend data logic (mirrors progressReport.studentTrend) ────────────
function computeTrend(
  monthlyMap: Map<string, { exams: number[]; dailyTests: number[]; weeklyTests: number[]; allPcts: number[] }>,
) {
  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      examAvg:
        data.exams.length > 0
          ? Math.round((data.exams.reduce((a, b) => a + b, 0) / data.exams.length) * 10) / 10
          : null,
      dailyAvg:
        data.dailyTests.length > 0
          ? Math.round(
              (data.dailyTests.reduce((a, b) => a + b, 0) / data.dailyTests.length) * 10,
            ) / 10
          : null,
      weeklyAvg:
        data.weeklyTests.length > 0
          ? Math.round(
              (data.weeklyTests.reduce((a, b) => a + b, 0) / data.weeklyTests.length) * 10,
            ) / 10
          : null,
      overallAvg:
        data.allPcts.length > 0
          ? Math.round(
              (data.allPcts.reduce((a, b) => a + b, 0) / data.allPcts.length) * 10,
            ) / 10
          : null,
      testCount: data.allPcts.length,
    }));
}

// ═══════════════════════════════════════════════════════════════════════
//                              TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("computeGrade", () => {
  it("returns A+ for 90% and above", () => {
    expect(computeGrade(90)).toBe("A+");
    expect(computeGrade(100)).toBe("A+");
  });

  it("returns A for 80-89%", () => {
    expect(computeGrade(80)).toBe("A");
    expect(computeGrade(89)).toBe("A");
  });

  it("returns B+ for 70-79%", () => {
    expect(computeGrade(70)).toBe("B+");
    expect(computeGrade(79)).toBe("B+");
  });

  it("returns B for 60-69%", () => {
    expect(computeGrade(60)).toBe("B");
    expect(computeGrade(69)).toBe("B");
  });

  it("returns C for 50-59%", () => {
    expect(computeGrade(50)).toBe("C");
    expect(computeGrade(59)).toBe("C");
  });

  it("returns D for 33-49%", () => {
    expect(computeGrade(33)).toBe("D");
    expect(computeGrade(49)).toBe("D");
  });

  it("returns F for below 33%", () => {
    expect(computeGrade(0)).toBe("F");
    expect(computeGrade(32)).toBe("F");
  });
});

describe("Test Filtering", () => {
  const tests = [
    makeTest({ _id: "t1", classId: "cls1", section: "A", subject: "Mathematics" }),
    makeTest({ _id: "t2", classId: "cls1", section: "B", subject: "English" }),
    makeTest({ _id: "t3", classId: "cls2", section: "A", subject: "Mathematics" }),
    makeTest({ _id: "t4", classId: "cls2", section: "B", subject: "Science" }),
  ];

  it("returns all tests when no filters applied", () => {
    expect(filterTests(tests, "", "", "")).toHaveLength(4);
  });

  it("filters by class", () => {
    expect(filterTests(tests, "cls1", "", "")).toHaveLength(2);
  });

  it("filters by section (case-insensitive)", () => {
    expect(filterTests(tests, "", "a", "")).toHaveLength(2);
  });

  it("filters by subject", () => {
    expect(filterTests(tests, "", "", "Mathematics")).toHaveLength(2);
  });

  it("filters by class + section + subject combined", () => {
    expect(filterTests(tests, "cls1", "A", "Mathematics")).toHaveLength(1);
    expect(filterTests(tests, "cls1", "A", "Mathematics")[0]._id).toBe("t1");
  });

  it("returns empty when no match", () => {
    expect(filterTests(tests, "cls99", "", "")).toHaveLength(0);
  });
});

describe("Subject Stats", () => {
  const tests: TestBasic[] = [
    { _id: "t1", subject: "Mathematics", totalMarks: 20, classId: "cls1", section: "A" },
    { _id: "t2", subject: "Mathematics", totalMarks: 20, classId: "cls1", section: "A" },
    { _id: "t3", subject: "English", totalMarks: 20, classId: "cls1", section: "A" },
    { _id: "t4", subject: "Science", totalMarks: 10, classId: "cls2", section: "B" },
  ];

  const marks: MarkRecord[] = [
    { testId: "t1", studentId: "s1", obtained: 18 },
    { testId: "t1", studentId: "s2", obtained: 12 },
    { testId: "t2", studentId: "s1", obtained: 20 },
    { testId: "t2", studentId: "s2", obtained: 14 },
    { testId: "t3", studentId: "s1", obtained: 16 },
    { testId: "t4", studentId: "s3", obtained: 8 },
  ];

  it("computes per-subject stats correctly", () => {
    const stats = computeSubjectStats(tests, marks);
    expect(stats).toHaveLength(3);
    // Mathematics: t1 avg 75%, t2 avg 85% → overall avg 80%
    const math = stats.find((s) => s.subject === "Mathematics")!;
    expect(math.testCount).toBe(2);
    expect(math.averagePct).toBe(80);
    expect(math.totalEntries).toBe(4);
    // English: t3 avg 80%
    const eng = stats.find((s) => s.subject === "English")!;
    expect(eng.testCount).toBe(1);
    expect(eng.averagePct).toBe(80);
    expect(eng.totalEntries).toBe(1);
  });

  it("sorts by average descending", () => {
    const stats = computeSubjectStats(tests, marks);
    expect(stats[0].averagePct).toBeGreaterThanOrEqual(stats[1].averagePct);
  });

  it("filters by class", () => {
    const stats = computeSubjectStats(tests, marks, "cls1");
    expect(stats).toHaveLength(2);
    expect(stats.find((s) => s.subject === "Science")).toBeUndefined();
  });

  it("filters by section", () => {
    const stats = computeSubjectStats(tests, marks, undefined, "B");
    expect(stats).toHaveLength(1);
    expect(stats[0].subject).toBe("Science");
  });

  it("returns empty for no matching data", () => {
    const stats = computeSubjectStats(tests, marks, "cls99");
    expect(stats).toHaveLength(0);
  });
});

describe("Trend Data", () => {
  it("computes monthly averages from buckets", () => {
    const map = new Map<string, { exams: number[]; dailyTests: number[]; weeklyTests: number[]; allPcts: number[] }>();
    map.set("2026-06", {
      exams: [80, 90],
      dailyTests: [70],
      weeklyTests: [],
      allPcts: [80, 90, 70],
    });
    map.set("2026-07", {
      exams: [60],
      dailyTests: [50, 80],
      weeklyTests: [90],
      allPcts: [60, 50, 80, 90],
    });

    const trend = computeTrend(map);
    expect(trend).toHaveLength(2);
    expect(trend[0].month).toBe("2026-06");
    expect(trend[1].month).toBe("2026-07");

    // June: exams avg = 85, daily avg = 70, overall = 80
    expect(trend[0].examAvg).toBe(85);
    expect(trend[0].dailyAvg).toBe(70);
    expect(trend[0].weeklyAvg).toBeNull();
    expect(trend[0].overallAvg).toBe(80);
    expect(trend[0].testCount).toBe(3);

    // July: exams=60, daily=65, weekly=90, overall=70
    expect(trend[1].examAvg).toBe(60);
    expect(trend[1].dailyAvg).toBe(65);
    expect(trend[1].weeklyAvg).toBe(90);
    expect(trend[1].overallAvg).toBe(70);
    expect(trend[1].testCount).toBe(4);
  });

  it("returns empty array for empty input", () => {
    const trend = computeTrend(new Map());
    expect(trend).toHaveLength(0);
  });

  it("handles months with no data in some categories", () => {
    const map = new Map<string, { exams: number[]; dailyTests: number[]; weeklyTests: number[]; allPcts: number[] }>();
    map.set("2026-08", {
      exams: [],
      dailyTests: [],
      weeklyTests: [],
      allPcts: [],
    });

    const trend = computeTrend(map);
    expect(trend).toHaveLength(1);
    expect(trend[0].examAvg).toBeNull();
    expect(trend[0].dailyAvg).toBeNull();
    expect(trend[0].weeklyAvg).toBeNull();
    expect(trend[0].overallAvg).toBeNull();
    expect(trend[0].testCount).toBe(0);
  });

  it("sorts months chronologically", () => {
    const map = new Map<string, { exams: number[]; dailyTests: number[]; weeklyTests: number[]; allPcts: number[] }>();
    map.set("2026-12", { exams: [80], dailyTests: [], weeklyTests: [], allPcts: [80] });
    map.set("2026-01", { exams: [60], dailyTests: [], weeklyTests: [], allPcts: [60] });
    map.set("2026-06", { exams: [70], dailyTests: [], weeklyTests: [], allPcts: [70] });

    const trend = computeTrend(map);
    expect(trend[0].month).toBe("2026-01");
    expect(trend[1].month).toBe("2026-06");
    expect(trend[2].month).toBe("2026-12");
  });
});

describe("TestDetail Stats", () => {
  function computeDetailStats(
    marks: { studentId: string; obtained: number }[],
    totalMarks: number,
  ) {
    const marksData = marks.map((m) => ({
      ...m,
      percentage: totalMarks > 0 ? Math.round((m.obtained / totalMarks) * 1000) / 10 : 0,
    }));

    const avg =
      marksData.length > 0
        ? marksData.reduce((s, m) => s + m.percentage, 0) / marksData.length
        : 0;

    return {
      marksEntered: marksData.length,
      average: Math.round(avg * 10) / 10,
      highest: marksData.length > 0 ? Math.max(...marksData.map((m) => m.percentage)) : 0,
      lowest: marksData.length > 0 ? Math.min(...marksData.map((m) => m.percentage)) : 0,
      passCount: marksData.filter((m) => m.percentage >= 33).length,
      failCount: marksData.filter((m) => m.percentage < 33).length,
    };
  }

  it("computes correct stats for a set of marks", () => {
    const marks = [
      { studentId: "s1", obtained: 18 }, // 90%
      { studentId: "s2", obtained: 14 }, // 70%
      { studentId: "s3", obtained: 6 },  // 30%
      { studentId: "s4", obtained: 20 }, // 100%
    ];

    const stats = computeDetailStats(marks, 20);
    expect(stats.marksEntered).toBe(4);
    expect(stats.average).toBe(72.5);
    expect(stats.highest).toBe(100);
    expect(stats.lowest).toBe(30);
    expect(stats.passCount).toBe(3);
    expect(stats.failCount).toBe(1);
  });

  it("handles empty marks", () => {
    const stats = computeDetailStats([], 20);
    expect(stats.marksEntered).toBe(0);
    expect(stats.average).toBe(0);
    expect(stats.highest).toBe(0);
    expect(stats.lowest).toBe(0);
    expect(stats.passCount).toBe(0);
    expect(stats.failCount).toBe(0);
  });

  it("handles all pass scenario", () => {
    const marks = [
      { studentId: "s1", obtained: 20 },
      { studentId: "s2", obtained: 18 },
    ];
    const stats = computeDetailStats(marks, 20);
    expect(stats.passCount).toBe(2);
    expect(stats.failCount).toBe(0);
  });

  it("handles all fail scenario", () => {
    const marks = [
      { studentId: "s1", obtained: 2 },
      { studentId: "s2", obtained: 4 },
    ];
    const stats = computeDetailStats(marks, 20);
    expect(stats.passCount).toBe(0);
    expect(stats.failCount).toBe(2);
  });
});
