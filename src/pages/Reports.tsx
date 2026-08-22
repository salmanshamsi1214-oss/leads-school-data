import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Banknote,
  CalendarDays,
  Download,
  FileBarChart,
  Loader2,
  PieChart,
  Printer,
  TrendingDown,
  TrendingUp,
  UserX,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { AttendanceStatus } from "@/convex/schema";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_META, STATUS_ORDER, statusLabel } from "@/lib/attendance";
import {
  exportCsv,
  formatDate,
  formatMonth,
  formatPkr,
  monthRange,
  pct,
  todayStr,
} from "@/lib/format";
import { cn } from "@/lib/utils";

function printPage() {
  window.print();
}

/* ---------------- Daily summary ---------------- */

function DailySummary() {
  const [date, setDate] = useState(todayStr());
  const students = useQuery(api.students.list, { status: "active" });
  const records = useQuery(api.attendance.byDate, { date });

  if (!students || !records) {
    return <Loading />;
  }

  const rows = students.map((student) => ({
    student,
    status: (records[student._id]?.status as AttendanceStatus | undefined) ?? null,
  }));
  const counts: Record<string, number> = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0 };
  for (const row of rows) {
    if (row.status === null) counts.unmarked += 1;
    else counts[row.status] += 1;
  }

  const handleExport = () => {
    exportCsv(
      `attendance-daily-${date}.csv`,
      rows.map((row) => ({
        date,
        rollNumber: row.student.rollNumber,
        name: row.student.name,
        className: row.student.className,
        section: row.student.section,
        status: row.status ? statusLabel(row.status) : "Not marked",
      })),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <label htmlFor="daily-date" className="text-xs font-medium text-muted-foreground">
            Date
          </label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="daily-date"
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-9 sm:w-48"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={printPage}>
            <Printer className="size-4" /> Print
          </Button>
          <Button variant="outline" className="cursor-pointer" onClick={handleExport}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[...STATUS_ORDER, "unmarked" as const].map((status) => (
          <div key={status} className="rounded-lg border px-4 py-3">
            <p className="text-xl font-bold tracking-tight">
              {counts[status]}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === "unmarked" ? "Not marked" : STATUS_META[status].label}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.student._id}>
                <TableCell className="font-mono text-xs">{row.student.rollNumber}</TableCell>
                <TableCell className="font-semibold">{row.student.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.student.className} · {row.student.section}
                </TableCell>
                <TableCell>
                  {row.status ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        STATUS_META[row.status].chip,
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Not marked
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------------- Class Attendance report ---------------- */

function ClassReport() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState("");
  const [section, setSection] = useState("all");
  const [month, setMonth] = useState(todayStr().slice(0, 7));

  const selectedClass = classes.find((cls) => cls._id === classId);
  const [year, monthNum] = month.split("-").map(Number);
  const { from, to } = monthRange(year, monthNum);

  const report = useQuery(
    api.attendance.classReport,
    classId
      ? {
          classId: classId as never,
          section: section === "all" ? undefined : section,
          from,
          to,
        }
      : "skip",
  );

  const handleExport = () => {
    if (!report) return;
    exportCsv(
      `class-report-${selectedClass?.name ?? "class"}-${month}.csv`,
      report.rows.map((row) => ({
        rollNumber: row.rollNumber,
        name: row.name,
        section: row.section,
        present: row.present,
        absent: row.absent,
        late: row.late,
        leave: row.leave,
        marked: row.marked,
        presentRate: row.marked > 0 ? pct(row.present, row.marked) : 0,
      })),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Class</label>
          <Select value={classId} onValueChange={(value) => { setClassId(value); setSection("all"); }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls._id} value={cls._id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Section</label>
          <Select value={section} onValueChange={setSection} disabled={!selectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {selectedClass?.sections.map((sectionName) => (
                <SelectItem key={sectionName} value={sectionName}>
                  Section {sectionName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="class-month" className="text-xs font-medium text-muted-foreground">
            Month
          </label>
          <Input
            id="class-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={printPage} disabled={!report}>
            <Printer className="size-4" /> Print
          </Button>
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={handleExport} disabled={!report || report.rows.length === 0}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {!classId ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileBarChart className="size-6" />
          </div>
          <p className="text-sm font-semibold">Choose a class and month</p>
          <p className="text-xs text-muted-foreground">
            Per-student present / absent / late / leave counts for the month.
          </p>
        </div>
      ) : report === undefined ? (
        <Loading />
      ) : (
        <>
          {/* Summary row */}
          {report.rows.length > 0 && (() => {
            const totals = report.rows.reduce(
              (acc, r) => ({
                present: acc.present + r.present,
                absent: acc.absent + r.absent,
                late: acc.late + r.late,
                leave: acc.leave + r.leave,
                marked: acc.marked + r.marked,
              }),
              { present: 0, absent: 0, late: 0, leave: 0, marked: 0 },
            );
            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{totals.present}</p>
                  <p className="text-xs text-emerald-600">Total Present</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">{totals.absent}</p>
                  <p className="text-xs text-red-600">Total Absent</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{totals.late}</p>
                  <p className="text-xs text-amber-600">Total Late</p>
                </div>
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xl font-bold tracking-tight">
                    {totals.marked > 0 ? `${pct(totals.present, totals.marked)}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Attendance</p>
                </div>
              </div>
            );
          })()}

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Leave</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>% Present</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No students found for this class and section.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-mono text-xs">{row.rollNumber}</TableCell>
                      <TableCell className="font-semibold">{row.name}</TableCell>
                      <TableCell className="font-medium text-emerald-700">{row.present}</TableCell>
                      <TableCell className="font-medium text-red-700">{row.absent}</TableCell>
                      <TableCell className="font-medium text-amber-700">{row.late}</TableCell>
                      <TableCell className="text-muted-foreground">{row.leave}</TableCell>
                      <TableCell className="text-muted-foreground">{row.marked}</TableCell>
                      <TableCell className="font-semibold">
                        {row.marked > 0 ? `${pct(row.present, row.marked)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Student history ---------------- */

function StudentHistory() {
  const students = useQuery(api.students.list, { status: "active" }) ?? [];
  const [studentId, setStudentId] = useState("");
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [year, monthNum] = month.split("-").map(Number);

  const history = useQuery(
    api.attendance.studentMonthly,
    studentId ? { studentId: studentId as never, year, month: monthNum } : "skip",
  );
  const student = students.find((s) => s._id === studentId);

  const handleExport = () => {
    if (!history || !student) return;
    exportCsv(
      `student-${student.rollNumber}-${month}.csv`,
      history.records.map((record) => ({
        date: record.date,
        status: statusLabel(record.status),
        name: student.name,
        rollNumber: student.rollNumber,
      })),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Student</label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Search and choose a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.name} · Roll {s.rollNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="student-month" className="text-xs font-medium text-muted-foreground">
            Month
          </label>
          <Input
            id="student-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={handleExport}
            disabled={!history || history.records.length === 0}
          >
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      {!studentId ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileBarChart className="size-6" />
          </div>
          <p className="text-sm font-semibold">Choose a student and month</p>
          <p className="text-xs text-muted-foreground">
            Day-by-day attendance history with monthly totals.
          </p>
        </div>
      ) : history === undefined ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="rounded-lg border px-4 py-3">
                <p className="text-xl font-bold tracking-tight">
                  {history.totals ? history.totals[status] : 0}
                </p>
                <p className="text-xs text-muted-foreground">{STATUS_META[status].label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-10 text-center text-sm text-muted-foreground">
                      No attendance marked in {formatMonth(`${month}-01`)} for this student.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.records.map((record) => (
                    <TableRow key={record.date}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            STATUS_META[record.status as AttendanceStatus].chip,
                          )}
                        >
                          {statusLabel(record.status)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Absent / late list ---------------- */

function AbsentLateList() {
  const [date, setDate] = useState(todayStr());
  const students = useQuery(api.students.list, { status: "active" });
  const records = useQuery(api.attendance.byDate, { date });

  const rows = useMemo(() => {
    if (!students || !records) return [];
    return students
      .map((student) => ({
        student,
        status: records[student._id]?.status as AttendanceStatus | undefined,
        remarks: records[student._id]?.remarks ?? "",
      }))
      .filter((row) => row.status === "absent" || row.status === "late")
      .sort((a, b) => a.student.className.localeCompare(b.student.className));
  }, [students, records]);

  const handleExport = () => {
    exportCsv(
      `absent-late-${date}.csv`,
      rows.map((row) => ({
        date,
        rollNumber: row.student.rollNumber,
        name: row.student.name,
        className: row.student.className,
        section: row.student.section,
        status: statusLabel(row.status!),
        reason: row.remarks,
      })),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <label htmlFor="absent-date" className="text-xs font-medium text-muted-foreground">
            Date
          </label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="absent-date"
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-9 sm:w-48"
            />
          </div>
        </div>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {!students || !records ? (
        <Loading />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <UserX className="size-6" />
          </div>
          <p className="text-sm font-semibold">No absent or late students</p>
          <p className="text-xs text-muted-foreground">
            Nobody was recorded absent or late on {formatDate(date)}.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.student._id}>
                  <TableCell className="font-mono text-xs">{row.student.rollNumber}</TableCell>
                  <TableCell className="font-semibold">{row.student.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.student.className} · {row.student.section}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        STATUS_META[row.status!].chip,
                      )}
                    >
                      {statusLabel(row.status!)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-64">
                    {row.remarks ? (
                      <span className="text-xs text-muted-foreground">{row.remarks}</span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Fee Collection by Class ---------------- */

function FeeCollectionByClass() {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const data = useQuery(api.analytics.feeCollectionByClass, { month });
  const drillDown = useQuery(
    api.analytics.feeCollectionByClassStudents,
    selectedClass ? { className: selectedClass, month } : "skip",
  );

  const handleExport = () => {
    if (!data) return;
    exportCsv(
      `fee-collection-${month}.csv`,
      data.classes.map((c) => ({
        class: c.className,
        totalStudents: c.totalStudents,
        paidStudents: c.paidStudents,
        unpaidStudents: c.unpaidStudents,
        totalDue: c.totalDue,
        totalPaid: c.totalPaid,
        balance: c.balance,
        collectionRate: `${c.collectionRate}%`,
      })),
    );
  };

  const handleExportStudents = () => {
    if (!drillDown) return;
    exportCsv(
      `fee-students-${selectedClass}-${month}.csv`,
      drillDown.students.map((s) => ({
        roll: s.rollNumber,
        name: s.name,
        section: s.section,
        father: s.fatherName,
        baseFee: s.baseFee,
        adjustments: s.adjustmentTotal,
        monthlyFee: s.monthlyFee,
        paid: s.paid,
        balance: s.balance,
        status: s.status,
        receiptNo: s.receiptNo ?? "",
      })),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <label htmlFor="fee-month" className="text-xs font-medium text-muted-foreground">
            Month
          </label>
          <Input
            id="fee-month"
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setSelectedClass(null); }}
            className="sm:w-48"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={printPage} disabled={!data}>
            <Printer className="size-4" /> Print
          </Button>
          <Button variant="outline" className="cursor-pointer" onClick={handleExport} disabled={!data || data.classes.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      {data === undefined || data === null ? (
        <Loading />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatPkr(data.summary.totalPaid)}</p>
              <p className="text-xs text-emerald-600">Total Collected</p>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xl font-bold tracking-tight">{formatPkr(data.summary.totalDue)}</p>
              <p className="text-xs text-muted-foreground">Total Due</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{formatPkr(data.summary.balance)}</p>
              <p className="text-xs text-amber-600">Outstanding</p>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-xl font-bold tracking-tight">{data.summary.overallCollectionRate}%</p>
              <p className="text-xs text-muted-foreground">Collection Rate</p>
            </div>
          </div>

          {/* Per-class table */}
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Unpaid</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.classes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No fee data found for {formatMonth(`${month}-01`)}.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.classes.map((c) => (
                    <TableRow
                      key={c.className}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        selectedClass === c.className && "bg-muted/70",
                      )}
                      onClick={() => setSelectedClass(selectedClass === c.className ? null : c.className)}
                    >
                      <TableCell className="font-semibold">
                        <span className="flex items-center gap-2">
                          {selectedClass === c.className ? "▼" : "▶"}
                          {c.className}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.totalStudents}</TableCell>
                      <TableCell className="font-medium text-emerald-700">{c.paidStudents}</TableCell>
                      <TableCell className="font-medium text-red-700">{c.unpaidStudents}</TableCell>
                      <TableCell>{formatPkr(c.totalDue)}</TableCell>
                      <TableCell className="font-medium text-emerald-700">{formatPkr(c.totalPaid)}</TableCell>
                      <TableCell className={cn("font-medium", c.balance > 0 ? "text-amber-700" : "text-emerald-700")}>
                        {formatPkr(c.balance)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.collectionRate >= 80 ? "bg-emerald-500" : c.collectionRate >= 50 ? "bg-amber-500" : "bg-red-500",
                              )}
                              style={{ width: `${Math.min(c.collectionRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{c.collectionRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Drill-down: per-student fee details */}
          {selectedClass && (
            <div className="rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setSelectedClass(null)}
                  >
                    ← Back
                  </Button>
                  <div>
                    <h3 className="text-sm font-bold">{selectedClass}</h3>
                    <p className="text-xs text-muted-foreground">Student fee details · {formatMonth(`${month}-01`)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="cursor-pointer" onClick={handleExportStudents} disabled={!drillDown}>
                    <Download className="size-3.5" /> CSV
                  </Button>
                </div>
              </div>

              {drillDown === undefined ? (
                <Loading />
              ) : drillDown === null ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Failed to load student data.</p>
              ) : (
                <div className="flex flex-col gap-3 p-4">
                  {/* Class summary mini-cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                      <p className="text-xs text-muted-foreground">Students</p>
                      <p className="text-lg font-bold">{drillDown.summary.total}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                      <p className="text-xs text-emerald-600">Paid</p>
                      <p className="text-lg font-bold text-emerald-700">{drillDown.summary.paid}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                      <p className="text-xs text-red-600">Unpaid</p>
                      <p className="text-lg font-bold text-red-700">{drillDown.summary.unpaid}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                      <p className="text-xs text-muted-foreground">Total Due</p>
                      <p className="text-lg font-bold">{formatPkr(drillDown.summary.totalDue)}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={cn("text-lg font-bold", drillDown.summary.balance > 0 ? "text-amber-700" : "text-emerald-700")}>
                        {formatPkr(drillDown.summary.balance)}
                      </p>
                    </div>
                  </div>

                  {/* Per-student table */}
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Roll</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Father</TableHead>
                          <TableHead className="text-right">Fee</TableHead>
                          <TableHead className="text-right">Adj</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drillDown.students.map((s) => (
                          <TableRow key={s.studentId}>
                            <TableCell className="font-mono text-xs">{s.rollNumber}</TableCell>
                            <TableCell>
                              <div className="font-semibold">{s.name}</div>
                              {s.phone && <div className="text-[10px] text-muted-foreground">{s.phone}</div>}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{s.section}</TableCell>
                            <TableCell className="text-muted-foreground">{s.fatherName}</TableCell>
                            <TableCell className="text-right">{formatPkr(s.baseFee)}</TableCell>
                            <TableCell className="text-right">
                              {s.adjustmentTotal !== 0 ? (
                                <span className={cn("text-xs", s.adjustmentTotal < 0 ? "text-emerald-600" : "text-red-600")}>
                                  {s.adjustmentTotal > 0 ? "+" : ""}{formatPkr(s.adjustmentTotal)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatPkr(s.monthlyFee)}</TableCell>
                            <TableCell className="text-right font-medium text-emerald-700">{formatPkr(s.paid)}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn("font-medium", s.balance > 0 ? "text-red-700" : "text-emerald-700")}>
                                {formatPkr(s.balance)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                                  s.status === "paid"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                                )}
                              >
                                {s.status === "paid" ? "Paid" : "Unpaid"}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {s.receiptNo ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Financial Overview ---------------- */

function FinancialOverview() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayStr());
  const data = useQuery(api.analytics.financial, { from, to });

  const handleExport = () => {
    if (!data) return;
    exportCsv(
      `financial-report-${from}-to-${to}.csv`,
      [
        {
          category: "Income (Fees)",
          amount: data.income,
          count: data.paymentCount,
        },
        {
          category: "Expenses",
          amount: data.expenses,
          count: data.expenseCount,
        },
        {
          category: "Payroll",
          amount: data.payroll,
          count: data.payrollCount,
        },
        {
          category: "Net Balance",
          amount: data.netBalance,
          count: "",
        },
      ],
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="fin-from" className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              id="fin-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="sm:w-44"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="fin-to" className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              id="fin-to"
              type="date"
              value={to}
              max={todayStr()}
              onChange={(e) => setTo(e.target.value)}
              className="sm:w-44"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={printPage} disabled={!data}>
            <Printer className="size-4" /> Print
          </Button>
          <Button variant="outline" className="cursor-pointer" onClick={handleExport} disabled={!data}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      </div>

      {data === undefined || data === null ? (
        <Loading />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-600" />
                <p className="text-xs text-emerald-600">Income</p>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatPkr(data.income)}</p>
              <p className="text-[10px] text-emerald-500">{data.paymentCount} payments</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-red-600" />
                <p className="text-xs text-red-600">Expenses</p>
              </div>
              <p className="mt-1 text-xl font-bold text-red-700 dark:text-red-300">{formatPkr(data.expenses)}</p>
              <p className="text-[10px] text-red-500">{data.expenseCount} entries</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex items-center gap-2">
                <Banknote className="size-4 text-blue-600" />
                <p className="text-xs text-blue-600">Payroll</p>
              </div>
              <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">{formatPkr(data.payroll)}</p>
              <p className="text-[10px] text-blue-500">{data.payrollCount} records</p>
            </div>
            <div className={cn(
              "rounded-lg border px-4 py-3",
              data.netBalance >= 0
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
            )}>
              <div className="flex items-center gap-2">
                <PieChart className={cn("size-4", data.netBalance >= 0 ? "text-emerald-600" : "text-red-600")} />
                <p className={cn("text-xs", data.netBalance >= 0 ? "text-emerald-600" : "text-red-600")}>Net Balance</p>
              </div>
              <p className={cn(
                "mt-1 text-xl font-bold",
                data.netBalance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300",
              )}>
                {formatPkr(data.netBalance)}
              </p>
            </div>
          </div>

          {/* Breakdown table */}
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">% of Income</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold text-emerald-700">Income (Fees)</TableCell>
                  <TableCell className="text-right font-medium">{formatPkr(data.income)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{data.paymentCount}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold text-red-700">Expenses</TableCell>
                  <TableCell className="text-right font-medium text-red-700">{formatPkr(data.expenses)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{data.expenseCount}</TableCell>
                  <TableCell className="text-right">
                    {data.income > 0 ? `${pct(data.expenses, data.income)}%` : "—"}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold text-blue-700">Payroll</TableCell>
                  <TableCell className="text-right font-medium text-blue-700">{formatPkr(data.payroll)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{data.payrollCount}</TableCell>
                  <TableCell className="text-right">
                    {data.income > 0 ? `${pct(data.payroll, data.income)}%` : "—"}
                  </TableCell>
                </TableRow>
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Net Balance</TableCell>
                  <TableCell className={cn("text-right", data.netBalance >= 0 ? "text-emerald-700" : "text-red-700")}>
                    {formatPkr(data.netBalance)}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Reports() {
  return (
    <AppShell title="Reports">
      <Tabs defaultValue="daily" className="flex flex-col gap-5">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="daily">Daily summary</TabsTrigger>
          <TabsTrigger value="class">Class attendance</TabsTrigger>
          <TabsTrigger value="student">Student history</TabsTrigger>
          <TabsTrigger value="absent">Absent / late</TabsTrigger>
          <TabsTrigger value="fees">Fee collection</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <DailySummary />
        </TabsContent>
        <TabsContent value="class">
          <ClassReport />
        </TabsContent>
        <TabsContent value="student">
          <StudentHistory />
        </TabsContent>
        <TabsContent value="absent">
          <AbsentLateList />
        </TabsContent>
        <TabsContent value="fees">
          <FeeCollectionByClass />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialOverview />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
