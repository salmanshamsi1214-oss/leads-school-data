import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

/** List all lesson plans, optionally filtered by class. */
export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    let plans = await ctx.db.query("lessonPlans").collect();
    if (args.classId) plans = plans.filter((p) => p.classId === args.classId);
    return plans.sort((a, b) => b.date.localeCompare(a.date));
  },
});

/** List lesson plans for a week (Mon-Fri) for a class/subject/teacher. */
export const weeklyPlans = query({
  args: {
    classId: v.optional(v.id("classes")),
    subject: v.optional(v.string()),
    weekStart: v.string(), // YYYY-MM-DD (Monday)
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const startDate = new Date(args.weekStart);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    // Fetch all plans for the week
    const allPlans = await Promise.all(
      dates.map(async (date) => {
        let q = ctx.db.query("lessonPlans").withIndex("by_date", (q) => q.eq("date", date));
        let plans = await q.collect();
        if (args.classId) plans = plans.filter((p) => p.classId === args.classId);
        if (args.subject) plans = plans.filter((p) => p.subject === args.subject);
        return plans;
      })
    );

    // Enrich with class names
    const classes = await ctx.db.query("classes").collect();
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    const enriched = allPlans.flat().map((p) => ({
      ...p,
      className: classMap.get(p.classId) ?? "—",
    }));

    // Group by date
    return dates.map((date) => ({
      date,
      day: new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }),
      plans: enriched.filter((p) => p.date === date).sort((a, b) => (a.periodNo ?? 0) - (b.periodNo ?? 0)),
    }));
  },
});

/** Dashboard stats for lesson planning. */
export const stats = query({
  args: {
    classId: v.optional(v.id("classes")),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    let plans = await ctx.db.query("lessonPlans").collect();
    if (args.classId) plans = plans.filter((p) => p.classId === args.classId);
    if (args.subject) plans = plans.filter((p) => p.subject === args.subject);

    const now = new Date().toISOString().slice(0, 10);

    const totalPlanned = plans.length;
    const completedLessons = plans.filter((p) => p.lessonCompleted).length;
    const pendingLessons = plans.filter((p) => p.date <= now && !p.lessonCompleted).length;
    const homeworkAssigned = plans.filter((p) => p.homework && p.homework.trim()).length;
    const needsFollowUp = plans.filter((p) => p.reflectionFollowUp && p.reflectionFollowUp.trim() && !p.lessonCompleted).length;

    return {
      totalPlanned,
      completedLessons,
      pendingLessons,
      completionPct: totalPlanned > 0 ? Math.round((completedLessons / totalPlanned) * 100) : 0,
      homeworkAssigned,
      needsFollowUp,
    };
  },
});

/** Create a lesson plan. */
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
    periodNo: v.optional(v.number()),
    lessonChapter: v.optional(v.string()),
    previousKnowledge: v.optional(v.string()),
    introduction: v.optional(v.string()),
    teachingMethod: v.optional(v.string()),
    explanation: v.optional(v.string()),
    classActivity: v.optional(v.string()),
    groupActivity: v.optional(v.string()),
    studentPractice: v.optional(v.string()),
    questionAnswer: v.optional(v.string()),
    assessmentMethod: v.optional(v.string()),
    homework: v.optional(v.string()),
    differentiatedLearning: v.optional(v.string()),
    extensionActivity: v.optional(v.string()),
    timingStarter: v.optional(v.number()),
    timingPresentation: v.optional(v.number()),
    timingPractice: v.optional(v.number()),
    timingAssessment: v.optional(v.number()),
    timingHomework: v.optional(v.number()),
    status: v.optional(v.union(v.literal("planned"), v.literal("taught"), v.literal("revised"))),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const now = Date.now();

    return await ctx.db.insert("lessonPlans", {
      ...args,
      status: args.status ?? "planned",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update a lesson plan. */
export const update = mutation({
  args: {
    id: v.id("lessonPlans"),
    topic: v.string(),
    objectives: v.string(),
    activities: v.optional(v.string()),
    resources: v.optional(v.string()),
    periodNo: v.optional(v.number()),
    lessonChapter: v.optional(v.string()),
    previousKnowledge: v.optional(v.string()),
    introduction: v.optional(v.string()),
    teachingMethod: v.optional(v.string()),
    explanation: v.optional(v.string()),
    classActivity: v.optional(v.string()),
    groupActivity: v.optional(v.string()),
    studentPractice: v.optional(v.string()),
    questionAnswer: v.optional(v.string()),
    assessmentMethod: v.optional(v.string()),
    homework: v.optional(v.string()),
    differentiatedLearning: v.optional(v.string()),
    extensionActivity: v.optional(v.string()),
    timingStarter: v.optional(v.number()),
    timingPresentation: v.optional(v.number()),
    timingPractice: v.optional(v.number()),
    timingAssessment: v.optional(v.number()),
    timingHomework: v.optional(v.number()),
    reflectionWhatWentWell: v.optional(v.string()),
    reflectionUnderstanding: v.optional(v.string()),
    reflectionNeedSupport: v.optional(v.string()),
    reflectionDifficulties: v.optional(v.string()),
    reflectionFollowUp: v.optional(v.string()),
    lessonCompleted: v.optional(v.boolean()),
    coordinatorRemarks: v.optional(v.string()),
    principalRemarks: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("taught"), v.literal("revised")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/** Delete a lesson plan. */
export const remove = mutation({
  args: { id: v.id("lessonPlans") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.id);
  },
});
