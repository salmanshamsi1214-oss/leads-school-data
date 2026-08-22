import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-\d{2}$/;

/** List fee slips, optionally filtered by period/status/type. */
export const list = query({
  args: {
    period: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"), v.literal("sent"), v.literal("paid"), v.literal("overdue"),
    )),
    type: v.optional(v.union(v.literal("slip"), v.literal("challan"), v.literal("reminder"))),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [students, classes, feeStructures, feeAssignments] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
    ]);
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const studentMap = new Map(students.map((s) => [s._id, s]));

    // Get monthly fees by class
    const monthlyByClass = new Map<string, number>();
    for (const f of feeStructures) {
      if (f.period !== "monthly") continue;
      monthlyByClass.set(f.classId, (monthlyByClass.get(f.classId) ?? 0) + f.amount);
    }
    const adjustmentByStudent = new Map<string, number>();
    for (const a of feeAssignments) {
      adjustmentByStudent.set(a.studentId, (adjustmentByStudent.get(a.studentId) ?? 0) + a.amount);
    }

    let rows = await ctx.db.query("feeSlips").collect();
    if (args.period) rows = rows.filter((r) => r.period === args.period);
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.type) rows = rows.filter((r) => r.type === args.type);

    return rows.map((r) => {
      const student = studentMap.get(r.studentId);
      return {
        ...r,
        studentName: student?.name ?? "—",
        fatherName: student?.fatherName ?? "—",
        rollNumber: student?.rollNumber ?? "—",
        className: classMap.get(r.classId) ?? "—",
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Generate fee slips for all active students in a given period. */
export const generateSlips = mutation({
  args: {
    period: v.string(),
    type: v.union(v.literal("slip"), v.literal("challan"), v.literal("reminder")),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    if (!PERIOD_RE.test(args.period)) throw new ConvexError("Period must be YYYY-MM.");
    if (args.dueDate && !DATE_RE.test(args.dueDate)) throw new ConvexError("Due date must be YYYY-MM-DD.");

    const [students, classes, feeStructures, feeAssignments, existingPayments] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("feePayments").withIndex("by_period", (q) => q.eq("period", args.period)).collect(),
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
    for (const p of existingPayments) {
      paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + p.amount);
    }

    // Check existing slips for this period to avoid duplicates
    const existingSlips = await ctx.db.query("feeSlips")
      .withIndex("by_period", (q) => q.eq("period", args.period))
      .collect();
    const existingSlipStudentIds = new Set(existingSlips.map((s) => s.studentId));

    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    let created = 0;

    for (const student of students) {
      if (student.status !== "active") continue;
      if (existingSlipStudentIds.has(student._id)) continue;

      const baseMonthly = monthlyByClass.get(student.classId) ?? 0;
      const adjustment = adjustmentByStudent.get(student._id) ?? 0;
      const totalAmount = Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);
      if (totalAmount <= 0) continue;

      const paidAmount = paidByStudent.get(student._id) ?? 0;
      const balance = Math.round((totalAmount - paidAmount) * 100) / 100;

      await ctx.db.insert("feeSlips", {
        studentId: student._id,
        classId: student.classId,
        section: student.section,
        period: args.period,
        type: args.type,
        totalAmount,
        paidAmount,
        balance,
        dueDate: args.dueDate || undefined,
        status: balance <= 0 ? "paid" : "pending",
        notes: args.notes?.trim() || undefined,
        createdBy: user._id,
        createdAt: now,
      });
      created++;
    }
    return created;
  },
});

/** Mark a fee slip as sent. */
export const markSent = mutation({
  args: {
    id: v.id("feeSlips"),
    channel: v.union(v.literal("whatsapp"), v.literal("sms"), v.literal("printed")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.patch(args.id, {
      status: "sent",
      sentChannel: args.channel,
      sentAt: Date.now(),
    });
  },
});

/** Mark a fee slip as paid. */
export const markPaid = mutation({
  args: { id: v.id("feeSlips") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.patch(args.id, { status: "paid" });
  },
});

/** Send reminders for unpaid slips (batch — creates a message for each). */
export const sendReminders = mutation({
  args: {
    period: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("sms")),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");

    const slips = await ctx.db.query("feeSlips")
      .withIndex("by_period", (q) => q.eq("period", args.period))
      .collect();
    const unpaid = slips.filter((s) => s.balance > 0 && s.status !== "paid");

    const students = await ctx.db.query("students").collect();
    const studentMap = new Map(students.map((s) => [s._id, s]));

    let sent = 0;
    for (const slip of unpaid) {
      const student = studentMap.get(slip.studentId);
      if (!student?.phone) continue;

      await ctx.db.patch(slip._id, {
        status: "sent",
        sentChannel: args.channel,
        sentAt: Date.now(),
      });
      sent++;
    }
    return sent;
  },
});

/** Get outstanding fees summary across all unpaid periods. */
export const outstanding = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return { summary: null, rows: [] };

    const students = await ctx.db.query("students").collect();
    const classes = await ctx.db.query("classes").collect();
    const classMap = new Map(classes.map((c) => [c._id, c.name]));

    // Get all payments
    const allPayments = await ctx.db.query("feePayments").collect();
    const paidByStudent = new Map<string, number>();
    for (const p of allPayments) {
      paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + p.amount);
    }

    // Get monthly fee structures
    const feeStructures = await ctx.db.query("feeStructures").collect();
    const feeAssignments = await ctx.db.query("feeAssignments").collect();
    const monthlyByClass = new Map<string, number>();
    for (const f of feeStructures) {
      if (f.period !== "monthly") continue;
      monthlyByClass.set(f.classId, (monthlyByClass.get(f.classId) ?? 0) + f.amount);
    }
    const adjustmentByStudent = new Map<string, number>();
    for (const a of feeAssignments) {
      adjustmentByStudent.set(a.studentId, (adjustmentByStudent.get(a.studentId) ?? 0) + a.amount);
    }

    // Count months since each student's admission (or since a fixed start)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const rows = students
      .filter((s) => s.status === "active")
      .map((student) => {
        const baseMonthly = monthlyByClass.get(student.classId) ?? 0;
        const adjustment = adjustmentByStudent.get(student._id) ?? 0;
        const monthly = Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);
        const totalPaid = paidByStudent.get(student._id) ?? 0;
        // Approximate total due = monthly * months so far
        const monthsSoFar = currentMonth; // simplified
        const totalDue = Math.round(monthly * monthsSoFar * 100) / 100;
        const outstanding = Math.round(Math.max(0, totalDue - totalPaid) * 100) / 100;
        return {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          className: classMap.get(student.classId) ?? "—",
          section: student.section,
          monthly,
          totalPaid,
          totalDue,
          outstanding,
          phone: student.phone ?? "",
        };
      })
      .filter((r) => r.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    const totalOutstanding = rows.reduce((sum, r) => sum + r.outstanding, 0);
    return {
      summary: {
        totalStudents: rows.length,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      },
      rows,
    };
  },
});

