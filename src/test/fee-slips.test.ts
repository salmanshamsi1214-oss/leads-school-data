import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════════════════════════════════
//          FEE SLIP LOGIC (mirrors feeSlips.ts backend)
// ═══════════════════════════════════════════════════════════════════

function computeFeeAmount(baseMonthly: number, adjustment: number): number {
  return Math.max(0, Math.round((baseMonthly + adjustment) * 100) / 100);
}

function computeBalance(totalAmount: number, paidAmount: number): number {
  return Math.round(Math.max(0, totalAmount - paidAmount) * 100) / 100;
}

function computeSlipStatus(balance: number): "paid" | "pending" | "overdue" {
  if (balance <= 0) return "paid";
  return "pending";
}

interface Student {
  _id: string;
  name: string;
  fatherName: string;
  rollNumber: string;
  classId: string;
  section: string;
  status: string;
  phone?: string;
}

interface FeeStructure {
  _id: string;
  classId: string;
  label: string;
  amount: number;
  period: string;
}

interface FeeAssignment {
  studentId: string;
  label: string;
  amount: number;
}

interface FeePayment {
  studentId: string;
  period: string;
  amount: number;
}

// ──── Classwise data computation (mirrors classwiseData query) ────
function computeClasswiseData(
  students: Student[],
  classId: string,
  section: string | undefined,
  feeStructures: FeeStructure[],
  feeAssignments: FeeAssignment[],
  payments: FeePayment[],
  period: string,
) {
  let target = students.filter(
    (s) => s.status === "active" && s.classId === classId,
  );
  if (section) {
    const sec = section.trim().toUpperCase();
    target = target.filter((s) => s.section === sec);
  }

  const monthlyFees = feeStructures.filter(
    (f) => f.classId === classId && f.period === "monthly",
  );
  const annualFees = feeStructures.filter(
    (f) => f.classId === classId && f.period === "annual",
  );

  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    if (p.period === period) {
      paidByStudent.set(
        p.studentId,
        (paidByStudent.get(p.studentId) ?? 0) + p.amount,
      );
    }
  }

  const adjustmentByStudent = new Map<string, number>();
  for (const a of feeAssignments) {
    adjustmentByStudent.set(
      a.studentId,
      (adjustmentByStudent.get(a.studentId) ?? 0) + a.amount,
    );
  }

  const totalMonthlyBase = monthlyFees.reduce((s, f) => s + f.amount, 0);
  const totalAnnual = annualFees.reduce((s, f) => s + f.amount, 0);

  const computedStudents = target.map((student) => {
    const adjustment = adjustmentByStudent.get(student._id) ?? 0;
    const totalMonthly = computeFeeAmount(totalMonthlyBase, adjustment);
    const paid = paidByStudent.get(student._id) ?? 0;
    const balance = computeBalance(totalMonthly, paid);

    return {
      studentId: student._id,
      name: student.name,
      fatherName: student.fatherName,
      rollNumber: student.rollNumber,
      section: student.section,
      totalMonthly,
      totalAnnual,
      paid,
      balance,
      adjustment,
    };
  });

  return {
    totalStudents: computedStudents.length,
    monthlyFees: monthlyFees.map((f) => ({ label: f.label, amount: f.amount })),
    annualFees: annualFees.map((f) => ({ label: f.label, amount: f.amount })),
    students: computedStudents,
  };
}

// ──── Fee slip filtering (mirrors list query) ────
interface FeeSlip {
  _id: string;
  studentId: string;
  classId: string;
  section: string;
  period: string;
  type: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  studentName?: string;
  className?: string;
}

function filterSlips(slips: FeeSlip[], filter: string): FeeSlip[] {
  if (filter === "all") return slips;
  return slips.filter((s) => s.status === filter);
}

