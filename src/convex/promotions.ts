import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

/** List promotions for a session. */
export const list = query({
  args: {
    session: v.optional(v.string()),
    fromClassId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [promos, students, classes] = await Promise.all([
      ctx.db.query("studentPromotions").collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c]));
    const studentMap = new Map(students.map((s) => [s._id, s]));

    let rows = promos;
    if (args.session) rows = rows.filter((p) => p.session === args.session);
    if (args.fromClassId)
      rows = rows.filter((p) => p.fromClassId === args.fromClassId);

    return rows
      .map((p) => ({
        ...p,
        studentName: studentMap.get(p.studentId)?.name ?? "—",
        fromClassName: classMap.get(p.fromClassId)?.name ?? "—",
        toClassName: classMap.get(p.toClassId)?.name ?? "—",
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Bulk promote students to next class. */
export const bulkPromote = mutation({
  args: {
    studentIds: v.array(v.id("students")),
    toClassId: v.id("classes"),
    toSection: v.string(),
    session: v.string(),
    carryFees: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const toClass = await ctx.db.get(args.toClassId);
    if (!toClass) throw new ConvexError("Target class not found.");

    const now = Date.now();
    let promoted = 0;

    for (const studentId of args.studentIds) {
      const student = await ctx.db.get(studentId);
      if (!student || student.status !== "active") continue;

      // Record the promotion
      await ctx.db.insert("studentPromotions", {
        studentId,
        fromClassId: student.classId,
        fromSection: student.section,
        toClassId: args.toClassId,
        toSection: args.toSection,
        session: args.session,
        reason: args.reason,
        carryFees: args.carryFees,
        createdBy: user._id,
        createdAt: now,
      });

      // Update student's class and section
      await ctx.db.patch(studentId, {
        classId: args.toClassId,
        section: args.toSection,
      });
      promoted++;
    }
    return promoted;
  },
});

/** Get promotion summary stats for a session. */
export const stats = query({
  args: { session: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    const promos = await ctx.db
      .query("studentPromotions")
      .collect();
    const sessionPromos = promos.filter((p) => p.session === args.session);

    return {
      total: sessionPromos.length,
      withFeeCarry: sessionPromos.filter((p) => p.carryFees).length,
      withoutFeeCarry: sessionPromos.filter((p) => !p.carryFees).length,
    };
  },
});
