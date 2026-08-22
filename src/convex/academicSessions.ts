import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

/** List all academic sessions. */
export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    return ctx.db.query("academicSessions").collect();
  },
});

/** List terms for a session. */
export const listTerms = query({
  args: { sessionId: v.id("academicSessions") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    return ctx.db
      .query("academicTerms")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

/** Create a new academic session. */
export const createSession = mutation({
  args: {
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    const id = await ctx.db.insert("academicSessions", {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "upcoming",
      createdBy: user._id,
      createdAt: Date.now(),
    });

    // Auto-create 3 terms
    const termNames: Array<{
      name: string;
      term: "1st_term" | "2nd_term" | "final_term";
    }> = [
      { name: "1st Term", term: "1st_term" },
      { name: "2nd Term", term: "2nd_term" },
      { name: "Final Term", term: "final_term" },
    ];
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    const thirdDays = Math.floor(totalDays / 3);

    for (let i = 0; i < 3; i++) {
      const termStart = new Date(start);
      termStart.setDate(termStart.getDate() + i * thirdDays);
      const termEnd = new Date(start);
      termEnd.setDate(
        termEnd.getDate() + (i === 2 ? totalDays : (i + 1) * thirdDays),
      );
      await ctx.db.insert("academicTerms", {
        sessionId: id,
        name: termNames[i].name,
        term: termNames[i].term,
        startDate: termStart.toISOString().slice(0, 10),
        endDate: termEnd.toISOString().slice(0, 10),
        status: i === 0 ? "active" : "upcoming",
        createdBy: user._id,
        createdAt: Date.now(),
      });
    }
    return id;
  },
});

/** Update session status. */
export const updateSessionStatus = mutation({
  args: {
    id: v.id("academicSessions"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Update term status. */
export const updateTermStatus = mutation({
  args: {
    id: v.id("academicTerms"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Delete a session and its terms. */
export const removeSession = mutation({
  args: { id: v.id("academicSessions") },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    const terms = await ctx.db
      .query("academicTerms")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const t of terms) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(args.id);
  },
});
