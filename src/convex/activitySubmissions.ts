import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"), v.literal("submitted"), v.literal("reviewed"), v.literal("returned"),
    )),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [classes, students, users] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("users").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "Staff"]));

    let rows = await ctx.db.query("activitySubmissions").collect();
    if (args.classId) rows = rows.filter((r) => r.classId === args.classId);
    if (args.section) { const s = args.section.trim().toUpperCase(); rows = rows.filter((r) => r.section === s); }
    if (args.status) rows = rows.filter((r) => r.status === args.status);

    return rows.map((r) => ({
      ...r,
      studentName: studentMap.get(r.studentId)?.name ?? "—",
      rollNumber: studentMap.get(r.studentId)?.rollNumber ?? "—",
      className: classMap.get(r.classId) ?? "—",
      createdByName: userMap.get(r.createdBy) ?? "Staff",
      reviewedByName: r.reviewedBy ? (userMap.get(r.reviewedBy) ?? "Staff") : undefined,
    })).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    studentId: v.id("students"),
    activityTitle: v.string(),
    subject: v.optional(v.string()),
    description: v.optional(v.string()),
    submissionType: v.union(
      v.literal("written"), v.literal("practical"), v.literal("project"),
      v.literal("presentation"), v.literal("other"),
    ),
    totalMarks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const title = args.activityTitle.trim();
    if (!title) throw new ConvexError("Activity title is required.");
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new ConvexError("Student not found.");

    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("activitySubmissions", {
      studentId: args.studentId,
      classId: student.classId,
      section: student.section,
      activityTitle: title,
      subject: args.subject?.trim() || undefined,
      description: args.description?.trim() || undefined,
      submissionType: args.submissionType,
      status: "pending",
      totalMarks: args.totalMarks || undefined,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const review = mutation({
  args: {
    id: v.id("activitySubmissions"),
    status: v.union(
      v.literal("pending"), v.literal("submitted"), v.literal("reviewed"), v.literal("returned"),
    ),
    marksObtained: v.optional(v.number()),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Submission not found.");
    const user = await requireSchoolUser(ctx);
    await ctx.db.patch(args.id, {
      status: args.status,
      marksObtained: args.marksObtained ?? existing.marksObtained,
      feedback: args.feedback?.trim() || existing.feedback,
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("activitySubmissions") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Submission not found.");
    await ctx.db.delete(args.id);
  },
});