// ──── Outstanding computation (mirrors outstanding query) ────
function computeOutstanding(
  students: Student[],
  feeStructures: FeeStructure[],
  feeAssignments: FeeAssignment[],
  payments: FeePayment[],
  monthsSoFar: number,
) {
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

  const rows = students
    .filter((s) => s.status === "active")
    .map((student) => {
      const baseMonthly = monthlyByClass.get(student.classId) ?? 0;
      const adjustment = adjustmentByStudent.get(student._id) ?? 0;
      const monthly = computeFeeAmount(baseMonthly, adjustment);
      const totalPaid = paidByStudent.get(student._id) ?? 0;
      const totalDue = Math.round(monthly * monthsSoFar * 100) / 100;
      const outstanding = computeBalance(totalDue, totalPaid);
      return { studentId: student._id, name: student.name, monthly, totalPaid, totalDue, outstanding };
    })
    .filter((r) => r.outstanding > 0);

  return {
    summary: {
      totalStudents: rows.length,
      totalOutstanding: Math.round(rows.reduce((s, r) => s + r.outstanding, 0) * 100) / 100,
    },
    rows,
  };
}

// ──── Challan HTML generation (mirrors frontend) ────
function generateChallanHTML(s: any, period: string): string {
  // Simplified version for testing — just checks the structure contains key elements
  const [year, month] = period.split("-");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[parseInt(month) - 1] || month;
  return `LEADS SCHOOL SYSTEM|ZEENAT CAMPUS|${monthName} ${year}|${s.name}|${s.rollNumber}|${s.className}|${s.totalMonthly}|${s.paid}|${s.balance}|${(s.annualFees || []).length}|${(s.monthlyFees || []).length}`;
}

// ═══════════════════════════════════════════════════════════════════
//                              TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Fee Amount Computation", () => {
  it("computes fee amount with no adjustment", () => {
    expect(computeFeeAmount(5000, 0)).toBe(5000);
  });

  it("computes fee amount with positive adjustment", () => {
    expect(computeFeeAmount(5000, 500)).toBe(5500);
  });

  it("computes fee amount with negative adjustment (discount)", () => {
    expect(computeFeeAmount(5000, -500)).toBe(4500);
  });

  it("floors at zero for large discounts", () => {
    expect(computeFeeAmount(5000, -10000)).toBe(0);
  });

  it("handles decimal rounding correctly", () => {
    expect(computeFeeAmount(5000.33, 100.67)).toBe(5101);
  });
});

describe("Balance Computation", () => {
  it("computes balance when unpaid", () => {
    expect(computeBalance(5000, 2000)).toBe(3000);
  });

  it("computes zero balance when fully paid", () => {
    expect(computeBalance(5000, 5000)).toBe(0);
  });

  it("floors at zero for overpayment", () => {
    expect(computeBalance(5000, 6000)).toBe(0);
  });

  it("handles exact amounts", () => {
    expect(computeBalance(3333.33, 1111.11)).toBe(2222.22);
  });
});

describe("Slip Status", () => {
  it("returns paid for zero balance", () => {
    expect(computeSlipStatus(0)).toBe("paid");
  });

  it("returns paid for negative balance (overpay)", () => {
    expect(computeSlipStatus(-100)).toBe("paid");
  });

  it("returns pending for positive balance", () => {
    expect(computeSlipStatus(1000)).toBe("pending");
  });
});

