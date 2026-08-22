import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("planning"), v.literal("building"), v.literal("testing"),
      v.literal("completed"), v.literal("presented"),
    )),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [classes, students] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("students").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const studentMap = new Map(students.map((s) => [s._id, s]));

    let rows = await ctx.db.query("robotProjects").collect();
    if (args.classId) rows = rows.filter((r) => r.classId === args.classId);
    if (args.section) { const s = args.section.trim().toUpperCase(); rows = rows.filter((r) => r.section === s); }
    if (args.status) rows = rows.filter((r) => r.status === args.status);

    return rows.map((r) => ({
      ...r,
      studentName: studentMap.get(r.studentId)?.name ?? "—",
      rollNumber: studentMap.get(r.studentId)?.rollNumber ?? "—",
      className: classMap.get(r.classId) ?? "—",
    })).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    studentId: v.id("students"),
    projectName: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const name = args.projectName.trim();
    if (!name) throw new ConvexError("Project name is required.");
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new ConvexError("Student not found.");

    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("robotProjects", {
      studentId: args.studentId,
      classId: student.classId,
      section: student.section,
      projectName: name,
      description: args.description?.trim() || undefined,
      status: "planning",
      startDate: args.startDate || undefined,
      remarks: args.remarks?.trim() || undefined,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("robotProjects"),
    projectName: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("planning"), v.literal("building"), v.literal("testing"),
      v.literal("completed"), v.literal("presented"),
    ),
    startDate: v.optional(v.string()),
    completionDate: v.optional(v.string()),
    grade: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Project not found.");
    await ctx.db.patch(args.id, {
      projectName: args.projectName.trim(),
      description: args.description?.trim() || undefined,
      status: args.status,
      startDate: args.startDate || undefined,
      completionDate: args.completionDate || undefined,
      grade: args.grade?.trim() || undefined,
      remarks: args.remarks?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("robotProjects") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Project not found.");
    await ctx.db.delete(args.id);
  },
});
