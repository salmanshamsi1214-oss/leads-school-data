import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireOfficeUser } from "./permissions";

export const NOTICE_CATEGORIES = [
  "general",
  "exam",
  "event",
  "fee",
  "holiday",
  "emergency",
] as const;
export const noticeCategoryValidator = v.union(
  v.literal("general"),
  v.literal("exam"),
  v.literal("event"),
  v.literal("fee"),
  v.literal("holiday"),
  v.literal("emergency"),
);

/**
 * All notices, newest published first. Pinned notices float to the top of
 * their date group. Visible to every school staff member (teachers included)
 * so the board doubles as the daily staff communication channel.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    const notices = await ctx.db.query("notices").collect();
    if (notices.length === 0) return [];
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(
      users.map((u) => [u._id, u.name ?? u.email ?? "School office"]),
    );
    const rows = notices.map((notice) => ({
      ...notice,
      createdByName: userMap.get(notice.createdBy) ?? "School office",
    }));
    rows.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.publishDate.localeCompare(a.publishDate) ||
        b.createdAt - a.createdAt,
    );
    return rows;
  },
});

const noticeArgs = {
  title: v.string(),
  body: v.string(),
  category: noticeCategoryValidator,
  pinned: v.boolean(),
  publishDate: v.string(),
};

/** Posts a new notice to the board. Office staff only. */
export const create = mutation({
  args: noticeArgs,
  handler: async (ctx, args) => {
    const user = await requireOfficeUser(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length === 0) {
      throw new ConvexError("Give the notice a title.");
    }
    if (body.length === 0) {
      throw new ConvexError("Write the notice text.");
    }
    if (!args.publishDate) {
      throw new ConvexError("Choose a publish date.");
    }
    const now = Date.now();
    return await ctx.db.insert("notices", {
      title,
      body,
      category: args.category,
      pinned: args.pinned,
      publishDate: args.publishDate,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Edits an existing notice. Office staff only. */
export const update = mutation({
  args: { id: v.id("notices"), ...noticeArgs },
  handler: async (ctx, args) => {
    await requireOfficeUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Notice not found.");
    }
    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length === 0) {
      throw new ConvexError("Give the notice a title.");
    }
    if (body.length === 0) {
      throw new ConvexError("Write the notice text.");
    }
    await ctx.db.patch(args.id, {
      title,
      body,
      category: args.category,
      pinned: args.pinned,
      publishDate: args.publishDate,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

/** Removes a notice from the board. Office staff only. */
export const remove = mutation({
  args: { id: v.id("notices") },
  handler: async (ctx, args) => {
    await requireOfficeUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Notice not found.");
    }
    await ctx.db.delete(args.id);
  },
});
