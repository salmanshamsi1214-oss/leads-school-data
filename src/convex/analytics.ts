import { v } from "convex/values";
import { query } from "./_generated/server";
import { isSchoolUser } from "./permissions";

/** Admin dashboard overview — financial and operational stats. */
export const adminOverview = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return null;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const yearStart = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().slice(0, 10);

    const [
      students,
      teachers,
      allExpenses,
      currentPayroll,
      prevPayroll,
      classes,
      attendanceToday,
    ] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("teachers").collect(),
      ctx.db.query("expenses").collect(),
      ctx.db
        .query("payrollRecords")
        .withIndex("by_month", (q) => q.eq("month", currentMonth))
        .collect(),
      ctx.db
        .query("payrollRecords")
        .withIndex("by_month", (q) => q.eq("month", prevMonthStr))
        .collect(),
      ctx.db.query("classes").collect(),
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", today))
        .collect(),
    ]);

    const activeStudents = students.filter((s) => s.status === "active").length;
    const activeTeachers = teachers.filter((t) => t.status === "active").length;
    const totalPaid = teachers.reduce((s, t) => s + (t.salary ?? 0), 0) * activeTeachers > 0
      ? teachers.filter((t) => t.status === "active").reduce((s, t) => s + (t.salary ?? 0), 0)
      : 0;

    // Expenses
    const currentExpenses = allExpenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((s, e) => s + e.amount, 0);
    const prevExpenses = allExpenses
      .filter((e) => e.date.startsWith(prevMonthStr))
      .reduce((s, e) => s + e.amount, 0);
    const yearExpenses = allExpenses
      .filter((e) => e.date >= yearStart)
      .reduce((s, e) => s + e.amount, 0);

    // Payroll
    const currentPayrollTotal = currentPayroll.reduce((s, r) => s + r.netPay, 0);
    const prevPayrollTotal = prevPayroll.reduce((s, r) => s + r.netPay, 0);
    const paidPayroll = currentPayroll
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + r.netPay, 0);
    const pendingPayroll = currentPayrollTotal - paidPayroll;

    // Attendance today
    const present = attendanceToday.filter((a) => a.status === "present" || a.status === "late").length;
    const absent = attendanceToday.filter((a) => a.status === "absent").length;
    const attendanceRate = activeStudents > 0 ? Math.round((present / activeStudents) * 100) : 0;

    // Fee stats (from dashboard)
    const payments = await ctx.db.query("feePayments").collect();
    const currentPayments = payments
      .filter((p) => p.period === currentMonth)
      .reduce((s, p) => s + p.amount, 0);

    // Monthly expense trend (last 6 months)
    const expenseTrend: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en", { month: "short" });
      expenseTrend.push({
        month: label,
        amount: allExpenses
          .filter((e) => e.date.startsWith(m))
          .reduce((s, e) => s + e.amount, 0),
      });
    }

    // Expense by category
    const catMap = new Map<string, number>();
    for (const e of allExpenses.filter((e) => e.date >= yearStart)) {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    }

    // Inquiries
    const inquiries = await ctx.db.query("inquiries").collect();
    const newInquiries = inquiries.filter((i) => i.status === "new").length;

    return {
      students: {
        active: activeStudents,
        total: students.length,
      },
      teachers: {
        active: activeTeachers,
        total: teachers.length,
      },
      classes: classes.length,
      attendance: {
        today: { present, absent, rate: attendanceRate },
      },
      fees: {
        collected: currentPayments,
      },
      payroll: {
        current: currentPayrollTotal,
        paid: paidPayroll,
        pending: pendingPayroll,
        prevMonth: prevPayrollTotal,
        trend: currentPayrollTotal > prevPayrollTotal ? "up" : currentPayrollTotal < prevPayrollTotal ? "down" : "flat",
      },
      expenses: {
        currentMonth: currentExpenses,
        prevMonth: prevExpenses,
        year: yearExpenses,
        trend: currentExpenses > prevExpenses ? "up" : currentExpenses < prevExpenses ? "down" : "flat",
        byCategory: Array.from(catMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
      },
      expenseTrend,
      inquiries: {
        new: newInquiries,
        total: inquiries.length,
      },
    };
  },
});

