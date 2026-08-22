import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** List activities, optionally filtered. */
export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("upcoming"), v.literal("ongoing"), v.literal("completed"), v.literal("cancelled"),
    )),
    from: v.optional(v.string()), // YYYY-MM-DD
    to: v.optional(v.string()), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const classes = await ctx.db.query("classes").collect();
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    let rows = await ctx.db.query("activities").collect();
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.from) { const f = args.from; rows = rows.filter((r) => r.date >= f); }
    if (args.to) { const t = args.to; rows = rows.filter((r) => r.date <= t); }

    return rows.map((r) => ({
      ...r,
      classNames: r.classIds?.map((id) => classMap.get(id) ?? "—").join(", ") || "All Classes",
    })).sort((a, b) => a.date.localeCompare(b.date));
  },
});

/** Get a single activity with participants. */
export const get = query({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    const activity = await ctx.db.get(args.id);
    if (!activity) return null;

    const participants = await ctx.db
      .query("activityParticipants")
      .withIndex("by_activity", (q) => q.eq("activityId", args.id))
      .collect();
    const students = await ctx.db.query("students").collect();
    const studentMap = new Map(students.map((s) => [s._id, s]));

    return {
      ...activity,
      participants: participants.map((p) => ({
        ...p,
        studentName: studentMap.get(p.studentId)?.name ?? "—",
        rollNumber: studentMap.get(p.studentId)?.rollNumber ?? "—",
      })),
    };
  },
});

/** Create an activity. */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("sports"), v.literal("cultural"), v.literal("academic"),
      v.literal("competition"), v.literal("workshop"), v.literal("field_trip"),
      v.literal("assembly"), v.literal("other"),
    ),
    date: v.string(),
    endDate: v.optional(v.string()),
    classIds: v.optional(v.array(v.id("classes"))),
    location: v.optional(v.string()),
    organizer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const title = args.title.trim();
    if (!title) throw new ConvexError("Activity title is required.");
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");

    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("activities", {
      title,
      description: args.description?.trim() || undefined,
      type: args.type,
      date: args.date,
      endDate: args.endDate || undefined,
      classIds: args.classIds && args.classIds.length > 0 ? args.classIds : undefined,
      location: args.location?.trim() || undefined,
      organizer: args.organizer?.trim() || undefined,
      status: "upcoming",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an activity. */
export const update = mutation({
  args: {
    id: v.id("activities"),
    title: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("sports"), v.literal("cultural"), v.literal("academic"),
      v.literal("competition"), v.literal("workshop"), v.literal("field_trip"),
      v.literal("assembly"), v.literal("other"),
    ),
    date: v.string(),
    endDate: v.optional(v.string()),
    classIds: v.optional(v.array(v.id("classes"))),
    location: v.optional(v.string()),
    organizer: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("ongoing"), v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Activity not found.");
    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      type: args.type,
      date: args.date,
      endDate: args.endDate || undefined,
      classIds: args.classIds && args.classIds.length > 0 ? args.classIds : undefined,
      location: args.location?.trim() || undefined,
      organizer: args.organizer?.trim() || undefined,
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/** Update status only. */
export const updateStatus = mutation({
  args: {
    id: v.id("activities"),
    status: v.union(v.literal("upcoming"), v.literal("ongoing"), v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
  },
});

/** Remove an activity and its participants. */
export const remove = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const participants = await ctx.db
      .query("activityParticipants")
      .withIndex("by_activity", (q) => q.eq("activityId", args.id))
      .collect();
    for (const p of participants) await ctx.db.delete(p._id);
    await ctx.db.delete(args.id);
  },
});

/** Add participants to an activity. */
export const addParticipants = mutation({
  args: {
    activityId: v.id("activities"),
    entries: v.array(v.object({
      studentId: v.id("students"),
      role: v.optional(v.string()),
      result: v.optional(v.string()),
      remarks: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.activityId);
    if (!existing) throw new ConvexError("Activity not found.");

    for (const entry of args.entries) {
      // Upsert: check if already added
      const existing = await ctx.db
        .query("activityParticipants")
        .withIndex("by_activity", (q) => q.eq("activityId", args.activityId))
        .collect();
      const duplicate = existing.find((p) => p.studentId === entry.studentId);
      if (duplicate) {
        await ctx.db.patch(duplicate._id, {
          role: entry.role?.trim() || duplicate.role,
          result: entry.result?.trim() || duplicate.result,
          remarks: entry.remarks?.trim() || duplicate.remarks,
        });
      } else {
        await ctx.db.insert("activityParticipants", {
          activityId: args.activityId,
          studentId: entry.studentId,
          role: entry.role?.trim() || undefined,
          result: entry.result?.trim() || undefined,
          remarks: entry.remarks?.trim() || undefined,
        });
      }
    }
    return args.entries.length;
  },
});

/** Remove a participant from an activity. */
export const removeParticipant = mutation({
  args: { id: v.id("activityParticipants") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.id);
  },
});
