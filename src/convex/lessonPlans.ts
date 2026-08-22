import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    date: v.optional(v.string()),
    myOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) return [];
    const userId = currentUser._id;

    // Check if user is a teacher — if so, they only see their own plans
    const user = await ctx.db.get(userId);
    const isTeacher = user?.role === "teacher";
    if (isTeacher) args.myOnly = true;

    let rows = await ctx.db.query("lessonPlans").collect();
    if (args.classId) rows = rows.filter((r) => r.classId === args.classId);
    if (args.section) { const s = args.section.trim().toUpperCase(); rows = rows.filter((r) => r.section === s); }
    if (args.date) rows = rows.filter((r) => r.date === args.date);
    if (args.myOnly) rows = rows.filter((r) => r.createdBy === userId);

    const [classes, users] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("users").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "Staff"]));

    return rows.map((r) => ({
      ...r,
      className: classMap.get(r.classId) ?? "—",
      createdByName: userMap.get(r.createdBy) ?? "Staff",
    })).sort((a, b) => a.date.localeCompare(b.date));
  },
});

export const create = mutation({
  args: {
    classId: v.id("classes"),
    section: v.string(),
    subject: v.string(),
    topic: v.string(),
    objectives: v.string(),
    activities: v.optional(v.string()),
    resources: v.optional(v.string()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) throw new ConvexError("Not authorized.");
    const userId = currentUser._id;

    const topic = args.topic.trim();
    if (!topic) throw new ConvexError("Topic is required.");
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");

    const section = args.section.trim().toUpperCase();
    const now = Date.now();
    return await ctx.db.insert("lessonPlans", {
      classId: args.classId,
      section,
      subject: args.subject.trim(),
      topic,
      objectives: args.objectives.trim(),
      activities: args.activities?.trim() || undefined,
      resources: args.resources?.trim() || undefined,
      date: args.date,
      status: "planned",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("lessonPlans"),
    classId: v.id("classes"),
    section: v.string(),
    subject: v.string(),
    topic: v.string(),
    objectives: v.string(),
    activities: v.optional(v.string()),
    resources: v.optional(v.string()),
    date: v.string(),
    status: v.union(v.literal("planned"), v.literal("taught"), v.literal("revised")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Lesson plan not found.");

    await ctx.db.patch(args.id, {
      classId: args.classId,
      section: args.section.trim().toUpperCase(),
      subject: args.subject.trim(),
      topic: args.topic.trim(),
      objectives: args.objectives.trim(),
      activities: args.activities?.trim() || undefined,
      resources: args.resources?.trim() || undefined,
      date: args.date,
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("lessonPlans") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Lesson plan not found.");
    await ctx.db.delete(args.id);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("lessonPlans"),
    status: v.union(v.literal("planned"), v.literal("taught"), v.literal("revised")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser) throw new ConvexError("Not authorized.");
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
  },
});
