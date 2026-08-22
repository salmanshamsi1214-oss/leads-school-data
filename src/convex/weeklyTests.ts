import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    date: v.optional(v.string()),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [classes, users] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("users").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "Staff"]));

    let rows = await ctx.db.query("weeklyTests").collect();
    if (args.classId) rows = rows.filter((r) => r.classId === args.classId);
    if (args.section) { const s = args.section.trim().toUpperCase(); rows = rows.filter((r) => r.section === s); }
    if (args.date) rows = rows.filter((r) => r.date === args.date);
    if (args.subject) rows = rows.filter((r) => r.subject === args.subject);

    const marks = await ctx.db.query("weeklyTestMarks").collect();
    const marksByTest = new Map<string, typeof marks>();
    for (const m of marks) {
      const arr = marksByTest.get(m.testId) ?? [];
      arr.push(m);
      marksByTest.set(m.testId, arr);
    }

    return rows.map((t) => {
      const testMarks = marksByTest.get(t._id) ?? [];
      const avg = testMarks.length > 0
        ? testMarks.reduce((s, m) => s + m.obtained, 0) / testMarks.length / (t.totalMarks || 1) * 100
        : 0;
      const highest = testMarks.length > 0
        ? Math.max(...testMarks.map((m) => (m.obtained / (t.totalMarks || 1)) * 100))
        : 0;
      const lowest = testMarks.length > 0
        ? Math.min(...testMarks.map((m) => (m.obtained / (t.totalMarks || 1)) * 100))
        : 0;
      return {
        ...t,
        className: classMap.get(t.classId) ?? "—",
        createdByName: userMap.get(t.createdBy) ?? "Staff",
        markCount: testMarks.length,
        averagePct: Math.round(avg * 10) / 10,
        highestPct: Math.round(highest * 10) / 10,
        lowestPct: Math.round(lowest * 10) / 10,
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Subject-wise stats for weekly tests within a class/section. */
export const subjectStats = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    let rows = await ctx.db.query("weeklyTests").collect();
    if (args.classId) rows = rows.filter((r) => r.classId === args.classId);
    if (args.section) { const s = args.section.trim().toUpperCase(); rows = rows.filter((r) => r.section === s); }

    const marks = await ctx.db.query("weeklyTestMarks").collect();
    const marksByTest = new Map<string, typeof marks>();
    for (const m of marks) {
      const arr = marksByTest.get(m.testId) ?? [];
      arr.push(m);
      marksByTest.set(m.testId, arr);
    }

    const subjectMap = new Map<string, { count: number; totalPct: number; totalStudents: number }>();
    for (const t of rows) {
      const testMarks = marksByTest.get(t._id) ?? [];
      const existing = subjectMap.get(t.subject) ?? { count: 0, totalPct: 0, totalStudents: 0 };
      existing.count += 1;
      existing.totalStudents += testMarks.length;
      if (testMarks.length > 0) {
        existing.totalPct += testMarks.reduce((s, m) => s + (m.obtained / (t.totalMarks || 1)) * 100, 0) / testMarks.length;
      }
      subjectMap.set(t.subject, existing);
    }

    return Array.from(subjectMap.entries()).map(([subject, data]) => ({
      subject,
      testCount: data.count,
      averagePct: data.count > 0 ? Math.round((data.totalPct / data.count) * 10) / 10 : 0,
      totalEntries: data.totalStudents,
    })).sort((a, b) => b.averagePct - a.averagePct);
  },
});

