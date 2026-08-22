import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Printer,
  Award,
  BookOpen,
  ClipboardCheck,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  User,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { formatDate } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/*                                CONSTANTS                                     */
/* -------------------------------------------------------------------------- */

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 text-emerald-700",
  A: "bg-emerald-100 text-emerald-600",
  "B+": "bg-blue-100 text-blue-700",
  B: "bg-blue-100 text-blue-600",
  C: "bg-amber-100 text-amber-700",
  D: "bg-orange-100 text-orange-700",
  F: "bg-red-100 text-red-700",
};

/* -------------------------------------------------------------------------- */
/*                        STUDENT TREND VIEW (Monthly)                          */
/* -------------------------------------------------------------------------- */

function StudentTrendView({ studentId }: { studentId: Id<"students"> }) {
  const trend = useQuery(api.progressReport.studentTrend, { studentId });

  if (!trend) {
    return <div className="text-center py-8 text-muted-foreground">Loading trend data...</div>;
  }

  if (trend.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="size-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No test data available for trend analysis</p>
        <p className="text-xs mt-1">Enter marks in daily or weekly tests to see performance trends</p>
      </div>
    );
  }

  const maxPct = Math.max(...trend.map((t) => t.overallAvg ?? 0), 100);

  // Determine trend direction
  const recentAvg = trend.length >= 2 ? trend[trend.length - 1]?.overallAvg ?? 0 : 0;
  const prevAvg = trend.length >= 2 ? trend[trend.length - 2]?.overallAvg ?? 0 : 0;
  const trendDirection = recentAvg > prevAvg ? "up" : recentAvg < prevAvg ? "down" : "stable";

  return (
    <div className="space-y-4">
      {/* Trend Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{trend.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Months Tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">
              {trend.reduce((s, t) => s + (t.testCount), 0)}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">Total Tests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              {trendDirection === "up" && <TrendingUp className="size-4 text-emerald-600" />}
              {trendDirection === "down" && <TrendingDown className="size-4 text-red-500" />}
              <p className={`text-lg font-bold ${trendDirection === "up" ? "text-emerald-600" : trendDirection === "down" ? "text-red-500" : ""}`}>
                {recentAvg > prevAvg ? "+" : ""}{Math.round((recentAvg - prevAvg) * 10) / 10}%
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase">vs Previous</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">
              {Math.round(trend.reduce((s, t) => s + (t.overallAvg ?? 0), 0) / trend.length * 10) / 10}%
            </p>
            <p className="text-[10px] text-muted-foreground uppercase">Avg All Months</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="size-4" /> Monthly Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {trend.map((t) => (
              <div key={t.month} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{formatMonth(t.month)}</span>
                  <span className="text-muted-foreground">{t.testCount} tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                    {t.overallAvg !== null && (
                      <div
                        className={`h-full rounded transition-all ${t.overallAvg >= 60 ? "bg-emerald-500" : t.overallAvg >= 33 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min((t.overallAvg / maxPct) * 100, 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs font-semibold w-12 text-right">{t.overallAvg ?? "—"}%</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  {t.examAvg !== null && <span>Exams: {t.examAvg}%</span>}
                  {t.dailyAvg !== null && <span>Daily: {t.dailyAvg}%</span>}
                  {t.weeklyAvg !== null && <span>Weekly: {t.weeklyAvg}%</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Data Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-left">Month</TableHead>
              <TableHead className="text-center">Tests</TableHead>
              <TableHead className="text-center">Exam Avg</TableHead>
              <TableHead className="text-center">Daily Avg</TableHead>
              <TableHead className="text-center">Weekly Avg</TableHead>
              <TableHead className="text-center">Overall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trend.map((t) => (
              <TableRow key={t.month}>
                <TableCell className="font-medium text-sm">{formatMonth(t.month)}</TableCell>
                <TableCell className="text-center text-xs">{t.testCount}</TableCell>
                <TableCell className="text-center text-xs">{t.examAvg !== null ? `${t.examAvg}%` : "—"}</TableCell>
                <TableCell className="text-center text-xs">{t.dailyAvg !== null ? `${t.dailyAvg}%` : "—"}</TableCell>
                <TableCell className="text-center text-xs">{t.weeklyAvg !== null ? `${t.weeklyAvg}%` : "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={t.overallAvg !== null && t.overallAvg >= 60 ? "default" : "secondary"} className="text-[10px]">
                    {t.overallAvg ?? "—"}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[parseInt(m) - 1]} ${year}`;
}

/* -------------------------------------------------------------------------- */
/*                         INDIVIDUAL PROGRESS REPORT                          */
/* -------------------------------------------------------------------------- */

function StudentReportView({ studentId }: { studentId: Id<"students"> }) {
  const data = useQuery(api.progressReport.studentReport, { studentId });

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading progress report...
      </div>
    );
  }

  const { student, exams, dailyTests, weeklyTests, attendance, notebooks, overall } = data;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Progress Report — ${student.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; color: #1a1a1a; font-size: 12px; }
        .header { text-align: center; border-bottom: 3px solid #ea580c; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { font-size: 18px; color: #ea580c; letter-spacing: 1px; }
        .header h2 { font-size: 13px; font-weight: 600; margin-top: 2px; }
        .header p { font-size: 10px; color: #666; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin-bottom: 12px; background: #fff7ed; padding: 10px; border-radius: 6px; border: 1px solid #fed7aa; }
        .info span { font-weight: 600; font-size: 11px; }
        .stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 14px; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
        .stat { text-align: center; }
        .stat .val { font-size: 18px; font-weight: 700; color: #ea580c; }
        .stat .lbl { font-size: 9px; color: #666; text-transform: uppercase; }
        .section-title { font-size: 13px; font-weight: 700; color: #ea580c; margin: 14px 0 6px; border-bottom: 1px solid #fed7aa; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
        th, td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: center; }
        th { background: #ea580c; color: white; font-weight: 600; font-size: 10px; }
        tr:nth-child(even) { background: #fef3e2; }
        .g-a { color: #059669; font-weight: 700; }
        .g-f { color: #dc2626; font-weight: 700; }
        .att-bar { display: inline-block; height: 8px; background: #22c55e; border-radius: 4px; }
        .footer { text-align: center; font-size: 9px; color: #999; margin-top: 16px; border-top: 1px solid #eee; padding-top: 6px; }
        @media print { body { padding: 10px; font-size: 11px; } }
      </style></head><body>
      <div class="header">
        <h1>LEADS SCHOOL SYSTEM</h1>
        <h2>Zeenat Campus — Student Progress Report</h2>
        <p>Kangan Road, Near Jalbani Petrol Pump, Dera Ghazi Khan · 0332-6241440</p>
      </div>
      <div class="info">
        <div><span>Student:</span> ${student.name}</div>
        <div><span>Father's Name:</span> ${student.fatherName}</div>
        <div><span>Roll No:</span> ${student.rollNumber}</div>
        <div><span>Class:</span> ${student.className} — ${student.section}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="val">${overall.overallAverage}%</div><div class="lbl">Overall Avg</div></div>
        <div class="stat"><div class="val">${overall.overallGrade}</div><div class="lbl">Grade</div></div>
        <div class="stat"><div class="val">${overall.examsTaken}</div><div class="lbl">Exams</div></div>
        <div class="stat"><div class="val">${overall.dailyTestsTaken + overall.weeklyTestsTaken}</div><div class="lbl">Tests</div></div>
        <div class="stat"><div class="val">${overall.attendanceRate}%</div><div class="lbl">Attendance</div></div>
      </div>
      ${exams.length > 0 ? `<div class="section-title">Examination Results</div>
      <table><thead><tr><th>Exam</th><th>Date</th>${exams[0]?.subjects.map((s: any) => `<th>${s.subject}<br><small>/${s.maxMarks}</small></th>`).join("") ?? ""}<th>Total</th><th>%</th><th>Grade</th></tr></thead>
      <tbody>${exams.map((r: any) => `<tr><td style="text-align:left">${r.examTitle}</td><td>${r.examDate}</td>${r.subjects.map((s: any) => `<td>${s.obtained}</td>`).join("")}<td><b>${r.totalObtained}/${r.totalMax}</b></td><td>${r.percentage}%</td><td class="${r.grade.startsWith("A") ? "g-a" : r.grade === "F" ? "g-f" : ""}">${r.grade}</td></tr>`).join("")}</tbody></table>` : ""}
      ${dailyTests.length > 0 ? `<div class="section-title">Daily Tests</div>
      <table><thead><tr><th>Subject</th><th>Title</th><th>Date</th><th>Marks</th><th>Obtained</th><th>%</th><th>Class Avg</th></tr></thead>
      <tbody>${dailyTests.map((d: any) => `<tr><td>${d.subject}</td><td style="text-align:left">${d.title}</td><td>${d.date}</td><td>/${d.totalMarks}</td><td>${d.obtained ?? "—"}</td><td>${d.percentage !== null ? d.percentage + "%" : "—"}</td><td>${d.classAverage}%</td></tr>`).join("")}</tbody></table>` : ""}
      ${weeklyTests.length > 0 ? `<div class="section-title">Weekly Tests</div>
      <table><thead><tr><th>Subject</th><th>Title</th><th>Date</th><th>Marks</th><th>Obtained</th><th>%</th><th>Class Avg</th></tr></thead>
      <tbody>${weeklyTests.map((w: any) => `<tr><td>${w.subject}</td><td style="text-align:left">${w.title}</td><td>${w.date}</td><td>/${w.totalMarks}</td><td>${w.obtained ?? "—"}</td><td>${w.percentage !== null ? w.percentage + "%" : "—"}</td><td>${w.classAverage}%</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="section-title">Attendance Summary</div>
      <div style="text-align:center;margin-bottom:12px;">
        <div class="att-bar" style="width:${attendance.attendanceRate}%;"></div>
        <div style="margin-top:4px;font-size:11px;"><b>${attendance.attendanceRate}%</b> — ${attendance.presentDays}/${attendance.totalDays} days present (${attendance.absentDays} absent, ${attendance.lateDays} late, ${attendance.leaveDays} leave)</div>
      </div>
      ${notebooks.total > 0 ? `<div class="section-title">Notebook Checks (Last 90 Days)</div>
      <div style="text-align:center;margin-bottom:8px;"><b>${notebooks.complete}/${notebooks.total}</b> complete (${notebooks.incomplete} incomplete)</div>` : ""}
      <div class="footer">LEADS SCHOOL SYSTEM — Zeenat Campus · Generated on ${new Date().toLocaleDateString("en-GB")}</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                {student.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold">{student.name}</h2>
                <p className="text-white/80 text-sm">
                  Roll #{student.rollNumber} · {student.className} — {student.section} · Father: {student.fatherName}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handlePrint}>
              <Printer className="size-3.5 mr-1" /> Print Report
            </Button>
          </div>
        </div>
      </Card>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{overall.overallAverage}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">Overall Average</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${overall.overallGrade.startsWith("A") ? "text-emerald-600" : overall.overallGrade === "F" ? "text-red-600" : ""}`}>{overall.overallGrade}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Grade</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{overall.examsTaken}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Exams Taken</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{overall.dailyTestsTaken + overall.weeklyTestsTaken}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Tests Taken</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${attendance.attendanceRate >= 80 ? "text-emerald-600" : attendance.attendanceRate >= 60 ? "text-amber-600" : "text-red-600"}`}>{attendance.attendanceRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">Attendance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{notebooks.complete}/{notebooks.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Notebooks OK</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <Tabs defaultValue="exams">
        <TabsList>
          <TabsTrigger value="exams"><Award className="size-3.5 mr-1" /> Exams ({exams.length})</TabsTrigger>
          <TabsTrigger value="daily"><ClipboardCheck className="size-3.5 mr-1" /> Daily Tests ({dailyTests.length})</TabsTrigger>
          <TabsTrigger value="weekly"><BookOpen className="size-3.5 mr-1" /> Weekly Tests ({weeklyTests.length})</TabsTrigger>
          <TabsTrigger value="attendance"><CalendarCheck className="size-3.5 mr-1" /> Attendance</TabsTrigger>
          <TabsTrigger value="trend"><BarChart3 className="size-3.5 mr-1" /> Trend</TabsTrigger>
        </TabsList>

        {/* Exams */}
        <TabsContent value="exams">
          {exams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No exam results recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-left">Exam</TableHead>
                    <TableHead>Date</TableHead>
                    {exams[0]?.subjects.map((s: any, i: number) => (
                      <TableHead key={i} className="text-center">
                        {s.subject}<br />
                        <span className="font-normal text-[10px]">/{s.maxMarks}</span>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((r: any, idx: number) => (
                    <TableRow key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-medium text-left">{r.examTitle}</TableCell>
                      <TableCell className="text-xs">{r.examDate}</TableCell>
                      {r.subjects.map((s: any, i: number) => (
                        <TableCell key={i} className="text-center text-xs">{s.obtained}</TableCell>
                      ))}
                      <TableCell className="text-center font-semibold text-xs">{r.totalObtained}/{r.totalMax}</TableCell>
                      <TableCell className="text-center font-medium text-xs">{r.percentage}%</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] ${GRADE_COLORS[r.grade] ?? ""}`}>{r.grade}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Daily Tests */}
        <TabsContent value="daily">
          {dailyTests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No daily tests recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-left">Subject</TableHead>
                    <TableHead className="text-left">Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-center">Obtained</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">Class Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyTests.map((d, idx) => (
                    <TableRow key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-medium">{d.subject}</TableCell>
                      <TableCell className="text-xs">{d.title}</TableCell>
                      <TableCell className="text-xs">{formatDate(d.date)}</TableCell>
                      <TableCell className="text-center text-xs">/{d.totalMarks}</TableCell>
                      <TableCell className="text-center font-semibold text-xs">{d.obtained ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs">{d.percentage !== null ? `${d.percentage}%` : "—"}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{d.classAverage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Weekly Tests */}
        <TabsContent value="weekly">
          {weeklyTests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No weekly tests recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-left">Subject</TableHead>
                    <TableHead className="text-left">Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-center">Obtained</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">Class Avg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyTests.map((w, idx) => (
                    <TableRow key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-medium">{w.subject}</TableCell>
                      <TableCell className="text-xs">{w.title}</TableCell>
                      <TableCell className="text-xs">{formatDate(w.date)}</TableCell>
                      <TableCell className="text-center text-xs">/{w.totalMarks}</TableCell>
                      <TableCell className="text-center font-semibold text-xs">{w.obtained ?? "—"}</TableCell>
                      <TableCell className="text-center text-xs">{w.percentage !== null ? `${w.percentage}%` : "—"}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{w.classAverage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Attendance */}
        <TabsContent value="attendance">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold">{attendance.totalDays}</p>
              <p className="text-[10px] text-muted-foreground">Total Days</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{attendance.presentDays}</p>
              <p className="text-[10px] text-muted-foreground">Present</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-red-600">{attendance.absentDays}</p>
              <p className="text-[10px] text-muted-foreground">Absent</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{attendance.lateDays}</p>
              <p className="text-[10px] text-muted-foreground">Late</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{attendance.leaveDays}</p>
              <p className="text-[10px] text-muted-foreground">Leave</p>
            </CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium">Attendance Rate:</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${attendance.attendanceRate >= 80 ? "bg-emerald-500" : attendance.attendanceRate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${attendance.attendanceRate}%` }}
                  />
                </div>
                <span className="text-sm font-bold">{attendance.attendanceRate}%</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend */}
        <TabsContent value="trend">
          <StudentTrendView studentId={studentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           CLASS-WIDE PROGRESS VIEW                          */
/* -------------------------------------------------------------------------- */

function ClassReportView() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const selectedClass = classes.find((c) => c._id === classId);

  const classReport = useQuery(
    api.progressReport.classReport,
    classId && section ? { classId, section } : "skip"
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Class</label>
          <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Section</label>
          <Select value={section} onValueChange={setSection} disabled={!classId}>
            <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
            <SelectContent>
              {selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!classId || !section ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a class and section to view the class report</p>
        </div>
      ) : !classReport ? (
        <div className="text-center py-12 text-muted-foreground">Loading class report...</div>
      ) : classReport.students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No students found in this class/section.</div>
      ) : (
        <>
          {/* Class Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{classReport.totalStudents}</p>
                <p className="text-[10px] text-muted-foreground">Students</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{classReport.classStats.average}%</p>
                <p className="text-[10px] text-muted-foreground">Class Average</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{classReport.classStats.highest}%</p>
                <p className="text-[10px] text-muted-foreground">Highest</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{classReport.classStats.passRate}%</p>
                <p className="text-[10px] text-muted-foreground">Pass Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Student Rankings */}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead className="text-center">Exam Avg</TableHead>
                  <TableHead className="text-center">Daily Tests</TableHead>
                  <TableHead className="text-center">Weekly Tests</TableHead>
                  <TableHead className="text-center">Attendance</TableHead>
                  <TableHead className="text-center">Overall</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classReport.students.map((s, idx) => (
                  <TableRow key={s.studentId} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                    <TableCell className="font-semibold text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.rollNumber}</TableCell>
                    <TableCell className="text-center text-xs">{s.examAverage}% ({s.examsTaken})</TableCell>
                    <TableCell className="text-center text-xs">{s.dailyTestAverage}% ({s.dailyTestsTaken})</TableCell>
                    <TableCell className="text-center text-xs">{s.weeklyTestAverage}% ({s.weeklyTestsTaken})</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-medium ${s.attendanceRate >= 80 ? "text-emerald-600" : s.attendanceRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {s.attendanceRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-sm">{s.overallAverage}%</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${GRADE_COLORS[s.overallGrade] ?? ""}`}>{s.overallGrade}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN PAGE                                      */
/* -------------------------------------------------------------------------- */

export default function ProgressReports() {
  const classes = useQuery(api.classes.list) ?? [];
  const allStudents = useQuery(api.students.list, {}) ?? [];
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<Id<"students"> | null>(null);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return allStudents.filter((s) => s.status === "active").slice(0, 20);
    const q = search.toLowerCase();
    return allStudents
      .filter(
        (s) =>
          s.status === "active" &&
          (s.name.toLowerCase().includes(q) ||
            s.rollNumber.toLowerCase().includes(q) ||
            s.fatherName.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [allStudents, search]);

  return (
    <AppShell title="Progress Reports">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Comprehensive student progress — exams, daily tests, weekly tests, attendance, notebook checks, and performance trends
        </p>

        <Tabs defaultValue={selectedStudentId ? "student" : "class"}>
          <TabsList>
            <TabsTrigger value="student"><User className="size-3.5 mr-1" /> Student Report</TabsTrigger>
            <TabsTrigger value="class"><TrendingUp className="size-3.5 mr-1" /> Class Report</TabsTrigger>
          </TabsList>

          {/* Individual Student Report */}
          <TabsContent value="student" className="space-y-4">
            {!selectedStudentId ? (
              <>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search student by name, roll number, or father's name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? "No students match your search." : "No active students."}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredStudents.map((s) => (
                      <Card
                        key={s._id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedStudentId(s._id)}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Roll #{s.rollNumber} · {classes.find((c) => c._id === s.classId)?.name ?? ""} — {s.section}
                            </p>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setSelectedStudentId(null)}>
                  ← Back to search
                </Button>
                <StudentReportView studentId={selectedStudentId} />
              </>
            )}
          </TabsContent>

          {/* Class-wide Report */}
          <TabsContent value="class">
            <ClassReportView />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
