import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Printer,
  Download,
  Loader2,
  Users,
  ClipboardCheck,
  Receipt,
  Star,
  FileText,
  CreditCard,
  Award,
  GraduationCap,
  CalendarDays,
  UserPlus,
  ClipboardList,
  UsersRound,
  UserCheck,
  ShieldAlert,
  BookOpen,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { formatPkr, todayStr, downloadHtml } from "@/lib/format";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ═══════════════════════════════════════════════════════════════════ */
/*                         SHARED PRINT HELPERS                       */
/* ═══════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function schoolHeader(extraTitle?: string): string {
  return `
  <div style="text-align:center;border-bottom:3px solid #ea580c;padding-bottom:10px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:4px;">
      <div style="width:56px;height:56px;border-radius:50%;border:2px solid #ea580c;overflow:hidden;background:#fff7ed;flex-shrink:0;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="56" height="56">
          <circle cx="256" cy="256" r="250" fill="none" stroke="#EA580C" stroke-width="14"/>
          <circle cx="256" cy="256" r="240" fill="white"/>
          <circle cx="256" cy="230" r="110" fill="#FDEBD0" stroke="#D4845A" stroke-width="2"/>
          <rect x="244" y="145" width="24" height="70" rx="4" fill="#999" stroke="#666" stroke-width="1.5"/>
          <rect x="238" y="210" width="36" height="8" rx="3" fill="#777"/>
          <path d="M256 100 C240 130,230 145,244 155 L256 135 L268 155 C282 145,272 130,256 100Z" fill="#E63C12"/>
          <path d="M256 110 C248 130,242 140,250 148 L256 132 L262 148 C270 140,264 130,256 110Z" fill="#F5A623"/>
          <path d="M190 225 Q220 200,256 215 Q292 200,322 225 L322 260 Q292 240,256 255 Q220 240,190 260Z" fill="white" stroke="#333" stroke-width="2"/>
          <line x1="256" y1="215" x2="256" y2="255" stroke="#333" stroke-width="1.5"/>
          <text x="256" y="345" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="38" font-weight="900" fill="#111">LEADS</text>
          <text x="256" y="368" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#111" letter-spacing="8">SYSTEM</text>
        </svg>
      </div>
      <div>
        <h1 style="font-size:22px;color:#ea580c;letter-spacing:1.5px;font-weight:900;margin:0;line-height:1.2">${BRAND.schoolName.toUpperCase()}</h1>
        <h2 style="font-size:13px;font-weight:700;margin:2px 0 0;color:#374151">${BRAND.campusName.toUpperCase()} – D.G. KHAN</h2>
      </div>
    </div>
    <p style="font-size:9px;color:#6b7280;margin:2px 0 0">${BRAND.address}</p>
    <p style="font-size:9px;color:#6b7280;margin:1px 0 0">Contact: ${BRAND.phones.join(" | ")}</p>
    ${extraTitle ? `<div style="font-size:14px;font-weight:800;margin-top:8px;color:#fff;background:#ea580c;display:inline-block;padding:5px 28px;border-radius:4px;letter-spacing:1px">${extraTitle}</div>` : ""}
  </div>`;
}

function fullHTML(body: string, title: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f1f5f9;font-size:10px}
    @media print{
      @page{size:A4 portrait;margin:8mm}
      body{background:white!important}
      .print-page{padding:8mm 10mm!important;width:100%!important;min-height:auto!important}
      .no-print{display:none!important}
    }
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left;font-size:9px}
    th{background:#ea580c;color:white;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:0.3px}
    .alt-row{background:#fef7ed}
    .sig-line{border-bottom:1px solid #374151;min-height:30px;width:100%}
    .section-title{font-size:11px;font-weight:800;color:#ea580c;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 6px;border-bottom:2px solid #ea580c;padding-bottom:3px}
  </style></head><body>${body}</body></html>`;
}

function printHTML(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { window.open(url, "_blank"); }
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1500);
  };
  iframe.src = url;
}

async function downloadPDF(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  return new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;";
    document.body.appendChild(iframe);
    iframe.onload = async () => {
      try {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const docWidth = doc.internal.pageSize.getWidth();
        const docHeight = doc.internal.pageSize.getHeight();
        await new Promise((r) => setTimeout(r, 400));
        const pages = iframe.contentDocument?.querySelectorAll(".print-page") ?? [];
        const elements = pages.length > 0 ? Array.from(pages) : [iframe.contentDocument?.body];
        for (let i = 0; i < elements.length; i++) {
          if (i > 0) doc.addPage();
          const el = elements[i] as HTMLElement;
          const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", width: 794, windowWidth: 794 });
          const imgData = canvas.toDataURL("image/png");
          const imgHeight = (canvas.height * docWidth) / canvas.width;
          const yOff = imgHeight < docHeight ? (docHeight - imgHeight) / 2 : 0;
          doc.addImage(imgData, "PNG", 0, yOff, docWidth, imgHeight);
        }
        doc.save(filename);
        toast.success("PDF downloaded");
      } catch { toast.error("PDF generation failed"); }
      finally { document.body.removeChild(iframe); URL.revokeObjectURL(url); resolve(); }
    };
    iframe.src = url;
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                   1. PHYSICAL ATTENDANCE REGISTER                  */
/* ═══════════════════════════════════════════════════════════════════ */