export const create = mutation({
  args: {
    classId: v.id("classes"),
    section: v.string(),
    subject: v.string(),
    title: v.optional(v.string()),
    date: v.string(),
    totalMarks: v.number(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");
    if (args.totalMarks <= 0) throw new ConvexError("Total marks must be positive.");
    const subject = args.subject.trim();
    if (!subject) throw new ConvexError("Subject is required.");

    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");
    const section = args.section.trim().toUpperCase();

    const user = await requireSchoolUser(ctx);
    return await ctx.db.insert("weeklyTests", {
      classId: args.classId,
      section,
      subject,
      title: args.title?.trim() || undefined,
      date: args.date,
      totalMarks: args.totalMarks,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("weeklyTests") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Test not found.");
    const marks = await ctx.db.query("weeklyTestMarks").withIndex("by_test", (q) => q.eq("testId", args.id)).collect();
    for (const m of marks) await ctx.db.delete(m._id);
    await ctx.db.delete(args.id);
  },
});

export const saveMarks = mutation({
  args: {
    testId: v.id("weeklyTests"),
    marks: v.array(
      v.object({
        studentId: v.id("students"),
        obtained: v.number(),
        remarks: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const test = await ctx.db.get(args.testId);
    if (!test) throw new ConvexError("Test not found.");

    let saved = 0;
    for (const entry of args.marks) {
      if (entry.obtained < 0) continue;
      const existing = await ctx.db
        .query("weeklyTestMarks")
        .withIndex("by_test_student", (q) =>
          q.eq("testId", args.testId).eq("studentId", entry.studentId),
        )
        .first();

      const data = { obtained: entry.obtained, remarks: entry.remarks || undefined };
      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("weeklyTestMarks", {
          testId: args.testId,
          studentId: entry.studentId,
          ...data,
        });
      }
      saved++;
    }
    return saved;
  },
});

export const getMarks = query({
  args: { testId: v.id("weeklyTests") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const test = await ctx.db.get(args.testId);
    if (!test) return [];

    const allMarks = await ctx.db.query("weeklyTestMarks")
      .withIndex("by_test", (q) => q.eq("testId", args.testId))
      .collect();
    const students = await ctx.db.query("students").collect();
    const studentMap = new Map(students.map((s) => [s._id, s]));

    return allMarks.map((m) => ({
      ...m,
      studentName: studentMap.get(m.studentId)?.name ?? "—",
      rollNumber: studentMap.get(m.studentId)?.rollNumber ?? "—",
    })).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  },
});

/** Get detailed test view: test info + all student marks with percentages. */
export const getDetail = query({
  args: { testId: v.id("weeklyTests") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    const test = await ctx.db.get(args.testId);
    if (!test) return null;

    const cls = await ctx.db.get(test.classId);
    const allMarks = await ctx.db.query("weeklyTestMarks")
      .withIndex("by_test", (q) => q.eq("testId", args.testId))
      .collect();
    const students = await ctx.db.query("students")
      .withIndex("by_class_section", (q) => q.eq("classId", test.classId).eq("section", test.section))
      .collect();
    const studentMap = new Map(students.map((s) => [s._id, s]));

    const marksData = allMarks.map((m) => {
      const percentage = test.totalMarks > 0 ? Math.round((m.obtained / test.totalMarks) * 1000) / 10 : 0;
      return {
        studentId: m.studentId,
        studentName: studentMap.get(m.studentId)?.name ?? "—",
        rollNumber: studentMap.get(m.studentId)?.rollNumber ?? "—",
        obtained: m.obtained,
        percentage,
        remarks: m.remarks,
      };
    }).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

    const avg = marksData.length > 0
      ? marksData.reduce((s, m) => s + m.percentage, 0) / marksData.length
      : 0;

    return {
      test,
      className: cls?.name ?? "—",
      marks: marksData,
      stats: {
        totalStudents: students.length,
        marksEntered: marksData.length,
        average: Math.round(avg * 10) / 10,
        highest: marksData.length > 0 ? Math.max(...marksData.map((m) => m.percentage)) : 0,
        lowest: marksData.length > 0 ? Math.min(...marksData.map((m) => m.percentage)) : 0,
        passCount: marksData.filter((m) => m.percentage >= 33).length,
        failCount: marksData.filter((m) => m.percentage < 33).length,
      },
    };
  },
});
