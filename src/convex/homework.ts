import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

/** List homework for a class/section with optional date range. */
export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    subject: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [allHomework, classes] = await Promise.all([
      ctx.db.query("homework").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c]));

    let rows = allHomework;
    if (args.classId) rows = rows.filter((h) => h.classId === args.classId);
    if (args.section) rows = rows.filter((h) => h.section === args.section);
    if (args.subject) rows = rows.filter((h) => h.subject === args.subject);
    if (args.from) rows = rows.filter((h) => h.assignedDate >= args.from!);
    if (args.to) rows = rows.filter((h) => h.assignedDate <= args.to!);
    if (args.search) {
      const q = args.search.toLowerCase();
      rows = rows.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.subject.toLowerCase().includes(q),
      );
    }

    return rows
      .map((h) => ({
        ...h,
        className: classMap.get(h.classId)?.name ?? "—",
      }))
      .sort((a, b) => b.assignedDate.localeCompare(a.assignedDate))
      .slice(0, 500);
  },
});

/** Create a homework assignment. */
export const create = mutation({
  args: {
    classId: v.id("classes"),
    section: v.string(),
    subject: v.string(),
    title: v.string(),
    description: v.string(),
    assignedDate: v.string(),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");

    // Count active students in the class/section
    const students = await ctx.db
      .query("students")
      .withIndex("by_class_section", (q) => q.eq("classId", args.classId))
      .collect();
    const activeCount = students.filter(
      (s) => s.section === args.section && s.status === "active",
    ).length;

    const now = Date.now();
    const id = await ctx.db.insert("homework", {
      classId: args.classId,
      section: args.section,
      subject: args.subject,
      title: args.title,
      description: args.description,
      assignedDate: args.assignedDate,
      dueDate: args.dueDate,
      status: "assigned",
      totalStudents: activeCount,
      submittedCount: 0,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-create pending submissions for all active students
    for (const s of students) {
      if (s.section === args.section && s.status === "active") {
        await ctx.db.insert("homeworkSubmissions", {
          homeworkId: id,
          studentId: s._id,
          status: "pending",
          createdBy: user._id,
          createdAt: now,
        });
      }
    }

    return id;
  },
});

/** Update a homework assignment. */
export const update = mutation({
  args: {
    id: v.id("homework"),
    classId: v.id("classes"),
    section: v.string(),
    subject: v.string(),
    title: v.string(),
    description: v.string(),
    assignedDate: v.string(),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Homework not found.");

    await ctx.db.patch(args.id, {
      classId: args.classId,
      section: args.section,
      subject: args.subject,
      title: args.title,
      description: args.description,
      assignedDate: args.assignedDate,
      dueDate: args.dueDate,
      updatedAt: Date.now(),
    });
  },
});

/** Delete a homework assignment and its submissions. */
export const remove = mutation({
  args: { id: v.id("homework") },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Homework not found.");

    const subs = await ctx.db
      .query("homeworkSubmissions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", args.id))
      .collect();
    for (const sub of subs) {
      await ctx.db.delete(sub._id);
    }
    await ctx.db.delete(args.id);
  },
});

/** Update a single student's submission status. */
export const updateSubmission = mutation({
  args: {
    homeworkId: v.id("homework"),
    studentId: v.id("students"),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("late"),
      v.literal("absent"),
    ),
    marks: v.optional(v.number()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const existing = await ctx.db
      .query("homeworkSubmissions")
      .withIndex("by_homework_student", (q) =>
        q.eq("homeworkId", args.homeworkId).eq("studentId", args.studentId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        marks: args.marks,
        remarks: args.remarks,
        ...(args.status === "submitted"
          ? { submittedDate: new Date().toISOString().slice(0, 10) }
          : {}),
      });
    } else {
      await ctx.db.insert("homeworkSubmissions", {
        homeworkId: args.homeworkId,
        studentId: args.studentId,
        status: args.status,
        marks: args.marks,
        remarks: args.remarks,
        createdBy: user._id,
        createdAt: Date.now(),
      });
    }

    // Update submitted count on the homework record
    const allSubs = await ctx.db
      .query("homeworkSubmissions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", args.homeworkId))
      .collect();
    const submittedCount = allSubs.filter(
      (s) => s.status === "submitted" || s.status === "late",
    ).length;
    await ctx.db.patch(args.homeworkId, {
      submittedCount,
      status: submittedCount > 0 ? "collected" : "assigned",
      updatedAt: Date.now(),
    });
  },
});

/** Bulk mark all students as submitted for a homework. */
export const bulkMarkAllSubmitted = mutation({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const subs = await ctx.db
      .query("homeworkSubmissions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", args.homeworkId))
      .collect();
    const today = new Date().toISOString().slice(0, 10);
    for (const sub of subs) {
      if (sub.status === "pending") {
        await ctx.db.patch(sub._id, {
          status: "submitted",
          submittedDate: today,
        });
      }
    }
    await ctx.db.patch(args.homeworkId, {
      submittedCount: subs.length,
      status: "collected",
      updatedAt: Date.now(),
    });
  },
});

/** Dashboard stats for homework. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return null;
    const all = await ctx.db.query("homework").collect();
    const now = new Date().toISOString().slice(0, 10);
    return {
      total: all.length,
      assigned: all.filter((h) => h.status === "assigned").length,
      collected: all.filter((h) => h.status === "collected").length,
      reviewed: all.filter((h) => h.status === "reviewed").length,
      overdue: all.filter(
        (h) => h.status === "assigned" && h.dueDate < now,
      ).length,
      thisMonth: all.filter((h) => h.assignedDate.slice(0, 7) === now.slice(0, 7))
        .length,
    };
  },
});

/** Get submissions for a specific homework assignment. */
export const getSubmissions = query({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const subs = await ctx.db
      .query("homeworkSubmissions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", args.homeworkId))
      .collect();

    const students = await Promise.all(subs.map((s) => ctx.db.get(s.studentId)));
    const studentMap = new Map(
      students
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s]),
    );

    return subs.map((sub) => ({
      ...sub,
      studentName: studentMap.get(sub.studentId)?.name ?? "Unknown",
      rollNumber: studentMap.get(sub.studentId)?.rollNumber ?? "—",
    }));
  },
});
