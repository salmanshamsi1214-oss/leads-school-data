import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireFeeManager, requireAdmin } from "./permissions";
import { feeMethodValidator } from "./schema";

const PERIOD_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ═══════════════════════════════════════════════════════
//                  AUDIT LOG HELPER
// ═══════════════════════════════════════════════════════

async function logAudit(
  ctx: { db: any; auth: any },
  entry: {
    studentId: Id<"students">;
    action: "payment" | "refund" | "fine" | "fine_waived" | "cancellation" | "discount" | "charge";
    amount: number;
    period?: string;
    referenceId?: string;
    receiptNo?: string;
    method?: "cash" | "bank" | "easypaisa" | "jazzcash" | "other";
    remarks?: string;
  },
) {
  const user = await ctx.auth.getUserIdentity();
  await ctx.db.insert("feeAuditLogs", {
    ...entry,
    performedBy: user?._id ?? "anonymous",
    timestamp: Date.now(),
  });
}

// ═══════════════════════════════════════════════════════
//                  FINES CRUD
// ═══════════════════════════════════════════════════════

/** Add a fine for a student. */
export const addFine = mutation({
  args: {
    studentId: v.id("students"),
    period: v.string(),
    label: v.string(),
    amount: v.number(),
    dueDate: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFeeManager(ctx);
    if (!PERIOD_RE.test(args.period)) throw new ConvexError("Period must be YYYY-MM.");
    if (!Number.isFinite(args.amount) || args.amount <= 0) throw new ConvexError("Amount must be positive.");
    if (!args.label.trim()) throw new ConvexError("Fine label is required.");
    const student = await ctx.db.get(args.studentId);
    if (!student) throw new ConvexError("Student not found.");

    const id = await ctx.db.insert("feeFines", {
      studentId: args.studentId,
      period: args.period,
      label: args.label.trim(),
      amount: Math.round(args.amount * 100) / 100,
      status: "pending",
      dueDate: args.dueDate,
      reason: args.reason?.trim(),
      createdBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      studentId: args.studentId,
      action: "fine",
      amount: args.amount,
      period: args.period,
      referenceId: id,
      remarks: args.label.trim(),
    });

    return id;
  },
});