describe("Classwise Data Computation", () => {
  const students: Student[] = [
    { _id: "s1", name: "Ali", fatherName: "Ahmed", rollNumber: "001", classId: "cls1", section: "A", status: "active" },
    { _id: "s2", name: "Sara", fatherName: "Usman", rollNumber: "002", classId: "cls1", section: "A", status: "active" },
    { _id: "s3", name: "Hassan", fatherName: "Ali", rollNumber: "003", classId: "cls1", section: "B", status: "active" },
    { _id: "s4", name: "Zain", fatherName: "Khan", rollNumber: "004", classId: "cls2", section: "A", status: "active" },
  ];

  const feeStructures: FeeStructure[] = [
    { _id: "f1", classId: "cls1", label: "Monthly Tuition", amount: 5000, period: "monthly" },
    { _id: "f2", classId: "cls1", label: "Computer Fee", amount: 1000, period: "monthly" },
    { _id: "f3", classId: "cls1", label: "Annual Exam Fee", amount: 2000, period: "annual" },
    { _id: "f4", classId: "cls2", label: "Monthly Tuition", amount: 6000, period: "monthly" },
  ];

  it("filters by class and returns correct fee structure", () => {
    const data = computeClasswiseData(students, "cls1", undefined, feeStructures, [], [], "2026-08");
    expect(data.totalStudents).toBe(3); // s1, s2, s3 (cls1)
    expect(data.monthlyFees).toHaveLength(2);
    expect(data.monthlyFees[0].label).toBe("Monthly Tuition");
    expect(data.monthlyFees[1].label).toBe("Computer Fee");
    expect(data.annualFees).toHaveLength(1);
  });

  it("filters by class and section", () => {
    const data = computeClasswiseData(students, "cls1", "A", feeStructures, [], [], "2026-08");
    expect(data.totalStudents).toBe(2); // s1, s2 (cls1-A)
  });

  it("applies fee adjustments per student", () => {
    const assignments: FeeAssignment[] = [
      { studentId: "s1", label: "Transport", amount: 2000 },
    ];
    const data = computeClasswiseData(students, "cls1", "A", feeStructures, assignments, [], "2026-08");
    const ali = data.students.find((s) => s.studentId === "s1")!;
    const sara = data.students.find((s) => s.studentId === "s2")!;
    expect(ali.totalMonthly).toBe(8000); // 5000+1000+2000
    expect(ali.adjustment).toBe(2000);
    expect(sara.totalMonthly).toBe(6000); // 5000+1000
    expect(sara.adjustment).toBe(0);
  });

  it("computes balance correctly with payments", () => {
    const payments: FeePayment[] = [
      { studentId: "s1", period: "2026-08", amount: 5000 },
    ];
    const data = computeClasswiseData(students, "cls1", "A", feeStructures, [], payments, "2026-08");
    const ali = data.students.find((s) => s.studentId === "s1")!;
    const sara = data.students.find((s) => s.studentId === "s2")!;
    expect(ali.paid).toBe(5000);
    expect(ali.balance).toBe(1000); // 6000 - 5000
    expect(sara.paid).toBe(0);
    expect(sara.balance).toBe(6000);
  });

  it("handles zero fee structure", () => {
    const data = computeClasswiseData(students, "cls2", "A", feeStructures, [], [], "2026-08");
    expect(data.totalStudents).toBe(1);
    expect(data.students[0].totalMonthly).toBe(6000);
  });

  it("excludes inactive students", () => {
    const inactiveStudents: Student[] = [
      { _id: "s5", name: "Inactive", fatherName: "X", rollNumber: "005", classId: "cls1", section: "A", status: "left" },
    ];
    const data = computeClasswiseData([...students, ...inactiveStudents], "cls1", "A", feeStructures, [], [], "2026-08");
    expect(data.totalStudents).toBe(2); // only active students
  });

  it("only counts payments for the selected period", () => {
    const payments: FeePayment[] = [
      { studentId: "s1", period: "2026-07", amount: 6000 }, // wrong period
      { studentId: "s1", period: "2026-08", amount: 4000 },
    ];
    const data = computeClasswiseData(students, "cls1", "A", feeStructures, [], payments, "2026-08");
    const ali = data.students.find((s) => s.studentId === "s1")!;
    expect(ali.paid).toBe(4000);
    expect(ali.balance).toBe(2000); // 6000 - 4000
  });
});

describe("Fee Slip Filtering", () => {
  const slips: FeeSlip[] = [
    { _id: "1", studentId: "s1", classId: "cls1", section: "A", period: "2026-08", type: "challan", totalAmount: 6000, paidAmount: 6000, balance: 0, status: "paid" },
    { _id: "2", studentId: "s2", classId: "cls1", section: "A", period: "2026-08", type: "challan", totalAmount: 6000, paidAmount: 0, balance: 6000, status: "pending" },
    { _id: "3", studentId: "s3", classId: "cls1", section: "B", period: "2026-08", type: "slip", totalAmount: 6000, paidAmount: 0, balance: 6000, status: "overdue" },
  ];

  it("returns all when filter is 'all'", () => {
    expect(filterSlips(slips, "all")).toHaveLength(3);
  });

  it("filters by pending", () => {
    expect(filterSlips(slips, "pending")).toHaveLength(1);
    expect(filterSlips(slips, "pending")[0]._id).toBe("2");
  });

  it("filters by paid", () => {
    expect(filterSlips(slips, "paid")).toHaveLength(1);
  });

  it("filters by overdue", () => {
    expect(filterSlips(slips, "overdue")).toHaveLength(1);
  });
});

