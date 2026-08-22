import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser } from "./permissions";

/** List payroll records for a given month, or all months. */
export const list = query({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const [records, teachers, users] = await Promise.all([
      args.month
        ? ctx.db
            .query("payrollRecords")
            .withIndex("by_month", (q) => q.eq("month", args.month!))
            .collect()
        : ctx.db.query("payrollRecords").collect(),
      ctx.db.query("teachers").collect(),
      ctx.db.query("users").collect(),
    ]);

    const teacherMap = new Map(
      teachers.map((t) => [t._id, { name: t.name, subject: t.subject ?? "—", salary: t.salary ?? 0 }]),
    );
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "Staff"]));

    return records
      .map((r) => ({
        ...r,
        teacherName: teacherMap.get(r.teacherId)?.name ?? "—",
        teacherSubject: teacherMap.get(r.teacherId)?.subject ?? "—",
        baseSalary: teacherMap.get(r.teacherId)?.salary ?? r.baseSalary,
        createdByName: userMap.get(r.createdBy) ?? "Staff",
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Generate payroll for all active teachers for a given month. */
export const generate = mutation({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      throw new ConvexError("Not authorized.");

    if (!/^\d{4}-\d{2}$/.test(args.month))
      throw new ConvexError("Month must be in YYYY-MM format.");

    // Check if already generated
    const existing = await ctx.db
      .query("payrollRecords")
      .withIndex("by_month", (q) => q.eq("month", args.month))
      .collect();
    if (existing.length > 0)
      throw new ConvexError(`Payroll for ${args.month} already exists (${existing.length} records).`);

    const teachers = await ctx.db
      .query("teachers")
      .collect()
      .then((list) => list.filter((t) => t.status === "active"));

    if (teachers.length === 0)
      throw new ConvexError("No active teachers found.");

    const user = (await ctx.auth.getUserIdentity()) as unknown as { _id: string };
    const now = Date.now();
    let count = 0;

    for (const teacher of teachers) {
      const salary = teacher.salary ?? 0;
      if (salary <= 0) continue;

      await ctx.db.insert("payrollRecords", {
        teacherId: teacher._id,
        month: args.month,
        baseSalary: salary,
        allowance: 0,
        deduction: 0,
        bonus: 0,
        netPay: salary,
        status: "draft",
        createdBy: user._id as Id<"users">,
        createdAt: now,
      });
      count++;
    }
    return count;
  },
});

/** Update a payroll record (adjust allowance, deduction, bonus). */
export const update = mutation({
  args: {
    id: v.id("payrollRecords"),
    allowance: v.optional(v.number()),
    deduction: v.optional(v.number()),
    bonus: v.optional(v.number()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      throw new ConvexError("Not authorized.");

    const record = await ctx.db.get(args.id);
    if (!record) throw new ConvexError("Record not found.");
    if (record.status === "paid")
      throw new ConvexError("Cannot edit a paid record.");

    const allowance = args.allowance ?? record.allowance ?? 0;
    const deduction = args.deduction ?? record.deduction ?? 0;
    const bonus = args.bonus ?? record.bonus ?? 0;
    const netPay = record.baseSalary + allowance - deduction + bonus;

    await ctx.db.patch(args.id, {
      allowance,
      deduction,
      bonus,
      netPay,
      remarks: args.remarks ?? record.remarks,
    });
    return netPay;
  },
});

/** Approve / mark paid. */
export const setStatus = mutation({
  args: {
    id: v.id("payrollRecords"),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("paid"),
    ),
    paidMethod: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("bank"),
        v.literal("easypaisa"),
        v.literal("jazzcash"),
      ),
    ),
    paidDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      throw new ConvexError("Not authorized.");

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "paid") {
      patch.paidMethod = args.paidMethod ?? "cash";
      patch.paidDate = args.paidDate ?? new Date().toISOString().slice(0, 10);
    }
    await ctx.db.patch(args.id, patch);
  },
});

/** Payroll summary for a month. */
export const summary = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx)))
      return { total: 0, paid: 0, pending: 0, draft: 0, count: 0 };

    const records = await ctx.db
      .query("payrollRecords")
      .withIndex("by_month", (q) => q.eq("month", args.month))
      .collect();

    return {
      count: records.length,
      total: records.reduce((s, r) => s + r.netPay, 0),
      paid: records
        .filter((r) => r.status === "paid")
        .reduce((s, r) => s + r.netPay, 0),
      approved: records
        .filter((r) => r.status === "approved")
        .reduce((s, r) => s + r.netPay, 0),
      draft: records
        .filter((r) => r.status === "draft")
        .reduce((s, r) => s + r.netPay, 0),
      pending:
        records.filter((r) => r.status !== "paid").reduce((s, r) => s + r.netPay, 0),
    };
  },
});
