import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EXAM_TYPES = ["monthly", "midterm", "final", "weekly", "other"] as const;

function computeGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

/** List exams, optionally filtered by class/section. */
export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const [classes, users] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("users").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "Staff"]));

    let exams = await ctx.db.query("exams").collect();

    if (args.classId) {
      exams = exams.filter((e) => e.classId === args.classId);
    }
    if (args.section) {
      const s = args.section.trim().toUpperCase();
      exams = exams.filter((e) => e.section === s);
    }

    // Attach result counts
    const results = await ctx.db.query("examResults").collect();
    const resultCounts = new Map<string, number>();
    for (const r of results) {
      resultCounts.set(r.examId, (resultCounts.get(r.examId) ?? 0) + 1);
    }

    return exams
      .map((e) => ({
        ...e,
        className: classMap.get(e.classId) ?? "—",
        createdByName: userMap.get(e.createdBy) ?? "Staff",
        resultCount: resultCounts.get(e._id) ?? 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Create a new exam. */
export const create = mutation({
  args: {
    title: v.string(),
    type: v.union(
      v.literal("monthly"),
      v.literal("midterm"),
      v.literal("final"),
      v.literal("weekly"),
      v.literal("other"),
    ),
    classId: v.id("classes"),
    section: v.string(),
    date: v.string(),
    totalMarks: v.number(),
    subjects: v.array(v.object({ name: v.string(), maxMarks: v.number() })),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) {
      throw new ConvexError("Not authorized.");
    }
    const title = args.title.trim();
    if (!title) throw new ConvexError("Exam title is required.");
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");
    if (args.totalMarks <= 0) throw new ConvexError("Total marks must be positive.");
    if (args.subjects.length === 0) throw new ConvexError("Add at least one subject.");

    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");
    const section = args.section.trim().toUpperCase();
    if (cls.sections.length > 0 && !cls.sections.includes(section)) {
      throw new ConvexError(`Section "${section}" is not in ${cls.name}.`);
    }

    const authUser = await requireSchoolUser(ctx);

    const now = Date.now();
    return await ctx.db.insert("exams", {
      title,
      type: args.type,
      classId: args.classId,
      section,
      date: args.date,
      totalMarks: args.totalMarks,
      subjects: args.subjects.map((s) => ({
        name: s.name.trim(),
        maxMarks: s.maxMarks,
      })),
      createdBy: authUser._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an exam. */
export const update = mutation({
  args: {
    id: v.id("exams"),
    title: v.string(),
    type: v.union(
      v.literal("monthly"),
      v.literal("midterm"),
      v.literal("final"),
      v.literal("weekly"),
      v.literal("other"),
    ),
    classId: v.id("classes"),
    section: v.string(),
    date: v.string(),
    totalMarks: v.number(),
    subjects: v.array(v.object({ name: v.string(), maxMarks: v.number() })),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Exam not found.");

    const title = args.title.trim();
    if (!title) throw new ConvexError("Exam title is required.");
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");
    if (args.totalMarks <= 0) throw new ConvexError("Total marks must be positive.");
    if (args.subjects.length === 0) throw new ConvexError("Add at least one subject.");

    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");
    const section = args.section.trim().toUpperCase();
    if (cls.sections.length > 0 && !cls.sections.includes(section)) {
      throw new ConvexError(`Section "${section}" is not in ${cls.name}.`);
    }

    await ctx.db.patch(args.id, {
      title,
      type: args.type,
      classId: args.classId,
      section,
      date: args.date,
      totalMarks: args.totalMarks,
      subjects: args.subjects.map((s) => ({
        name: s.name.trim(),
        maxMarks: s.maxMarks,
      })),
      updatedAt: Date.now(),
    });
  },
});

/** Remove an exam and all its results. */
export const remove = mutation({
  args: { id: v.id("exams") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Exam not found.");

    // Delete all results for this exam
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_exam", (q) => q.eq("examId", args.id))
      .collect();
    for (const r of results) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(args.id);
  },
});

/** Get results for a specific exam, with student details. */
export const getResults = query({
  args: { examId: v.id("exams") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const exam = await ctx.db.get(args.examId);
    if (!exam) return null;

    const [allResults, students, classes] = await Promise.all([
      ctx.db
        .query("examResults")
        .withIndex("by_exam", (q) => q.eq("examId", args.examId))
        .collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
    ]);

    const studentMap = new Map(students.map((s) => [s._id, s]));
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    const rows = allResults
      .map((r) => {
        const student = studentMap.get(r.studentId);
        return {
          ...r,
          studentName: student?.name ?? "—",
          rollNumber: student?.rollNumber ?? "—",
          className: classMap.get(exam.classId) ?? "—",
          section: exam.section,
        };
      })
      .sort((a, b) => b.percentage - a.percentage || a.rollNumber.localeCompare(b.rollNumber));

    // Class stats
    const percentages = rows.map((r) => r.percentage);
    const avg = percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;
    const highest = percentages.length > 0 ? Math.max(...percentages) : 0;
    const lowest = percentages.length > 0 ? Math.min(...percentages) : 0;
    const passCount = percentages.filter((p) => p >= 33).length;

    return {
      exam: {
        ...exam,
        className: classMap.get(exam.classId) ?? "—",
      },
      results: rows,
      stats: {
        totalStudents: rows.length,
        average: Math.round(avg * 10) / 10,
        highest,
        lowest,
        passRate: percentages.length > 0 ? Math.round((passCount / percentages.length) * 100) : 0,
      },
    };
  },
});

/** Get student performance across all exams (progress report data). */
export const progressReport = query({
  args: {
    studentId: v.id("students"),
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const student = await ctx.db.get(args.studentId);
    if (!student) return null;

    const cls = await ctx.db.get(args.classId ?? student.classId);
    if (!cls) return null;

    const allResults = await ctx.db
      .query("examResults")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const examIds = allResults.map((r) => r.examId);
    const exams = await Promise.all(examIds.map((id) => ctx.db.get(id)));
    const examMap = new Map(exams.filter(Boolean).map((e) => [e!._id, e!]));

    // Group by exam, sorted by date
    const report = allResults
      .filter((r) => examMap.has(r.examId))
      .map((r) => {
        const exam = examMap.get(r.examId)!;
        return {
          examId: r.examId,
          examTitle: exam.title,
          examType: exam.type,
          examDate: exam.date,
          subjects: r.marks,
          totalObtained: r.totalObtained,
          totalMax: exam.totalMarks,
          percentage: r.percentage,
          grade: r.grade,
          remarks: r.remarks,
        };
      })
      .sort((a, b) => a.examDate.localeCompare(b.examDate));

    // Overall stats
    const percentages = report.map((r) => r.percentage);
    const overallPct = percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;

    return {
      student: {
        id: student._id,
        name: student.name,
        fatherName: student.fatherName,
        rollNumber: student.rollNumber,
        className: cls.name,
        section: student.section,
      },
      report,
      overall: {
        examsTaken: report.length,
        averagePercentage: Math.round(overallPct * 10) / 10,
        overallGrade: computeGrade(overallPct),
      },
    };
  },
});

/** Bulk save results for an exam. Creates or updates one result per student. */
export const saveResults = mutation({
  args: {
    examId: v.id("exams"),
    results: v.array(
      v.object({
        studentId: v.id("students"),
        marks: v.array(
          v.object({
            subject: v.string(),
            obtained: v.number(),
            maxMarks: v.number(),
            remarks: v.optional(v.string()),
          }),
        ),
        totalObtained: v.number(),
        percentage: v.number(),
        grade: v.string(),
        remarks: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");

    const exam = await ctx.db.get(args.examId);
    if (!exam) throw new ConvexError("Exam not found.");

    const authUser = await requireSchoolUser(ctx);
    const now = Date.now();
    let saved = 0;

    for (const entry of args.results) {
      // Skip students with no marks entered (all zeros)
      const hasAnyMarks = entry.marks.some((m) => m.obtained > 0);
      if (!hasAnyMarks) continue;

      const pct = exam.totalMarks > 0 ? Math.round((entry.totalObtained / exam.totalMarks) * 1000) / 10 : 0;

      // Check if result already exists (upsert)
      const existing = await ctx.db
        .query("examResults")
        .withIndex("by_exam_student", (q) =>
          q.eq("examId", args.examId).eq("studentId", entry.studentId),
        )
        .first();

      const data = {
        marks: entry.marks,
        totalObtained: entry.totalObtained,
        percentage: pct,
        grade: computeGrade(pct),
        remarks: entry.remarks || undefined,
        enteredBy: authUser._id,
        enteredAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("examResults", {
          examId: args.examId,
          studentId: entry.studentId,
          ...data,
        });
      }
      saved++;
    }

    return saved;
  },
});
