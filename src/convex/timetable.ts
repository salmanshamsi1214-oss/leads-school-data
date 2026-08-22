import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Get the full timetable for a class/section. */
export const get = query({
  args: {
    classId: v.id("classes"),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const section = args.section.trim().toUpperCase();
    const entries = await ctx.db
      .query("timetable")
      .withIndex("by_class_section", (q) =>
        q.eq("classId", args.classId).eq("section", section),
      )
      .collect();

    const teachers = await ctx.db.query("teachers").collect();
    const teacherMap = new Map(teachers.map((t) => [t._id, t.name]));

    return entries.map((e) => ({
      ...e,
      teacherName: e.teacherId ? (teacherMap.get(e.teacherId) ?? "—") : "—",
    }));
  },
});

/** Get timetable grouped by teacher — shows each teacher's weekly schedule. */
export const byTeacher = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];

    const [entries, allTeachers, allClasses] = await Promise.all([
      ctx.db.query("timetable").collect(),
      ctx.db.query("teachers").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const teachers = allTeachers.filter((t) => t.status === "active");
    const classMap = new Map(allClasses.map((cls) => [cls._id, cls.name]));

    const teacherMap = new Map<string, { name: string; subject: string }>(
      teachers.map((teacher) => [
        teacher._id as string,
        { name: teacher.name, subject: teacher.subject ?? "—" },
      ]),
    );

    const byTeacher = new Map<
      string,
      Array<{
        day: string;
        period: number;
        subject: string;
        className: string;
        section: string;
        startTime: string;
        endTime: string;
      }>
    >();

    for (const entry of entries) {
      if (!entry.teacherId) continue;
      const tid = entry.teacherId;
      if (!byTeacher.has(tid)) byTeacher.set(tid, []);
      const row: {
        day: string;
        period: number;
        subject: string;
        className: string;
        section: string;
        startTime: string;
        endTime: string;
      } = {
        day: DAYS[entry.day] ?? `Day ${entry.day}`,
        period: entry.period,
        subject: entry.subject,
        className: classMap.get(entry.classId) ?? "—",
        section: entry.section,
        startTime: entry.startTime,
        endTime: entry.endTime,
      };
      byTeacher.get(tid)!.push(row);
    }

    return Array.from(byTeacher.entries()).map(([teacherId, schedule]) => ({
      teacherId,
      ...(teacherMap.get(teacherId) ?? { name: "—", subject: "—" }),
      schedule: schedule.sort((a, b) => {
        const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
        return dayDiff !== 0 ? dayDiff : a.period - b.period;
      }),
    }));
  },
});

/** Copy a timetable from one class/section to another. */
export const copy = mutation({
  args: {
    fromClassId: v.id("classes"),
    fromSection: v.string(),
    toClassId: v.id("classes"),
    toSection: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const fromSection = args.fromSection.trim().toUpperCase();
    const toSection = args.toSection.trim().toUpperCase();

    const sourceEntries = await ctx.db
      .query("timetable")
      .withIndex("by_class_section", (q) =>
        q.eq("classId", args.fromClassId).eq("section", fromSection),
      )
      .collect();

    if (sourceEntries.length === 0)
      throw new ConvexError("Source timetable is empty.");

    // Delete existing entries for the target
    const existing = await ctx.db
      .query("timetable")
      .withIndex("by_class_section", (q) =>
        q.eq("classId", args.toClassId).eq("section", toSection),
      )
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);

    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    for (const e of sourceEntries) {
      await ctx.db.insert("timetable", {
        classId: args.toClassId,
        section: toSection,
        day: e.day,
        period: e.period,
        subject: e.subject,
        teacherId: e.teacherId,
        startTime: e.startTime,
        endTime: e.endTime,
        createdBy: user._id,
        updatedAt: now,
      });
    }
    return sourceEntries.length;
  },
});

/** Save the full timetable for a class/section (replaces all periods). */
export const save = mutation({
  args: {
    classId: v.id("classes"),
    section: v.string(),
    entries: v.array(
      v.object({
        day: v.number(),
        period: v.number(),
        subject: v.string(),
        teacherId: v.optional(v.id("teachers")),
        startTime: v.string(),
        endTime: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const section = args.section.trim().toUpperCase();

    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");

    // Delete existing entries for this class/section
    const existing = await ctx.db
      .query("timetable")
      .withIndex("by_class_section", (q) =>
        q.eq("classId", args.classId).eq("section", section),
      )
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);

    // Insert new entries
    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    for (const entry of args.entries) {
      if (!entry.subject.trim()) continue;
      await ctx.db.insert("timetable", {
        classId: args.classId,
        section,
        day: entry.day,
        period: entry.period,
        subject: entry.subject.trim(),
        teacherId: entry.teacherId || undefined,
        startTime: entry.startTime,
        endTime: entry.endTime,
        createdBy: user._id,
        updatedAt: now,
      });
    }
    return args.entries.filter((e) => e.subject.trim()).length;
  },
});
