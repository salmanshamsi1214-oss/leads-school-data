import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("new"), v.literal("contacted"), v.literal("follow_up"),
      v.literal("enrolled"), v.literal("closed"),
    )),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    let rows = await ctx.db.query("inquiries").collect();
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const create = mutation({
  args: {
    studentName: v.string(),
    fatherName: v.optional(v.string()),
    phone: v.string(),
    classInterested: v.optional(v.string()),
    source: v.union(
      v.literal("walk_in"), v.literal("phone"), v.literal("whatsapp"),
      v.literal("referral"), v.literal("social_media"), v.literal("other"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const name = args.studentName.trim();
    if (!name) throw new ConvexError("Student name is required.");
    const phone = args.phone.trim();
    if (!phone) throw new ConvexError("Phone number is required.");
    const now = Date.now();
    return await ctx.db.insert("inquiries", {
      studentName: name,
      fatherName: args.fatherName?.trim() || undefined,
      phone,
      classInterested: args.classInterested?.trim() || undefined,
      source: args.source,
      status: "new",
      notes: args.notes?.trim() || undefined,
      createdBy: (await requireSchoolUser(ctx))._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("inquiries"),
    studentName: v.string(),
    fatherName: v.optional(v.string()),
    phone: v.string(),
    classInterested: v.optional(v.string()),
    source: v.union(
      v.literal("walk_in"), v.literal("phone"), v.literal("whatsapp"),
      v.literal("referral"), v.literal("social_media"), v.literal("other"),
    ),
    status: v.union(
      v.literal("new"), v.literal("contacted"), v.literal("follow_up"),
      v.literal("enrolled"), v.literal("closed"),
    ),
    nextFollowUp: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Inquiry not found.");
    await ctx.db.patch(args.id, {
      studentName: args.studentName.trim(),
      fatherName: args.fatherName?.trim() || undefined,
      phone: args.phone.trim(),
      classInterested: args.classInterested?.trim() || undefined,
      source: args.source,
      status: args.status,
      nextFollowUp: args.nextFollowUp || undefined,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("inquiries") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Inquiry not found.");
    await ctx.db.delete(args.id);
  },
});
