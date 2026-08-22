import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

/** List syllabus entries filtered by class, subject, term. */
export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    subject: v.optional(v.string()),
    term: v.optional(v.union(v.literal("1st_term"), v.literal("2nd_term"), v.literal("final_term"))),
    status: v.optional(v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    let q = ctx.db.query("syllabus");

    let results = await q.collect();

    if (args.subject) {
      results = results.filter((s) => s.subject === args.subject);
    }
    if (args.term) {
      results = results.filter((s) => s.term === args.term);
    }
    if (args.status) {
      results = results.filter((s) => s.status === args.status);
    }

    // Enrich with class names
    const classes = await ctx.db.query("classes").collect();
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    return results.map((s) => ({
      ...s,
      className: classMap.get(s.classId) ?? "—",
      completionPct: s.totalLessons > 0 ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0,
    })).sort((a, b) => a.chapterNo.localeCompare(b.chapterNo, undefined, { numeric: true }));
  },
});

/** Progress stats for a class/subject/term. */
export const progressStats = query({
  args: {
    classId: v.id("classes"),
    subject: v.string(),
    term: v.union(v.literal("1st_term"), v.literal("2nd_term"), v.literal("final_term")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const entries = await ctx.db
      .query("syllabus")
      .collect();

    const termEntries = entries.filter((e) => e.classId === args.classId && e.subject === args.subject && e.term === args.term);

    const totalChapters = termEntries.length;
    const completedChapters = termEntries.filter((e) => e.status === "completed").length;
    const inProgressChapters = termEntries.filter((e) => e.status === "in_progress").length;
    const totalLessons = termEntries.reduce((s, e) => s + e.totalLessons, 0);
    const completedLessons = termEntries.reduce((s, e) => s + e.completedLessons, 0);

    return {
      totalChapters,
      completedChapters,
      inProgressChapters,
      notStartedChapters: totalChapters - completedChapters - inProgressChapters,
      totalLessons,
      completedLessons,
      completionPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    };
  },
});

/** Create a syllabus entry. */
export const create = mutation({
  args: {
    classId: v.id("classes"),
    section: v.string(),
    subject: v.string(),
    term: v.union(v.literal("1st_term"), v.literal("2nd_term"), v.literal("final_term")),
    bookName: v.optional(v.string()),
    chapterNo: v.string(),
    chapterName: v.string(),
    topics: v.string(),
    subTopics: v.optional(v.string()),
    pagesFrom: v.optional(v.number()),
    pagesTo: v.optional(v.number()),
    syllabusType: v.union(v.literal("written"), v.literal("oral"), v.literal("practical")),
    learningObjectives: v.optional(v.string()),
    writtenWork: v.optional(v.string()),
    oralWork: v.optional(v.string()),
    practicalWork: v.optional(v.string()),
    homework: v.optional(v.string()),
    classActivity: v.optional(v.string()),
    assessment: v.optional(v.string()),
    teachingAids: v.optional(v.string()),
    totalLessons: v.number(),
    completedLessons: v.optional(v.number()),
    startDate: v.optional(v.string()),
    expectedEndDate: v.optional(v.string()),
    status: v.optional(v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const now = Date.now();

    return await ctx.db.insert("syllabus", {
      ...args,
      completedLessons: args.completedLessons ?? 0,
      status: args.status ?? "not_started",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update a syllabus entry. */
export const update = mutation({
  args: {
    id: v.id("syllabus"),
    chapterName: v.string(),
    topics: v.string(),
    subTopics: v.optional(v.string()),
    pagesFrom: v.optional(v.number()),
    pagesTo: v.optional(v.number()),
    totalLessons: v.number(),
    completedLessons: v.number(),
    status: v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed")),
    startDate: v.optional(v.string()),
    expectedEndDate: v.optional(v.string()),
    actualEndDate: v.optional(v.string()),
    revisionRequired: v.optional(v.boolean()),
    revisionCompleted: v.optional(v.boolean()),
    testTaken: v.optional(v.boolean()),
    weakAreas: v.optional(v.string()),
    additionalPractice: v.optional(v.string()),
    teacherRemarks: v.optional(v.string()),
    coordinatorRemarks: v.optional(v.string()),
    principalRemarks: v.optional(v.string()),
    writtenWork: v.optional(v.string()),
    oralWork: v.optional(v.string()),
    practicalWork: v.optional(v.string()),
    homework: v.optional(v.string()),
    classActivity: v.optional(v.string()),
    assessment: v.optional(v.string()),
    teachingAids: v.optional(v.string()),
    learningObjectives: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/** Delete a syllabus entry. */
export const remove = mutation({
  args: { id: v.id("syllabus") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.id);
  },
});
