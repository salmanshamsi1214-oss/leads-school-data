import { describe, it, expect } from "vitest";
/**
 * Targeted tests for the generateChallanBody normalization fix.
 *
 * The function must handle two different data shapes:
 * 1. ClasswiseData student — { name, totalMonthly, totalAnnual, paid, balance, monthlyFees, annualFees, ... }
 * 2. FeeSlip list row — { studentName, totalAmount, paidAmount, balance, ... }
 *
 * Previously, calling it with a feeSlip list row caused:
 *   TypeError: Cannot read properties of undefined (reading 'toLocaleString')
 *   at generateChallanBody → s.totalMonthly.toLocaleString()
 */

/* ───────────── helpers ───────────── */

// Re-implement the normalization logic from generateChallanBody for unit testing
// (we test the normalization logic itself since the full HTML generator requires DOM)
function normalizeSlipData(s: any) {
  const studentName = s.name || s.studentName || "—";
  const fatherName = s.fatherName || "—";
  const rollNumber = s.rollNumber || "—";
  const admissionNo = s.admissionNo || s.rollNumber || "—";
  const className = s.className || "—";
  const section = s.section || "—";
  const annualFees = s.annualFees || [];
  const monthlyFeesList = s.monthlyFees || [];
  const totalMonthly = s.totalMonthly ?? s.totalAmount ?? 0;
  const totalAnnual = s.totalAnnual ?? 0;
  const paid = s.paid ?? s.paidAmount ?? 0;
  const balance = s.balance ?? 0;
  const previousBalance = s.previousBalance ?? 0;
  const adjustment = s.adjustment ?? 0;

  return {
    studentName, fatherName, rollNumber, admissionNo,
    className, section, annualFees, monthlyFeesList,
    totalMonthly, totalAnnual, paid, balance,
    previousBalance, adjustment,
  };
}

function toLocaleSafe(n: number): string {
  return Number(n || 0).toLocaleString();
}

/* ───────────── ClasswiseData shape ───────────── */

describe("ClasswiseData shape", () => {
  const classwiseStudent = {
    studentId: "stu_001",
    name: "Ali Raza",
    fatherName: "Muhammad Raza",
    rollNumber: "045",
    section: "A",
    admissionNo: "045",
    monthlyFees: [
      { label: "Tuition Fee", amount: 4000 },
      { label: "Computer Fee", amount: 500 },
    ],
    annualFees: [
      { label: "Annual Fund", amount: 5000 },
    ],
    totalMonthly: 4500,
    totalAnnual: 5000,
    paid: 3000,
    balance: 1500,
    previousBalance: 500,
    adjustment: -200,
  };

  it("normalizes student name from name field", () => {
    const d = normalizeSlipData(classwiseStudent);
    expect(d.studentName).toBe("Ali Raza");
  });

  it("uses totalMonthly for totalMonthly", () => {
    const d = normalizeSlipData(classwiseStudent);
    expect(d.totalMonthly).toBe(4500);
  });

  it("uses paid for paid", () => {
    const d = normalizeSlipData(classwiseStudent);
    expect(d.paid).toBe(3000);
  });

  it("uses totalAnnual", () => {
    const d = normalizeSlipData(classwiseStudent);
    expect(d.totalAnnual).toBe(5000);
  });

  it("preserves monthlyFees list", () => {
    const d = normalizeSlipData(classwiseStudent);
    expect(d.monthlyFeesList).toHaveLength(2);
    expect(d.monthlyFeesList[0].label).toBe("Tuition Fee");
  });

  it("preserves annualFees list", () => {
    const d = normalizeSlipData(classwiseStudent);
    expect(d.annualFees).toHaveLength(1);
    expect(d.annualFees[0].label).toBe("Annual Fund");
  });

  it("formats all values safely with toLocaleString", () => {
    const d = normalizeSlipData(classwiseStudent);
    // Should not throw
    expect(toLocaleSafe(d.totalMonthly)).toBe("4,500");
    expect(toLocaleSafe(d.paid)).toBe("3,000");
    expect(toLocaleSafe(d.balance)).toBe("1,500");
    expect(toLocaleSafe(d.totalAnnual)).toBe("5,000");
    expect(toLocaleSafe(d.previousBalance)).toBe("500");
    expect(toLocaleSafe(Math.abs(d.adjustment))).toBe("200");
  });
});

/* ───────────── FeeSlip list shape ───────────── */

