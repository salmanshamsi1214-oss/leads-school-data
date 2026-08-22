import { useState } from "react";
import { useQuery } from "convex/react";
import {
  CalendarCheck2,
  ChevronRight,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  Phone,
  Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_META, statusLabel } from "@/lib/attendance";
import { formatDate, formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ParentApp() {
  const classes = useQuery(api.classes.list) ?? [];
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");

  const students = useQuery(
    api.students.list,
    selectedClass
      ? {
          classId: selectedClass as never,
          section: selectedSection || undefined,
          status: "active",
        }
      : "skip",
  );

  const profile = useQuery(
    api.studentProfile.get,
    selectedStudent ? { studentId: selectedStudent as never } : "skip",
  );

  const selectedClassObj = classes.find((c) => c._id === selectedClass);

  // If student selected, show their profile
  if (profile) {
    const { student, className, attendance, fees, exams } = profile;

    return (
      <AppShell title={student.name}>
        <div className="flex flex-col gap-4 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedStudent("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Change student
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="bg-primary/15 font-bold text-primary">
                {initials(student.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-bold">{student.name}</h2>
              <p className="text-xs text-muted-foreground">
                Roll {student.rollNumber} · {className} {student.section}
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <QuickStat
              label="Attendance"
              value={`${attendance.presentRate}%`}
              tone={attendance.presentRate >= 80 ? "success" : "danger"}
            />
            <QuickStat
              label="Paid"
              value={formatPkr(fees.totalPaid)}
              tone="success"
            />
            <QuickStat
              label="Exams"
              value={exams.totalExams}
              tone="default"
            />
          </div>

          <Tabs defaultValue="attendance">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="attendance" className="cursor-pointer text-xs">
                Attendance
              </TabsTrigger>
              <TabsTrigger value="fees" className="cursor-pointer text-xs">
                Fees
              </TabsTrigger>
              <TabsTrigger value="exams" className="cursor-pointer text-xs">
                Exams
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance" className="mt-3">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  {attendance.records.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No records yet.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {attendance.records.slice(0, 14).map((rec) => (
                        <div
                          key={rec.date}
                          className="flex items-center justify-between py-2"
                        >
                          <span className="text-xs font-medium">
                            {formatDate(rec.date)}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              STATUS_META[rec.status]?.chip,
                            )}
                          >
                            {statusLabel(rec.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fees" className="mt-3">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {fees.recentPayments.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No payments yet.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {fees.recentPayments.map((p) => (
                        <div
                          key={p._id}
                          className="flex items-center justify-between py-2"
                        >
                          <div>
                            <p className="text-xs font-medium">{p.period}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(p.date)}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-emerald-600">
                            {formatPkr(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exams" className="mt-3">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Exam Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {exams.summaries.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No exam results yet.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {exams.summaries.map((s) => (
                        <div
                          key={s!.examId}
                          className="flex items-center justify-between py-2"
                        >
                          <div>
                            <p className="text-xs font-semibold">
                              {s!.examTitle}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDate(s!.examDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">
                              {s!.percentage}%
                            </span>
                            <Badge
                              className={cn(
                                "text-[10px]",
                                s!.percentage >= 60
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-red-100 text-red-700 hover:bg-red-100",
                              )}
                            >
                              {s!.grade}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AppShell>
    );
  }

  // Student selector
  return (
    <AppShell title="Parent View">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Select your child&apos;s class and name to view their progress.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 text-xs font-medium">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection("");
                setSelectedStudent("");
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {selectedClassObj && selectedClassObj.sections.length > 0 && (
            <div>
              <label className="mb-1 text-xs font-medium">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setSelectedStudent("");
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">All sections</option>
                {selectedClassObj.sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {students && students.length > 0 && (
          <div className="divide-y rounded-xl border">
            {students.map((s) => (
              <button
                key={s._id}
                onClick={() => setSelectedStudent(s._id)}
                className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/60"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                    {initials(s.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Roll {s.rollNumber} · {s.section}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function QuickStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "success" | "danger" | "default";
}) {
  const bg = {
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-red-50 text-red-700",
    default: "bg-secondary/60 text-foreground",
  };
  return (
    <div className={cn("rounded-lg p-3 text-center", bg[tone])}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
