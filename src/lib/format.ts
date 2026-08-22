/** Local YYYY-MM-DD for "today" in the browser's timezone. */
export function todayStr(): string {
  const now = new Date();
  return toIsoDate(now);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Local YYYY-MM-DD for n days before today. */
export function daysAgoStr(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toIsoDate(date);
}

/** "2026-08-17" -> "17 Aug 2026" */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-08-17" -> "Aug 2026" */
export function formatMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Short weekday, e.g. "Mon". */
export function formatWeekday(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const monthStr = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${monthStr}-01`,
    to: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Formats an amount as Pakistani rupees, e.g. 12500 -> "Rs 12,500". */
export function formatPkr(amount: number): string {
  const formatted = Math.round(amount).toLocaleString("en-PK");
  return `Rs ${formatted}`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

const twoDigits = (n: number): string => {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones > 0 ? ` ${ONES[ones]}` : ""}`;
};

const threeDigits = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(" ");
};

/**
 * Converts a rupee amount to words using the Pakistani (Indian) numbering
 * system — e.g. 12500 -> "Twelve Thousand Five Hundred". Paisa is included
 * when the amount has a fractional part. Supports up to 99 crore.
 */
export function numberToWords(value: number): string {
  const amount = Math.round(Math.abs(value) * 100) / 100;
  const rupees = Math.floor(amount);
  const paisa = Math.round((amount - rupees) * 100);

  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1_000);
  const rest = rupees % 1_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));

  let words = parts.length > 0 ? parts.join(" ") : "Zero";
  if (paisa > 0) words += ` and ${twoDigits(paisa)} Paisa`;
  return words;
}

export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return round1((part / total) * 100);
}

const escapeCsvCell = (value: string | number): string => {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

/**
 * Wraps raw HTML content in a full standalone HTML document with embedded
 * print-friendly styles, then triggers a browser download as .html.
 * The file can be opened in any browser and printed via Ctrl+P.
 */
export function downloadHtml(filename: string, bodyHtml: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${filename.replace(/\.html$/i, "")}</title>
<style>
  @page { size: A4; margin: 15mm; }
  @media print { .no-print { display: none !important; } body { margin: 0; } }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #1a1a1a; margin: 20px; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #d1d5db; padding: 4px 8px; text-align: left; font-size: 11px; }
  th { background: #fef3c7; font-weight: 700; color: #92400e; }
  tr:nth-child(even) { background: #fffbeb; }
  h1 { font-size: 18px; color: #ea580c; margin: 0 0 4px 0; text-align: center; }
  h2 { font-size: 14px; color: #92400e; margin: 12px 0 4px 0; border-bottom: 2px solid #fbbf24; padding-bottom: 3px; }
  h3 { font-size: 12px; color: #78716c; margin: 8px 0 3px 0; }
  .school-header { text-align: center; border-bottom: 3px double #ea580c; padding-bottom: 8px; margin-bottom: 12px; }
  .school-header p { margin: 2px 0; font-size: 12px; color: #666; }
  .school-header .school-name { font-size: 22px; font-weight: 900; color: #ea580c; margin: 0; }
  .school-header .campus { font-size: 13px; font-weight: 600; color: #374151; margin: 2px 0; }
  .flex-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .flex-row > div { flex: 1; min-width: 120px; }
  .label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { font-weight: 600; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
  .sig-box { text-align: center; width: 25%; }
  .sig-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; font-size: 10px; color: #666; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Builds and downloads a CSV file from an array of row objects. */
export function exportCsv(
  filename: string,
  rows: Record<string, string | number>[],
): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h] ?? "")).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
