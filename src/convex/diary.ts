import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validateDate = (date: string, field = "Date") => {
  if (!DATE_RE.test(date)) {
    throw new ConvexError(`${field} must be in YYYY-MM-DD format.`);
  }
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ConvexError(`${field} is not a valid calendar date.`);
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ConvexError(`${field} is not a valid calendar date.`);
  }
};

const requireSection = (section: string) => {
  const trimmed = section.trim();
  if (trimmed === "") {
    throw new ConvexError("Section is required.");
  }
  return trimmed;
};

const getClassName = async (ctx: QueryCtx, classId: Id<"classes">) => {
  const cls = await ctx.db.get(classId);
  return cls?.name ?? "—";
};

/**
 * Loads daily diary entries with class names. Filters by date range and
 * optional class/section. Returns newest first.
 */
/** Get daily diary for a specific class/section/date — used by Teacher view. */
export const dailyForClass = query({
  args: {
    classId: v.id("classes"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    const all = await ctx.db
      .query("dailyDiary")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    return all.find((e) => e.classId === args.classId) ?? null;
  },
});

/** Get weekly diary for a specific class — used by Teacher view. */
export const weeklyForClass = query({
  args: {
    classId: v.id("classes"),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    return ctx.db
      .query("weeklyDiary")
      .withIndex("by_class_section_week", (q) => q.eq("classId", args.classId))
      .order("desc")
      .take(5);
  },
});

export const dailyList = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const from = args.from ?? "0000-01-01";
    const to = args.to ?? "9999-12-31";
    const records = await ctx.db
      .query("dailyDiary")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .collect();

    const filtered = records.filter(
      (record) =>
        (args.classId === undefined || record.classId === args.classId) &&
        (args.section === undefined || args.section === "" || record.section === args.section),
    );
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    return Promise.all(
      filtered.map(async (record) => ({
        ...record,
        className: await getClassName(ctx, record.classId),
      })),
    );
  },
});

/** Saves (creates or updates) a daily diary entry. One per class/section/date. */
export const dailySave = mutation({
  args: {
    id: v.optional(v.id("dailyDiary")),
    classId: v.id("classes"),
    section: v.string(),
    date: v.string(),
    summary: v.string(),
    homework: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    validateDate(args.date);
    const section = requireSection(args.section);
    const summary = args.summary.trim();
    if (summary === "") {
      throw new ConvexError("Please describe the day's work.");
    }
    const homework = args.homework?.trim() || undefined;
    const cls = await ctx.db.get(args.classId);
    if (cls === null) {
      throw new ConvexError("Class not found.");
    }

    if (args.id !== undefined) {
      const existing = await ctx.db.get(args.id);
      if (existing === null) {
        throw new ConvexError("Diary entry not found.");
      }
      await ctx.db.patch(args.id, {
        classId: args.classId,
        section,
        date: args.date,
        summary,
        homework,
        createdBy: user._id,
        updatedAt: Date.now(),
      });
      return args.id;
    }

    const existing = await ctx.db
      .query("dailyDiary")
      .withIndex("by_class_section_date", (q) =>
        q.eq("classId", args.classId).eq("section", section).eq("date", args.date),
      )
      .first();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        summary,
        homework,
        createdBy: user._id,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("dailyDiary", {
      classId: args.classId,
      section,
      date: args.date,
      summary,
      homework,
      createdBy: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const dailyRemove = mutation({
  args: { id: v.id("dailyDiary") },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Diary entry not found.");
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * Loads weekly diary entries with class names. Filters by week-start range and
 * optional class/section. Returns newest first.
 */
export const weeklyList = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const from = args.from ?? "0000-01-01";
    const to = args.to ?? "9999-12-31";
    const records = await ctx.db
      .query("weeklyDiary")
      .withIndex("by_week", (q) => q.gte("weekStart", from).lte("weekStart", to))
      .collect();

    const filtered = records.filter(
      (record) =>
        (args.classId === undefined || record.classId === args.classId) &&
        (args.section === undefined || args.section === "" || record.section === args.section),
    );
    filtered.sort((a, b) => b.weekStart.localeCompare(a.weekStart));

    return Promise.all(
      filtered.map(async (record) => ({
        ...record,
        className: await getClassName(ctx, record.classId),
      })),
    );
  },
});

/**
 * Saves (creates or updates) a weekly diary entry. One per class/section/week.
 * The page is organized per subject: each entry has a subject name and the
 * work assigned for the week.
 */
export const weeklySave = mutation({
  args: {
    id: v.optional(v.id("weeklyDiary")),
    classId: v.id("classes"),
    section: v.string(),
    weekStart: v.string(),
    weekEnd: v.string(),
    entries: v.array(
      v.object({ subject: v.string(), work: v.string() }),
    ),
    summary: v.optional(v.string()),
    nextWeek: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    validateDate(args.weekStart, "Week start");
    validateDate(args.weekEnd, "Week end");
    if (args.weekEnd < args.weekStart) {
      throw new ConvexError("Week end cannot be before week start.");
    }
    const section = requireSection(args.section);
    const entries = args.entries
      .map((entry) => ({
        subject: entry.subject.trim(),
        work: entry.work.trim(),
      }))
      .filter((entry) => entry.subject !== "" && entry.work !== "");
    if (entries.length === 0) {
      throw new ConvexError("Add at least one subject with work assigned.");
    }
    const summary = args.summary?.trim() || undefined;
    const nextWeek = args.nextWeek?.trim() || undefined;
    const cls = await ctx.db.get(args.classId);
    if (cls === null) {
      throw new ConvexError("Class not found.");
    }

    if (args.id !== undefined) {
      const existing = await ctx.db.get(args.id);
      if (existing === null) {
        throw new ConvexError("Diary entry not found.");
      }
      await ctx.db.patch(args.id, {
        classId: args.classId,
        section,
        weekStart: args.weekStart,
        weekEnd: args.weekEnd,
        entries,
        summary,
        nextWeek,
        createdBy: user._id,
        updatedAt: Date.now(),
      });
      return args.id;
    }

    const existing = await ctx.db
      .query("weeklyDiary")
      .withIndex("by_class_section_week", (q) =>
        q
          .eq("classId", args.classId)
          .eq("section", section)
          .eq("weekStart", args.weekStart),
      )
      .first();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        weekEnd: args.weekEnd,
        entries,
        summary,
        nextWeek,
        createdBy: user._id,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("weeklyDiary", {
      classId: args.classId,
      section,
      weekStart: args.weekStart,
      weekEnd: args.weekEnd,
      entries,
      summary,
      nextWeek,
      createdBy: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const weeklyRemove = mutation({
  args: { id: v.id("weeklyDiary") },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Diary entry not found.");
    }
    await ctx.db.delete(args.id);
  },
});
