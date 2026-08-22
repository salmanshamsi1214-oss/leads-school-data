import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  isSchoolUser,
  requireFeeManager,
  requireOfficeUser,
} from "./permissions";
import { feeMethodValidator, feePeriodValidator } from "./schema";

const PERIOD_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validatePeriod = (period: string) => {
  if (!PERIOD_RE.test(period)) {
    throw new ConvexError("Period must be in YYYY-MM format.");
  }
  const month = Number(period.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new ConvexError("Period is not a valid month.");
  }
};

/** All fee structures joined with their class name. */
export const structures = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [feeStructures, classes] = await Promise.all([
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const classMap = new Map(classes.map((cls) => [cls._id, cls.name]));
    return feeStructures
      .map((structure) => ({
        ...structure,
        className: classMap.get(structure.classId) ?? "—",
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  },
});

export const saveStructure = mutation({
  args: {
    id: v.optional(v.id("feeStructures")),
    classId: v.id("classes"),
    label: v.string(),
    amount: v.number(),
    period: feePeriodValidator,
  },
  handler: async (ctx, args) => {
    await requireFeeManager(ctx);
    const label = args.label.trim();
    if (label.length === 0) {
      throw new ConvexError("Fee label is required.");
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new ConvexError("Amount must be a positive number.");
    }
    const cls = await ctx.db.get(args.classId);
    if (cls === null) {
      throw new ConvexError("Selected class no longer exists.");
    }
    const amount = Math.round(args.amount * 100) / 100;
    if (args.id !== undefined) {
      const existing = await ctx.db.get(args.id);
      if (existing === null) {
        throw new ConvexError("Fee structure not found.");
      }
      await ctx.db.patch(args.id, {
        classId: args.classId,
        label,
        amount,
        period: args.period,
      });
      return args.id;
    }
    return await ctx.db.insert("feeStructures", {
      classId: args.classId,
      label,
      amount,
      period: args.period,
    });
  },
});

export const deleteStructure = mutation({
  args: { id: v.id("feeStructures") },
  handler: async (ctx, args) => {
    await requireFeeManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Fee structure not found.");
    }
    await ctx.db.delete(args.id);
  },
});

/** All per-student fee adjustments with student and class details. */
export const assignments = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [assignments, students, classes] = await Promise.all([
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const classMap = new Map(classes.map((cls) => [cls._id, cls.name]));
    return assignments
      .map((assignment) => {
        const student = studentMap.get(assignment.studentId);
        return {
          ...assignment,
          studentName: student?.name ?? "Unknown",
          rollNumber: student?.rollNumber ?? "",
          className: student ? (classMap.get(student.classId) ?? "—") : "—",
          section: student?.section ?? "",
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  },
});

/**
 * Create or update a per-student fee adjustment. Negative amounts are
 * concessions (discounts), positive amounts are extra monthly charges.
 */
export const saveAssignment = mutation({
  args: {
    id: v.optional(v.id("feeAssignments")),
    studentId: v.id("students"),
    label: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireFeeManager(ctx);
    const label = args.label.trim();
    if (label.length === 0) {
      throw new ConvexError("Give the adjustment a short label (e.g. Sibling concession).");
    }
    if (!Number.isFinite(args.amount) || args.amount === 0) {
      throw new ConvexError("Amount must be a non-zero number.");
    }
    const student = await ctx.db.get(args.studentId);
    if (student === null) {
      throw new ConvexError("Selected student no longer exists.");
    }
    const amount = Math.round(args.amount * 100) / 100;
    if (args.id !== undefined) {
      const existing = await ctx.db.get(args.id);
      if (existing === null) {
        throw new ConvexError("Fee assignment not found.");
      }
      await ctx.db.patch(args.id, { studentId: args.studentId, label, amount });
      return args.id;
    }
    return await ctx.db.insert("feeAssignments", {
      studentId: args.studentId,
      label,
      amount,
    });
  },
});

export const deleteAssignment = mutation({
  args: { id: v.id("feeAssignments") },
  handler: async (ctx, args) => {
    await requireFeeManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Fee assignment not found.");
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * Monthly due list: every active student with a monthly liability (class
 * structures plus per-student adjustments), what has been paid, and the
 * outstanding balance.
 */
export const dueList = query({
  args: { period: v.string() }, // YYYY-MM
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return { summary: null, rows: [] };
    validatePeriod(args.period);

    const [students, classes, feeStructures, payments, feeAssignments] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feePayments").withIndex("by_period", (q) =>
        q.eq("period", args.period),
      ).collect(),
      ctx.db.query("feeAssignments").collect(),
    ]);

    const classMap = new Map(classes.map((cls) => [cls._id, cls]));

    // Monthly liability per class = sum of monthly structures for that class.
    const monthlyByClass = new Map<string, number>();
    for (const structure of feeStructures) {
      if (structure.period !== "monthly") continue;
      monthlyByClass.set(
        structure.classId,
        (monthlyByClass.get(structure.classId) ?? 0) + structure.amount,
      );
    }

    // Per-student adjustments: concessions are negative, extras positive.
    const adjustmentByStudent = new Map<string, number>();
    for (const assignment of feeAssignments) {
      adjustmentByStudent.set(
        assignment.studentId,
        (adjustmentByStudent.get(assignment.studentId) ?? 0) + assignment.amount,
      );
    }

    const paidByStudent = new Map<
      string,
      { amount: number; receiptNo: string; date: string; paymentId: Id<"feePayments"> }
    >();
    for (const payment of payments) {
      paidByStudent.set(payment.studentId, {
        amount: payment.amount,
        receiptNo: payment.receiptNo,
        date: payment.date,
        paymentId: payment._id,
      });
    }

    const rows = students
      .filter((s) => s.status === "active")
      .map((student) => {
        const baseMonthly = monthlyByClass.get(student.classId) ?? 0;
        const adjustment = adjustmentByStudent.get(student._id) ?? 0;
        const monthly = Math.max(
          0,
          Math.round((baseMonthly + adjustment) * 100) / 100,
        );
        const paid = paidByStudent.get(student._id);
        const paidAmount = paid?.amount ?? 0;
        return {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          className: classMap.get(student.classId)?.name ?? "—",
          section: student.section,
          baseMonthly,
          adjustment,
          monthly,
          paidAmount,
          balance: Math.round((monthly - paidAmount) * 100) / 100,
          receiptNo: paid?.receiptNo ?? null,
          paymentId: paid?.paymentId ?? null,
          paidDate: paid?.date ?? null,
        };
      })
      .filter((row) => row.monthly > 0)
      .sort((a, b) => {
        const byClass = a.className.localeCompare(b.className);
        if (byClass !== 0) return byClass;
        return a.rollNumber.localeCompare(b.rollNumber);
      });

    const expected = rows.reduce((sum, row) => sum + row.monthly, 0);
    const collected = rows.reduce((sum, row) => sum + row.paidAmount, 0);
    return {
      summary: {
        expected: Math.round(expected * 100) / 100,
        collected: Math.round(collected * 100) / 100,
        outstanding: Math.round((expected - collected) * 100) / 100,
        rate:
          expected === 0
            ? 0
            : Math.round((collected / expected) * 1000) / 10,
        paidCount: rows.filter((r) => r.paidAmount > 0).length,
        dueCount: rows.filter((r) => r.balance > 0).length,
        totalCount: rows.length,
      },
      rows,
    };
  },
});

/** A single payment with student and receiver details, for the receipt page. */
export const receipt = query({
  args: { paymentId: v.id("feePayments") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    const payment = await ctx.db.get(args.paymentId);
    if (payment === null) return null;
    const [student, receiver] = await Promise.all([
      ctx.db.get(payment.studentId),
      ctx.db.get(payment.receivedBy),
    ]);
    const cls = student === null ? null : await ctx.db.get(student.classId);
    return {
      ...payment,
      studentName: student?.name ?? "Unknown",
      fatherName: student?.fatherName ?? "",
      rollNumber: student?.rollNumber ?? "",
      studentPhone: student?.phone ?? "",
      className: cls?.name ?? "—",
      section: student?.section ?? "",
      receivedByName: receiver?.name ?? receiver?.email ?? "School office",
    };
  },
});

/** All payments recorded for a month, newest first, for the collections log. */
export const collections = query({
  args: { period: v.string() }, // YYYY-MM
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    validatePeriod(args.period);
    const [payments, students, classes, users] = await Promise.all([
      ctx.db.query("feePayments").withIndex("by_period", (q) =>
        q.eq("period", args.period),
      ).collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("users").collect(),
    ]);
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const classMap = new Map(classes.map((cls) => [cls._id, cls.name]));
    const userMap = new Map(users.map((u) => [u._id, u.email ?? u.name ?? ""]));
    return payments
      .map((payment) => {
        const student = studentMap.get(payment.studentId);
        return {
          ...payment,
          studentName: student?.name ?? "Unknown",
          rollNumber: student?.rollNumber ?? "",
          className: student ? (classMap.get(student.classId) ?? "—") : "—",
          receivedByName: userMap.get(payment.receivedBy) ?? "—",
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo));
  },
});

/** Record a fee payment and issue a receipt number for the period. */
export const recordPayment = mutation({
  args: {
    studentId: v.id("students"),
    period: v.string(), // YYYY-MM
    amount: v.number(),
    method: feeMethodValidator,
    date: v.string(), // YYYY-MM-DD
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFeeManager(ctx);
    validatePeriod(args.period);
    if (!DATE_RE.test(args.date)) {
      throw new ConvexError("Payment date must be in YYYY-MM-DD format.");
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new ConvexError("Amount must be a positive number.");
    }
    const student = await ctx.db.get(args.studentId);
    if (student === null) {
      throw new ConvexError("Student not found.");
    }

    // Receipt number: RC-<YYYYMM>-<seq> where seq is sequential within the period.
    const prefix = `RC-${args.period.replace("-", "")}-`;
    const existing = await ctx.db
      .query("feePayments")
      .withIndex("by_receipt", (q) => q.gte("receiptNo", prefix))
      .collect();
    const seq = String(existing.length + 1).padStart(4, "0");
    const receiptNo = `${prefix}${seq}`;

    const id = await ctx.db.insert("feePayments", {
      studentId: args.studentId,
      period: args.period,
      amount: Math.round(args.amount * 100) / 100,
      method: args.method,
      date: args.date,
      receiptNo,
      remarks: args.remarks?.trim() || undefined,
      receivedBy: user._id,
    });
    return { id, receiptNo };
  },
});

/** Delete a payment (corrections). Also returns its receipt number. */
export const deletePayment = mutation({
  args: { id: v.id("feePayments") },
  handler: async (ctx, args) => {
    await requireOfficeUser(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Payment not found.");
    }
    await ctx.db.delete(args.id);
    return existing.receiptNo;
  },
});

/** Apply sibling discount: finds all students sharing the same fatherName
 *  and phone, then applies a fee concession (negative feeAssignment) to
 *  the 2nd, 3rd, etc. sibling. amount is the discount per extra sibling. */
export const applySiblingDiscount = mutation({
  args: {
    discountAmount: v.number(),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireFeeManager(ctx);
    if (args.discountAmount <= 0) throw new ConvexError("Discount must be positive.");

    const students = (await ctx.db.query("students").collect()).filter(
      (s) => s.status === "active",
    );

    // Group by fatherName + phone (same family)
    const families = new Map<string, typeof students>();
    for (const s of students) {
      const key = `${(s.fatherName ?? "").trim().toLowerCase()}|${(s.phone ?? "").trim()}`;
      if (key === "|") continue; // skip students with no parent info
      const list = families.get(key) ?? [];
      list.push(s);
      families.set(key, list);
    }

    let applied = 0;
    for (const [, siblings] of families) {
      if (siblings.length < 2) continue;
      // Skip the first (full fee), apply discount to the rest
      for (let i = 1; i < siblings.length; i++) {
        const existing = await ctx.db
          .query("feeAssignments")
          .withIndex("by_student", (q) => q.eq("studentId", siblings[i]._id))
          .collect();
        const hasDiscount = existing.some((a) => a.label.includes("Sibling"));
        if (!hasDiscount) {
          await ctx.db.insert("feeAssignments", {
            studentId: siblings[i]._id,
            label: `Sibling Discount (${siblings[0].name})`,
            amount: -Math.abs(args.discountAmount),
          });
          applied++;
        }
      }
    }
    return { familiesFound: families.size, discountsApplied: applied };
  },
});

/** Advance payment: record a payment for a future period. */
export const recordAdvancePayment = mutation({
  args: {
    studentId: v.id("students"),
    period: v.string(), // target YYYY-MM
    amount: v.number(),
    method: feeMethodValidator,
    date: v.string(),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFeeManager(ctx);
    validatePeriod(args.period);
    if (!DATE_RE.test(args.date)) {
      throw new ConvexError("Date must be YYYY-MM-DD.");
    }
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new ConvexError("Amount must be positive.");
    }
    const student = await ctx.db.get(args.studentId);
    if (student === null) throw new ConvexError("Student not found.");

    const prefix = `RC-${args.period.replace("-", "")}-`;
    const existing = await ctx.db
      .query("feePayments")
      .withIndex("by_receipt", (q) => q.gte("receiptNo", prefix))
      .collect();
    const seq = String(existing.length + 1).padStart(4, "0");
    const receiptNo = `${prefix}${seq}`;

    const id = await ctx.db.insert("feePayments", {
      studentId: args.studentId,
      period: args.period,
      amount: Math.round(args.amount * 100) / 100,
      method: args.method,
      date: args.date,
      receiptNo,
      remarks: `Advance: ${args.remarks ?? ""}`.trim() || undefined,
      receivedBy: user._id,
    });
    return { id, receiptNo };
  },
});

/** Find siblings: students sharing the same fatherName + phone. */
export const findSiblings = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [students, classes] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const families = new Map<string, typeof students>();
    for (const s of students.filter((s) => s.status === "active")) {
      const key = `${(s.fatherName ?? "").trim().toLowerCase()}|${(s.phone ?? "").trim()}`;
      if (key === "|") continue;
      const list = families.get(key) ?? [];
      list.push(s);
      families.set(key, list);
    }
    const result: Array<{ fatherName: string; students: Array<{ id: string; name: string; className: string; section: string }> }> = [];
    for (const [, siblings] of families) {
      if (siblings.length < 2) continue;
      result.push({
        fatherName: siblings[0].fatherName,
        students: siblings.map((s) => ({
          id: s._id,
          name: s.name,
          className: classMap.get(s.classId) ?? "—",
          section: s.section,
        })),
      });
    }
    return result;
  },
});