function AttendanceRegister() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);
  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const monthName = MONTH_NAMES[monthNum - 1];

  const students = useQuery(
    api.students.list,
    classId ? { status: "active", classId } : "skip"
  ) ?? [];

  const filteredStudents = section
    ? students.filter((s) => s.section === section)
    : students;

  const sortedStudents = useMemo(
    () => [...filteredStudents].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })),
    [filteredStudents]
  );

  const generateHTML = () => {
    const dateCols = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const headerCells = dateCols.map((d) => `<th style="width:18px;text-align:center;padding:3px 1px;font-size:7px">${d}</th>`).join("");
    const emptyCells = dateCols.map(() => "<td style=\"text-align:center;padding:3px 1px\">&nbsp;</td>").join("");

    const studentRows = sortedStudents.map((s, i) => `
      <tr class="${i % 2 === 0 ? "" : "alt-row"}">
        <td style="text-align:center;width:30px">${i + 1}</td>
        <td style="font-size:8px;min-width:100px">${s.name}</td>
        <td style="text-align:center;width:40px;font-size:8px">${s.rollNumber}</td>
        ${emptyCells}
        <td style="width:40px"></td>
      </tr>
    `).join("");

    // Legend row
    const legendRow = `
      <tr style="background:#f9fafb">
        <td colspan="${3 + daysInMonth + 1}" style="border:none;padding:8px 0">
          <div style="display:flex;gap:20px;font-size:9px;color:#374151">
            <span><strong>P</strong> = Present</span>
            <span><strong>A</strong> = Absent</span>
            <span><strong>L</strong> = Late</span>
            <span><strong>W</strong> = Weekly Off</span>
            <span><strong>H</strong> = Holiday</span>
            <span><strong>—</strong> = No Class</span>
          </div>
        </td>
      </tr>`;

    const body = `
    <div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:'Segoe UI',sans-serif;">
      ${schoolHeader("DAILY ATTENDANCE REGISTER")}

      <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:10px;color:#374151">
        <div><strong>Class:</strong> ${selectedClass?.name ?? "________"} <strong>Section:</strong> ${section || "All"}</div>
        <div><strong>Month:</strong> ${monthName} ${year}</div>
        <div><strong>Teacher:</strong> ________________________</div>
        <div><strong>Total Students:</strong> ${sortedStudents.length}</div>
      </div>

      <table style="table-layout:fixed;">
        <thead>
          <tr>
            <th style="width:30px">#</th>
            <th style="min-width:100px">Student Name</th>
            <th style="width:40px">Roll</th>
            ${headerCells}
            <th style="width:40px;text-align:center">Total</th>
          </tr>
          <tr style="background:#fef7ed">
            <th colspan="3" style="background:#fef7ed;border-color:#d1d5db;color:#374151;font-size:7px">DATE →</th>
            ${dateCols.map((d) => `<th style="background:#fef7ed;border-color:#d1d5db;color:#ea580c;font-size:7px;text-align:center">${d}</th>`).join("")}
            <th style="background:#fef7ed;border-color:#d1d5db;color:#374151;font-size:7px">P</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>

      ${legendRow}

      <!-- Summary Box -->
      <div style="margin-top:12px;border:1px solid #d1d5db;border-radius:6px;padding:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:9px">
        <div><strong>Total Present:</strong> ____</div>
        <div><strong>Total Absent:</strong> ____</div>
        <div><strong>Total Late:</strong> ____</div>
        <div><strong>Attendance %:</strong> ____</div>
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:9px;color:#6b7280">
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:35px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Class Teacher</div>
          <div>Signature & Date</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:35px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Principal</div>
          <div>Signature & Date</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:35px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Office Copy</div>
          <div>Received by</div>
        </div>
      </div>

      <div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:10px;border-top:1px solid #f3f4f6;padding-top:4px">
        ${BRAND.schoolName} – ${BRAND.campusName} · Attendance Register for ${monthName} ${year}
      </div>
    </div>`;

    return fullHTML(body, `Attendance Register — ${selectedClass?.name ?? "Class"} ${monthName} ${year}`);
  };

  const handlePrint = () => {
    if (!classId || sortedStudents.length === 0) return toast.error("Select a class with students first");
    printHTML(generateHTML());
  };

  const handlePDF = async () => {
    if (!classId || sortedStudents.length === 0) return toast.error("Select a class with students first");
    setLoading(true);
    const [y, m] = month.split("-").map(Number);
    const name = `${selectedClass?.name ?? "Class"}-${MONTH_NAMES[m - 1]}-${y}`;
    await downloadPDF(generateHTML(), `Attendance-${name}.pdf`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-3d">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary" /> Attendance Register Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px]">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Section</Label>
              <Select value={section || "_all"} onValueChange={(v) => setSection(v === "_all" ? "" : v)} disabled={!classId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Sections</SelectItem>
                  {selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5 flex items-end">
              <div className="flex gap-2 w-full">
                <Button size="sm" className="flex-1 cursor-pointer btn-3d" onClick={handlePrint} disabled={!classId || sortedStudents.length === 0}>
                  <Printer className="size-3.5 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={handlePDF} disabled={!classId || sortedStudents.length === 0 || loading}>
                  {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Generates a {daysInMonth}-column attendance grid for {monthName} {year} with {sortedStudents.length} students.
            Columns for each day of the month, summary totals, and signature lines for Class Teacher, Principal, and Office.
          </p>
        </CardContent>
      </Card>

      {/* Preview */}
      {classId && sortedStudents.length > 0 && (
        <Card className="card-3d">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Preview: {sortedStudents.length} students · {daysInMonth} day columns · {monthName} {year}
            </p>
            <div className="overflow-x-auto rounded-lg border max-h-96 overflow-y-auto">
              <table className="text-[9px]">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Name</th>
                    <th className="w-10">Roll</th>
                    {Array.from({ length: Math.min(daysInMonth, 31) }, (_, i) => (
                      <th key={i} className="w-5 text-center p-0.5">{i + 1}</th>
                    ))}
                    <th className="w-8">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((s, i) => (
                    <tr key={s._id} className={i % 2 === 0 ? "" : "bg-orange-50/30"}>
                      <td className="text-center">{i + 1}</td>
                      <td className="whitespace-nowrap">{s.name}</td>
                      <td className="text-center">{s.rollNumber}</td>
                      {Array.from({ length: Math.min(daysInMonth, 31) }, (_, j) => (
                        <td key={j} className="text-center border-r border-dashed border-gray-200">&nbsp;</td>
                      ))}
                      <td className="text-center font-bold">&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mt-3 text-[9px] text-muted-foreground">
              <span><strong>P</strong> Present</span>
              <span><strong>A</strong> Absent</span>
              <span><strong>L</strong> Late</span>
              <span><strong>W</strong> Weekly Off</span>
              <span><strong>H</strong> Holiday</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!classId && (
        <Card className="card-3d">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="size-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select a class to generate the attendance register</p>
            <p className="text-xs mt-1">The register includes columns for every day of the selected month</p>
          </CardContent>
        </Card>
      )}
      </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                      2. FEE SLIP FORMAT                            */
/* ═══════════════════════════════════════════════════════════════════ */

function FeeSlipFormat() {
  const classes = useQuery(api.classes.list) ?? [];
  const feeStructures = useQuery(api.fees.structures) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);
  const students = useQuery(
    api.students.list,
    classId ? { status: "active" as const, classId } : "skip"
  ) ?? [];

  const filteredStudents = section
    ? students.filter((s) => s.section === section)
    : students;

  const sortedStudents = useMemo(
    () => [...filteredStudents].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })),
    [filteredStudents]
  );

  const classFees = useMemo(() => {
    return feeStructures.filter((f) => f.classId === classId);
  }, [feeStructures, classId]);

  const monthlyTotal = classFees.filter((f) => f.period === "monthly").reduce((s, f) => s + f.amount, 0);
  const annualTotal = classFees.filter((f) => f.period === "annual").reduce((s, f) => s + f.amount, 0);

  const [year, monthNum] = month.split("-").map(Number);
  const monthName = MONTH_NAMES[monthNum - 1];

  const generateSingleSlip = (s: any, copyLabel: string) => {
    const monthlyFees = classFees.filter((f) => f.period === "monthly");
    const annualFees = classFees.filter((f) => f.period === "annual");
    const total = monthlyTotal + annualTotal;

    return `
    <div style="width:100%;padding:12px 16px;border-bottom:2px dashed #d1d5db;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:8px;color:#ea580c;font-weight:700;text-transform:uppercase;letter-spacing:1px">${copyLabel}</div>
        <div style="font-size:8px;color:#6b7280">Date: ${dueDate || "____/____/____"}</div>
      </div>

      <table style="width:100%;border:2px solid #ea580c;border-radius:4px;overflow:hidden;margin-bottom:8px">
        <tr style="background:#ea580c;color:white">
          <td colspan="4" style="padding:6px 10px;font-size:11px;font-weight:800;text-align:center;letter-spacing:0.5px">
            FEE SLIP — ${monthName} ${year}
          </td>
        </tr>
      </table>

      <table style="width:100%;font-size:9px">
        <tr>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;width:25%;color:#6b7280">Student Name</td>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;width:25%;font-weight:700">${s.name}</td>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;width:25%;color:#6b7280">Class</td>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;width:25%;font-weight:700">${selectedClass?.name ?? "—"} — ${s.section}</td>
        </tr>
        <tr>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;color:#6b7280">Father's Name</td>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;font-weight:700">${s.fatherName || "________________"}</td>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;color:#6b7280">Roll No.</td>
          <td style="padding:3px 8px;border:1px solid #e5e7eb;font-weight:700">${s.rollNumber}</td>
        </tr>
      </table>

      <!-- Fee Breakdown -->
      <div class="section-title" style="font-size:9px;margin-top:8px">Fee Breakdown</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
        <thead>
          <tr>
            <th style="background:#ea580c;color:white;padding:4px 8px;font-size:8px;text-align:left">Fee Description</th>
            <th style="background:#ea580c;color:white;padding:4px 8px;font-size:8px;text-align:right;width:100px">Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyFees.map((f, i) => `
          <tr class="${i % 2 === 0 ? "" : "alt-row"}">
            <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:9px">${f.label} (Monthly)</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:9px;text-align:right;font-weight:600">Rs. ${Number(f.amount).toLocaleString()}</td>
          </tr>`).join("")}
          ${annualFees.map((f, i) => `
          <tr class="${(monthlyFees.length + i) % 2 === 0 ? "" : "alt-row"}">
            <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:9px">${f.label} (Annual)</td>
            <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:9px;text-align:right;font-weight:600">Rs. ${Number(f.amount).toLocaleString()}</td>
          </tr>`).join("")}
          ${classFees.length === 0 ? `<tr><td colspan="2" style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-style:italic;font-size:9px">No fee structure defined — go to Fee Management → Fee Structures</td></tr>` : ""}
          <tr style="background:#fef3c7;font-weight:800">
            <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:10px">TOTAL DUE</td>
            <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right">Rs. ${total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- Payment Info -->
      <div style="margin-top:8px;border:1px solid #e5e7eb;border-radius:4px;padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px">
        <div><span style="color:#6b7280">Amount Paid:</span> <strong style="color:#059669">Rs. ____________</strong></div>
        <div><span style="color:#6b7280">Balance Due:</span> <strong style="color:#dc2626">Rs. ____________</strong></div>
        <div><span style="color:#6b7280">Payment Method:</span> ☐ Cash  ☐ Bank  ☐ Online</div>
        <div><span style="color:#6b7280">Receipt No:</span> <strong>______________</strong></div>
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:8px;color:#6b7280">
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:25px"></div>
          <div style="margin-top:2px">Parent/Guardian</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:25px"></div>
          <div style="margin-top:2px">Cashier</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:25px"></div>
          <div style="margin-top:2px">Accounts</div>
        </div>
      </div>

      <div style="text-align:center;font-size:7px;color:#9ca3af;margin-top:6px;border-top:1px solid #f3f4f6;padding-top:3px">
        ${BRAND.schoolName} – ${BRAND.campusName} · Please pay fees by the due date to avoid late charges.
      </div>
    </div>`;
  };

  const generateAllSlips = () => {
    const allBodies = sortedStudents.map((s) => generateSingleSlip(s, "STUDENT COPY")).join("");
    const officeBodies = sortedStudents.map((s) => generateSingleSlip(s, "OFFICE COPY")).join("");

    const body = `
    <div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:'Segoe UI',sans-serif;">
      ${schoolHeader(`FEE SLIPS — ${selectedClass?.name ?? "Class"} — ${monthName} ${year}`)}
      ${allBodies}
    </div>`;

    return fullHTML(body, `Fee Slips — ${selectedClass?.name} ${monthName} ${year}`);
  };

  const handlePrint = () => {
    if (!classId || sortedStudents.length === 0) return toast.error("Select a class with students");
    printHTML(generateAllSlips());
  };

  const handlePDF = async () => {
    if (!classId || sortedStudents.length === 0) return toast.error("Select a class with students");
    setLoading(true);
    await downloadPDF(generateAllSlips(), `Fee-Slips-${selectedClass?.name}-${monthName}-${year}.pdf`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-3d">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="size-4 text-primary" /> Fee Slip Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px]">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Section</Label>
              <Select value={section || "_all"} onValueChange={(v) => setSection(v === "_all" ? "" : v)} disabled={!classId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Sections</SelectItem>
                  {selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {classFees.length > 0 && (
            <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-orange-700 mb-1">Fee Structure — {selectedClass?.name}</p>
              <div className="flex flex-wrap gap-3 text-[10px]">
                {classFees.map((f) => (
                  <span key={f._id}>
                    <span className="text-muted-foreground">{f.label}</span>{" "}
                    <strong className="text-foreground">{formatPkr(f.amount)}</strong>
                    <span className="text-muted-foreground"> ({f.period})</span>
                  </span>
                ))}
                <span className="font-bold text-orange-700">= Total Rs. {(monthlyTotal + annualTotal).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint} disabled={!classId || sortedStudents.length === 0}>
              <Printer className="size-3.5 mr-1" /> Print All ({sortedStudents.length} slips)
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={!classId || sortedStudents.length === 0 || loading}>
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {classId && sortedStudents.length > 0 && (
        <Card className="card-3d">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Sample Slip Preview
            </p>
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-white p-4 text-[9px]" dangerouslySetInnerHTML={{ __html: generateSingleSlip(sortedStudents[0], "STUDENT COPY") }} />
            </div>
          </CardContent>
        </Card>
      )}

      {!classId && (
        <Card className="card-3d">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="size-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select a class to generate fee slips</p>
            <p className="text-xs mt-1">Each slip includes fee breakdown, payment section, and signature lines</p>
          </CardContent>
        </Card>
      )}
      </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                  3. PERFORMANCE APPRAISAL FORM                     */
/* ═══════════════════════════════════════════════════════════════════ */

const APPRAISAL_SECTIONS = [
  {
    title: "TEACHING EFFECTIVENESS",
    items: [
      "Subject knowledge and preparation",
      "Lesson planning and delivery",
      "Use of teaching aids and technology",
      "Classroom management skills",
      "Student engagement and motivation",
      "Differentiated instruction",
    ],
  },
  {
    title: "STUDENT DEVELOPMENT",
    items: [
      "Student learning outcomes",
      "Assessment and feedback quality",
      "Support for struggling students",
      "Mentoring and guidance",
      "Parent communication",
    ],
  },
  {
    title: "PROFESSIONAL CONDUCT",
    items: [
      "Punctuality and attendance",
      "Dress code and professional appearance",
      "Compliance with school policies",
      "Cooperation with colleagues",
      "Participation in school events",
    ],
  },
  {
    title: "LEADERSHIP & GROWTH",
    items: [
      "Professional development activities",
      "Initiative and innovation",
      "Mentoring new staff",
      "Commitment to continuous improvement",
    ],
  },
];

const RATING_SCALE = [
  { label: "5", desc: "Outstanding" },
  { label: "4", desc: "Exceeds Expectations" },
  { label: "3", desc: "Meets Expectations" },
  { label: "2", desc: "Needs Improvement" },
  { label: "1", desc: "Unsatisfactory" },
];

function PerformanceAppraisal() {
  const teachers = useQuery(api.teachers.list, {}) ?? [];
  const [teacherId, setTeacherId] = useState("");
  const [appraisalPeriod, setAppraisalPeriod] = useState(`${new Date().getFullYear()}-${new Date().getMonth() < 6 ? "Spring" : "Fall"}`);
  const [loading, setLoading] = useState(false);

  const selectedTeacher = teachers.find((t) => t._id === teacherId) as any;

  const totalItems = APPRAISAL_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);

  const generateHTML = () => {
    const sections = APPRAISAL_SECTIONS.map((sec) => {
      const rows = sec.items.map((item, i) => `
        <tr class="${i % 2 === 0 ? "" : "alt-row"}">
          <td style="padding:5px 8px;border:1px solid #d1d5db;font-size:9px;width:35%">${item}</td>
          ${[5,4,3,2,1].map((r) => `<td style="text-align:center;padding:5px 4px;border:1px solid #d1d5db;width:8%">☐</td>`).join("")}
          <td style="padding:5px 8px;border:1px solid #d1d5db;width:12%;font-size:8px;color:#6b7280"></td>
        </tr>
      `).join("");

      return `
      <div class="section-title">${sec.title}</div>
      <table style="margin-bottom:10px">
        <thead>
          <tr>
            <th style="text-align:left;padding:5px 8px;font-size:8px;width:35%">Competency Area</th>
            ${RATING_SCALE.map((r) => `<th style="text-align:center;padding:5px 2px;font-size:7px;width:8%">${r.label}<br/><span style="font-weight:400;font-size:6px;text-transform:none">${r.desc}</span></th>`).join("")}
            <th style="text-align:left;padding:5px 8px;font-size:8px;width:12%">Evidence/Comments</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    }).join("");

    return `
    <div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 10mm;font-family:'Segoe UI',sans-serif;">
      ${schoolHeader("TEACHER PERFORMANCE APPRAISAL FORM")}

      <!-- Teacher Info -->
      <table style="width:100%;margin-bottom:12px">
        <tr>
          <td style="padding:4px 8px;border:1px solid #d1d5db;width:25%;color:#6b7280;font-size:9px;background:#fef7ed">Teacher Name</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;width:25%;font-weight:700;font-size:9px">${selectedTeacher?.name ?? "________________"}</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;width:25%;color:#6b7280;font-size:9px;background:#fef7ed">Employee ID</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;width:25%;font-size:9px">__________</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border:1px solid #d1d5db;color:#6b7280;font-size:9px;background:#fef7ed">Designation</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px">${selectedTeacher?.subject ?? "__________"}</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;color:#6b7280;font-size:9px;background:#fef7ed">Appraisal Period</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;font-weight:600;font-size:9px">${appraisalPeriod}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border:1px solid #d1d5db;color:#6b7280;font-size:9px;background:#fef7ed">Date of Joining</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px">__________</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;color:#6b7280;font-size:9px;background:#fef7ed">Reviewed By</td>
          <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px">__________</td>
        </tr>
      </table>

      <!-- Rating Scale Legend -->
      <div style="display:flex;gap:12px;margin-bottom:10px;font-size:8px;color:#374151;background:#fef7ed;padding:6px 10px;border-radius:4px;border:1px solid #fed7aa">
        <strong>Rating Scale:</strong>
        <span><strong>5</strong> = Outstanding</span>
        <span><strong>4</strong> = Exceeds Expectations</span>
        <span><strong>3</strong> = Meets Expectations</span>
        <span><strong>2</strong> = Needs Improvement</span>
        <span><strong>1</strong> = Unsatisfactory</span>
      </div>

      ${sections}

      <!-- TOTAL SCORE -->
      <div style="border:2px solid #ea580c;border-radius:6px;padding:8px 12px;margin:12px 0;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:10px;font-weight:700;color:#ea580c">TOTAL SCORE</span>
          <span style="font-size:9px;color:#6b7280;margin-left:8px">______ / ${totalItems * 5}</span>
        </div>
        <div>
          <span style="font-size:10px;font-weight:700;color:#374151">PERCENTAGE</span>
          <span style="font-size:9px;color:#6b7280;margin-left:8px">______ %</span>
        </div>
        <div>
          <span style="font-size:10px;font-weight:700;color:#374151">GRADE</span>
          <span style="font-size:9px;color:#6b7280;margin-left:8px">☐ A+ ☐ A ☐ B ☐ C ☐ D</span>
        </div>
      </div>

      <!-- Strengths & Areas for Improvement -->
      <div class="section-title">STRENGTHS</div>
      <div style="border:1px solid #d1d5db;border-radius:4px;min-height:50px;padding:8px;font-size:9px;color:#6b7280;margin-bottom:8px">
        _____________________________________________________________<br/>
        _____________________________________________________________<br/>
        _____________________________________________________________
      </div>

      <div class="section-title">AREAS FOR IMPROVEMENT</div>
      <div style="border:1px solid #d1d5db;border-radius:4px;min-height:50px;padding:8px;font-size:9px;color:#6b7280;margin-bottom:8px">
        _____________________________________________________________<br/>
        _____________________________________________________________<br/>
        _____________________________________________________________
      </div>

      <!-- Goals for Next Period -->
      <div class="section-title">GOALS FOR NEXT APPRAISAL PERIOD</div>
      <div style="border:1px solid #d1d5db;border-radius:4px;min-height:40px;padding:8px;font-size:9px;color:#6b7280;margin-bottom:8px">
        1. __________________________________________________________<br/>
        2. __________________________________________________________<br/>
        3. __________________________________________________________
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:9px;color:#6b7280">
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:30px"></div>
          <div style="margin-top:3px;font-weight:600;color:#374151;font-size:10px">Teacher</div>
          <div>Signature & Date</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:30px"></div>
          <div style="margin-top:3px;font-weight:600;color:#374151;font-size:10px">Reviewer</div>
          <div>Signature & Date</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:30px"></div>
          <div style="margin-top:3px;font-weight:600;color:#374151;font-size:10px">Principal</div>
          <div>Signature & Date</div>
        </div>
      </div>

      <div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:10px;border-top:1px solid #f3f4f6;padding-top:4px">
        ${BRAND.schoolName} – ${BRAND.campusName} · Teacher Performance Appraisal ${appraisalPeriod}
      </div>
    </div>`;
  };

  const handlePrint = () => {
    if (!teacherId) return toast.error("Select a teacher first");
    printHTML(generateHTML());
  };

  const handlePDF = async () => {
    if (!teacherId) return toast.error("Select a teacher first");
    setLoading(true);
    await downloadPDF(generateHTML(), `Appraisal-${selectedTeacher?.name ?? "Teacher"}-${appraisalPeriod}.pdf`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-3d">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="size-4 text-primary" /> Performance Appraisal Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px]">Teacher</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name} — {t.subject ?? "Teacher"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Appraisal Period</Label>
              <Input value={appraisalPeriod} onChange={(e) => setAppraisalPeriod(e.target.value)} className="h-8 text-xs" placeholder="e.g. 2026-Spring" />
            </div>
            <div className="space-y-1.5 flex items-end">
              <div className="flex gap-2 w-full">
                <Button size="sm" className="flex-1 cursor-pointer btn-3d" onClick={handlePrint} disabled={!teacherId}>
                  <Printer className="size-3.5 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={handlePDF} disabled={!teacherId || loading}>
                  {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {totalItems} competency items across {APPRAISAL_SECTIONS.length} sections · Rating scale 1-5 · Score out of {totalItems * 5}
          </p>
        </CardContent>
      </Card>

      {/* Section Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {APPRAISAL_SECTIONS.map((sec) => (
          <Card key={sec.title} className="card-3d">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">{sec.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {sec.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="size-1 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {!teacherId && (
        <Card className="card-3d">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Star className="size-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select a teacher to generate the appraisal form</p>
            <p className="text-xs mt-1">The form includes {totalItems} items across {APPRAISAL_SECTIONS.length} competency sections with rating scales</p>
          </CardContent>
        </Card>
      )}
      </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                    4. STUDENT ID CARD                              */
/* ═══════════════════════════════════════════════════════════════════ */

function IDCardFormat() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);
  const students = useQuery(
    api.students.list,
    classId ? { status: "active" as const, classId } : "skip"
  ) ?? [];

  const filteredStudents = section
    ? students.filter((s) => s.section === section)
    : students;

  const sortedStudents = useMemo(
    () => [...filteredStudents].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })),
    [filteredStudents]
  );

  const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="48" height="48">
    <circle cx="256" cy="256" r="250" fill="none" stroke="#EA580C" stroke-width="14"/>
    <circle cx="256" cy="256" r="240" fill="white"/>
    <circle cx="256" cy="230" r="110" fill="#FDEBD0" stroke="#D4845A" stroke-width="2"/>
    <rect x="244" y="145" width="24" height="70" rx="4" fill="#999" stroke="#666" stroke-width="1.5"/>
    <rect x="238" y="210" width="36" height="8" rx="3" fill="#777"/>
    <path d="M256 100 C240 130,230 145,244 155 L256 135 L268 155 C282 145,272 130,256 100Z" fill="#E63C12"/>
    <path d="M256 110 C248 130,242 140,250 148 L256 132 L262 148 C270 140,264 130,256 110Z" fill="#F5A623"/>
    <path d="M190 225 Q220 200,256 215 Q292 200,322 225 L322 260 Q292 240,256 255 Q220 240,190 260Z" fill="white" stroke="#333" stroke-width="2"/>
    <line x1="256" y1="215" x2="256" y2="255" stroke="#333" stroke-width="1.5"/>
    <text x="256" y="345" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="38" font-weight="900" fill="#111">LEADS</text>
    <text x="256" y="368" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#111" letter-spacing="8">SYSTEM</text>
  </svg>`;

  const generateCard = (s: any, side: "front" | "back") => {
    if (side === "front") {
      return `
      <div style="width:3.4in;height:2.1in;border:2px solid #ea580c;border-radius:8px;overflow:hidden;position:relative;background:white;display:flex;flex-direction:column;page-break-inside:avoid;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#ea580c,#f97316);padding:6px 10px;display:flex;align-items:center;gap:8px;">
          <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;border:2px solid white;flex-shrink:0;background:white">${logoSVG}</div>
          <div>
            <div style="color:white;font-size:9px;font-weight:900;letter-spacing:1px">${BRAND.schoolName.toUpperCase()}</div>
            <div style="color:#fed7aa;font-size:7px;font-weight:600">${BRAND.campusName.toUpperCase()}</div>
          </div>
          <div style="margin-left:auto;background:white;border-radius:4px;padding:2px 6px">
            <div style="font-size:7px;color:#ea580c;font-weight:700">STUDENT ID</div>
          </div>
        </div>
        <!-- Body -->
        <div style="display:flex;flex:1;padding:8px 10px;gap:10px;">
          <div style="width:60px;height:70px;border:1px solid #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f9fafb;flex-shrink:0">
            <div style="font-size:7px;color:#9ca3af;text-align:center">Photo<br/>(粘贴处)</div>
          </div>
          <div style="flex:1;font-size:8px;display:flex;flex-direction:column;justify-content:center;gap:3px;">
            <div style="font-size:11px;font-weight:800;color:#111;line-height:1.1">${s.name}</div>
            <div><span style="color:#6b7280">Father:</span> <strong>${s.fatherName || "—"}</strong></div>
            <div style="display:flex;gap:12px">
              <span><span style="color:#6b7280">Class:</span> <strong>${selectedClass?.name ?? "—"} ${s.section}</strong></span>
              <span><span style="color:#6b7280">Roll:</span> <strong>${s.rollNumber}</strong></span>
            </div>
            <div><span style="color:#6b7280">Phone:</span> <strong>${s.phone || "—"}</strong></div>
          </div>
        </div>
        <!-- Footer -->
        <div style="background:#fef7ed;padding:4px 10px;display:flex;justify-content:space-between;font-size:6px;color:#6b7280;border-top:1px solid #fed7aa">
          <span>${BRAND.phones[0]}</span>
          <span>ID: ${s.rollNumber}-${selectedClass?.name?.slice(0,3).toUpperCase() ?? "CLS"}</span>
        </div>
      </div>`;
    }
    // BACK side
    return `
    <div style="width:3.4in;height:2.1in;border:2px solid #ea580c;border-radius:8px;overflow:hidden;background:white;display:flex;flex-direction:column;page-break-inside:avoid;">
      <div style="background:linear-gradient(135deg,#ea580c,#f97316);padding:8px;text-align:center">
        <div style="color:white;font-size:9px;font-weight:800;letter-spacing:1.5px">${BRAND.schoolName.toUpperCase()}</div>
        <div style="color:#fed7aa;font-size:7px">${BRAND.address}</div>
      </div>
      <div style="flex:1;padding:8px 12px;display:flex;flex-direction:column;justify-content:center;gap:4px;font-size:8px;">
        <div style="display:flex;justify-content:space-between"><span style="color:#6b7280">Emergency Contact:</span><strong>${s.phone || "_____________"}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#6b7280">Blood Group:</span><strong>_____________</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#6b7280">Address:</span><strong>${BRAND.address}</strong></div>
        <div style="margin-top:6px;border-top:1px dashed #d1d5db;padding-top:4px;font-size:7px;color:#6b7280;text-align:center">
          This card is the property of ${BRAND.schoolName}. If found, please return to the school office.
        </div>
      </div>
      <div style="background:#fef7ed;padding:4px 10px;display:flex;justify-content:center;border-top:1px solid #fed7aa">
        <div style="font-size:8px;color:#ea580c;font-weight:700">Contact: ${BRAND.phones.join(" | ")}</div>
      </div>
    </div>`;
  };

  const generateAllCards = () => {
    // 4 cards per page (2x2 grid, front+back)
    let cardsHTML = "";
    for (let i = 0; i < sortedStudents.length; i += 4) {
      const batch = sortedStudents.slice(i, i + 4);
      cardsHTML += `
      <div class="print-page" style="width:210mm;min-height:297mm;padding:10mm;font-family:'Segoe UI',sans-serif;">
        ${schoolHeader(i === 0 ? `STUDENT ID CARDS — ${selectedClass?.name ?? ""}` : undefined)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          ${batch.map((s) => generateCard(s, "front")).join("")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:2px dashed #ea580c;padding-top:10px;margin-top:6px;">
          ${batch.map((s) => generateCard(s, "back")).join("")}
        </div>
      </div>`;
    }
    return fullHTML(cardsHTML, `ID Cards — ${selectedClass?.name ?? "Class"}`);
  };

  const handlePrint = () => {
    if (!classId || sortedStudents.length === 0) return toast.error("Select a class with students");
    printHTML(generateAllCards());
  };

  const handlePDF = async () => {
    if (!classId || sortedStudents.length === 0) return toast.error("Select a class with students");
    setLoading(true);
    await downloadPDF(generateAllCards(), `ID-Cards-${selectedClass?.name}.pdf`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-3d">
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2">
          <CreditCard className="size-4 text-primary" /> Student ID Card Generation
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label className="text-[10px]">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-[10px]">Section</Label>
              <Select value={section || "_all"} onValueChange={(v) => setSection(v === "_all" ? "" : v)} disabled={!classId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent><SelectItem value="_all">All</SelectItem>
                  {selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent></Select></div>
            <div className="col-span-2 flex items-end gap-2">
              <Button size="sm" className="flex-1 cursor-pointer btn-3d" onClick={handlePrint} disabled={!classId || sortedStudents.length === 0}>
                <Printer className="size-3.5 mr-1" /> Print ID Cards ({sortedStudents.length})</Button>
              <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={handlePDF} disabled={!classId || sortedStudents.length === 0 || loading}>
                {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Front: photo area, name, class, roll, father name, phone. Back: school info, emergency contact, blood group.</p>
        </CardContent>
      </Card>
      {classId && sortedStudents.length > 0 && (
        <Card className="card-3d"><CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Sample Preview — {sortedStudents[0].name}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="rounded-lg border overflow-hidden bg-white p-2" dangerouslySetInnerHTML={{ __html: generateCard(sortedStudents[0], "front") }} />
            <div className="rounded-lg border overflow-hidden bg-white p-2" dangerouslySetInnerHTML={{ __html: generateCard(sortedStudents[0], "back") }} />
          </div>
        </CardContent></Card>
      )}
      {!classId && (
        <Card className="card-3d"><CardContent className="py-12 text-center text-muted-foreground">
          <CreditCard className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a class to generate ID cards</p>
          <p className="text-xs mt-1">Printable ID cards with photo area, student details, and school branding</p>
        </CardContent></Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                  5. TRANSFER CERTIFICATE (TC)                      */
/* ═══════════════════════════════════════════════════════════════════ */

function TransferCertificateFormat() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const students = useQuery(
    api.students.list,
    classId ? { status: "active" as const, classId } : "skip"
  ) ?? [];

  const selectedStudent = students.find((s) => s._id === studentId);
  const selectedClass = classes.find((c) => c._id === classId);

  const generateHTML = () => {
    if (!selectedStudent) return "";
    const today = new Date();
    const issueDate = `${today.getDate()} ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;

    return `
    <div class="print-page" style="width:210mm;min-height:297mm;padding:12mm 15mm;font-family:'Segoe UI',sans-serif;">
      ${schoolHeader("TRANSFER CERTIFICATE")}

      <div style="display:flex;justify-content:flex-end;margin-bottom:10px;font-size:10px;color:#374151">
        <div><strong>Date of Issue:</strong> ${issueDate}</div>
      </div>

      <table style="width:100%;margin-bottom:14px;font-size:10px">
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;width:25%;color:#6b7280;background:#fef7ed">Student Name</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;width:25%;font-weight:700">${selectedStudent.name}</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;width:25%;color:#6b7280;background:#fef7ed">Father's Name</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;width:25%;font-weight:700">${selectedStudent.fatherName || "—"}</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Roll Number</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">${selectedStudent.rollNumber}</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Class / Section</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">${selectedClass?.name ?? "—"} / ${selectedStudent.section}</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Date of Admission</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">${selectedStudent.admissionDate || "—"}</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Date of Birth</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">${selectedStudent.birthDate || "—"}</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Phone</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700" colspan="3">${selectedStudent.phone || "—"}</td>
        </tr>
      </table>

      <div style="font-size:10px;line-height:1.8;color:#374151;margin-bottom:12px">
        <p>This is to certify that <strong>${selectedStudent.name}</strong>, S/o <strong>${selectedStudent.fatherName || "—"}</strong>, was a bonafide student of this school from <strong>${selectedStudent.admissionDate || "__________"}</strong> to <strong>${issueDate}</strong> in class <strong>${selectedClass?.name ?? "__________"}</strong> Section <strong>${selectedStudent.section}</strong>.</p>
      </div>

      <table style="width:100%;margin-bottom:12px;font-size:10px">
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed;width:25%">Conduct During Stay</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">☐ Excellent  ☐ Good  ☐ Satisfactory</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Reason for Leaving</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">${reason || "________________________"}</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Dues Cleared</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">☐ Yes  ☐ No (Pending: Rs. _________)</td>
        </tr>
        <tr>
          <td style="padding:5px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Library Books Returned</td>
          <td style="padding:5px 10px;border:1px solid #d1d5db;font-weight:700">☐ Yes  ☐ No</td>
        </tr>
      </table>

      <div style="font-size:10px;color:#374151;line-height:1.8;margin-bottom:16px">
        <p>We wish the student all success in future endeavours.</p>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:20px;font-size:9px;color:#6b7280">
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:40px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Class Teacher</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:40px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Accounts</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:40px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Principal</div>
          <div style="font-size:7px;color:#ea580c">Official Seal</div>
        </div>
      </div>

      <div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:12px;border-top:1px solid #f3f4f6;padding-top:4px">
        ${BRAND.schoolName} – ${BRAND.campusName} · Transfer Certificate
      </div>
    </div>`;
  };

  const handlePrint = () => {
    if (!studentId) return toast.error("Select a student first");
    printHTML(generateHTML());
  };

  const handlePDF = async () => {
    if (!studentId) return toast.error("Select a student first");
    setLoading(true);
    await downloadPDF(generateHTML(), `TC-${selectedStudent?.name ?? "Student"}.pdf`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-3d">
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2">
          <FileText className="size-4 text-primary" /> Transfer Certificate
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label className="text-[10px]">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setStudentId(""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-[10px]">Student</Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} — {s.rollNumber}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="col-span-2 space-y-1.5"><Label className="text-[10px]">Reason for Leaving</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 text-xs" placeholder="e.g. Family relocation, transfer" /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint} disabled={!studentId}>
              <Printer className="size-3.5 mr-1" /> Print TC</Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={!studentId || loading}>
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button>
          </div>
        </CardContent>
      </Card>
      {!classId && (
        <Card className="card-3d"><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a class and student to generate a Transfer Certificate</p>
        </CardContent></Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                  6. REPORT CARD                                    */
/* ═══════════════════════════════════════════════════════════════════ */

const GRADE_SCALE = [
  { min: 90, grade: "A+", remarks: "Outstanding" },
  { min: 80, grade: "A", remarks: "Excellent" },
  { min: 70, grade: "B+", remarks: "Very Good" },
  { min: 60, grade: "B", remarks: "Good" },
  { min: 50, grade: "C", remarks: "Average" },
  { min: 40, grade: "D", remarks: "Below Average" },
  { min: 0, grade: "F", remarks: "Fail" },
];

function ReportCardFormat() {
  const classes = useQuery(api.classes.list) ?? [];
  const exams = useQuery(api.exams.list, {}) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [examId, setExamId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);

  const students = useQuery(
    api.students.list,
    classId ? { status: "active" as const, classId } : "skip"
  ) ?? [];

  const examResultData = useQuery(
    api.exams.getResults,
    examId ? { examId: examId as Id<"exams"> } : "skip"
  );
  const examResults: any[] = examResultData?.results ?? [];

  const selectedClass = classes.find((c) => c._id === classId);
  const selectedExam = exams.find((e) => e._id === examId);
  const selectedStudent = students.find((s) => s._id === studentId);
  const studentResult = examResults.find((r: any) => r.studentId === studentId);

  const generateHTML = () => {
    if (!selectedStudent || !studentResult) return "";
    const gradeInfo = GRADE_SCALE.find((g) => studentResult.percentage >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];

    const subjectRows = (studentResult.marks ?? []).map((m: any, i: number) => `
      <tr class="${i % 2 === 0 ? "" : "alt-row"}">
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:10px">${m.subject}</td>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:10px;text-align:center">${m.maxMarks}</td>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:10px;text-align:center;font-weight:700">${m.obtained}</td>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:10px;text-align:center">${m.maxMarks > 0 ? ((m.obtained / m.maxMarks) * 100).toFixed(1) : 0}%</td>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:10px;text-align:center;color:#ea580c;font-weight:700">${m.maxMarks > 0 ? (m.obtained >= m.maxMarks * 0.9 ? "A+" : m.obtained >= m.maxMarks * 0.8 ? "A" : m.obtained >= m.maxMarks * 0.7 ? "B+" : m.obtained >= m.maxMarks * 0.6 ? "B" : m.obtained >= m.maxMarks * 0.5 ? "C" : "F") : "—"}</td>
        <td style="padding:5px 10px;border:1px solid #d1d5db;font-size:9px;color:#6b7280">${m.remarks || ""}</td>
      </tr>
    `).join("");

    return `
    <div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 12mm;font-family:'Segoe UI',sans-serif;">
      ${schoolHeader(`REPORT CARD — ${selectedExam?.title ?? "Examination"}`)}

      <table style="width:100%;margin-bottom:12px;font-size:10px">
        <tr>
          <td style="padding:4px 10px;border:1px solid #d1d5db;width:20%;color:#6b7280;background:#fef7ed">Student Name</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;width:30%;font-weight:700">${selectedStudent.name}</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;width:20%;color:#6b7280;background:#fef7ed">Father's Name</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;width:30%;font-weight:700">${selectedStudent.fatherName || "—"}</td>
        </tr>
        <tr>
          <td style="padding:4px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Class / Section</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;font-weight:700">${selectedClass?.name ?? "—"} / ${selectedStudent.section}</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Roll Number</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;font-weight:700">${selectedStudent.rollNumber}</td>
        </tr>
        <tr>
          <td style="padding:4px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Exam</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;font-weight:700">${selectedExam?.title ?? "—"}</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;color:#6b7280;background:#fef7ed">Exam Date</td>
          <td style="padding:4px 10px;border:1px solid #d1d5db;font-weight:700">${selectedExam?.date ?? "—"}</td>
        </tr>
      </table>

      <div style="font-size:11px;font-weight:800;color:#ea580c;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 6px;border-bottom:2px solid #ea580c;padding-bottom:3px">Academic Performance</div>

      <table style="width:100%;margin-bottom:12px">
        <thead>
          <tr>
            <th style="background:#ea580c;color:white;padding:5px 10px;font-size:9px;text-align:left">Subject</th>
            <th style="background:#ea580c;color:white;padding:5px 10px;font-size:9px;text-align:center;width:70px">Max Marks</th>
            <th style="background:#ea580c;color:white;padding:5px 10px;font-size:9px;text-align:center;width:70px">Obtained</th>
            <th style="background:#ea580c;color:white;padding:5px 10px;font-size:9px;text-align:center;width:70px">Percentage</th>
            <th style="background:#ea580c;color:white;padding:5px 10px;font-size:9px;text-align:center;width:60px">Grade</th>
            <th style="background:#ea580c;color:white;padding:5px 10px;font-size:9px;text-align:left;width:100px">Remarks</th>
          </tr>
        </thead>
        <tbody>${subjectRows}</tbody>
      </table>

      <!-- Summary -->
      <div style="border:2px solid #ea580c;border-radius:6px;padding:10px 14px;margin:12px 0;display:flex;justify-content:space-between;align-items:center;background:#fef7ed">
        <div><span style="font-size:11px;font-weight:700;color:#ea580c">TOTAL</span>
          <span style="font-size:10px;color:#6b7280;margin-left:8px">${studentResult.totalObtained} / ${(studentResult.marks ?? []).reduce((s: number, m: any) => s + (m.maxMarks || 0), 0)}</span>
        </div>
        <div><span style="font-size:11px;font-weight:700;color:#374151">PERCENTAGE</span>
          <span style="font-size:10px;color:#6b7280;margin-left:8px">${studentResult.percentage.toFixed(1)}%</span>
        </div>
        <div><span style="font-size:11px;font-weight:700;color:#374151">GRADE</span>
          <span style="font-size:10px;color:#ea580c;margin-left:8px;font-weight:800">${studentResult.grade || gradeInfo.grade}</span>
        </div>
      </div>

      <!-- Remarks -->
      <div style="margin-top:14px;font-size:10px">
        <div style="font-weight:700;color:#374151;margin-bottom:4px">Teacher's Remarks:</div>
        <div style="border:1px solid #d1d5db;border-radius:4px;padding:8px;min-height:30px;color:#6b7280">${studentResult.remarks || "_______________________________________________"}</div>
      </div>

      <div style="margin-top:10px;font-size:10px">
        <div style="font-weight:700;color:#374151;margin-bottom:4px">Principal's Remarks:</div>
        <div style="border:1px solid #d1d5db;border-radius:4px;padding:8px;min-height:30px;color:#6b7280">_______________________________________________</div>
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:9px;color:#6b7280">
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:35px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Class Teacher</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:35px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Parent/Guardian</div>
        </div>
        <div style="text-align:center;width:30%">
          <div style="border-bottom:1px solid #374151;min-height:35px"></div>
          <div style="margin-top:4px;font-weight:600;color:#374151;font-size:10px">Principal</div>
          <div style="font-size:7px;color:#ea580c">Official Seal</div>
        </div>
      </div>

      <div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:10px;border-top:1px solid #f3f4f6;padding-top:4px">
        ${BRAND.schoolName} – ${BRAND.campusName} · Report Card
      </div>
    </div>`;
  };

  const handlePrint = () => {
    if (!studentId || !studentResult) return toast.error("Select a student with exam results");
    printHTML(generateHTML());
  };

  const handlePDF = async () => {
    if (!studentId || !studentResult) return toast.error("Select a student with exam results");
    setLoading(true);
    await downloadPDF(generateHTML(), `ReportCard-${selectedStudent?.name}.pdf`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card className="card-3d">
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2">
          <GraduationCap className="size-4 text-primary" /> Report Card Generation
        </CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label className="text-[10px]">Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setStudentId(""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-[10px]">Exam</Label>
              <Select value={examId} onValueChange={setExamId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>{exams.map((e: any) => <SelectItem key={e._id} value={e._id}>{e.title}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-[10px]">Student</Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={!classId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} — {s.rollNumber}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="flex items-end gap-2">
              <Button size="sm" className="flex-1 cursor-pointer btn-3d" onClick={handlePrint} disabled={!studentId || !studentResult}>
                <Printer className="size-3.5 mr-1" /> Print</Button>
              <Button size="sm" variant="outline" className="flex-1 cursor-pointer" onClick={handlePDF} disabled={!studentId || !studentResult || loading}>
                {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {studentResult ? `${(studentResult.marks ?? []).length} subjects · ${studentResult.percentage.toFixed(1)}% · Grade: ${studentResult.grade}` : "Select a class, exam, and student to generate a report card"}
          </p>
        </CardContent>
      </Card>
      {!classId && (
        <Card className="card-3d"><CardContent className="py-12 text-center text-muted-foreground">
          <GraduationCap className="size-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a class, exam, and student to generate a report card</p>
        </CardContent></Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

function StaffAppointmentRegister() {
  const [rows, setRows] = useState(20);
  const [loading, setLoading] = useState(false);
  const genHTML = () => {
    const h = ["#","Full Name","Designation","Dept","Qualification","Join Date","CNIC","Phone","Salary","Status","Remarks"].map((x) => '<th style="background:#ea580c;color:white;padding:5px 6px;font-size:8px;text-align:left;white-space:nowrap">' + x + '</th>').join("");
    const r = Array.from({ length: rows }, (_, i) => '<tr class="' + (i % 2 ? 'alt-row' : '') + '"><td style="padding:5px 6px;border:1px solid #d1d5db;font-size:9px;text-align:center;width:25px">' + (i+1) + '</td>' + Array.from({length:10},() => '<td style="padding:5px 6px;border:1px solid #d1d5db;font-size:9px;min-width:70px">&nbsp;</td>').join("") + '</tr>').join("");
    return fullHTML('<div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' + schoolHeader("STAFF APPOINTMENT REGISTER") + '<div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:10px;color:#374151"><div><strong>Academic Year:</strong> _______________</div><div><strong>Total Staff:</strong> ' + rows + '</div><div><strong>Prepared By:</strong> _______________</div></div><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%"><thead><tr>' + h + '</tr></thead><tbody>' + r + '</tbody></table></div><div style="margin-top:14px;border:1px solid #d1d5db;border-radius:6px;padding:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:9px"><div><strong>Total Active:</strong> ______</div><div><strong>New Appointments:</strong> ______</div><div><strong>Left During Year:</strong> ______</div></div><div style="display:flex;justify-content:space-between;margin-top:20px;font-size:9px;color:#6b7280"><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:35px"></div><div style="margin-top:4px;font-weight:600;color:#374151">HR / Admin</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:35px"></div><div style="margin-top:4px;font-weight:600;color:#374151">Accounts</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:35px"></div><div style="margin-top:4px;font-weight:600;color:#374151">Principal</div></div></div><div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:10px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Staff Appointment Register</div></div>', "Staff Appointment Register");
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), "Staff-Appointment-Register.pdf"); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml("Staff-Appointment-Register.html", genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="size-4 text-primary" /> Staff Appointment Register</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><div className="space-y-1.5"><Label className="text-[10px]">Rows</Label><Input type="number" value={rows} onChange={(e) => setRows(Math.max(5, Math.min(50, Number(e.target.value) || 20)))} className="h-8 text-xs w-24" min={5} max={50} /></div><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Staff appointment record: name, designation, dept, qualification, joining date, CNIC, phone, salary, status.</p></CardContent></Card></div>);
}

function TeacherPerformanceRegister() {
  const [rows, setRows] = useState(20);
  const [loading, setLoading] = useState(false);
  const genHTML = () => {
    const h = ["#","Teacher","Subject","Class","Q1","Q2","Q3","Q4","Avg%","Grade","Remarks","Sig."].map((x) => '<th style="background:#ea580c;color:white;padding:5px 6px;font-size:7px;text-align:left;white-space:nowrap">' + x + '</th>').join("");
    const r = Array.from({ length: rows }, (_, i) => '<tr class="' + (i % 2 ? 'alt-row' : '') + '"><td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;text-align:center;width:22px">' + (i+1) + '</td>' + Array.from({length:11},() => '<td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;min-width:50px">&nbsp;</td>').join("") + '</tr>').join("");
    return fullHTML('<div class="print-page" style="width:297mm;min-height:210mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' + schoolHeader("TEACHER PERFORMANCE / APPRAISAL REGISTER") + '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:10px;color:#374151"><div><strong>Academic Year:</strong> _______________</div><div><strong>Prepared By:</strong> _______________</div></div><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%"><thead><tr>' + h + '</tr></thead><tbody>' + r + '</tbody></table></div><div style="margin-top:10px;padding:6px 10px;background:#fef7ed;border:1px solid #fed7aa;border-radius:4px;font-size:8px;color:#374151"><strong>Grade:</strong> A+(90+) A(80+) B+(70+) B(60+) C(50+) D(40+) F(&lt;40%) | <strong>Scores:</strong> 5=Outstanding 4=Exceeds 3=Meets 2=Needs Improvement 1=Unsatisfactory</div><div style="display:flex;justify-content:space-between;margin-top:14px;font-size:9px;color:#6b7280"><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">VP / Coordinator</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Principal</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">HR</div></div></div><div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:8px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Teacher Performance Register</div></div>', "Teacher Performance Register");
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), "Teacher-Performance-Register.pdf"); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml("Teacher-Performance-Register.html", genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="size-4 text-primary" /> Teacher Performance Register</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><div className="space-y-1.5"><Label className="text-[10px]">Rows</Label><Input type="number" value={rows} onChange={(e) => setRows(Math.max(5, Math.min(50, Number(e.target.value) || 20)))} className="h-8 text-xs w-24" min={5} max={50} /></div><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Landscape A4 quarterly teacher appraisal: 4 scores, average %, grade, remarks.</p></CardContent></Card></div>);
}

function VisitorRegister() {
  const [rows, setRows] = useState(25);
  const [loading, setLoading] = useState(false);
  const genHTML = () => {
    const h = ["#","Date","Visitor Name","CNIC / ID","Phone","Purpose","Person Visited","In Time","Out Time","Remarks","Signature"].map((x) => '<th style="background:#ea580c;color:white;padding:5px 6px;font-size:8px;text-align:left;white-space:nowrap">' + x + '</th>').join("");
    const r = Array.from({ length: rows }, (_, i) => '<tr class="' + (i % 2 ? 'alt-row' : '') + '"><td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;text-align:center;width:22px">' + (i+1) + '</td>' + Array.from({length:10},() => '<td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;min-width:60px">&nbsp;</td>').join("") + '</tr>').join("");
    return fullHTML('<div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' + schoolHeader("VISITOR REGISTER") + '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:10px;color:#374151"><div><strong>Month:</strong> _______________</div><div><strong>Security Guard:</strong> _______________</div></div><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%"><thead><tr>' + h + '</tr></thead><tbody>' + r + '</tbody></table></div><div style="margin-top:10px;padding:6px 10px;background:#fef7ed;border:1px solid #fed7aa;border-radius:4px;font-size:8px;color:#374151"><strong>Note:</strong> All visitors must show valid ID at the gate. No visitor beyond reception without admin approval.</div><div style="display:flex;justify-content:space-between;margin-top:14px;font-size:9px;color:#6b7280"><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Security In-Charge</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Office Manager</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Principal</div></div></div><div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:8px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Visitor Register</div></div>', "Visitor Register");
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), "Visitor-Register.pdf"); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml("Visitor-Register.html", genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><UsersRound className="size-4 text-primary" /> Visitor Register</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><div className="space-y-1.5"><Label className="text-[10px]">Rows</Label><Input type="number" value={rows} onChange={(e) => setRows(Math.max(5, Math.min(50, Number(e.target.value) || 25)))} className="h-8 text-xs w-24" min={5} max={50} /></div><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Gate register: visitor name, CNIC, phone, purpose, in/out time.</p></CardContent></Card></div>);
}

function ParentMeetingRegister() {
  const [rows, setRows] = useState(20);
  const [loading, setLoading] = useState(false);
  const genHTML = () => {
    const h = ["#","Date","Student","Class","Parent","Relation","Phone","Purpose","Teacher","Outcome","Sig."].map((x) => '<th style="background:#ea580c;color:white;padding:5px 6px;font-size:7px;text-align:left;white-space:nowrap">' + x + '</th>').join("");
    const r = Array.from({ length: rows }, (_, i) => '<tr class="' + (i % 2 ? 'alt-row' : '') + '"><td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;text-align:center;width:22px">' + (i+1) + '</td>' + Array.from({length:10},() => '<td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;min-width:55px">&nbsp;</td>').join("") + '</tr>').join("");
    return fullHTML('<div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' + schoolHeader("PARENT MEETING REGISTER") + '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:10px;color:#374151"><div><strong>Month:</strong> _______________</div><div><strong>Class:</strong> _______________</div></div><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%"><thead><tr>' + h + '</tr></thead><tbody>' + r + '</tbody></table></div><div style="margin-top:10px;padding:6px 10px;background:#fef7ed;border:1px solid #fed7aa;border-radius:4px;font-size:8px;color:#374151"><strong>Codes:</strong> PTM=Parent-Teacher Meeting | AC=Academic | BE=Behaviour | FE=Fee Discussion | OC=Other</div><div style="display:flex;justify-content:space-between;margin-top:14px;font-size:9px;color:#6b7280"><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Class Teacher</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Counselor</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Principal</div></div></div><div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:8px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Parent Meeting Register</div></div>', "Parent Meeting Register");
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), "Parent-Meeting-Register.pdf"); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml("Parent-Meeting-Register.html", genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="size-4 text-primary" /> Parent Meeting Register</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><div className="space-y-1.5"><Label className="text-[10px]">Rows</Label><Input type="number" value={rows} onChange={(e) => setRows(Math.max(5, Math.min(50, Number(e.target.value) || 20)))} className="h-8 text-xs w-24" min={5} max={50} /></div><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Parent meeting log: student, parent info, purpose, teacher, outcome.</p></CardContent></Card></div>);
}

function StudentDisciplineRegister() {
  const [rows, setRows] = useState(20);
  const [loading, setLoading] = useState(false);
  const genHTML = () => {
    const h = ["#","Date","Student","Class/Roll","Type","Description","Witness","Action Taken","Parent Informed","Follow-up","Verified"].map((x) => '<th style="background:#ea580c;color:white;padding:5px 6px;font-size:7px;text-align:left;white-space:nowrap">' + x + '</th>').join("");
    const r = Array.from({ length: rows }, (_, i) => '<tr class="' + (i % 2 ? 'alt-row' : '') + '"><td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;text-align:center;width:22px">' + (i+1) + '</td>' + Array.from({length:10},() => '<td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px;min-width:55px">&nbsp;</td>').join("") + '</tr>').join("");
    return fullHTML('<div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' + schoolHeader("STUDENT DISCIPLINE REGISTER") + '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:10px;color:#374151"><div><strong>Academic Year:</strong> _______________</div><div><strong>Class:</strong> _______________</div><div><strong>Counselor:</strong> _______________</div></div><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%"><thead><tr>' + h + '</tr></thead><tbody>' + r + '</tbody></table></div><div style="margin-top:10px;padding:6px 10px;background:#fef7ed;border:1px solid #fed7aa;border-radius:4px;font-size:8px;color:#374151"><strong>Types:</strong> F=Fighting V=Verbal P=Property U=Uniform A=Academic T=Tardiness O=Other | <strong>Actions:</strong> W=Warning D=Detention S=Suspension C=Parent Conference E=Expulsion</div><div style="display:flex;justify-content:space-between;margin-top:14px;font-size:9px;color:#6b7280"><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Class Teacher</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Counselor</div></div><div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Principal</div></div></div><div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:8px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Student Discipline Register</div></div>', "Student Discipline Register");
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), "Student-Discipline-Register.pdf"); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml("Student-Discipline-Register.html", genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="size-4 text-primary" /> Student Discipline Register</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><div className="space-y-1.5"><Label className="text-[10px]">Rows</Label><Input type="number" value={rows} onChange={(e) => setRows(Math.max(5, Math.min(50, Number(e.target.value) || 20)))} className="h-8 text-xs w-24" min={5} max={50} /></div><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Discipline log: incident type, description, witnesses, action, parent notification.</p></CardContent></Card></div>);

}

/* ═══════════════════════════════════════════════════════════════ */
/*                   LESSON PLAN PRINT FORMAT                      */
/* ═══════════════════════════════════════════════════════════════ */

function LessonPlanPrintFormat() {
  const [loading, setLoading] = useState(false);
  const genHTML = () => {
    const stages = [
      ['Starter', 'Introduction / Recap', '5 min'],
      ['Presentation', 'New Concept', '10-15 min'],
      ['Practice', 'Individual/Group Activity', '15 min'],
      ['Assessment', 'Questions/Activity', '5-10 min'],
      ['Homework', 'Assignment', '2-5 min'],
    ];
    const stageRows = stages.map((s, i) =>
      '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:' + (i % 2 === 0 ? '#fef7ed' : 'white') + '">' + s[0] + '</td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px">' + s[1] + '</td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;text-align:center">' + s[2] + '</td></tr>'
    ).join('');

    return fullHTML(
      '<div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' +
      schoolHeader('DAILY LESSON PLAN') +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;font-size:9px;border:1px solid #d1d5db;border-radius:6px;padding:8px;background:#fef7ed">' +
        '<div><strong>Academic Session:</strong> _____________</div>' +
        '<div><strong>Campus:</strong> _____________</div>' +
        '<div><strong>Teacher Name:</strong> _____________</div>' +
        '<div><strong>Class:</strong> ________ <strong>Section:</strong> ___</div>' +
        '<div><strong>Subject:</strong> _____________</div>' +
        '<div><strong>Date:</strong> ____/____/________</div>' +
        '<div><strong>Period No.:</strong> ________</div>' +
        '<div><strong>Day:</strong> _____________</div>' +
        '<div><strong>Lesson/Chapter:</strong> _____________</div>' +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:10px">' +
        '<thead><tr><th colspan="2" style="background:#ea580c;color:white;padding:5px 8px;font-size:10px;text-align:left">LESSON PLAN</th></tr></thead>' +
        '<tbody>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;width:30%;background:#f3f4f6"><strong>Topic</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Learning Objectives</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;height:30px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Previous Knowledge</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Teaching Method</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Introduction / Starter</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;height:30px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Explanation / Presentation</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;height:40px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Class Activity</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;height:30px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Group / Pair Activity</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Student Practice</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Question & Answer</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Assessment Method</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Homework</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Resources / Teaching Aids</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Differentiated Learning</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
          '<tr><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px;background:#f3f4f6"><strong>Extension Activity</strong></td><td style="padding:4px 8px;border:1px solid #d1d5db;font-size:9px"></td></tr>' +
        '</tbody>' +
      '</table>' +
      '<div style="margin-bottom:10px"><strong style="font-size:10px;color:#ea580c">LESSON TIMING</strong>' +
      '<table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr><th style="background:#ea580c;color:white;padding:4px 8px;font-size:9px;text-align:left">Stage</th><th style="background:#ea580c;color:white;padding:4px 8px;font-size:9px;text-align:left">Activity</th><th style="background:#ea580c;color:white;padding:4px 8px;font-size:9px;text-align:center">Time</th></tr></thead><tbody>' + stageRows + '</tbody></table></div>' +
      '<div style="margin-bottom:10px"><strong style="font-size:10px;color:#ea580c">TEACHER REFLECTION</strong>' +
      '<div style="border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:9px">' +
        '<div style="margin-bottom:4px"><strong>What went well?</strong> _______________________________________________</div>' +
        '<div style="margin-bottom:4px"><strong>Students’ understanding level:</strong> _______________________________________________</div>' +
        '<div style="margin-bottom:4px"><strong>Students who need additional support:</strong> _______________________________________________</div>' +
        '<div style="margin-bottom:4px"><strong>Difficulties faced:</strong> _______________________________________________</div>' +
        '<div style="margin-bottom:4px"><strong>Follow-up action:</strong> _______________________________________________</div>' +
        '<div><strong>Lesson completed:</strong> ☐ Yes &nbsp; ☐ No</div>' +
      '</div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:14px;font-size:9px;color:#6b7280">' +
        '<div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Teacher Signature</div></div>' +
        '<div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Coordinator / Academic Head</div></div>' +
        '<div style="text-align:center;width:30%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Principal</div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:8px;font-size:9px;color:#6b7280"><strong>Date:</strong> ____/____/________</div>' +
      '<div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:10px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Daily Lesson Plan</div>' +
      '</div>',
      'Daily Lesson Plan'
    );
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), 'Daily-Lesson-Plan.pdf'); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml('Daily-Lesson-Plan.html', genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="size-4 text-primary" /> Daily Lesson Plan</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Complete lesson plan format: objectives, teaching flow, timing, reflection, and approval signatures.</p></CardContent></Card></div>);
}

/* ═══════════════════════════════════════════════════════════════ */
/*                     SYLLABUS PRINT FORMAT                        */
/* ═══════════════════════════════════════════════════════════════ */

function SyllabusPrintFormat() {
  const [rows, setRows] = useState(15);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState('1st Term');
  const genHTML = () => {
    const h = ['#', 'Ch.', 'Chapter Name', 'Topics', 'Type', 'Pages', 'Objectives', 'Written', 'Oral', 'Practical', 'Status'].map((x) =>
      '<th style="background:#ea580c;color:white;padding:4px 6px;font-size:7px;text-align:left;white-space:nowrap">' + x + '</th>'
    ).join('');
    const r = Array.from({ length: rows }, (_, i) =>
      '<tr class="' + (i % 2 ? 'alt-row' : '') + '"><td style="padding:4px 6px;border:1px solid #d1d5db;font-size:8px;text-align:center;width:20px">' + (i+1) + '</td>' +
      Array.from({length:10}, () => '<td style="padding:4px 6px;border:1px solid #d1d5db;font-size:8px;min-width:45px"></td>').join('') +
      '</tr>'
    ).join('');
    return fullHTML(
      '<div class="print-page" style="width:210mm;min-height:297mm;padding:10mm 8mm;font-family:Segoe UI,sans-serif;">' +
      schoolHeader('SYLLABUS TRACKING') +
      '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:10px;color:#374151">' +
        '<div><strong>Academic Session:</strong> _______________</div>' +
        '<div><strong>Term:</strong> ' + term + '</div>' +
        '<div><strong>Class:</strong> _______________</div>' +
        '<div><strong>Subject:</strong> _______________</div>' +
        '<div><strong>Teacher:</strong> _______________</div>' +
      '</div>' +
      '<div style="overflow-x:auto"><table style="table-layout:fixed;width:100%"><thead><tr>' + h + '</tr></thead><tbody>' + r + '</tbody></table></div>' +
      '<div style="margin-top:10px;padding:6px 10px;background:#fef7ed;border:1px solid #fed7aa;border-radius:4px;font-size:8px;color:#374151">' +
        '<strong>Status:</strong> ✓ Completed &nbsp; ○ In Progress &nbsp; — Not Started &nbsp; | &nbsp; ' +
        '<strong>Type:</strong> W = Written &nbsp; O = Oral &nbsp; P = Practical' +
      '</div>' +
      '<div style="margin-top:8px;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:9px">' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">' +
          '<div><strong>Total Chapters:</strong> _____</div>' +
          '<div><strong>Completed:</strong> _____</div>' +
          '<div><strong>In Progress:</strong> _____</div>' +
          '<div><strong>Completion %:</strong> _____</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px">' +
          '<div><strong>Start Date:</strong> ____/____/____</div>' +
          '<div><strong>Expected End:</strong> ____/____/____</div>' +
          '<div><strong>Actual End:</strong> ____/____/____</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:8px;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:9px">' +
        '<strong>Exam Preparation:</strong>' +
        '<div style="display:flex;gap:16px;margin-top:4px">' +
          '<label>☐ Revision Required</label><label>☐ Revision Completed</label><label>☐ Test Taken</label>' +
        '</div>' +
        '<div style="margin-top:4px"><strong>Weak Areas:</strong> _______________________________________________</div>' +
        '<div><strong>Additional Practice Required:</strong> _______________________________________________</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:14px;font-size:9px;color:#6b7280">' +
        '<div style="text-align:center;width:25%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Teacher</div></div>' +
        '<div style="text-align:center;width:25%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Coordinator</div></div>' +
        '<div style="text-align:center;width:25%"><div style="border-bottom:1px solid #374151;min-height:30px"></div><div style="margin-top:3px;font-weight:600;color:#374151">Principal</div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:6px;font-size:9px;color:#6b7280"><strong>Approval Date:</strong> ____/____/________</div>' +
      '<div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:8px;border-top:1px solid #f3f4f6;padding-top:4px">' + BRAND.schoolName + ' - ' + BRAND.campusName + ' Syllabus Tracking</div>' +
      '</div>',
      'Syllabus Tracking'
    );
  };
  const handlePrint = () => { printHTML(genHTML()); };
  const handlePDF = async () => { setLoading(true); await downloadPDF(genHTML(), 'Syllabus-Tracking.pdf'); setLoading(false); };
  const handleDownloadHtml = () => downloadHtml('Syllabus-Tracking.html', genHTML());
  return (<div className="space-y-4"><Card className="card-3d"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="size-4 text-primary" /> Syllabus Tracking</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end gap-3"><div className="space-y-1.5"><Label className="text-[10px]">Rows</Label><Input type="number" value={rows} onChange={(e) => setRows(Math.max(5, Math.min(40, Number(e.target.value) || 15)))} className="h-8 text-xs w-24" min={5} max={40} /></div><div className="space-y-1.5"><Label className="text-[10px]">Term</Label><select value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 text-xs w-36 border border-border rounded-md px-2"><option>1st Term</option><option>2nd Term</option><option>Final Term</option></select></div><Button size="sm" className="cursor-pointer btn-3d" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handleDownloadHtml}><Download className="size-3.5 mr-1" /> HTML</Button><Button size="sm" variant="outline" className="cursor-pointer" onClick={handlePDF} disabled={loading}>{loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF</Button></div><p className="text-[10px] text-muted-foreground">Syllabus tracking: chapter-wise progress, exam prep, completion tracking, and approval signatures.</p></CardContent></Card></div>);
}
/*                         MAIN PAGE                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export default function PrintFormats() {
  return (
    <AppShell title="Print Formats">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Generate print-ready documents — attendance registers, fee slips, ID cards, certificates, report cards, and office registers
        </p>
        <Tabs defaultValue="attendance">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="attendance" className="gap-1.5">
              <ClipboardCheck className="size-3.5" /> Attendance Register
            </TabsTrigger>
            <TabsTrigger value="feeslip" className="gap-1.5">
              <Receipt className="size-3.5" /> Fee Slip
            </TabsTrigger>
            <TabsTrigger value="idcard" className="gap-1.5">
              <CreditCard className="size-3.5" /> ID Card
            </TabsTrigger>
            <TabsTrigger value="tc" className="gap-1.5">
              <FileText className="size-3.5" /> Transfer Certificate
            </TabsTrigger>
            <TabsTrigger value="reportcard" className="gap-1.5">
              <GraduationCap className="size-3.5" /> Report Card
            </TabsTrigger>
                        <TabsTrigger value="appraisal" className="gap-1.5"><Star className="size-3.5" /> Appraisal</TabsTrigger>
            <TabsTrigger value="staff" className="gap-1.5"><UserPlus className="size-3.5" /> Staff</TabsTrigger>
            <TabsTrigger value="perf" className="gap-1.5"><ClipboardList className="size-3.5" /> Perf. Register</TabsTrigger>
            <TabsTrigger value="visitor" className="gap-1.5"><UsersRound className="size-3.5" /> Visitor</TabsTrigger>
            <TabsTrigger value="parent" className="gap-1.5"><UserCheck className="size-3.5" /> Parent Meeting</TabsTrigger>
            <TabsTrigger value="discipline" className="gap-1.5"><ShieldAlert className="size-3.5" /> Discipline</TabsTrigger>
            <TabsTrigger value="lessonplan" className="gap-1.5"><BookOpen className="size-3.5" /> Lesson Plan</TabsTrigger>
            <TabsTrigger value="syllabus" className="gap-1.5"><BookOpen className="size-3.5" /> Syllabus</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance"><AttendanceRegister /></TabsContent>
          <TabsContent value="feeslip"><FeeSlipFormat /></TabsContent>
          <TabsContent value="idcard"><IDCardFormat /></TabsContent>
          <TabsContent value="tc"><TransferCertificateFormat /></TabsContent>
          <TabsContent value="reportcard"><ReportCardFormat /></TabsContent>
          <TabsContent value="appraisal"><PerformanceAppraisal /></TabsContent>
          <TabsContent value="staff"><StaffAppointmentRegister /></TabsContent>
          <TabsContent value="perf"><TeacherPerformanceRegister /></TabsContent>
          <TabsContent value="visitor"><VisitorRegister /></TabsContent>
          <TabsContent value="parent"><ParentMeetingRegister /></TabsContent>
          <TabsContent value="discipline"><StudentDisciplineRegister /></TabsContent>
          <TabsContent value="lessonplan"><LessonPlanPrintFormat /></TabsContent>
          <TabsContent value="syllabus"><SyllabusPrintFormat /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
