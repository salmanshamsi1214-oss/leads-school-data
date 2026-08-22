import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck2,
  Camera,
  ChevronRight,
  ClipboardCheck,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_META, statusLabel } from "@/lib/attendance";
import { formatDate, formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const profile = useQuery(
    api.studentProfile.get,
    id ? { studentId: id as never } : "skip",
  );

  if (!id) {
    return (
      <AppShell title="Student Profile">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-muted-foreground">No student selected.</p>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link to="/students">
              <ArrowLeft className="size-4" /> Back to students
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (profile === undefined) {
    return (
      <AppShell title="Student Profile">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Student Profile">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm font-semibold">Student not found</p>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link to="/students">
              <ArrowLeft className="size-4" /> Back to students
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { student, className: clsName, attendance, fees, exams, notebookChecks, robotProjects, submissions } = profile;

  const whatsappLink = (() => {
    if (!student.phone) return null;
    let digits = student.phone.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
    if (!digits.startsWith("92")) digits = `92${digits}`;
    if (digits.length < 10) return null;
    return `https://wa.me/${digits}`;
  })();

  return (
    <AppShell title={student.name}>
      <div className="flex flex-col gap-6">
        {/* Back link */}
        <Link
          to="/students"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to students
        </Link>

        {/* Header card */}
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
                {initials(student.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">
                  {student.name}
                </h2>
                <Badge
                  className={cn(
                    student.status === "active"
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {student.status === "active" ? "Active" : "Left"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Roll {student.rollNumber} · {clsName} · Section {student.section}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Father</p>
                  <p className="font-medium">{student.fatherName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="font-medium">{student.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Admission</p>
                  <p className="font-medium">
                    {student.admissionDate
                      ? formatDate(student.admissionDate)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date of birth</p>
                  <p className="font-medium">
                    {student.birthDate ? formatDate(student.birthDate) : "—"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {whatsappLink && (
                <Button asChild variant="outline" size="sm" className="cursor-pointer">
                  <a href={whatsappLink} target="_blank" rel="noreferrer">
                    <Phone className="size-3.5" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="overview" className="cursor-pointer">
              Overview
            </TabsTrigger>
            <TabsTrigger value="attendance" className="cursor-pointer">
              Attendance
            </TabsTrigger>
            <TabsTrigger value="fees" className="cursor-pointer">
              Fees
            </TabsTrigger>
            <TabsTrigger value="exams" className="cursor-pointer">
              Exams
            </TabsTrigger>
            <TabsTrigger value="notebooks" className="cursor-pointer">
              Notebooks
            </TabsTrigger>
            {(robotProjects.length > 0 || submissions.length > 0) && (
              <TabsTrigger value="activities" className="cursor-pointer">
                Activities
              </TabsTrigger>
            )}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat
                label="Attendance rate"
                value={`${attendance.presentRate}%`}
                sub={`${attendance.totalMarked} days marked`}
                tone={
                  attendance.presentRate >= 90
                    ? "success"
                    : attendance.presentRate >= 70
                      ? "warning"
                      : "danger"
                }
              />
              <MiniStat
                label="Total paid"
                value={formatPkr(fees.totalPaid)}
                sub={`${fees.paymentCount} payment${fees.paymentCount === 1 ? "" : "s"}`}
                tone="success"
              />
              <MiniStat
                label="Exams taken"
                value={exams.totalExams}
                sub={
                  exams.overallAverage > 0
                    ? `${exams.overallAverage}% avg · ${exams.overallGrade}`
                    : "No results yet"
                }
                tone="default"
              />
              <MiniStat
                label="Notebook checks"
                value={notebookChecks.length}
                sub="Last 30 days"
                tone="default"
              />
            </div>

            {/* Attendance mini-chart */}
            <Card className="mt-4 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarCheck2 className="size-4" />
                  Attendance — Last 90 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    Object.keys(attendance.totals) as (keyof typeof attendance.totals)[]
                  ).map((status) => (
                    <div
                      key={status}
                      className="rounded-lg bg-secondary/60 px-3 py-2.5 text-center"
                    >
                      <p className="text-xl font-bold">
                        {attendance.totals[status]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {statusLabel(status)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance" className="mt-4">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-sm">
                  Attendance Records
                </CardTitle>
                <CardDescription>
                  {attendance.totalMarked} day(s) marked in the last 90 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attendance.records.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No attendance records in the last 90 days.
                  </p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {attendance.records.map((record) => (
                      <div
                        key={record.date}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <span className="text-sm font-medium">
                          {formatDate(record.date)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            STATUS_META[record.status]?.chip,
                          )}
                        >
                          {statusLabel(record.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEES */}
          <TabsContent value="fees" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MiniStat
                label="Monthly fee"
                value={formatPkr(fees.monthlyFee)}
                tone="default"
              />
              <MiniStat
                label="Total paid"
                value={formatPkr(fees.totalPaid)}
                tone="success"
              />
              <MiniStat
                label="Adjustments"
                value={formatPkr(fees.totalAssignments)}
                sub="Extra charges or concessions"
                tone={fees.totalAssignments >= 0 ? "warning" : "success"}
              />
            </div>
            <Card className="mt-4 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {fees.recentPayments.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Period</th>
                          <th className="pb-2 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Method</th>
                          <th className="pb-2 font-medium">Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fees.recentPayments.map((p) => (
                          <tr key={p._id} className="border-b last:border-0">
                            <td className="py-2.5 font-medium">
                              {formatDate(p.date)}
                            </td>
                            <td className="py-2.5">{p.period}</td>
                            <td className="py-2.5 font-semibold">
                              {formatPkr(p.amount)}
                            </td>
                            <td className="py-2.5 capitalize">{p.method}</td>
                            <td className="py-2.5 font-mono text-xs">
                              {p.receiptNo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXAMS */}
          <TabsContent value="exams" className="mt-4">
            {exams.totalExams === 0 ? (
              <Card className="shadow-none">
                <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                  <GraduationCap className="size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No exam results recorded yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <MiniStat
                    label="Overall average"
                    value={`${exams.overallAverage}%`}
                    tone={
                      exams.overallAverage >= 60 ? "success" : "warning"
                    }
                  />
                  <MiniStat
                    label="Overall grade"
                    value={exams.overallGrade ?? "—"}
                    tone="default"
                  />
                  <MiniStat
                    label="Exams taken"
                    value={exams.totalExams}
                    tone="default"
                  />
                </div>
                <Card className="shadow-none">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Exam</th>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Obtained</th>
                            <th className="px-4 py-3 font-medium">%</th>
                            <th className="px-4 py-3 font-medium">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exams.summaries.map((s) => (
                            <tr
                              key={s!.examId}
                              className="border-b last:border-0"
                            >
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-semibold">{s!.examTitle}</p>
                                  <p className="text-xs capitalize text-muted-foreground">
                                    {s!.examType}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {formatDate(s!.examDate)}
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {s!.totalObtained}
                              </td>
                              <td className="px-4 py-3">{s!.percentage}%</td>
                              <td className="px-4 py-3">
                                <Badge
                                  className={cn(
                                    s!.percentage >= 60
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-red-100 text-red-700 hover:bg-red-100",
                                  )}
                                >
                                  {s!.grade}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* NOTEBOOKS */}
          <TabsContent value="notebooks" className="mt-4">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notebook Checks</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {notebookChecks.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No notebook checks recorded in the last 30 days.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {notebookChecks.map((nb) => (
                      <div
                        key={nb._id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-semibold">{nb.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(nb.date)} · {nb.pagesCompleted}/
                            {nb.pagesExpected} pages
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            nb.status === "complete"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : nb.status === "incomplete"
                                ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                          )}
                        >
                          {nb.status === "complete"
                            ? "Complete"
                            : nb.status === "incomplete"
                              ? "Incomplete"
                              : "Not brought"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACTIVITIES */}
          {(robotProjects.length > 0 || submissions.length > 0) && (
            <TabsContent value="activities" className="mt-4">
              {robotProjects.length > 0 && (
                <Card className="mb-4 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Camera className="size-4" /> Robotics Projects
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {robotProjects.map((rp) => (
                        <div
                          key={rp._id}
                          className="rounded-lg border px-3 py-2.5"
                        >
                          <p className="text-sm font-semibold">
                            {rp.projectName}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {rp.status}
                            {rp.grade ? ` · Grade ${rp.grade}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {submissions.length > 0 && (
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <FileText className="size-4" /> Activity Submissions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {submissions.map((sub) => (
                        <div
                          key={sub._id}
                          className="rounded-lg border px-3 py-2.5"
                        >
                          <p className="text-sm font-semibold">
                            {sub.activityTitle}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {sub.status}
                            {sub.marksObtained != null
                              ? ` · ${sub.marksObtained}/${sub.totalMarks}`
                              : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const tones = {
    default: "border-l-slate-300",
    success: "border-l-emerald-500",
    danger: "border-l-red-500",
    warning: "border-l-amber-500",
  };
  return (
    <div className={cn("rounded-lg border border-l-4 bg-card p-4", tones[tone])}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {sub && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
