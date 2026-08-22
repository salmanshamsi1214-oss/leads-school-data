import { describe, it, expect } from "vitest";

/**
 * Targeted tests for the feeManagement module business logic.
 *
 * Since Convex server functions require the Convex runtime, we test the
 * pure logic patterns: period generation, balance calculations, fine status
 * transitions, ledger running balance, defaulter aggregation, daily closing
 * aggregation, collection report calculations, and audit log filtering.
 */

// ═══════════════════════════════════════════════════════════════════
//                  PERIOD GENERATION (defaulterReport)
// ═══════════════════════════════════════════════════════════════════

function generatePeriods(asOfMonth: string, monthsBack: number): string[] {
  const [year, month] = asOfMonth.split("-").map(Number);
  const periods: string[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const m = month - i;
    const y = m <= 0 ? year - 1 : year;
    const mm = m <= 0 ? m + 12 : m;
    periods.push(`${y}-${String(mm).padStart(2, "0")}`);
  }
  return periods;
}

describe("Period generation", () => {
  it("generates 6 months back from 2026-08", () => {
    const periods = generatePeriods("2026-08", 6);
    expect(periods).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
    ]);
  });

  it("crosses year boundary from 2026-02", () => {
    const periods = generatePeriods("2026-02", 4);
    expect(periods).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });

  it("1 month back is just the current month", () => {
    const periods = generatePeriods("2026-01", 1);
    expect(periods).toEqual(["2026-01"]);
  });

  it("12 months generates full year", () => {
    const periods = generatePeriods("2026-08", 12);
    expect(periods).toHaveLength(12);
    expect(periods[0]).toBe("2026-08");
    expect(periods[11]).toBe("2025-09");
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  FINE STATUS TRANSITIONS (payFine / waiveFine)
// ═══════════════════════════════════════════════════════════════════

function computeFineStatus(
  amount: number,
  paidAmount: number,
): "pending" | "paid" {
  const newPaid = Math.round((paidAmount) * 100) / 100;
  return newPaid >= amount ? "paid" : "pending";
}

function computePartialPayResult(
  fineAmount: number,
  currentPaid: number,
  payAmount: number,
): { paid: number; status: "pending" | "paid" } {
  const newPaid = Math.round((currentPaid + payAmount) * 100) / 100;
  const status = newPaid >= fineAmount ? "paid" : "pending";
  return { paid: newPaid, status };
}

describe("Fine status transitions", () => {
  it("full payment marks as paid", () => {
    const result = computePartialPayResult(500, 0, 500);
    expect(result).toEqual({ paid: 500, status: "paid" });
  });

  it("partial payment stays pending", () => {
    const result = computePartialPayResult(500, 0, 200);
    expect(result).toEqual({ paid: 200, status: "pending" });
  });

  it("incremental payments eventually pay off", () => {
    let result = computePartialPayResult(500, 0, 200);
    expect(result.status).toBe("pending");
    result = computePartialPayResult(500, result.paid, 200);
    expect(result.status).toBe("pending");
    result = computePartialPayResult(500, result.paid, 100);
    expect(result.status).toBe("paid");
    expect(result.paid).toBe(500);
  });

  it("overpayment is treated as paid", () => {
    const result = computePartialPayResult(500, 0, 600);
    expect(result.status).toBe("paid");
    expect(result.paid).toBe(600);
  });

  it("zero amount fine is immediately paid", () => {
    const status = computeFineStatus(0, 0);
    expect(status).toBe("paid");
  });

  it("decimal amounts round correctly", () => {
    const result = computePartialPayResult(100.33, 50.11, 50.22);
    expect(result.paid).toBe(100.33);
    expect(result.status).toBe("paid");
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  REFUND VALIDATION
// ═══════════════════════════════════════════════════════════════════

function validateRefund(paymentAmount: number, refundAmount: number): string | null {
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) return "Amount must be positive.";
  if (refundAmount > paymentAmount + 0.01) return "Refund cannot exceed payment amount.";
  return null;
}

describe("Refund validation", () => {
  it("full refund is valid", () => {
    expect(validateRefund(1000, 1000)).toBeNull();
  });

  it("partial refund is valid", () => {
    expect(validateRefund(1000, 500)).toBeNull();
  });

  it("refund exceeding payment is rejected", () => {
    expect(validateRefund(1000, 1001)).toBe("Refund cannot exceed payment amount.");
  });

  it("zero refund is rejected", () => {
    expect(validateRefund(1000, 0)).toBe("Amount must be positive.");
  });

  it("negative refund is rejected", () => {
    expect(validateRefund(1000, -100)).toBe("Amount must be positive.");
  });

  it("NaN refund is rejected", () => {
    expect(validateRefund(1000, NaN)).toBe("Amount must be positive.");
  });

  it("Infinity refund is rejected", () => {
    expect(validateRefund(1000, Infinity)).toBe("Amount must be positive.");
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  LEDGER RUNNING BALANCE
// ═══════════════════════════════════════════════════════════════════

interface LedgerTransaction {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

function computeRunningBalance(transactions: LedgerTransaction[]): LedgerTransaction[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let runningBalance = 0;
  for (const t of sorted) {
    runningBalance = Math.round((runningBalance + t.debit - t.credit) * 100) / 100;
    t.balance = runningBalance;
  }
  return sorted;
}

describe("Ledger running balance", () => {
  it("single payment produces negative balance (credit)", () => {
    const txns = computeRunningBalance([
      { date: "2026-08-01", type: "payment", description: "Fee", debit: 0, credit: 5000, balance: 0 },
    ]);
    expect(txns[0].balance).toBe(-5000);
  });

  it("fine then payment balances out", () => {
    const txns = computeRunningBalance([
      { date: "2026-08-01", type: "fine", description: "Late fee", debit: 500, credit: 0, balance: 0 },
      { date: "2026-08-05", type: "payment", description: "Fee", debit: 0, credit: 500, balance: 0 },
    ]);
    expect(txns[0].balance).toBe(500);
    expect(txns[1].balance).toBe(0);
  });

  it("multiple transactions in order", () => {
    const txns = computeRunningBalance([
      { date: "2026-08-10", type: "payment", description: "Partial", debit: 0, credit: 3000, balance: 0 },
      { date: "2026-08-01", type: "payment", description: "Fee", debit: 0, credit: 2000, balance: 0 },
      { date: "2026-08-05", type: "fine", description: "Late", debit: 500, credit: 0, balance: 0 },
    ]);
    // Sorted: Aug 01, Aug 05, Aug 10
    expect(txns[0].date).toBe("2026-08-01");
    expect(txns[0].balance).toBe(-2000);
    expect(txns[1].balance).toBe(-1500); // -2000 + 500
    expect(txns[2].balance).toBe(-4500); // -1500 - 3000
  });

  it("empty ledger has zero balance", () => {
    const txns = computeRunningBalance([]);
    expect(txns).toEqual([]);
  });

  it("handles decimal amounts without float drift", () => {
    const txns = computeRunningBalance([
      { date: "2026-08-01", type: "payment", description: "Fee", debit: 0, credit: 100.10, balance: 0 },
      { date: "2026-08-02", type: "fine", description: "Fine", debit: 50.20, credit: 0, balance: 0 },
    ]);
    expect(txns[0].balance).toBe(-100.1);
    expect(txns[1].balance).toBe(-49.9);
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  DEFAULTER AGGREGATION
// ═══════════════════════════════════════════════════════════════════

interface DefaulterInput {
  studentId: string;
  name: string;
  monthly: number;
  periods: string[];
  paidByPeriod: Record<string, number>;
  finesByPeriod: Record<string, number>;
}

interface DefaulterRow {
  studentId: string;
  name: string;
  monthly: number;
  totalDue: number;
  totalPaid: number;
  totalFines: number;
  totalOutstanding: number;
  monthsOwed: number;
}

function computeDefaulterRows(students: DefaulterInput[]): DefaulterRow[] {
  return students
    .map((s) => {
      let totalDue = 0;
      let totalPaid = 0;
      let totalFines = 0;
      let monthsOwed = 0;

      for (const p of s.periods) {
        const due = s.monthly;
        const paid = s.paidByPeriod[p] ?? 0;
        const fine = s.finesByPeriod[p] ?? 0;
        totalDue += due;
        totalPaid += paid;
        totalFines += fine;
        if (due - paid > 0 || fine > 0) monthsOwed++;
      }

      const totalOutstanding = Math.round((totalDue - totalPaid + totalFines) * 100) / 100;
      return {
        studentId: s.studentId,
        name: s.name,
        monthly: s.monthly,
        totalDue,
        totalPaid,
        totalFines,
        totalOutstanding,
        monthsOwed,
      };
    })
    .filter((r) => r.totalOutstanding > 0)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

describe("Defaulter aggregation", () => {
  const periods = ["2026-08", "2026-07", "2026-06"];

  it("fully paid student is excluded", () => {
    const rows = computeDefaulterRows([
      {
        studentId: "s1",
        name: "Ali",
        monthly: 5000,
        periods,
        paidByPeriod: { "2026-08": 5000, "2026-07": 5000, "2026-06": 5000 },
        finesByPeriod: {},
      },
    ]);
    expect(rows).toHaveLength(0);
  });

  it("unpaid student appears with correct totals", () => {
    const rows = computeDefaulterRows([
      {
        studentId: "s2",
        name: "Ahmed",
        monthly: 5000,
        periods,
        paidByPeriod: { "2026-07": 5000 },
        finesByPeriod: {},
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalDue).toBe(15000);
    expect(rows[0].totalPaid).toBe(5000);
    expect(rows[0].totalOutstanding).toBe(10000);
    expect(rows[0].monthsOwed).toBe(2); // Aug + Jun
  });

  it("fines increase outstanding", () => {
    const rows = computeDefaulterRows([
      {
        studentId: "s3",
        name: "Bilal",
        monthly: 5000,
        periods: ["2026-08"],
        paidByPeriod: { "2026-08": 5000 },
        finesByPeriod: { "2026-08": 500 },
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalOutstanding).toBe(500); // 5000 - 5000 + 500
  });

  it("sorted by outstanding descending", () => {
    const rows = computeDefaulterRows([
      {
        studentId: "s1",
        name: "Low",
        monthly: 5000,
        periods: ["2026-08"],
        paidByPeriod: { "2026-08": 4000 },
        finesByPeriod: {},
      },
      {
        studentId: "s2",
        name: "High",
        monthly: 5000,
        periods: ["2026-08"],
        paidByPeriod: {},
        finesByPeriod: {},
      },
    ]);
    expect(rows[0].name).toBe("High");
    expect(rows[1].name).toBe("Low");
  });

  it("summary totals are correct", () => {
    const rows = computeDefaulterRows([
      {
        studentId: "s1",
        name: "A",
        monthly: 5000,
        periods: ["2026-08"],
        paidByPeriod: {},
        finesByPeriod: {},
      },
      {
        studentId: "s2",
        name: "B",
        monthly: 5000,
        periods: ["2026-08"],
        paidByPeriod: { "2026-08": 3000 },
        finesByPeriod: { "2026-08": 200 },
      },
    ]);
    const summary = {
      totalDefaulters: rows.length,
      totalOutstanding: rows.reduce((s, r) => s + r.totalOutstanding, 0),
      totalFines: rows.reduce((s, r) => s + r.totalFines, 0),
    };
    expect(summary.totalDefaulters).toBe(2);
    expect(summary.totalOutstanding).toBe(7200); // 5000 + 2200
    expect(summary.totalFines).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  DAILY CLOSING AGGREGATION
// ═══════════════════════════════════════════════════════════════════

interface Payment {
  studentId: string;
  amount: number;
  method: string;
  date: string;
  receiptNo: string;
}

function computeDailyClosing(payments: Payment[], targetDate: string) {
  const todayPayments = payments.filter((p) => p.date === targetDate);

  const byMethod: Record<string, number> = {};
  for (const p of todayPayments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  }

  const totalCollected = todayPayments.reduce((s, p) => s + p.amount, 0);

  return {
    date: targetDate,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalTransactions: todayPayments.length,
    byMethod,
  };
}

describe("Daily closing", () => {
  const payments: Payment[] = [
    { studentId: "s1", amount: 5000, method: "cash", date: "2026-08-15", receiptNo: "R001" },
    { studentId: "s2", amount: 3000, method: "bank", date: "2026-08-15", receiptNo: "R002" },
    { studentId: "s3", amount: 5000, method: "cash", date: "2026-08-15", receiptNo: "R003" },
    { studentId: "s4", amount: 2000, method: "easypaisa", date: "2026-08-14", receiptNo: "R004" },
  ];

  it("counts only today's payments", () => {
    const result = computeDailyClosing(payments, "2026-08-15");
    expect(result.totalTransactions).toBe(3);
  });

  it("sums total collected correctly", () => {
    const result = computeDailyClosing(payments, "2026-08-15");
    expect(result.totalCollected).toBe(13000);
  });

  it("aggregates by payment method", () => {
    const result = computeDailyClosing(payments, "2026-08-15");
    expect(result.byMethod).toEqual({
      cash: 10000,
      bank: 3000,
    });
  });

  it("no payments on a different date", () => {
    const result = computeDailyClosing(payments, "2026-08-20");
    expect(result.totalTransactions).toBe(0);
    expect(result.totalCollected).toBe(0);
    expect(result.byMethod).toEqual({});
  });

  it("single payment", () => {
    const result = computeDailyClosing(
      [{ studentId: "s1", amount: 7500, method: "jazzcash", date: "2026-08-15", receiptNo: "R010" }],
      "2026-08-15",
    );
    expect(result.totalTransactions).toBe(1);
    expect(result.totalCollected).toBe(7500);
    expect(result.byMethod.jazzcash).toBe(7500);
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  COLLECTION REPORT CALCULATIONS
// ═══════════════════════════════════════════════════════════════════

interface ClassReportInput {
  classId: string;
  className: string;
  studentCount: number;
  baseMonthly: number;
  students: Array<{
    name: string;
    monthly: number;
    paid: number;
    fine: number;
  }>;
}

function computeClassReport(input: ClassReportInput) {
  let totalExpected = 0;
  let totalCollected = 0;
  let totalFines = 0;
  let paidCount = 0;
  let dueCount = 0;

  for (const s of input.students) {
    totalExpected += s.monthly;
    totalCollected += s.paid;
    totalFines += s.fine;
    if (s.paid >= s.monthly && s.fine === 0) paidCount++;
    else dueCount++;
  }

  const outstanding = Math.round((totalExpected - totalCollected + totalFines) * 100) / 100;
  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

  return {
    className: input.className,
    studentCount: input.studentCount,
    baseMonthly: input.baseMonthly,
    totalExpected: Math.round(totalExpected * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalFines: Math.round(totalFines * 100) / 100,
    outstanding,
    collectionRate,
    paidCount,
    dueCount,
  };
}

describe("Collection report", () => {
  it("100% collection rate when all paid", () => {
    const report = computeClassReport({
      classId: "c1",
      className: "5-A",
      studentCount: 3,
      baseMonthly: 5000,
      students: [
        { name: "A", monthly: 5000, paid: 5000, fine: 0 },
        { name: "B", monthly: 5000, paid: 5000, fine: 0 },
        { name: "C", monthly: 5000, paid: 5000, fine: 0 },
      ],
    });
    expect(report.collectionRate).toBe(100);
    expect(report.paidCount).toBe(3);
    expect(report.dueCount).toBe(0);
    expect(report.outstanding).toBe(0);
  });

  it("partial collection", () => {
    const report = computeClassReport({
      classId: "c1",
      className: "5-A",
      studentCount: 3,
      baseMonthly: 5000,
      students: [
        { name: "A", monthly: 5000, paid: 5000, fine: 0 },
        { name: "B", monthly: 5000, paid: 3000, fine: 0 },
        { name: "C", monthly: 5000, paid: 0, fine: 0 },
      ],
    });
    expect(report.totalExpected).toBe(15000);
    expect(report.totalCollected).toBe(8000);
    expect(report.collectionRate).toBeCloseTo(53.3, 0);
    expect(report.paidCount).toBe(1);
    expect(report.dueCount).toBe(2);
  });

  it("fines add to outstanding", () => {
    const report = computeClassReport({
      classId: "c1",
      className: "5-A",
      studentCount: 1,
      baseMonthly: 5000,
      students: [
        { name: "A", monthly: 5000, paid: 5000, fine: 500 },
      ],
    });
    expect(report.outstanding).toBe(500); // 5000 - 5000 + 500
    expect(report.paidCount).toBe(0); // has fine, so counted as due
    expect(report.dueCount).toBe(1);
  });

  it("adjustments via per-student monthly", () => {
    const report = computeClassReport({
      classId: "c1",
      className: "5-A",
      studentCount: 2,
      baseMonthly: 5000,
      students: [
        { name: "A", monthly: 5500, paid: 5500, fine: 0 }, // +500 adjustment
        { name: "B", monthly: 4500, paid: 4500, fine: 0 }, // -500 adjustment
      ],
    });
    expect(report.totalExpected).toBe(10000); // Adjusted, not baseMonthly*count
    expect(report.totalCollected).toBe(10000);
    expect(report.collectionRate).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  AUDIT LOG FILTERING
// ═══════════════════════════════════════════════════════════════════

interface AuditLog {
  studentId: string;
  action: string;
  amount: number;
  timestamp: number;
  period?: string;
}

function filterAuditLogs(
  logs: AuditLog[],
  opts: { action?: string; fromTimestamp?: number; toTimestamp?: number; limit?: number },
): AuditLog[] {
  let rows = [...logs];
  if (opts.action) rows = rows.filter((r) => r.action === opts.action);
  if (opts.fromTimestamp) rows = rows.filter((r) => r.timestamp >= opts.fromTimestamp!);
  if (opts.toTimestamp) rows = rows.filter((r) => r.timestamp <= opts.toTimestamp!);
  rows.sort((a, b) => b.timestamp - a.timestamp);
  return rows.slice(0, opts.limit ?? 100);
}

describe("Audit log filtering", () => {
  const logs: AuditLog[] = [
    { studentId: "s1", action: "payment", amount: 5000, timestamp: 1000 },
    { studentId: "s2", action: "refund", amount: 1000, timestamp: 2000 },
    { studentId: "s1", action: "fine", amount: 500, timestamp: 3000 },
    { studentId: "s3", action: "payment", amount: 3000, timestamp: 4000 },
    { studentId: "s2", action: "fine_waived", amount: 200, timestamp: 5000 },
  ];

  it("filters by action", () => {
    const result = filterAuditLogs(logs, { action: "payment" });
    expect(result).toHaveLength(2);
    expect(result.every((l) => l.action === "payment")).toBe(true);
  });

  it("filters by timestamp range", () => {
    const result = filterAuditLogs(logs, { fromTimestamp: 2000, toTimestamp: 4000 });
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.timestamp).sort()).toEqual([2000, 3000, 4000]);
  });

  it("applies limit", () => {
    const result = filterAuditLogs(logs, { limit: 2 });
    expect(result).toHaveLength(2);
    // Most recent first
    expect(result[0].timestamp).toBe(5000);
    expect(result[1].timestamp).toBe(4000);
  });

  it("returns all when no filters", () => {
    const result = filterAuditLogs(logs, {});
    expect(result).toHaveLength(5);
    // Sorted desc
    expect(result[0].timestamp).toBe(5000);
  });

  it("empty logs returns empty array", () => {
    const result = filterAuditLogs([], { action: "payment" });
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  PAYMENT VALIDATION
// ═══════════════════════════════════════════════════════════════════

function validateFineAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be positive.";
  return null;
}

function validatePeriod(period: string): boolean {
  return /^\d{4}-\d{2}$/.test(period);
}

function validateDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

describe("Input validation", () => {
  it("valid period format", () => {
    expect(validatePeriod("2026-08")).toBe(true);
    expect(validatePeriod("2026-12")).toBe(true);
  });

  it("invalid period formats", () => {
    expect(validatePeriod("2026/08")).toBe(false);
    expect(validatePeriod("26-08")).toBe(false);
    expect(validatePeriod("august-2026")).toBe(false);
    expect(validatePeriod("")).toBe(false);
  });

  it("valid date format", () => {
    expect(validateDate("2026-08-15")).toBe(true);
  });

  it("invalid date formats", () => {
    expect(validateDate("2026/08/15")).toBe(false);
    expect(validateDate("15-08-2026")).toBe(false);
  });

  it("fine amount must be positive", () => {
    expect(validateFineAmount(500)).toBeNull();
    expect(validateFineAmount(0.01)).toBeNull();
    expect(validateFineAmount(0)).toBe("Amount must be positive.");
    expect(validateFineAmount(-100)).toBe("Amount must be positive.");
    expect(validateFineAmount(NaN)).toBe("Amount must be positive.");
  });
});

// ═══════════════════════════════════════════════════════════════════
//                  EDGE CASES & INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("defaulter report with 0 months back", () => {
    const periods = generatePeriods("2026-08", 0);
    expect(periods).toEqual([]);
  });

  it("ledger with only fines (no payments)", () => {
    const txns = computeRunningBalance([
      { date: "2026-08-01", type: "fine", description: "Library fine", debit: 200, credit: 0, balance: 0 },
      { date: "2026-08-15", type: "fine", description: "Damage fine", debit: 500, credit: 0, balance: 0 },
    ]);
    expect(txns[0].balance).toBe(200);
    expect(txns[1].balance).toBe(700);
  });

  it("daily closing with all different methods", () => {
    const payments: Payment[] = [
      { studentId: "s1", amount: 1000, method: "cash", date: "2026-08-15", receiptNo: "R1" },
      { studentId: "s2", amount: 1000, method: "bank", date: "2026-08-15", receiptNo: "R2" },
      { studentId: "s3", amount: 1000, method: "easypaisa", date: "2026-08-15", receiptNo: "R3" },
      { studentId: "s4", amount: 1000, method: "jazzcash", date: "2026-08-15", receiptNo: "R4" },
    ];
    const result = computeDailyClosing(payments, "2026-08-15");
    expect(result.byMethod).toEqual({
      cash: 1000,
      bank: 1000,
      easypaisa: 1000,
      jazzcash: 1000,
    });
    expect(result.totalCollected).toBe(4000);
  });

  it("collection rate with zero expected", () => {
    const report = computeClassReport({
      classId: "c1",
      className: "1-A",
      studentCount: 0,
      baseMonthly: 0,
      students: [],
    });
    expect(report.collectionRate).toBe(0);
    expect(report.totalExpected).toBe(0);
    expect(report.outstanding).toBe(0);
  });
});
