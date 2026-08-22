import { v } from "convex/values";
import { query } from "./_generated/server";
import { isSchoolUser } from "./permissions";

function computeGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

/** Full progress report for a single student — exams, daily tests, weekly tests, attendance, notebook checks. */
export const studentReport = query({
  args: {
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const student = await ctx.db.get(args.studentId);
    if (!student) return null;
    const cls = await ctx.db.get(student.classId);
    if (!cls) return null;

    // Fetch all data in parallel
    const [
      examResults,
      allExams,
      dailyTests,
      dailyTestMarks,
      weeklyTests,
      weeklyTestMarks,
      attendance,
      notebookChecks,
    ] = await Promise.all([
      ctx.db
        .query("examResults")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db.query("exams").collect(),
      ctx.db.query("dailyTests").collect(),
      ctx.db.query("dailyTestMarks").collect(),
      ctx.db.query("weeklyTests").collect(),
      ctx.db.query("weeklyTestMarks").collect(),
      (await ctx.db.query("attendance").collect()).filter((a) => a.studentId === args.studentId),
      ctx.db.query("notebookChecks").collect(),
    ]);

    const examMap = new Map(allExams.map((e) => [e._id, e]));

    // ─── EXAMS ───
    const examData = examResults
      .filter((r) => examMap.has(r.examId))
      .map((r) => {
        const exam = examMap.get(r.examId)!;
        return {
          examTitle: exam.title,
          examType: exam.type,
          examDate: exam.date,
          className: cls.name,
          section: student.section,
          subjects: r.marks,
          totalObtained: r.totalObtained,
          totalMax: exam.totalMarks,
          percentage: r.percentage,
          grade: r.grade,
        };
      })
      .sort((a, b) => a.examDate.localeCompare(b.examDate));

    const examPcts = examData.map((e) => e.percentage);
    const examAvg = examPcts.length > 0 ? examPcts.reduce((a, b) => a + b, 0) / examPcts.length : 0;

    // ─── DAILY TESTS ───
    const dailyByTest = new Map<string, typeof dailyTestMarks>();
    for (const m of dailyTestMarks) {
      const arr = dailyByTest.get(m.testId) ?? [];
      arr.push(m);
      dailyByTest.set(m.testId, arr);
    }
    const dailyTestData = dailyTests
      .filter((t) => t.classId === student.classId && t.section === student.section)
      .map((t) => {
        const marks = dailyByTest.get(t._id) ?? [];
        const myMark = marks.find((m) => m.studentId === args.studentId);
        const allPcts = marks.map((m) => (t.totalMarks > 0 ? (m.obtained / t.totalMarks) * 100 : 0));
        const avgPct = allPcts.length > 0 ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 0;
        return {
          title: t.title || `${t.subject} Quiz`,
          subject: t.subject,
          date: t.date,
          totalMarks: t.totalMarks,
          obtained: myMark?.obtained ?? null,
          percentage: myMark && t.totalMarks > 0 ? Math.round((myMark.obtained / t.totalMarks) * 1000) / 10 : null,
          classAverage: Math.round(avgPct * 10) / 10,
          studentCount: marks.length,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const dailyEntered = dailyTestData.filter((d) => d.obtained !== null);
    const dailyAvg =
      dailyEntered.length > 0
        ? dailyEntered.reduce((s, d) => s + (d.percentage ?? 0), 0) / dailyEntered.length
        : 0;

    // ─── WEEKLY TESTS ───
    const weeklyByTest = new Map<string, typeof weeklyTestMarks>();
    for (const m of weeklyTestMarks) {
      const arr = weeklyByTest.get(m.testId) ?? [];
      arr.push(m);
      weeklyByTest.set(m.testId, arr);
    }
    const weeklyTestData = weeklyTests
      .filter((t) => t.classId === student.classId && t.section === student.section)
      .map((t) => {
        const marks = weeklyByTest.get(t._id) ?? [];
        const myMark = marks.find((m) => m.studentId === args.studentId);
        const allPcts = marks.map((m) => (t.totalMarks > 0 ? (m.obtained / t.totalMarks) * 100 : 0));
        const avgPct = allPcts.length > 0 ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 0;
        return {
          title: t.title || `${t.subject} Test`,
          subject: t.subject,
          date: t.date,
          totalMarks: t.totalMarks,
          obtained: myMark?.obtained ?? null,
          percentage: myMark && t.totalMarks > 0 ? Math.round((myMark.obtained / t.totalMarks) * 1000) / 10 : null,
          classAverage: Math.round(avgPct * 10) / 10,
          studentCount: marks.length,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const weeklyEntered = weeklyTestData.filter((w) => w.obtained !== null);
    const weeklyAvg =
      weeklyEntered.length > 0
        ? weeklyEntered.reduce((s, w) => s + (w.percentage ?? 0), 0) / weeklyEntered.length
        : 0;

    // ─── ATTENDANCE ───
    const totalDays = attendance.length;
    const presentDays = attendance.filter((a) => a.status === "present" || a.status === "late").length;
    const absentDays = attendance.filter((a) => a.status === "absent").length;
    const lateDays = attendance.filter((a) => a.status === "late").length;
    const leaveDays = attendance.filter((a) => a.status === "leave").length;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 0;

    // ─── NOTEBOOK CHECKS (last 90 days) ───
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);
    const myNotebooks = notebookChecks
      .filter((n) => n.studentId === args.studentId && n.date >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date));
    const notebookComplete = myNotebooks.filter((n) => n.status === "complete").length;

    // ─── OVERALL ───
    const allPcts = [...examPcts, ...dailyEntered.map((d) => d.percentage ?? 0), ...weeklyEntered.map((w) => w.percentage ?? 0)];
    const overallAvg = allPcts.length > 0 ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 0;

    return {
      student: {
        id: student._id,
        name: student.name,
        fatherName: student.fatherName,
        rollNumber: student.rollNumber,
        className: cls.name,
        section: student.section,
        phone: student.phone ?? "",
        birthDate: student.birthDate ?? "",
        admissionDate: student.admissionDate ?? "",
      },
      exams: examData,
      dailyTests: dailyTestData,
      weeklyTests: weeklyTestData,
      attendance: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        leaveDays,
        attendanceRate,
      },
      notebooks: {
        total: myNotebooks.length,
        complete: notebookComplete,
        incomplete: myNotebooks.length - notebookComplete,
        records: myNotebooks.slice(0, 20),
      },
      overall: {
        examsTaken: examData.length,
        dailyTestsTaken: dailyEntered.length,
        weeklyTestsTaken: weeklyEntered.length,
        examAverage: Math.round(examAvg * 10) / 10,
        dailyTestAverage: Math.round(dailyAvg * 10) / 10,
        weeklyTestAverage: Math.round(weeklyAvg * 10) / 10,
        overallAverage: Math.round(overallAvg * 10) / 10,
        overallGrade: computeGrade(overallAvg),
        attendanceRate,
      },
    };
  },
});

/** Class-wide progress summary — all students in a class with averages from exams, daily tests, weekly tests. */
export const classReport = query({
  args: {
    classId: v.id("classes"),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const cls = await ctx.db.get(args.classId);
    if (!cls) return null;
    const section = args.section.trim().toUpperCase();

    const [students, allExams, examResults, dailyTests, dailyTestMarks, weeklyTests, weeklyTestMarks, attendance] =
      await Promise.all([
        ctx.db
          .query("students")
          .filter((q) => q.and(q.eq(q.field("classId"), args.classId), q.eq(q.field("section"), section), q.eq(q.field("status"), "active")))
          .collect(),
        ctx.db.query("exams").collect(),
        ctx.db.query("examResults").collect(),
        ctx.db.query("dailyTests").collect(),
        ctx.db.query("dailyTestMarks").collect(),
        ctx.db.query("weeklyTests").collect(),
        ctx.db.query("weeklyTestMarks").collect(),        ctx.db.query("attendance").collect(),
      ]);

      const examMap = new Map(allExams.map((e) => [e._id, e]));
      const sectionExams = allExams.filter((e) => e.classId === args.classId && e.section === section);
    const sectionExamIds = new Set(sectionExams.map((e) => e._id));
    const sectionDailyTests = dailyTests.filter((t) => t.classId === args.classId && t.section === section);
    const sectionWeeklyTests = weeklyTests.filter((t) => t.classId === args.classId && t.section === section);

    // Index marks
    const dailyByTest = new Map<string, typeof dailyTestMarks>();
    for (const m of dailyTestMarks) {
      const arr = dailyByTest.get(m.testId) ?? [];
      arr.push(m);
      dailyByTest.set(m.testId, arr);
    }
    const weeklyByTest = new Map<string, typeof weeklyTestMarks>();
    for (const m of weeklyTestMarks) {
      const arr = weeklyByTest.get(m.testId) ?? [];
      arr.push(m);
      weeklyByTest.set(m.testId, arr);
    }

    // Build per-student summaries
    const studentSummaries = students.map((student) => {
      // Exams
      const myExamResults = examResults.filter((r) => r.studentId === student._id && sectionExamIds.has(r.examId));
      const examPcts = myExamResults.map((r) => r.percentage);
      const examAvg = examPcts.length > 0 ? examPcts.reduce((a, b) => a + b, 0) / examPcts.length : 0;

      // Daily tests
      const myDailyMarks = sectionDailyTests.map((t) => {
        const marks = dailyByTest.get(t._id) ?? [];
        const my = marks.find((m) => m.studentId === student._id);
        return my && t.totalMarks > 0 ? (my.obtained / t.totalMarks) * 100 : null;
      });
      const dailyEntered = myDailyMarks.filter((p) => p !== null) as number[];
      const dailyAvg = dailyEntered.length > 0 ? dailyEntered.reduce((a, b) => a + b, 0) / dailyEntered.length : 0;

      // Weekly tests
      const myWeeklyMarks = sectionWeeklyTests.map((t) => {
        const marks = weeklyByTest.get(t._id) ?? [];
        const my = marks.find((m) => m.studentId === student._id);
        return my && t.totalMarks > 0 ? (my.obtained / t.totalMarks) * 100 : null;
      });
      const weeklyEntered = myWeeklyMarks.filter((p) => p !== null) as number[];
      const weeklyAvg = weeklyEntered.length > 0 ? weeklyEntered.reduce((a, b) => a + b, 0) / weeklyEntered.length : 0;

      // Attendance
      const myAttendance = attendance.filter((a) => a.studentId === student._id);
      const totalAtt = myAttendance.length;
      const presentAtt = myAttendance.filter((a) => a.status === "present" || a.status === "late").length;
      const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 1000) / 10 : 0;

      // Overall
      const allPcts = [...examPcts, ...dailyEntered, ...weeklyEntered];
      const overallAvg = allPcts.length > 0 ? allPcts.reduce((a, b) => a + b, 0) / allPcts.length : 0;

      return {
        studentId: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        examAverage: Math.round(examAvg * 10) / 10,
        examsTaken: myExamResults.length,
        dailyTestAverage: Math.round(dailyAvg * 10) / 10,
        dailyTestsTaken: dailyEntered.length,
        weeklyTestAverage: Math.round(weeklyAvg * 10) / 10,
        weeklyTestsTaken: weeklyEntered.length,
        attendanceRate: attRate,
        overallAverage: Math.round(overallAvg * 10) / 10,
        overallGrade: computeGrade(overallAvg),
      };
    });

    // Class stats
    const allAvg = studentSummaries.map((s) => s.overallAverage);
    const classAvg = allAvg.length > 0 ? allAvg.reduce((a, b) => a + b, 0) / allAvg.length : 0;

    return {
      className: cls.name,
      section,
      totalStudents: students.length,
      students: studentSummaries.sort((a, b) => b.overallAverage - a.overallAverage),
      classStats: {
        average: Math.round(classAvg * 10) / 10,
        highest: allAvg.length > 0 ? Math.max(...allAvg) : 0,
        lowest: allAvg.length > 0 ? Math.min(...allAvg) : 0,
        passRate:
          allAvg.length > 0
            ? Math.round((allAvg.filter((a) => a >= 33).length / allAvg.length) * 100)
            : 0,
      },
    };
  },
});

/** Monthly performance trend for a student — groups test results by month. */
export const studentTrend = query({
  args: {
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const student = await ctx.db.get(args.studentId);
    if (!student) return [];

    const [examResults, allExams, dailyTests, dailyTestMarks, weeklyTests, weeklyTestMarks] = await Promise.all([
      ctx.db
        .query("examResults")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db.query("exams").collect(),
      ctx.db.query("dailyTests").collect(),
      ctx.db.query("dailyTestMarks").collect(),
      ctx.db.query("weeklyTests").collect(),
      ctx.db.query("weeklyTestMarks").collect(),
    ]);

    const examMap = new Map(allExams.map((e) => [e._id, e]));

    // Build monthly buckets
    const monthlyMap = new Map<string, { exams: number[]; dailyTests: number[]; weeklyTests: number[]; allPcts: number[] }>();

    function getOrCreate(month: string) {
      if (!monthlyMap.has(month)) monthlyMap.set(month, { exams: [], dailyTests: [], weeklyTests: [], allPcts: [] });
      return monthlyMap.get(month)!;
    }

    // Exam results
    for (const r of examResults) {
      const exam = examMap.get(r.examId);
      if (!exam) continue;
      const month = r.enteredAt ? new Date(r.enteredAt).toISOString().slice(0, 7) : exam.date.slice(0, 7);
      const bucket = getOrCreate(month);
      bucket.exams.push(r.percentage);
      bucket.allPcts.push(r.percentage);
    }

    // Daily tests
    const dailyByTest = new Map<string, typeof dailyTestMarks>();
    for (const m of dailyTestMarks) {
      const arr = dailyByTest.get(m.testId) ?? [];
      arr.push(m);
      dailyByTest.set(m.testId, arr);
    }
    for (const t of dailyTests) {
      if (t.classId !== student.classId || t.section !== student.section) continue;
      const marks = dailyByTest.get(t._id) ?? [];
      const myMark = marks.find((m) => m.studentId === args.studentId);
      if (myMark && t.totalMarks > 0) {
        const pct = Math.round((myMark.obtained / t.totalMarks) * 1000) / 10;
        const month = t.date.slice(0, 7);
        const bucket = getOrCreate(month);
        bucket.dailyTests.push(pct);
        bucket.allPcts.push(pct);
      }
    }

    // Weekly tests
    const weeklyByTest = new Map<string, typeof weeklyTestMarks>();
    for (const m of weeklyTestMarks) {
      const arr = weeklyByTest.get(m.testId) ?? [];
      arr.push(m);
      weeklyByTest.set(m.testId, arr);
    }
    for (const t of weeklyTests) {
      if (t.classId !== student.classId || t.section !== student.section) continue;
      const marks = weeklyByTest.get(t._id) ?? [];
      const myMark = marks.find((m) => m.studentId === args.studentId);
      if (myMark && t.totalMarks > 0) {
        const pct = Math.round((myMark.obtained / t.totalMarks) * 1000) / 10;
        const month = t.date.slice(0, 7);
        const bucket = getOrCreate(month);
        bucket.weeklyTests.push(pct);
        bucket.allPcts.push(pct);
      }
    }

    return Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        examAvg: data.exams.length > 0 ? Math.round(data.exams.reduce((a, b) => a + b, 0) / data.exams.length * 10) / 10 : null,
        dailyAvg: data.dailyTests.length > 0 ? Math.round(data.dailyTests.reduce((a, b) => a + b, 0) / data.dailyTests.length * 10) / 10 : null,
        weeklyAvg: data.weeklyTests.length > 0 ? Math.round(data.weeklyTests.reduce((a, b) => a + b, 0) / data.weeklyTests.length * 10) / 10 : null,
        overallAvg: data.allPcts.length > 0 ? Math.round(data.allPcts.reduce((a, b) => a + b, 0) / data.allPcts.length * 10) / 10 : null,
        testCount: data.allPcts.length,
      }));
  },
});