/** List fines for a period or student. */
export const listFines = query({
  args: {
    period: v.optional(v.string()),
    studentId: v.optional(v.id("students")),
    status: v.optional(v.union(v.literal("pending"), v.literal("paid"), v.literal("waived"))),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    let rows = await ctx.db.query("feeFines").collect();
    if (args.period) rows = rows.filter((r) => r.period === args.period);
    if (args.studentId) rows = rows.filter((r) => r.studentId === args.studentId);
    if (args.status) rows = rows.filter((r) => r.status === args.status);

    const students = await ctx.db.query("students").collect();
    const classes = await ctx.db.query("classes").collect();
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    return rows
      .map((r) => {
        const s = studentMap.get(r.studentId);
        return {
          ...r,
          studentName: s?.name ?? "—",
          rollNumber: s?.rollNumber ?? "—",
          className: s ? (classMap.get(s.classId) ?? "—") : "—",
          section: s?.section ?? "",
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Pay a fine (full or partial). */
export const payFine = mutation({
  args: {
    fineId: v.id("feeFines"),
    amount: v.number(),
    method: feeMethodValidator,
    date: v.string(),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFeeManager(ctx);
    if (!DATE_RE.test(args.date)) throw new ConvexError("Date must be YYYY-MM-DD.");
    if (!Number.isFinite(args.amount) || args.amount <= 0) throw new ConvexError("Amount must be positive.");

    const fine = await ctx.db.get(args.fineId);
    if (!fine) throw new ConvexError("Fine not found.");
    if (fine.status === "paid") throw new ConvexError("Fine is already paid.");
    if (fine.status === "waived") throw new ConvexError("Fine has been waived.");

    const currentPaid = fine.paidAmount ?? 0;
    const remaining = Math.round((fine.amount - currentPaid) * 100) / 100;
    if (args.amount > remaining + 0.01) throw new ConvexError(`Amount exceeds remaining balance of ${remaining}.`);

    const newPaid = Math.round((currentPaid + args.amount) * 100) / 100;
    const newStatus = newPaid >= fine.amount ? "paid" : "pending";

    await ctx.db.patch(args.fineId, {
      paidAmount: newPaid,
      status: newStatus,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      studentId: fine.studentId,
      action: "fine",
      amount: args.amount,
      period: fine.period,
      referenceId: args.fineId,
      method: args.method,
      remarks: args.remarks?.trim() || `Fine payment: ${fine.label}`,
    });

    return { status: newStatus, paid: newPaid };
  },
});

/** Waive a fine (admin only). */
export const waiveFine = mutation({
  args: {
    fineId: v.id("feeFines"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const fine = await ctx.db.get(args.fineId);
    if (!fine) throw new ConvexError("Fine not found.");
    if (fine.status === "paid") throw new ConvexError("Cannot waive a paid fine.");

    await ctx.db.patch(args.fineId, { status: "waived", updatedAt: Date.now() });

    await logAudit(ctx, {
      studentId: fine.studentId,
      action: "fine_waived",
      amount: fine.amount,
      period: fine.period,
      referenceId: args.fineId,
      remarks: args.reason.trim(),
    });

    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
//                  REFUND
// ═══════════════════════════════════════════════════════

/** Refund a fee payment (cancels the original payment record and logs audit). */
export const refundPayment = mutation({
  args: {
    paymentId: v.id("feePayments"),
    reason: v.string(),
    amount: v.optional(v.number()), // partial refund support
  },
  handler: async (ctx, args) => {
    const user = await requireFeeManager(ctx);
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new ConvexError("Payment not found.");

    const refundAmount = args.amount ?? payment.amount;
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new ConvexError("Refund amount must be positive.");
    if (refundAmount > payment.amount + 0.01) throw new ConvexError("Refund cannot exceed payment amount.");

    // Delete the original payment
    await ctx.db.delete(args.paymentId);

    // Log audit trail
    await logAudit(ctx, {
      studentId: payment.studentId,
      action: "refund",
      amount: refundAmount,
      period: payment.period,
      referenceId: args.paymentId,
      receiptNo: payment.receiptNo,
      method: payment.method,
      remarks: `Refund for ${payment.receiptNo}: ${args.reason.trim()}`,
    });

    return { receiptNo: payment.receiptNo, refundAmount };
  },
});

// ═══════════════════════════════════════════════════════
//                  STUDENT LEDGER
// ═══════════════════════════════════════════════════════

/** Complete transaction ledger for a student. */
export const studentLedger = query({
  args: {
    studentId: v.id("students"),
    fromPeriod: v.optional(v.string()),
    toPeriod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const student = await ctx.db.get(args.studentId);
    if (!student) return null;
    const cls = await ctx.db.get(student.classId);

    // Get all payments
    const payments = await ctx.db
      .query("feePayments")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    // Get all fines
    const fines = await ctx.db
      .query("feeFines")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    // Get all audit logs
    const auditLogs = await ctx.db
      .query("feeAuditLogs")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    // Filter by period range
    const filterPeriod = (p: string) => {
      if (args.fromPeriod && p < args.fromPeriod) return false;
      if (args.toPeriod && p > args.toPeriod) return false;
      return true;
    };

    // Build transaction list
    const transactions: Array<{
      date: string;
      type: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
      reference: string;
      period: string;
    }> = [];

    // Add payments as credits
    for (const p of payments) {
      if (!filterPeriod(p.period)) continue;
      transactions.push({
        date: p.date,
        type: "payment",
        description: `Fee payment (${p.method})`,
        debit: 0,
        credit: p.amount,
        balance: 0,
        reference: p.receiptNo,
        period: p.period,
      });
    }

    // Add fines as debits
    for (const f of fines) {
      if (!filterPeriod(f.period)) continue;
      const paid = f.paidAmount ?? 0;
      const outstanding = Math.round((f.amount - paid) * 100) / 100;
      if (outstanding > 0) {
        transactions.push({
          date: new Date(f.createdAt).toISOString().slice(0, 10),
          type: "fine",
          description: f.label,
          debit: outstanding,
          credit: 0,
          balance: 0,
          reference: f._id,
          period: f.period,
        });
      }
      if (paid > 0) {
        transactions.push({
          date: new Date(f.updatedAt).toISOString().slice(0, 10),
          type: "fine_payment",
          description: `Fine payment: ${f.label}`,
          debit: 0,
          credit: paid,
          balance: 0,
          reference: f._id,
          period: f.period,
        });
      }
    }

    // Sort by date
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate running balance
    let runningBalance = 0;
    for (const t of transactions) {
      runningBalance = Math.round((runningBalance + t.debit - t.credit) * 100) / 100;
      t.balance = runningBalance;
    }

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalFines = fines.reduce((s, f) => s + ((f.paidAmount ?? 0) > 0 ? (f.amount - (f.paidAmount ?? 0)) : f.amount), 0);

    return {
      student: {
        name: student.name,
        fatherName: student.fatherName,
        rollNumber: student.rollNumber,
        className: cls?.name ?? "—",
        section: student.section,
        status: student.status,
      },
      transactions,
      summary: {
        totalPaid,
        totalFines,
        totalOutstanding: runningBalance,
      },
      auditLogs: auditLogs
        .filter((l) => !args.fromPeriod || !l.period || l.period >= args.fromPeriod)
        .filter((l) => !args.toPeriod || !l.period || l.period <= args.toPeriod)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 100),
    };
  },
});

// ═══════════════════════════════════════════════════════
//                  DEFAULTER REPORT (Multi-month)
// ═══════════════════════════════════════════════════════

/** Students with outstanding dues across multiple months. */
export const defaulterReport = query({
  args: {
    asOfMonth: v.string(), // YYYY-MM
    months: v.optional(v.number()), // how many months back (default 6)
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return { summary: null, rows: [] };
    if (!PERIOD_RE.test(args.asOfMonth)) throw new ConvexError("asOfMonth must be YYYY-MM.");
    const monthsBack = args.months ?? 6;
    const [year, month] = args.asOfMonth.split("-").map(Number);

    // Generate period list
    const periods: string[] = [];
    for (let i = 0; i < monthsBack; i++) {
      const m = month - i;
      const y = m <= 0 ? year - 1 : year;
      const mm = m <= 0 ? m + 12 : m;
      periods.push(`${y}-${String(mm).padStart(2, "0")}`);
    }

    const [students, classes, feeStructures, feeAssignments, payments, fines] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("feePayments").collect(),
      ctx.db.query("feeFines").collect(),
    ]);

    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    // Monthly fee per class
    const monthlyByClass = new Map<string, number>();
    for (const f of feeStructures) {
      if (f.period !== "monthly") continue;
      monthlyByClass.set(f.classId, (monthlyByClass.get(f.classId) ?? 0) + f.amount);
    }

    // Per-student adjustments
    const adjustmentByStudent = new Map<string, number>();
    for (const a of feeAssignments) {
      adjustmentByStudent.set(a.studentId, (adjustmentByStudent.get(a.studentId) ?? 0) + a.amount);
    }

    // Payments per student per period
    const paidByStudentPeriod = new Map<string, number>();
    for (const p of payments) {
      if (!periods.includes(p.period)) continue;
      paidByStudentPeriod.set(
        `${p.studentId}:${p.period}`,
        (paidByStudentPeriod.get(`${p.studentId}:${p.period}`) ?? 0) + p.amount,
      );
    }

    // Fines per student per period (unpaid portion)
    const finesByStudentPeriod = new Map<string, number>();
    for (const f of fines) {
      if (!periods.includes(f.period)) continue;
      const outstanding = Math.round((f.amount - (f.paidAmount ?? 0)) * 100) / 100;
      if (outstanding > 0) {
        finesByStudentPeriod.set(
          `${f.studentId}:${f.period}`,
          (finesByStudentPeriod.get(`${f.studentId}:${f.period}`) ?? 0) + outstanding,
        );
      }
    }

    const rows = students
      .filter((s) => s.status === "active")
      .map((student) => {
        const baseMonthly = monthlyByClass.get(student.classId) ?? 0;
        const adjustment = adjustmentByStudent.get(student._id) ?? 0;
        const monthly = Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);

        let totalDue = 0;
        let totalPaid = 0;
        let totalFines = 0;
        const monthBreakdown: Array<{ period: string; due: number; paid: number; balance: number; fine: number }> = [];

        for (const p of periods) {
          const due = monthly;
          const paid = paidByStudentPeriod.get(`${student._id}:${p}`) ?? 0;
          const fine = finesByStudentPeriod.get(`${student._id}:${p}`) ?? 0;
          const balance = Math.max(0, Math.round((due - paid) * 100) / 100);
          totalDue += due;
          totalPaid += paid;
          totalFines += fine;
          if (due > 0 || fine > 0) {
            monthBreakdown.push({ period: p, due, paid, balance, fine });
          }
        }

        const totalOutstanding = Math.round((totalDue - totalPaid + totalFines) * 100) / 100;
        return {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          className: classMap.get(student.classId) ?? "—",
          section: student.section,
          monthly,
          totalDue,
          totalPaid,
          totalFines,
          totalOutstanding,
          monthsOwed: monthBreakdown.filter((m) => m.balance > 0 || m.fine > 0).length,
          phone: student.phone ?? "",
          monthBreakdown,
        };
      })
      .filter((r) => r.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const summary = {
      totalDefaulters: rows.length,
      totalOutstanding: rows.reduce((s, r) => s + r.totalOutstanding, 0),
      totalFines: rows.reduce((s, r) => s + r.totalFines, 0),
      periods,
    };

    return { summary, rows };
  },
});

// ═══════════════════════════════════════════════════════
//                  DAILY CLOSING
// ═══════════════════════════════════════════════════════

/** End-of-day fee summary: payments received, fines collected, by method. */
export const dailyClosing = query({
  args: {
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    if (!DATE_RE.test(args.date)) return null;

    const [payments, students, classes, users] = await Promise.all([
      ctx.db.query("feePayments").collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("users").collect(),
    ]);

    const studentMap = new Map(students.map((s) => [s._id, s]));
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? ""]));

    // Filter payments for today
    const todayPayments = payments.filter((p) => p.date === args.date);

    // Aggregate by method
    const byMethod: Record<string, number> = {};
    for (const p of todayPayments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
    }

    // Aggregate by class
    const byClass: Record<string, { count: number; amount: number }> = {};
    for (const p of todayPayments) {
      const s = studentMap.get(p.studentId);
      const cls = s ? (classMap.get(s.classId) ?? "Unknown") : "Unknown";
      if (!byClass[cls]) byClass[cls] = { count: 0, amount: 0 };
      byClass[cls].count++;
      byClass[cls].amount = Math.round((byClass[cls].amount + p.amount) * 100) / 100;
    }

    // Detailed receipt list
    const receipts = todayPayments
      .map((p) => {
        const s = studentMap.get(p.studentId);
        return {
          receiptNo: p.receiptNo,
          studentName: s?.name ?? "—",
          rollNumber: s?.rollNumber ?? "—",
          className: s ? (classMap.get(s.classId) ?? "—") : "—",
          amount: p.amount,
          method: p.method,
          remarks: p.remarks ?? "",
          receivedBy: userMap.get(p.receivedBy) ?? "—",
        };
      })
      .sort((a, b) => a.receiptNo.localeCompare(b.receiptNo));

    const totalCollected = todayPayments.reduce((s, p) => s + p.amount, 0);

    return {
      date: args.date,
      totalCollected,
      totalTransactions: todayPayments.length,
      byMethod,
      byClass,
      receipts,
    };
  },
});

// ═══════════════════════════════════════════════════════
//                  FEE COLLECTION REPORTS
// ═══════════════════════════════════════════════════════

/** Class-wise fee collection report for a period. */
export const classCollectionReport = query({
  args: { period: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    if (!PERIOD_RE.test(args.period)) return [];

    const [students, classes, payments, feeStructures, feeAssignments, fines] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("feePayments").withIndex("by_period", (q) => q.eq("period", args.period)).collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("feeFines").withIndex("by_period", (q) => q.eq("period", args.period)).collect(),
    ]);

    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const monthlyByClass = new Map<string, number>();
    for (const f of feeStructures) {
      if (f.period !== "monthly") continue;
      monthlyByClass.set(f.classId, (monthlyByClass.get(f.classId) ?? 0) + f.amount);
    }

    const adjustmentByStudent = new Map<string, number>();
    for (const a of feeAssignments) {
      adjustmentByStudent.set(a.studentId, (adjustmentByStudent.get(a.studentId) ?? 0) + a.amount);
    }

    const paidByStudent = new Map<string, number>();
    for (const p of payments) {
      paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + p.amount);
    }

    const finesByStudent = new Map<string, number>();
    for (const f of fines) {
      finesByStudent.set(f.studentId, (finesByStudent.get(f.studentId) ?? 0) + (f.amount - (f.paidAmount ?? 0)));
    }

    // Group students by class
    const classStudents = new Map<string, typeof students>();
    for (const s of students) {
      if (s.status !== "active") continue;
      const list = classStudents.get(s.classId) ?? [];
      list.push(s);
      classStudents.set(s.classId, list);
    }

    const report = [];
    for (const [classId, studs] of classStudents) {
      const baseMonthly = monthlyByClass.get(classId) ?? 0;
      let totalExpected = 0;
      let totalCollected = 0;
      let totalFines = 0;
      let paidCount = 0;
      let dueCount = 0;

      for (const s of studs) {
        const adjustment = adjustmentByStudent.get(s._id) ?? 0;
        const expected = Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);
        const paid = paidByStudent.get(s._id) ?? 0;
        const fine = finesByStudent.get(s._id) ?? 0;
        totalExpected += expected;
        totalCollected += paid;
        totalFines += fine;
        if (paid >= expected && fine === 0) paidCount++;
        else dueCount++;
      }

      report.push({
        classId,
        className: classMap.get(classId as any) ?? "—",
        studentCount: studs.length,
        baseMonthly,
        totalExpected: Math.round(totalExpected * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalFines: Math.round(totalFines * 100) / 100,
        outstanding: Math.round((totalExpected - totalCollected + totalFines) * 100) / 100,
        collectionRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0,
        paidCount,
        dueCount,
      });
    }

    return report.sort((a, b) => a.className.localeCompare(b.className));
  },
});

// ═══════════════════════════════════════════════════════
//                  AUDIT LOG QUERY
// ═══════════════════════════════════════════════════════

/** List audit logs with optional filters. */
export const auditLogs = query({
  args: {
    studentId: v.optional(v.id("students")),
    action: v.optional(v.union(
      v.literal("payment"), v.literal("refund"), v.literal("fine"),
      v.literal("fine_waived"), v.literal("cancellation"),
      v.literal("discount"), v.literal("charge"),
    )),
    fromTimestamp: v.optional(v.number()),
    toTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    let rows = args.studentId
      ? await ctx.db.query("feeAuditLogs").withIndex("by_student", (q) => q.eq("studentId", args.studentId!)).collect()
      : await ctx.db.query("feeAuditLogs").collect();

    if (args.action) rows = rows.filter((r) => r.action === args.action);
    if (args.fromTimestamp) rows = rows.filter((r) => r.timestamp >= args.fromTimestamp!);
    if (args.toTimestamp) rows = rows.filter((r) => r.timestamp <= args.toTimestamp!);

    const students = await ctx.db.query("students").collect();
    const users = await ctx.db.query("users").collect();
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const userMap = new Map(users.map((u) => [u._id, u.name ?? u.email ?? ""]));

    return rows
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, args.limit ?? 100)
      .map((r) => ({
        ...r,
        studentName: studentMap.get(r.studentId)?.name ?? "—",
        performedByName: userMap.get(r.performedBy) ?? "—",
      }));
  },
});
