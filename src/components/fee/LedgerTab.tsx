import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen,
  Search,
  Printer,
  User,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatPkr, formatDate, todayStr } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function LedgerTab() {
  const students = useQuery(api.students.list, { status: "active" }) ?? [];
  const classes = useQuery(api.classes.list) ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | "">("");
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [searchText, setSearchText] = useState("");

  const filteredStudents = useMemo(() => {
    if (!searchText.trim()) return students;
    const q = searchText.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q),
    );
  }, [students, searchText]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c._id, c.name])), [classes]);

  const ledger = useQuery(
    api.feeManagement.studentLedger,
    selectedStudentId
      ? {
          studentId: selectedStudentId as Id<"students">,
          fromPeriod: fromPeriod || undefined,
          toPeriod: toPeriod || undefined,
        }
      : "skip",
  );

  const handlePrint = () => {
    if (!ledger) return;
    const student = ledger.student;
    const rows = ledger.transactions
      .map(
        (t) => `
        <tr>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px">${formatDate(t.date)}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px">${t.period}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px">${t.type.replace("_", " ").toUpperCase()}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px">${t.description}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;color:#dc2626">${t.debit > 0 ? formatPkr(t.debit) : "—"}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;color:#059669">${t.credit > 0 ? formatPkr(t.credit) : "—"}</td>
          <td style="padding:4px 8px;border:1px solid #e5e7eb;font-size:10px;text-align:right;font-weight:600">${formatPkr(t.balance)}</td>
        </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Student Ledger — ${student.name}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;padding:16px;font-size:10px}
    @media print{@page{size:A4 landscape;margin:10mm}body{padding:0}}h1{font-size:14px;color:#ea580c;margin-bottom:4px}h2{font-size:11px;color:#374151;margin-bottom:8px}
    .info{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px 16px;background:#fff7ed;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #fed7aa}
    .info span{font-size:10px;color:#6b7280}.info strong{color:#1f2937}
    table{width:100%;border-collapse:collapse;margin-bottom:10px}
    th{background:#ea580c;color:white;padding:4px 8px;font-size:9px;text-align:left;border:1px solid #ea580c}
    .summary{display:flex;gap:16px;margin-top:8px}
    .summary .card{flex:1;padding:8px;border:1px solid #e5e7eb;border-radius:6px;text-align:center}
    .summary .card p{font-size:16px;font-weight:800}
    .summary .card span{font-size:8px;color:#6b7280;text-transform:uppercase}
    </style></head><body>
    <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #ea580c;padding-bottom:6px">
      <h1>${BRAND.schoolName} — ${BRAND.campusName}</h1>
      <p style="font-size:8px;color:#6b7280">${BRAND.address} · ${BRAND.phones.join(" | ")}</p>
      <p style="font-size:12px;font-weight:800;color:#ea580c;margin-top:4px">STUDENT FEE LEDGER</p>
    </div>
    <div class="info">
      <div><span>Student:</span> <strong>${student.name}</strong></div>
      <div><span>Roll No:</span> <strong>${student.rollNumber}</strong></div>
      <div><span>Class:</span> <strong>${student.className} — ${student.section}</strong></div>
      <div><span>Status:</span> <strong>${student.status}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>Date</th><th>Period</th><th>Type</th><th>Description</th>
        <th style="text-align:right">Debit (Rs.)</th>
        <th style="text-align:right">Credit (Rs.)</th>
        <th style="text-align:right">Balance (Rs.)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div class="card"><p style="color:#059669">${formatPkr(ledger.summary.totalPaid)}</p><span>Total Paid</span></div>
      <div class="card"><p style="color:#dc2626">${formatPkr(ledger.summary.totalFines)}</p><span>Total Fines</span></div>
      <div class="card"><p style="color:${ledger.summary.totalOutstanding > 0 ? "#dc2626" : "#059669"}">${formatPkr(ledger.summary.totalOutstanding)}</p><span>Outstanding</span></div>
    </div>
    <p style="text-align:center;font-size:8px;color:#9ca3af;margin-top:12px;border-top:1px solid #f3f4f6;padding-top:4px">
      ${BRAND.schoolName} — ${BRAND.campusName} · Generated on ${new Date().toLocaleDateString("en-GB")} at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
    </p>
    </body></html>`;

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
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Student Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="size-4" /> Student Fee Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or roll number..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">From Period</Label>
              <Input
                type="month"
                value={fromPeriod}
                onChange={(e) => setFromPeriod(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">To Period</Label>
              <Input
                type="month"
                value={toPeriod}
                onChange={(e) => setToPeriod(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Select Student</Label>
            <Select
              value={selectedStudentId}
              onValueChange={(v) => setSelectedStudentId(v as Id<"students">)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Choose a student to view ledger..." />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name} — Roll {s.rollNumber} — {classMap.get(s.classId) ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedStudentId && ledger && (
            <Button size="sm" variant="outline" onClick={handlePrint} className="cursor-pointer">
              <Printer className="size-3.5 mr-1" /> Print Ledger
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Ledger Display */}
      {selectedStudentId && ledger && (
        <>
          {/* Student Info + Summary */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-3 text-center">
                <User className="size-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-bold">{ledger.student.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Roll {ledger.student.rollNumber} · {ledger.student.className} — {ledger.student.section}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{formatPkr(ledger.summary.totalPaid)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Total Paid</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{formatPkr(ledger.summary.totalFines)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Total Fines</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className={cn(
                  "text-2xl font-bold",
                  ledger.summary.totalOutstanding > 0 ? "text-red-600" : "text-emerald-600"
                )}>
                  {formatPkr(ledger.summary.totalOutstanding)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
              </CardContent>
            </Card>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                      No transactions found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.transactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(t.date)}</TableCell>
                      <TableCell className="text-xs font-mono">{t.period}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize",
                            t.type === "payment" && "border-emerald-200 text-emerald-700",
                            t.type === "fine_payment" && "border-emerald-200 text-emerald-700",
                            t.type === "fine" && "border-amber-200 text-amber-700",
                            t.type === "refund" && "border-red-200 text-red-700",
                          )}
                        >
                          {t.type === "payment" || t.type === "fine_payment" ? (
                            <ArrowUpRight className="size-2.5 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="size-2.5 mr-0.5" />
                          )}
                          {t.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{t.description}</TableCell>
                      <TableCell className="text-right text-xs text-red-600 font-medium">
                        {t.debit > 0 ? formatPkr(t.debit) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 font-medium">
                        {t.credit > 0 ? formatPkr(t.credit) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold">
                        <span className={cn(t.balance > 0 ? "text-red-600" : "text-emerald-600")}>
                          {formatPkr(t.balance)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Audit Logs */}
          {ledger.auditLogs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Recent Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {ledger.auditLogs.map((log) => (
                    <div
                      key={log._id}
                      className="flex items-center gap-3 text-[10px] py-1 border-b last:border-0"
                    >
                      <Badge variant="outline" className="text-[9px] shrink-0 capitalize">
                        {log.action.replace("_", " ")}
                      </Badge>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-medium">{formatPkr(log.amount)}</span>
                      {log.remarks && (
                        <span className="text-muted-foreground truncate">{log.remarks}</span>
                      )}
                      <span className="ml-auto text-muted-foreground shrink-0">by {(log as any).performedByName ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedStudentId && (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="size-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">Select a student to view their ledger</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The fee ledger shows all payments, fines, and adjustments with running balance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
