import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Printer,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Moon,
} from "lucide-react";

export default function MonthlyAttendanceReport() {
  const classes = useQuery(api.classes.list) ?? [];
  const now = new Date();
  const [classId, setClassId] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const report = useQuery(
    api.attendance.classReport,
    classId
      ? {
          classId: classId as Id<"classes">,
          section: section || undefined,
          from: `${year}-${String(month).padStart(2, "0")}-01`,
          to: `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`,
        }
      : "skip",
  );

  const selectedClass = classes.find((c) => c._id === classId);

  // Calculate day grid for the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // School days (weekdays)
  const schoolDays = useMemo(() => {
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      if (dow !== 0) {
        // skip Sunday
        days.push(
          `${monthStr}-${String(d).padStart(2, "0")}`,
        );
      }
    }
    return days;
  }, [year, month, monthStr, daysInMonth]);

  // Summary stats
  const summary = useMemo(() => {
    if (!report?.rows?.length) return null;
    const total = report.rows.length;
    const avgPresent = report.rows.reduce((a, r) => a + r.present, 0);
    const totalAbsent = report.rows.reduce((a, r) => a + r.absent, 0);
    const totalLate = report.rows.reduce((a, r) => a + r.late, 0);
    const totalLeave = report.rows.reduce((a, r) => a + r.leave, 0);
    const totalDays = schoolDays.length || 1;
    return {
      totalStudents: total,
      avgAttendance: Math.round((avgPresent / (total * totalDays)) * 100),
      totalAbsent,
      totalLate,
      totalLeave,
      totalPresent: avgPresent,
    };
  }, [report, schoolDays]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const monthName = new Date(year, month - 1).toLocaleString("en", {
    month: "long",
  });

  const handlePrint = () => {
    window.print();
  };

  // Per-student color based on percentage
  const pctColor = (pct: number) => {
    if (pct >= 90) return "text-green-600";
    if (pct >= 75) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <AppShell title="Monthly Attendance Report">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="card-3d">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px]">
                <Label className="text-xs">Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClass && selectedClass.sections.length > 0 && (
                <div className="min-w-[120px]">
                  <Label className="text-xs">Section</Label>
                  <Select value={section} onValueChange={setSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {selectedClass.sections.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" onClick={prevMonth}>
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-center min-w-[140px]">
                  <p className="text-sm font-bold">
                    {monthName} {year}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {schoolDays.length} school days
                  </p>
                </div>
                <Button variant="outline" size="icon-sm" onClick={nextMonth}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={handlePrint} className="ml-auto">
                <Printer className="size-4" /> Print Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="card-3d">
              <CardContent className="p-3 text-center">
                <Users className="size-5 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{summary.totalStudents}</p>
                <p className="text-[10px] text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-3 text-center">
                <CheckCircle2 className="size-5 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-600">
                  {summary.avgAttendance}%
                </p>
                <p className="text-[10px] text-muted-foreground">Avg Attendance</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-3 text-center">
                <XCircle className="size-5 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-600">
                  {summary.totalAbsent}
                </p>
                <p className="text-[10px] text-muted-foreground">Total Absent</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-3 text-center">
                <Clock className="size-5 mx-auto text-amber-500 mb-1" />
                <p className="text-xl font-bold text-amber-600">{summary.totalLate}</p>
                <p className="text-[10px] text-muted-foreground">Total Late</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-3 text-center">
                <Moon className="size-5 mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-blue-600">{summary.totalLeave}</p>
                <p className="text-[10px] text-muted-foreground">Total Leave</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Report Table */}
        {report && report.rows.length > 0 ? (
          <Card className="card-3d print:shadow-none print:border-0">
            <CardHeader>
              <CardTitle className="text-sm">
                {selectedClass?.name ?? "Class"} {section && `— ${section}`} Attendance
                — {monthName} {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Leave</TableHead>
                    <TableHead className="text-center">Days Marked</TableHead>
                    <TableHead className="text-center">Attendance %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r, i) => {
                    const totalDays = r.present + r.absent + r.late + r.leave;
                    const pct =
                      totalDays > 0 ? Math.round((r.present / totalDays) * 100) : 0;
                    return (
                      <TableRow key={r.studentId}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.rollNumber}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {r.name}
                        </TableCell>
                        <TableCell className="text-center text-sm text-green-600">
                          {r.present}
                        </TableCell>
                        <TableCell className="text-center text-sm text-red-600">
                          {r.absent}
                        </TableCell>
                        <TableCell className="text-center text-sm text-amber-600">
                          {r.late}
                        </TableCell>
                        <TableCell className="text-center text-sm text-blue-600">
                          {r.leave}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {r.marked}
                        </TableCell>
                        <TableCell
                          className={`text-center text-sm font-bold ${pctColor(pct)}`}
                        >
                          {pct}%
                        </TableCell>
                        <TableCell>
                          {pct >= 90 ? (
                            <Badge className="bg-green-100 text-green-700 text-[10px]">
                              Excellent
                            </Badge>
                          ) : pct >= 75 ? (
                            <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                              Good
                            </Badge>
                          ) : pct >= 60 ? (
                            <Badge className="bg-orange-100 text-orange-700 text-[10px]">
                              Average
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-[10px]">
                              Poor
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : classId ? (
          <Card className="card-3d">
            <CardContent className="p-12 text-center">
              <CalendarDays className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                No attendance data for this month. Mark attendance first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-3d">
            <CardContent className="p-12 text-center">
              <CalendarDays className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Select a class to view the monthly report.</p>
            </CardContent>
          </Card>
        )}

        {/* Fine/Defaulter Legend */}
        <Card className="card-3d">
          <CardContent className="p-4">
            <p className="text-xs font-semibold mb-2">Attendance Status Legend</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500" /> Present
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500" /> Absent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> Late
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-500" /> Leave
              </span>
              <span className="ml-4 text-muted-foreground">
                ≥90% Excellent | ≥75% Good | ≥60% Average | &lt;60% Poor (may incur fine)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