/** Generate slips for all active students in a specific class/section. */
export const generateClassSlips = mutation({
  args: {
    classId: v.id("classes"),
    section: v.optional(v.string()),
    period: v.string(),
    type: v.union(v.literal("slip"), v.literal("challan"), v.literal("reminder")),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    if (!PERIOD_RE.test(args.period)) throw new ConvexError("Period must be YYYY-MM.");
    if (args.dueDate && !DATE_RE.test(args.dueDate)) throw new ConvexError("Due date must be YYYY-MM-DD.");

    const cls = await ctx.db.get(args.classId);
    if (!cls) throw new ConvexError("Class not found.");

    // Get students for this class/section
    let targetStudents = (await ctx.db.query("students")
      .withIndex("by_class_section", (q) => q.eq("classId", args.classId))
      .collect())
      .filter((s) => s.status === "active");
    if (args.section) {
      const section = args.section.trim().toUpperCase();
      targetStudents = targetStudents.filter((s) => s.section === section);
    }

    // Get fee data
    const [feeStructures, feeAssignments, existingPayments, existingSlips] = await Promise.all([
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("feePayments").withIndex("by_period", (q) => q.eq("period", args.period)).collect(),
      ctx.db.query("feeSlips").withIndex("by_period", (q) => q.eq("period", args.period)).collect(),
    ]);

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
    for (const p of existingPayments) {
      paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + p.amount);
    }
    const existingSlipStudentIds = new Set(existingSlips.map((s) => s.studentId));

    const user = await requireSchoolUser(ctx);
    const now = Date.now();
    let created = 0;

    for (const student of targetStudents) {
      if (existingSlipStudentIds.has(student._id)) continue;
      const baseMonthly = monthlyByClass.get(student.classId) ?? 0;
      const adjustment = adjustmentByStudent.get(student._id) ?? 0;
      const totalAmount = Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);
      if (totalAmount <= 0) continue;
      const paidAmount = paidByStudent.get(student._id) ?? 0;
      const balance = Math.round((totalAmount - paidAmount) * 100) / 100;

      await ctx.db.insert("feeSlips", {
        studentId: student._id,
        classId: student.classId,
        section: student.section,
        period: args.period,
        type: args.type,
        totalAmount,
        paidAmount,
        balance,
        dueDate: args.dueDate || undefined,
        status: balance <= 0 ? "paid" : "pending",
        notes: args.notes?.trim() || undefined,
        createdBy: user._id,
        createdAt: now,
      });
      created++;
    }
    return created;
  },
});

