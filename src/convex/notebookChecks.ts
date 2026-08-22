import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** List notebook checks for a class/section on a date, or all for today. */
export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const date = args.date && DATE_RE.test(args.date) ? args.date : new Date().toISOString().slice(0, 10);

    let rows = await ctx.db
      .query("notebookChecks")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();

    if (args.classId) rows = rows.filter((r) => r.classId === args.classId);
    if (args.section) { const s = args.section.trim().toUpperCase(); rows = rows.filter((r) => r.section === s); }

    const [students, classes] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    return rows.map((r) => ({
      ...r,
      studentName: studentMap.get(r.studentId)?.name ?? "—",
      rollNumber: studentMap.get(r.studentId)?.rollNumber ?? "—",
      className: classMap.get(r.classId) ?? "—",
    })).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  },
});

/** Bulk save notebook checks for a class/section/date. */
export const saveChecks = mutation({
  args: {
    classId: v.id("classes"),
    section: v.string(),
    date: v.string(),
    subject: v.string(),
    entries: v.array(
      v.object({
        studentId: v.id("students"),
        pagesExpected: v.number(),
        pagesCompleted: v.number(),
        status: v.union(v.literal("complete"), v.literal("incomplete"), v.literal("not_brought")),
        remarks: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");
    const subject = args.subject.trim();
    if (!subject) throw new ConvexError("Subject is required.");

    const section = args.section.trim().toUpperCase();
    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");
    if (cls.sections.length > 0 && !cls.sections.includes(section)) {
      throw new ConvexError(`Section "${section}" is not in ${cls.name}.`);
    }

    const user = await requireSchoolUser(ctx);
    let saved = 0;

    for (const entry of args.entries) {
      // Delete existing check for this student/subject/date
      const existing = await ctx.db
        .query("notebookChecks")
        .withIndex("by_student_date", (q) =>
          q.eq("studentId", entry.studentId).eq("date", args.date),
        )
        .collect();
      const sameSubject = existing.find((e) => e.subject === subject);
      if (sameSubject) await ctx.db.delete(sameSubject._id);

      await ctx.db.insert("notebookChecks", {
        studentId: entry.studentId,
        classId: args.classId,
        section,
        subject,
        date: args.date,
        pagesExpected: entry.pagesExpected,
        pagesCompleted: entry.pagesCompleted,
        status: entry.status,
        remarks: entry.remarks || undefined,
        checkedBy: user._id,
        createdAt: Date.now(),
      });
      saved++;
    }
    return saved;
  },
});

/** Remove a notebook check */
export const remove = mutation({
  args: { id: v.id("notebookChecks") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.id);
  },
});