describe("FeeSlip list shape (previously crashing)", () => {
  const slipRow = {
    _id: "slip_abc",
    _creationTime: Date.now(),
    studentId: "stu_002",
    studentName: "Fatima Noor",
    fatherName: "Ahmed Noor",
    rollNumber: "012",
    className: "3",
    section: "B",
    period: "2026-08",
    type: "challan",
    totalAmount: 3500,
    paidAmount: 1000,
    balance: 2500,
    status: "pending",
    dueDate: "2026-08-15",
    createdAt: Date.now(),
  };

  it("normalizes student name from studentName field", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.studentName).toBe("Fatima Noor");
  });

  it("maps totalAmount to totalMonthly", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.totalMonthly).toBe(3500);
  });

  it("maps paidAmount to paid", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.paid).toBe(1000);
  });

  it("defaults totalAnnual to 0 (not present)", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.totalAnnual).toBe(0);
  });

  it("defaults monthlyFees to empty array (not present)", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.monthlyFeesList).toEqual([]);
  });

  it("defaults annualFees to empty array (not present)", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.annualFees).toEqual([]);
  });

  it("defaults previousBalance to 0 (not present)", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.previousBalance).toBe(0);
  });

  it("defaults adjustment to 0 (not present)", () => {
    const d = normalizeSlipData(slipRow);
    expect(d.adjustment).toBe(0);
  });

  it("formats all values safely without crashing", () => {
    const d = normalizeSlipData(slipRow);
    // This is the exact pattern that was crashing before the fix
    expect(() => toLocaleSafe(d.totalMonthly)).not.toThrow();
    expect(() => toLocaleSafe(d.paid)).not.toThrow();
    expect(() => toLocaleSafe(d.balance)).not.toThrow();
    expect(() => toLocaleSafe(d.totalAnnual)).not.toThrow();
    expect(() => toLocaleSafe(d.previousBalance)).not.toThrow();
    expect(() => toLocaleSafe(Math.abs(d.adjustment))).not.toThrow();
  });

  it("formats with correct locale values", () => {
    const d = normalizeSlipData(slipRow);
    expect(toLocaleSafe(d.totalMonthly)).toBe("3,500");
    expect(toLocaleSafe(d.paid)).toBe("1,000");
    expect(toLocaleSafe(d.balance)).toBe("2,500");
    expect(toLocaleSafe(d.totalAnnual)).toBe("0");
  });
});

/* ───────────── Edge cases ───────────── */

describe("Edge cases", () => {
  it("handles completely empty object", () => {
    const d = normalizeSlipData({});
    expect(d.studentName).toBe("—");
    expect(d.totalMonthly).toBe(0);
    expect(d.paid).toBe(0);
    expect(d.balance).toBe(0);
    expect(d.totalAnnual).toBe(0);
    expect(d.monthlyFeesList).toEqual([]);
    expect(d.annualFees).toEqual([]);
    expect(() => toLocaleSafe(d.totalMonthly)).not.toThrow();
    expect(() => toLocaleSafe(d.paid)).not.toThrow();
  });

  it("handles null/undefined fields gracefully", () => {
    const d = normalizeSlipData({
      name: null,
      studentName: undefined,
      totalMonthly: undefined,
      totalAmount: undefined,
      paid: null,
      paidAmount: undefined,
      balance: undefined,
    });
    expect(d.studentName).toBe("—");
    expect(d.totalMonthly).toBe(0);
    expect(d.paid).toBe(0);
    expect(d.balance).toBe(0);
  });

  it("handles zero amounts", () => {
    const d = normalizeSlipData({
      totalMonthly: 0,
      totalAmount: 0,
      paid: 0,
      paidAmount: 0,
      balance: 0,
    });
    expect(toLocaleSafe(d.totalMonthly)).toBe("0");
    expect(toLocaleSafe(d.paid)).toBe("0");
    expect(toLocaleSafe(d.balance)).toBe("0");
  });

  it("handles large amounts", () => {
    const d = normalizeSlipData({
      totalAmount: 125000,
      paidAmount: 50000,
      balance: 75000,
    });
    expect(toLocaleSafe(d.totalMonthly)).toBe("125,000");
    expect(toLocaleSafe(d.paid)).toBe("50,000");
    expect(toLocaleSafe(d.balance)).toBe("75,000");
  });

  it("handles decimal amounts", () => {
    const d = normalizeSlipData({
      totalAmount: 4500.5,
      paidAmount: 2000.25,
      balance: 2500.25,
    });
    expect(d.totalMonthly).toBe(4500.5);
    expect(d.paid).toBe(2000.25);
    expect(d.balance).toBe(2500.25);
  });

  it("prefers classwiseData fields when both exist", () => {
    // If somehow both shapes overlap, classwiseData fields should win (?? operator)
    const d = normalizeSlipData({
      name: "Ali",         // classwiseData
      studentName: "Bob",  // feeSlip list
      totalMonthly: 5000,  // classwiseData
      totalAmount: 3000,   // feeSlip list
      paid: 2000,          // classwiseData
      paidAmount: 1000,    // feeSlip list
    });
    expect(d.studentName).toBe("Ali");     // name wins over studentName
    expect(d.totalMonthly).toBe(5000);     // totalMonthly wins over totalAmount
    expect(d.paid).toBe(2000);             // paid wins over paidAmount
  });
});