describe("Outstanding Computation", () => {
  const students: Student[] = [
    { _id: "s1", name: "Ali", fatherName: "X", rollNumber: "001", classId: "cls1", section: "A", status: "active" },
    { _id: "s2", name: "Sara", fatherName: "Y", rollNumber: "002", classId: "cls1", section: "A", status: "active" },
    { _id: "s3", name: "Inactive", fatherName: "Z", rollNumber: "003", classId: "cls1", section: "A", status: "left" },
  ];

  const feeStructures: FeeStructure[] = [
    { _id: "f1", classId: "cls1", label: "Tuition", amount: 5000, period: "monthly" },
  ];

  it("computes outstanding for active students only", () => {
    const result = computeOutstanding(students, feeStructures, [], [], 3); // 3 months
    // Ali: 5000 * 3 = 15000 due, 0 paid → 15000 outstanding
    // Sara: 5000 * 3 = 15000 due, 0 paid → 15000 outstanding
    // Inactive: excluded
    expect(result.summary.totalStudents).toBe(2);
    expect(result.summary.totalOutstanding).toBe(30000);
  });

  it("reduces outstanding with payments", () => {
    const payments: FeePayment[] = [
      { studentId: "s1", period: "2026-08", amount: 5000 },
      { studentId: "s1", period: "2026-07", amount: 5000 },
    ];
    const result = computeOutstanding(students, feeStructures, [], payments, 3);
    const ali = result.rows.find((r) => r.studentId === "s1")!;
    expect(ali.totalPaid).toBe(10000);
    expect(ali.outstanding).toBe(5000); // 15000 - 10000
  });

  it("excludes fully paid students from outstanding", () => {
    const payments: FeePayment[] = [
      { studentId: "s1", period: "2026-08", amount: 5000 },
      { studentId: "s1", period: "2026-07", amount: 5000 },
      { studentId: "s1", period: "2026-06", amount: 5000 },
    ];
    const result = computeOutstanding(students, feeStructures, [], payments, 3);
    expect(result.rows.find((r) => r.studentId === "s1")).toBeUndefined();
    expect(result.summary.totalStudents).toBe(1);
  });
});

describe("Challan HTML Generation", () => {
  it("includes school branding", () => {
    const html = generateChallanHTML(
      { name: "Ali", rollNumber: "001", className: "Class 5", totalMonthly: 6000, paid: 2000, balance: 4000, annualFees: [{ label: "Exam", amount: 2000 }], monthlyFees: [{ label: "Tuition", amount: 5000 }] },
      "2026-08",
    );
    expect(html).toContain("LEADS SCHOOL SYSTEM");
    expect(html).toContain("ZEENAT CAMPUS");
    expect(html).toContain("Ali");
    expect(html).toContain("001");
    expect(html).toContain("Class 5");
  });

  it("formats month name correctly", () => {
    const html = generateChallanHTML({ name: "X", rollNumber: "1", className: "A", totalMonthly: 0, paid: 0, balance: 0, annualFees: [], monthlyFees: [] }, "2026-08");
    expect(html).toContain("August 2026");
  });

  it("includes annual and monthly fee counts", () => {
    const html = generateChallanHTML(
      { name: "X", rollNumber: "1", className: "A", totalMonthly: 6000, paid: 0, balance: 6000, annualFees: [{ label: "A", amount: 1000 }], monthlyFees: [{ label: "B", amount: 2000 }, { label: "C", amount: 3000 }] },
      "2026-01",
    );
    expect(html).toContain("|1|"); // 1 annual fee
    expect(html).toMatch(/\|2$/); // 2 monthly fees (at end of stripped content)
  });
});