/** Fee collection report grouped by class for a given period. */
export const feeCollectionByClass = query({
  args: {
    month: v.optional(v.string()), // YYYY-MM, defaults to current month
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const now = new Date();
    const month = args.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [students, payments, structures, assignments, allClasses] = await Promise.all([
      ctx.db.query("students").filter((q) => q.eq(q.field("status"), "active")).collect(),
      ctx.db.query("feePayments").withIndex("by_period", (q) => q.eq("period", month)).collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("classes").collect(),
    ]);

    const classById = new Map(allClasses.map((c) => [c._id, c]));

    // Monthly base fee per class (sum of monthly structures)
    const baseByClassId = new Map<string, number>();
    for (const s of structures) {
      if (s.period !== "monthly") continue;
      baseByClassId.set(s.classId, (baseByClassId.get(s.classId) ?? 0) + s.amount);
    }

    // Per-student adjustments from feeAssignments
    const adjByStudent = new Map<string, number>();
    for (const a of assignments) {
      adjByStudent.set(a.studentId, (adjByStudent.get(a.studentId) ?? 0) + a.amount);
    }

    // Group students by class name
    const classMap = new Map<string, {
      className: string;
      studentCount: number;
      totalDue: number;
      totalPaid: number;
      paidStudents: number;
      unpaidStudents: number;
    }>();

    for (const student of students) {
      const cls = classById.get(student.classId);
      const className = cls?.name ?? "Unknown";
      if (!classMap.has(className)) {
        classMap.set(className, { className, studentCount: 0, totalDue: 0, totalPaid: 0, paidStudents: 0, unpaidStudents: 0 });
      }
      const entry = classMap.get(className)!;
      entry.studentCount++;

      const base = baseByClassId.get(student.classId) ?? 0;
      const adj = adjByStudent.get(student._id) ?? 0;
      const monthlyFee = Math.max(0, Math.round((base + adj) * 100) / 100);
      entry.totalDue += monthlyFee;

      const payment = payments.find((p) => p.studentId === student._id);
      const paid = payment?.amount ?? 0;
      entry.totalPaid += paid;

      if (paid >= monthlyFee && monthlyFee > 0) entry.paidStudents++;
      else entry.unpaidStudents++;
    }

    const classes = Array.from(classMap.values())
      .map((c) => ({
        className: c.className,
        totalStudents: c.studentCount,
        totalDue: c.totalDue,
        totalPaid: c.totalPaid,
        balance: c.totalDue - c.totalPaid,
        collectionRate: c.totalDue > 0 ? Math.round((c.totalPaid / c.totalDue) * 100) : 0,
        paidStudents: c.paidStudents,
        unpaidStudents: c.unpaidStudents,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    const grandDue = classes.reduce((s, c) => s + c.totalDue, 0);
    const grandPaid = classes.reduce((s, c) => s + c.totalPaid, 0);

    return {
      month,
      classes,
      summary: {
        totalStudents: students.length,
        totalDue: grandDue,
        totalPaid: grandPaid,
        balance: grandDue - grandPaid,
        overallCollectionRate: grandDue > 0 ? Math.round((grandPaid / grandDue) * 100) : 0,
      },
    };
  },
});

/** Per-student fee details for a specific class in a given month. */
export const feeCollectionByClassStudents = query({
  args: {
    className: v.string(),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const now = new Date();
    const month = args.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [students, payments, structures, assignments, allClasses] = await Promise.all([
      ctx.db.query("students").filter((q) => q.eq(q.field("status"), "active")).collect(),
      ctx.db.query("feePayments").withIndex("by_period", (q) => q.eq("period", month)).collect(),
      ctx.db.query("feeStructures").collect(),
      ctx.db.query("feeAssignments").collect(),
      ctx.db.query("classes").collect(),
    ]);

    const classById = new Map(allClasses.map((c) => [c._id, c]));

    // Monthly base fee per class
    const baseByClassId = new Map<string, number>();
    for (const s of structures) {
      if (s.period !== "monthly") continue;
      baseByClassId.set(s.classId, (baseByClassId.get(s.classId) ?? 0) + s.amount);
    }

    // Per-student adjustments
    const adjByStudent = new Map<string, { amount: number; label: string }[]>();
    for (const a of assignments) {
      const list = adjByStudent.get(a.studentId) ?? [];
      list.push({ amount: a.amount, label: a.label });
      adjByStudent.set(a.studentId, list);
    }

    const classStudents = students
      .filter((s) => {
        const cls = classById.get(s.classId);
        return cls?.name === args.className && s.status === "active";
      })
      .map((student) => {
        const base = baseByClassId.get(student.classId) ?? 0;
        const adjs = adjByStudent.get(student._id) ?? [];
        const adjTotal = adjs.reduce((sum, a) => sum + a.amount, 0);
        const monthlyFee = Math.max(0, Math.round((base + adjTotal) * 100) / 100);

        const payment = payments.find((p) => p.studentId === student._id);
        const paid = payment?.amount ?? 0;
        const balance = Math.round((monthlyFee - paid) * 100) / 100;

        return {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          section: student.section,
          fatherName: student.fatherName,
          phone: student.phone ?? "",
          baseFee: base,
          adjustments: adjs.map((a) => ({ label: a.label, amount: a.amount })),
          adjustmentTotal: adjTotal,
          monthlyFee,
          paid,
          balance,
          receiptNo: payment?.receiptNo ?? null,
          paymentDate: payment?.date ?? null,
          status: paid >= monthlyFee && monthlyFee > 0 ? ("paid" as const) : ("unpaid" as const),
        };
      })
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

    const totalDue = classStudents.reduce((s, r) => s + r.monthlyFee, 0);
    const totalPaid = classStudents.reduce((s, r) => s + r.paid, 0);

    return {
      className: args.className,
      month,
      students: classStudents,
      summary: {
        total: classStudents.length,
        paid: classStudents.filter((s) => s.status === "paid").length,
        unpaid: classStudents.filter((s) => s.status === "unpaid").length,
        totalDue,
        totalPaid,
        balance: totalDue - totalPaid,
      },
    };
  },
});

/** Financial report — income vs expenses for a date range. */
export const financial = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;

    const [payments, expenses, payroll] = await Promise.all([
      ctx.db.query("feePayments").collect(),
      ctx.db.query("expenses").collect(),
      ctx.db.query("payrollRecords").collect(),
    ]);

    const from = args.from ?? "";
    const to = args.to ?? "9999";

    const filteredPayments = payments.filter(
      (p) => p.date >= from && p.date <= to,
    );
    const filteredExpenses = expenses.filter(
      (e) => e.date >= from && e.date <= to,
    );
    const filteredPayroll = payroll.filter(
      (r) => r.month >= from.slice(0, 7) && r.month <= to.slice(0, 7),
    );

    const totalIncome = filteredPayments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalPayroll = filteredPayroll
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + r.netPay, 0);

    return {
      income: totalIncome,
      expenses: totalExpenses,
      payroll: totalPayroll,
      netBalance: totalIncome - totalExpenses - totalPayroll,
      paymentCount: filteredPayments.length,
      expenseCount: filteredExpenses.length,
      payrollCount: filteredPayroll.length,
    };
  },
});
