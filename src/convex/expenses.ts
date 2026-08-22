import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isSchoolUser } from "./permissions";

const EXPENSE_CATEGORIES = [
  "salary",
  "utilities",
  "maintenance",
  "supplies",
  "transport",
  "events",
  "technology",
  "other",
] as const;

/** List expenses, optionally filtered by category or date range. */
export const list = query({
  args: {
    category: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const allExpenses = await ctx.db.query("expenses").collect();
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "Staff"]));

    const from = args.from ?? "";
    const to = args.to ?? "9999";
    let filtered = allExpenses;
    if (args.category) {
      filtered = filtered.filter((e) => e.category === args.category);
    }
    if (from) {
      filtered = filtered.filter((e) => e.date >= from);
    }
    if (to) {
      filtered = filtered.filter((e) => e.date <= to);
    }

    return filtered
      .map((e) => ({
        ...e,
        createdByName: userMap.get(e.createdBy) ?? "Staff",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

/** Create an expense. */
export const create = mutation({
  args: {
    title: v.string(),
    amount: v.number(),
    category: v.union(
      v.literal("salary"),
      v.literal("utilities"),
      v.literal("maintenance"),
      v.literal("supplies"),
      v.literal("transport"),
      v.literal("events"),
      v.literal("technology"),
      v.literal("other"),
    ),
    date: v.string(),
    paidMethod: v.union(
      v.literal("cash"),
      v.literal("bank"),
      v.literal("easypaisa"),
      v.literal("jazzcash"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      throw new ConvexError("Not authorized.");

    const title = args.title.trim();
    if (!title) throw new ConvexError("Title is required.");
    if (!Number.isFinite(args.amount) || args.amount <= 0)
      throw new ConvexError("Amount must be positive.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date))
      throw new ConvexError("Date must be in YYYY-MM-DD format.");

    const user = (await ctx.auth.getUserIdentity()) as unknown as { _id: string };
    return ctx.db.insert("expenses", {
      title,
      amount: args.amount,
      category: args.category,
      date: args.date,
      paidMethod: args.paidMethod,
      notes: args.notes,
      createdBy: user._id as never,
      createdAt: Date.now(),
    });
  },
});

/** Delete an expense. */
export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.id);
  },
});

/** Expense summary by category for a date range. */
export const summary = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      return { total: 0, byCategory: [] as { category: string; total: number }[] };

    let expenses = await ctx.db.query("expenses").collect();
    const from = args.from ?? "";
    const to = args.to ?? "9999";
    expenses = expenses.filter((e) => e.date >= from && e.date <= to);

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const catMap = new Map<string, number>();
    for (const e of expenses) {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    }

    return {
      total,
      byCategory: EXPENSE_CATEGORIES
        .map((cat) => ({
          category: cat,
          total: catMap.get(cat) ?? 0,
        }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    };
  },
});
