import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Receipt, FileText, Printer, Send, Trash2, CheckCircle2, Eye, DollarSign,
  Layers, Users, AlertTriangle, Download, Loader2, MessageSquare,
  Search, SendHorizontal,
} from "lucide-react";
import { formatPkr } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ═══════════════════════════════════════════════════════════════════ */
/*                     CHALLAN HTML GENERATOR (A4 print-ready)        */
/* ═══════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function generateChallanBody(s: any, period: string): string {
  const [year, month] = period.split("-");
  const monthName = MONTH_NAMES[parseInt(month) - 1] || month;

  // Normalize: handle both classwiseData shape and feeSlip list shape
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

  const annualRows = annualFees
    .map((f: any, i: number) =>
      `<tr style="background:${i % 2 === 0 ? "#fff" : "#fef7ed"}">
        <td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151">${f.label}</td>
        <td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;color:#1f2937">Rs. ${Number(f.amount || 0).toLocaleString()}</td>
      </tr>`
    ).join("");

  const monthlyRows = monthlyFeesList
    .map((f: any, i: number) =>
      `<tr style="background:${i % 2 === 0 ? "#fff" : "#fef7ed"}">
        <td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151">${f.label}</td>
        <td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;color:#1f2937">Rs. ${Number(f.amount || 0).toLocaleString()}</td>
      </tr>`
    ).join("");

  return `
  <div class="challan-page" style="width:210mm;min-height:297mm;padding:12mm 14mm;color:#1a1a1a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:11px;margin:0 auto;background:white;position:relative;">

    <!-- ═══ HEADER ═══ -->
    <div style="text-align:center;border-bottom:3px solid #ea580c;padding-bottom:10px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:4px;">
        <div style="width:50px;height:50px;border-radius:50%;border:2px solid #ea580c;overflow:hidden;background:#fff7ed;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="50" height="50">
            <circle cx="256" cy="256" r="250" fill="none" stroke="#EA580C" stroke-width="14"/>
            <circle cx="256" cy="256" r="240" fill="white"/>
            <circle cx="256" cy="230" r="110" fill="#FDEBD0" stroke="#D4845A" stroke-width="2"/>
            <rect x="244" y="145" width="24" height="70" rx="4" fill="#999" stroke="#666" stroke-width="1.5"/>
            <rect x="238" y="210" width="36" height="8" rx="3" fill="#777" stroke="#555" stroke-width="1"/>
            <path d="M256 100 C240 130,230 145,244 155 L256 135 L268 155 C282 145,272 130,256 100Z" fill="#E63C12"/>
            <path d="M256 110 C248 130,242 140,250 148 L256 132 L262 148 C270 140,264 130,256 110Z" fill="#F5A623"/>
            <path d="M190 225 Q220 200,256 215 Q292 200,322 225 L322 260 Q292 240,256 255 Q220 240,190 260Z" fill="white" stroke="#333" stroke-width="2"/>
            <line x1="256" y1="215" x2="256" y2="255" stroke="#333" stroke-width="1.5"/>
            <text x="256" y="345" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="38" font-weight="900" fill="#111" letter-spacing="2">LEADS</text>
            <text x="256" y="368" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#111" letter-spacing="8">SYSTEM</text>
          </svg>
        </div>
        <div>
          <h1 style="font-size:20px;color:#ea580c;letter-spacing:1.5px;font-weight:900;margin:0;line-height:1.2">${BRAND.schoolName.toUpperCase()}</h1>
          <h2 style="font-size:12px;font-weight:700;margin:1px 0 0;color:#374151">${BRAND.campusName.toUpperCase()} – D.G. KHAN</h2>
        </div>
      </div>
      <p style="font-size:9px;color:#6b7280;margin:2px 0 0">${BRAND.address}</p>
      <p style="font-size:9px;color:#6b7280;margin:1px 0 0">Contact: ${BRAND.phones.join(" | ")}</p>
      <div style="font-size:13px;font-weight:800;margin-top:8px;color:#fff;background:#ea580c;display:inline-block;padding:4px 24px;border-radius:4px;letter-spacing:1px">STUDENT FEE CHALLAN</div>
    </div>

    <!-- ═══ STUDENT INFO ═══ -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;margin-bottom:10px;background:#fff7ed;padding:10px 14px;border-radius:6px;border:1px solid #fed7aa;">
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Fee Month:</span> <strong>${monthName} ${year}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Academic Year:</span> <strong>${year}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Student Name:</span> <strong>${studentName}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Roll No.:</span> <strong>${rollNumber}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Father/Guardian:</span> <strong>${fatherName}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Admission No.:</span> <strong>${admissionNo}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Class:</span> <strong>${className}</strong></div>
      <div style="padding:3px 0;font-size:11px"><span style="color:#6b7280;font-size:10px">Section:</span> <strong>${section}</strong></div>
    </div>

    <!-- ═══ ANNUAL FEES ═══ -->
    ${annualFees.length > 0 ? `
    <div style="font-size:11px;font-weight:800;color:#ea580c;margin:12px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">📋 Annual Fees</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead><tr>
        <th style="background:#ea580c;color:white;font-weight:600;padding:5px 10px;font-size:10px;border:1px solid #ea580c;text-align:left">Description</th>
        <th style="background:#ea580c;color:white;font-weight:600;padding:5px 10px;font-size:10px;border:1px solid #ea580c;text-align:right;width:120px">Amount (Rs.)</th>
      </tr></thead>
      <tbody>
        ${annualRows}
        <tr style="background:#fef3c7;font-weight:700">
          <td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px">Total Annual Fee</td>
          <td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:800">Rs. ${totalAnnual.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>` : ""}

    <!-- ═══ MONTHLY FEES ═══ -->
    <div style="font-size:11px;font-weight:800;color:#ea580c;margin:12px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">📋 Monthly Fees</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead><tr>
        <th style="background:#ea580c;color:white;font-weight:600;padding:5px 10px;font-size:10px;border:1px solid #ea580c;text-align:left">Description</th>
        <th style="background:#ea580c;color:white;font-weight:600;padding:5px 10px;font-size:10px;border:1px solid #ea580c;text-align:right;width:120px">Amount (Rs.)</th>
      </tr></thead>
      <tbody>
        ${monthlyRows}
        ${!monthlyRows && !annualFees.length ? `<tr><td colspan="2" style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-style:italic">No fee structure defined for this class</td></tr>` : ""}
        ${previousBalance > 0 ? `<tr style="background:#fef2f2"><td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151">Previous Balance</td><td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;color:#dc2626">Rs. ${previousBalance.toLocaleString()}</td></tr>` : ""}
        ${adjustment < 0 ? `<tr style="background:#f0fdf4"><td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151">Discount / Concession</td><td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;color:#059669">− Rs. ${Math.abs(adjustment).toLocaleString()}</td></tr>` : ""}
        ${adjustment > 0 ? `<tr style="background:#eff6ff"><td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;color:#374151">Additional Charges</td><td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;color:#2563eb">Rs. ${adjustment.toLocaleString()}</td></tr>` : ""}
        <tr style="background:#fef3c7;font-weight:700">
          <td style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px">Total Monthly Fee</td>
          <td style="text-align:right;padding:6px 10px;border:1px solid #e5e7eb;font-size:11px;font-weight:800">Rs. ${totalMonthly.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <!-- ═══ PAYMENT SUMMARY ═══ -->
    <div style="font-size:11px;font-weight:800;color:#ea580c;margin:12px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">💰 Payment Summary</div>
    <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:10px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f9fafb"><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;color:#6b7280">Annual Fee Total</td><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">Rs. ${totalAnnual.toLocaleString()}</td></tr>
        <tr><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;color:#6b7280">Monthly Fee Total</td><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">Rs. ${totalMonthly.toLocaleString()}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;color:#6b7280">Previous Balance</td><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${previousBalance > 0 ? '#dc2626' : '#059669'}">Rs. ${previousBalance.toLocaleString()}</td></tr>
        <tr><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;color:#6b7280">Fee Paid</td><td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#059669">Rs. ${paid.toLocaleString()}</td></tr>
      </table>
    </div>

    <!-- ═══ TOTALS ═══ -->
    <div style="background:#ea580c;color:white;padding:8px 14px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:800;margin:8px 0;letter-spacing:0.3px">
      <span>TOTAL AMOUNT PAID</span>
      <span style="font-size:15px">Rs. ${paid.toLocaleString()}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;font-size:13px;font-weight:800;border:2px solid ${balance > 0 ? '#dc2626' : '#059669'};border-radius:6px;margin-bottom:8px;background:${balance > 0 ? '#fef2f2' : '#f0fdf4'}">
      <span style="color:${balance > 0 ? '#991b1b' : '#166534'}">REMAINING BALANCE</span>
      <span style="color:${balance > 0 ? '#dc2626' : '#059669'};font-size:15px">Rs. ${balance.toLocaleString()}</span>
    </div>

    <!-- ═══ PAYMENT METHOD ═══ -->
    <div style="display:flex;gap:20px;margin:10px 0 6px;font-size:10px;color:#6b7280;">
      <span style="font-weight:600;color:#374151">Payment Method:</span>
      <label style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border:1.5px solid #9ca3af;display:inline-block;border-radius:2px;background:white"></span> Cash</label>
      <label style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border:1.5px solid #9ca3af;display:inline-block;border-radius:2px;background:white"></span> Bank</label>
      <label style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border:1.5px solid #9ca3af;display:inline-block;border-radius:2px;background:white"></span> Online</label>
      <label style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border:1.5px solid #9ca3af;display:inline-block;border-radius:2px;background:white"></span> Cheque</label>
    </div>

    <!-- ═══ SIGNATURES ═══ -->
    <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:9px;color:#6b7280;">
      <div style="text-align:center;padding-top:26px;border-top:1px solid #d1d5db;width:28%">
        <div style="font-weight:600;color:#374151;font-size:10px">Parent/Guardian</div>
        <div>Signature</div>
      </div>
      <div style="text-align:center;padding-top:26px;border-top:1px solid #d1d5db;width:28%">
        <div style="font-weight:600;color:#374151;font-size:10px">Received By</div>
        <div>Name & Signature</div>
      </div>
      <div style="text-align:center;padding-top:26px;border-top:1px solid #d1d5db;width:28%">
        <div style="font-weight:600;color:#374151;font-size:10px">School Stamp</div>
        <div>&nbsp;</div>
      </div>
    </div>

    <!-- ═══ FOOTER ═══ -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:6px 10px;border-radius:4px;font-size:9px;color:#6b7280;margin-top:8px;">
      <strong style="color:#374151">IMPORTANT:</strong> Please keep this fee slip safely as proof of payment. Fees should be paid within the due date according to school policy. For queries, contact the accounts office.
    </div>
    <div style="text-align:center;font-size:8px;color:#9ca3af;margin-top:6px;border-top:1px solid #f3f4f6;padding-top:4px;">
      ${BRAND.schoolName} – ${BRAND.campusName} · Quality Education • Character Building • Bright Future<br/>
      Slip generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
    </div>
  </div>`;
}

function generateFullHTML(body: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; background:#f1f5f9; }
  @media print {
    @page { size: A4 portrait; margin: 0; }
    body { background: white !important; }
    .challan-page { page-break-after: always; padding: 10mm 12mm !important; width: 100% !important; min-height: auto !important; }
    .challan-page:last-child { page-break-after: auto; }
    table { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
  @page { size: A4 portrait; margin: 10mm; }
</style>
</head>
<body>${body}</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                     PRINT + PDF HELPERS                             */
/* ═══════════════════════════════════════════════════════════════════ */

