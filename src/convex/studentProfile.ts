import { v } from "convex/values";
import { query } from "./_generated/server";
import { isSchoolUser } from "./permissions";

/** Comprehensive profile data for a single student. */
export const get = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const student = await ctx.db.get(args.studentId);
    if (!student) return null;

    const cls = await ctx.db.get(student.classId);
    const className = cls?.name ?? "—";

    // Attendance summary — last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).gte("date", cutoffStr),
      )
      .collect();

    const attendanceTotals = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const rec of attendance) {
      attendanceTotals[rec.status]++;
    }
    const totalMarked =
      attendanceTotals.present +
      attendanceTotals.absent +
      attendanceTotals.late +
      attendanceTotals.leave;
    const presentRate =
      totalMarked > 0
        ? Math.round((attendanceTotals.present / totalMarked) * 100)
        : 0;

    // Fee summary
    const payments = await ctx.db
      .query("feePayments")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const assignments = await ctx.db
      .query("feeAssignments")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const totalAssignments = assignments.reduce(
      (sum, a) => sum + a.amount,
      0,
    );

    // Monthly fee from class structure
    const structures = await ctx.db
      .query("feeStructures")
      .withIndex("by_class", (q) => q.eq("classId", student.classId))
      .collect();
    const monthlyFee = structures
      .filter((s) => s.period === "monthly")
      .reduce((sum, s) => sum + s.amount, 0);

    // Exam results
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const examIds = [...new Set(results.map((r) => r.examId))];
    const exams = await Promise.all(examIds.map((id) => ctx.db.get(id)));
    const examMap = new Map(
      exams.filter(Boolean).map((e) => [e!._id, e!]),
    );

    const examSummaries = results
      .map((r) => {
        const exam = examMap.get(r.examId);
        return exam
          ? {
              examId: r.examId,
              examTitle: exam.title,
              examType: exam.type,
              examDate: exam.date,
              marks: r.marks,
              totalObtained: r.totalObtained,
              percentage: r.percentage,
              grade: r.grade,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ea = examMap.get(a!.examId)!;
        const eb = examMap.get(b!.examId)!;
        return eb.date.localeCompare(ea.date);
      });

    const overallAverage =
      results.length > 0
        ? Math.round(
            results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
          )
        : 0;

    // Notebook checks — last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const nbCutoff = thirtyDaysAgo.toISOString().slice(0, 10);
    const notebookChecks = await ctx.db
      .query("notebookChecks")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).gte("date", nbCutoff),
      )
      .collect();

    // Robot projects
    const robotProjects = await ctx.db
      .query("robotProjects")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    // Activity submissions
    const submissions = await ctx.db
      .query("activitySubmissions")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    return {
      student,
      className,
      attendance: {
        records: attendance.sort((a, b) => b.date.localeCompare(a.date)),
        totals: attendanceTotals,
        totalMarked,
        presentRate,
      },
      fees: {
        totalPaid,
        totalAssignments,
        monthlyFee,
        paymentCount: payments.length,
        recentPayments: payments
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10),
      },
      exams: {
        summaries: examSummaries,
        totalExams: examSummaries.length,
        overallAverage,
        overallGrade:
          examSummaries.length > 0
            ? computeGrade(overallAverage)
            : null,
      },
      notebookChecks: notebookChecks.sort(
        (a, b) => b.date.localeCompare(a.date),
      ),
      robotProjects,
      submissions,
    };
  },
});

function computeGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}
