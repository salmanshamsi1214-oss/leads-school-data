import type { FeeMethod, FeePeriod } from "@/convex/schema";

export const FEE_METHOD_LABELS: Record<FeeMethod, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  other: "Other",
};

export const FEE_PERIOD_LABELS: Record<FeePeriod, string> = {
  monthly: "Monthly",
  annual: "Annual",
  admission: "Admission",
};

/** "2026-08" -> "August 2026" */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return period;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}