/** Get fee slip data for a class/section including annual + monthly breakdown. */
export const classwiseData = query({
  args: {
    classId: v.id("classes"),
    section: v.optional(v.string()),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    if (!PERIOD_RE.test(args.period)) return null;

    const cls = await ctx.db.get(args.classId);
    if (!cls) return null;

    let targetStudents = (await ctx.db.query("students")
      .withIndex("by_class_section", (q) => q.eq("classId", args.classId))
      .collect())
      .filter((s) => s.status === "active");
    if (args.section) {
      const section = args.section.trim().toUpperCase();
      targetStudents = targetStudents.filter((s) => s.section === section);
    }

    const [feeStructures, feeAssignments, allPayments] = await Promise.all([
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("feePayments").collect(),
    ]);

    // Fee structures for this class
    const classFees = feeStructures.filter((f) => f.classId === args.classId);
    const monthlyFees = classFees.filter((f) => f.period === "monthly");
    const annualFees = classFees.filter((f) => f.period === "annual");

    const paidByStudent = new Map<string, number>();
    for (const p of allPayments) {
      if (p.period === args.period) {
        paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + p.amount);
      }
    }
    const adjustmentByStudent = new Map<string, number>();
    for (const a of feeAssignments) {
      adjustmentByStudent.set(a.studentId, (adjustmentByStudent.get(a.studentId) ?? 0) + a.amount);
    }

    const students = targetStudents.map((student) => {
      const baseMonthly = monthlyFees.reduce((s, f) => s + f.amount, 0);
      const adjustment = adjustmentByStudent.get(student._id) ?? 0;
      const totalMonthly = Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);
      const totalAnnual = annualFees.reduce((s, f) => s + f.amount, 0);
      const paid = paidByStudent.get(student._id) ?? 0;
      const balance = Math.max(0, Math.round((totalMonthly - paid) * 100) / 100);

      return {
        studentId: student._id,
        name: student.name,
        fatherName: student.fatherName,
        rollNumber: student.rollNumber,
        section: student.section,
        admissionNo: student.rollNumber,
        monthlyFees: monthlyFees.map((f) => ({ label: f.label, amount: f.amount })),
        annualFees: annualFees.map((f) => ({ label: f.label, amount: f.amount })),
        totalMonthly,
        totalAnnual,
        paid,
        balance,
        previousBalance: 0,
        adjustment,
      };
    });

    return {
      className: cls.name,
      section: args.section?.toUpperCase() || "All",
      period: args.period,
      totalStudents: students.length,
      monthlyFees: monthlyFees.map((f) => ({ label: f.label, amount: f.amount })),
      annualFees: annualFees.map((f) => ({ label: f.label, amount: f.amount })),
      students,
    };
  },
});

/** Delete a fee slip. */
export const remove = mutation({
  args: { id: v.id("feeSlips") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) throw new ConvexError("Not authorized.");
    await ctx.db.delete(args.id);
  },
});