function printHTML(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1500);
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

        // Wait for fonts and images
        await new Promise((r) => setTimeout(r, 500));

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          toast.error("Could not generate PDF");
          return;
        }

        // Get all challan pages
        const pages = iframeDoc.querySelectorAll(".challan-page");
        const pagesToRender = pages.length > 0 ? Array.from(pages) : [iframeDoc.body];

        for (let i = 0; i < pagesToRender.length; i++) {
          if (i > 0) doc.addPage();

          const pageEl = pagesToRender[i] as HTMLElement;
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            width: 794,
            windowWidth: 794,
          });

          const imgData = canvas.toDataURL("image/png");
          const imgWidth = docWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Center vertically if shorter than page
          const yOff = imgHeight < docHeight ? (docHeight - imgHeight) / 2 : 0;
          doc.addImage(imgData, "PNG", 0, yOff, imgWidth, imgHeight);
        }

        doc.save(filename);
      } catch (err) {
        console.error("PDF generation failed:", err);
        toast.error("PDF generation failed. Try using Print instead.");
      } finally {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
        resolve();
      }
    };

    iframe.src = url;
  });
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                     CLASSWISE FEE SLIP TAB                          */
/* ═══════════════════════════════════════════════════════════════════ */

function ClasswiseTab() {
  const classes = useQuery(api.classes.list) ?? [];
  const generateClassSlips = useMutation(api.feeSlips.generateClassSlips);

  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [type, setType] = useState<"slip" | "challan" | "reminder">("challan");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);

  const classData = useQuery(
    api.feeSlips.classwiseData,
    classId ? { classId, period, section: section || undefined } : "skip"
  );

  const handleGenerate = async () => {
    if (!classId) return toast.error("Select a class first");
    setGenerating(true);
    try {
      const count = await generateClassSlips({
        classId,
        section: section || undefined,
        period,
        type,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      });
      if (count === 0) {
        toast.info("All slips already generated for this period, or no fee structure defined");
      } else {
        toast.success(`Generated ${count} fee ${type}s for ${selectedClass?.name ?? ""}${section ? ` - ${section}` : ""}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
    setGenerating(false);
  };

  const handlePrintAll = () => {
    if (!classData || classData.students.length === 0) return;
    const body = classData.students.map((s) => generateChallanBody(s, period)).join("");
    const html = generateFullHTML(body, `Fee Challans — ${classData.className} ${period}`);
    printHTML(html);
  };

  const handleDownloadPDFAll = async () => {
    if (!classData || classData.students.length === 0) return;
    setPdfLoading(true);
    try {
      const body = classData.students.map((s) => generateChallanBody(s, period)).join("");
      const html = generateFullHTML(body, `Fee Challans — ${classData.className} ${period}`);
      const [year, month] = period.split("-");
      const monthName = MONTH_NAMES[parseInt(month) - 1] || month;
      await downloadPDF(html, `Fee-Challans-${classData.className}-${monthName}-${year}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch {
      toast.error("PDF generation failed");
    }
    setPdfLoading(false);
  };

  const handlePrintSingle = (student: any) => {
    const body = generateChallanBody(student, period);
    const html = generateFullHTML(body, `Fee Challan — ${student.name}`);
    printHTML(html);
  };

  const handleDownloadPDFSingle = async (student: any) => {
    setPdfLoading(true);
    try {
      const body = generateChallanBody(student, period);
      const html = generateFullHTML(body, `Fee Challan — ${student.name}`);
      const [year, month] = period.split("-");
      const monthName = MONTH_NAMES[parseInt(month) - 1] || month;
      await downloadPDF(html, `Fee-Challan-${student.name.replace(/\s+/g, "-")}-${monthName}-${year}.pdf`);
      toast.success(`PDF downloaded for ${student.name}`);
    } catch {
      toast.error("PDF generation failed");
    }
    setPdfLoading(false);
  };

  const totalCollection = classData?.students.reduce((s, st) => s + st.paid, 0) ?? 0;
  const totalBalance = classData?.students.reduce((s, st) => s + st.balance, 0) ?? 0;
  const hasNoFeeStructure = classData && classData.monthlyFees.length === 0 && classData.annualFees.length === 0;

  return (
    <div className="space-y-4">
      {/* Class Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="size-4" /> Classwise Fee Slip & Challan Generation
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
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Sections" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Sections</SelectItem>
                  {selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Period (YYYY-MM)</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="h-8 text-xs" placeholder="2026-08" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="challan">Fee Challan</SelectItem>
                  <SelectItem value="slip">Fee Slip</SelectItem>
                  <SelectItem value="reminder">Fee Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px]">Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px]">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-xs" placeholder="Optional notes" />
            </div>
          </div>

          {hasNoFeeStructure && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              <span><strong>No fee structure</strong> is defined for this class. Go to Fee Management &gt; Fee Structure to set up monthly/annual fees first.</span>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={handleGenerate} disabled={!classId || generating}>
              {generating ? "Generating..." : "Generate Fee Slips"}
            </Button>
            {classData && classData.students.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={handlePrintAll} disabled={pdfLoading}>
                  <Printer className="size-3.5 mr-1" /> Print All ({classData.students.length})
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadPDFAll} disabled={pdfLoading}>
                  {pdfLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} Download PDF
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Class Summary */}
      {classData && classData.students.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{classData.totalStudents}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Students</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{formatPkr(totalCollection)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total Collected</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{formatPkr(totalBalance)}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total Balance</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{classData.monthlyFees.length + classData.annualFees.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Fee Items</p>
            </CardContent></Card>
          </div>

          {/* Fee Structure Preview */}
          {(classData.monthlyFees.length > 0 || classData.annualFees.length > 0) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Fee Structure — {classData.className}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {classData.monthlyFees.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Monthly Fees</p>
                      {classData.monthlyFees.map((f, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5"><span>{f.label}</span><span className="font-medium">{formatPkr(f.amount)}</span></div>
                      ))}
                    </div>
                  )}
                  {classData.annualFees.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Annual Fees</p>
                      {classData.annualFees.map((f, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5"><span>{f.label}</span><span className="font-medium">{formatPkr(f.amount)}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Students List with Print + PDF */}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead className="w-8">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {classData.students.map((s, i) => (
                  <TableRow key={s.studentId} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{s.name}<p className="text-[10px] text-muted-foreground">Father: {s.fatherName || "—"}</p></TableCell>
                    <TableCell className="text-xs">{s.rollNumber}</TableCell>
                    <TableCell className="text-right text-xs">{formatPkr(s.totalMonthly)}</TableCell>
                    <TableCell className="text-right text-xs text-emerald-600">{formatPkr(s.paid)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold text-destructive">{formatPkr(s.balance)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => setPreviewStudent(s)} title="Preview">
                          <Eye className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handlePrintSingle(s)} title="Print">
                          <Printer className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDownloadPDFSingle(s)} disabled={pdfLoading} title="Download PDF">
                          {pdfLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {classId && classData && classData.students.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active students found</p>
          <p className="text-xs mt-1">Try selecting a different class or section</p>
        </div>
      )}

      {!classId && (
        <div className="text-center py-8 text-muted-foreground">
          <Layers className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a class to generate fee slips</p>
        </div>
      )}

      {/* Inline Preview Dialog */}
      {previewStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewStudent(null)}>
          <div className="bg-white rounded-lg max-w-[800px] w-full max-h-[92vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
              <div>
                <h3 className="font-semibold text-sm">Fee Challan Preview</h3>
                <p className="text-[10px] text-muted-foreground">{previewStudent.name} — {previewStudent.className} — {previewStudent.section}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrintSingle(previewStudent)}>
                  <Printer className="size-3.5 mr-1" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadPDFSingle(previewStudent)} disabled={pdfLoading}>
                  {pdfLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setPreviewStudent(null)}>✕</Button>
              </div>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: generateChallanBody(previewStudent, period) }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                     ALL SLIPS LIST TAB                              */
/* ═══════════════════════════════════════════════════════════════════ */

function AllSlipsTab() {
  const slips = useQuery(api.feeSlips.list, {});
  const removeSlip = useMutation(api.feeSlips.remove);
  const markSent = useMutation(api.feeSlips.markSent);
  const [previewSlip, setPreviewSlip] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const filtered = slips?.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return s.studentName.toLowerCase().includes(q) || s.className.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  const handlePrint = (slip: any) => {
    const body = generateChallanBody(slip, slip.period);
    const html = generateFullHTML(body, `Fee Slip — ${slip.studentName}`);
    printHTML(html);
  };

  const handleDownloadPDF = async (slip: any) => {
    setPdfLoading(true);
    try {
      const body = generateChallanBody(slip, slip.period);
      const html = generateFullHTML(body, `Fee Slip — ${slip.studentName}`);
      const [year, month] = slip.period.split("-");
      const monthName = MONTH_NAMES[parseInt(month) - 1] || month;
      await downloadPDF(html, `Fee-Slip-${slip.studentName.replace(/\s+/g, "-")}-${monthName}-${year}.pdf`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF failed");
    }
    setPdfLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "pending", "sent", "paid", "overdue"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="h-7 text-xs capitalize">
            {f} {filter === f && filtered.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4">{filtered.length}</Badge>}
          </Button>
        ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 w-full pl-8 text-xs sm:w-52"
          />
        </div>
      </div>

      {!slips ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground"><Receipt className="size-10 mx-auto mb-3 opacity-30" /><p>No fee slips</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Student</TableHead><TableHead>Period</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s._id}>
                  <TableCell><p className="font-medium text-sm">{s.studentName}</p><p className="text-[10px] text-muted-foreground">Roll {s.rollNumber} · {s.className}</p></TableCell>
                  <TableCell className="text-xs">{s.period}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize">{s.type}</Badge></TableCell>
                  <TableCell className="text-right text-xs">{formatPkr(s.totalAmount)}</TableCell>
                  <TableCell className="text-right text-xs text-emerald-600">{formatPkr(s.paidAmount)}</TableCell>
                  <TableCell className="text-right text-xs font-semibold text-destructive">{formatPkr(s.balance)}</TableCell>
                  <TableCell><Badge className={`text-[10px] ${s.status === "paid" ? "bg-emerald-100 text-emerald-700" : s.status === "overdue" ? "bg-red-100 text-red-700" : s.status === "sent" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setPreviewSlip(s)} title="Preview"><Eye className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => handlePrint(s)} title="Print"><Printer className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDownloadPDF(s)} disabled={pdfLoading} title="Download PDF">
                      {pdfLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    </Button>
                    {s.status === "pending" && <Button variant="ghost" size="icon" className="size-7" onClick={async () => { try { await markSent({ id: s._id, channel: "printed" }); toast.success("Marked sent"); } catch { /* */ } }}><Send className="size-3.5" /></Button>}
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="size-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preview Dialog */}
      {previewSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewSlip(null)}>
          <div className="bg-white rounded-lg max-w-[800px] w-full max-h-[92vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
              <div>
                <h3 className="font-semibold text-sm">Fee Slip Preview</h3>
                <p className="text-[10px] text-muted-foreground">{previewSlip.studentName} — {previewSlip.className} — {previewSlip.period}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrint(previewSlip)}>
                  <Printer className="size-3.5 mr-1" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(previewSlip)} disabled={pdfLoading}>
                  {pdfLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />} PDF
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setPreviewSlip(null)}>✕</Button>
              </div>
            </div>
            <div className="p-4" dangerouslySetInnerHTML={{ __html: generateChallanBody(previewSlip, previewSlip.period) }} />
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete fee slip?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the fee slip for "{deleteTarget?.studentName}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={async () => { if (!deleteTarget) return; try { await removeSlip({ id: deleteTarget._id }); toast.success("Deleted"); } catch (e: any) { toast.error(e.message); } setDeleteTarget(null); }} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                     OUTSTANDING TAB                                 */
/* ═══════════════════════════════════════════════════════════════════ */

function OutstandingTab() {
  const data = useQuery(api.feeSlips.outstanding, {});
  const sendFeeReminder = useAction(api.sms.sendFeeReminder);
  const sendFineAlert = useAction(api.sms.sendFineAlert);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const handleSendReminder = async (row: any) => {
    setSendingReminder(row.studentId);
    try {
      const result = await sendFeeReminder({
        studentId: row.studentId,
        channel: "whatsapp",
        period: new Date().toISOString().slice(0, 7),
        totalAmount: row.monthly,
        paidAmount: row.totalPaid,
        balance: row.outstanding,
      });
      if (result.success) {
        toast.success(`Fee reminder sent to guardian of ${row.name}`);
      } else {
        toast.error(result.message || "Could not send reminder");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reminder");
    } finally {
      setSendingReminder(null);
    }
  };

  const handleSendFineAlert = async (row: any) => {
    setSendingReminder(row.studentId);
    try {
      const result = await sendFineAlert({
        studentId: row.studentId,
        channel: "whatsapp",
        period: new Date().toISOString().slice(0, 7),
        totalAmount: row.monthly,
        paidAmount: row.totalPaid,
        balance: row.outstanding,
        fineAmount: 0,
        daysOverdue: 0,
      });
      if (result.success) {
        toast.success(`Fine alert sent to guardian of ${row.name}`);
      } else {
        toast.error(result.message || "Could not send alert");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send alert");
    } finally {
      setSendingReminder(null);
    }
  };

  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0 });

  const handleBulkReminders = async () => {
    if (!rows || rows.length === 0) return;
    setBulkSending(true);
    setBulkProgress({ sent: 0, total: rows.length });
    let sent = 0;
    for (const row of rows) {
      try {
        const result = await sendFeeReminder({
          studentId: row.studentId,
          channel: "whatsapp",
          period: new Date().toISOString().slice(0, 7),
          totalAmount: row.monthly,
          paidAmount: row.totalPaid,
          balance: row.outstanding,
        });
        if (result.success) sent++;
      } catch {
        // Continue with next
      }
      setBulkProgress({ sent, total: rows.length });
    }
    setBulkSending(false);
    toast.success(`Sent ${sent} of ${rows.length} reminders`);
  };

  if (!data) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  const { summary, rows } = data;

  if (!summary || rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle2 className="size-10 mx-auto mb-3 text-emerald-500 opacity-50" />
        <p className="font-medium text-emerald-600">All fees are up to date!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid gap-3 sm:grid-cols-2 flex-1">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{summary.totalStudents}</p>
          <p className="text-xs text-muted-foreground">Students with Dues</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{formatPkr(summary.totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
        </CardContent></Card>
      </div>
        <Button
          size="sm"
          className="cursor-pointer shrink-0"
          onClick={handleBulkReminders}
          disabled={bulkSending}
        >
          {bulkSending ? (
            <><Loader2 className="size-3.5 mr-1 animate-spin" /> Sending {bulkProgress.sent}/{bulkProgress.total}...</>
          ) : (
            <><SendHorizontal className="size-3.5 mr-1" /> Send All Reminders</>
          )}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>              <TableHeader><TableRow className="bg-muted/50">
            <TableHead>Student</TableHead><TableHead>Roll</TableHead><TableHead>Class</TableHead>
            <TableHead className="text-right">Monthly</TableHead><TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-xs">{r.rollNumber}</TableCell>
                <TableCell className="text-xs">{r.className} — {r.section}</TableCell>
                <TableCell className="text-right text-xs">{formatPkr(r.monthly)}</TableCell>
                <TableCell className="text-right text-xs text-emerald-600">{formatPkr(r.totalPaid)}</TableCell>
                <TableCell className="text-right text-xs font-semibold text-destructive">{formatPkr(r.outstanding)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 text-[10px]"
                      onClick={() => handleSendReminder(r)}
                      disabled={sendingReminder === r.studentId}
                      title="Send fee reminder via WhatsApp"
                    >
                      {sendingReminder === r.studentId ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Send className="size-3" />
                      )}
                      Reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-red-600 border-red-200 hover:bg-red-50 h-7 text-[10px]"
                      onClick={() => handleSendFineAlert(r)}
                      disabled={sendingReminder === r.studentId}
                      title="Send overdue fine alert via WhatsApp"
                    >
                      <MessageSquare className="size-3" />
                      Fine
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                          MAIN PAGE                                 */
/* ═══════════════════════════════════════════════════════════════════ */

export default function FeeSlips() {
  return (
    <AppShell title="Fee Slips & Challans">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Classwise fee slip and challan generation — Print or Download as PDF</p>
        <Tabs defaultValue="classwise">
          <TabsList>
            <TabsTrigger value="classwise"><Layers className="size-3.5 mr-1" /> Classwise Generation</TabsTrigger>
            <TabsTrigger value="all"><Receipt className="size-3.5 mr-1" /> All Slips</TabsTrigger>
            <TabsTrigger value="outstanding"><DollarSign className="size-3.5 mr-1" /> Outstanding</TabsTrigger>
          </TabsList>
          <TabsContent value="classwise"><ClasswiseTab /></TabsContent>
          <TabsContent value="all"><AllSlipsTab /></TabsContent>
          <TabsContent value="outstanding"><OutstandingTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
