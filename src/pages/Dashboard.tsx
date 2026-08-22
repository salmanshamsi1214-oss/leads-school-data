import { useQuery } from "convex/react";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  BookUser,
  Cake,
  CalendarCheck2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  PlusCircle,
  Send,
  UserX,
  Users,
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
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { BIRTHDAY_MESSAGE, whatsappLink, initials } from "@/lib/school";
import { todayStr, formatDate, formatWeekday, formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

function NotificationRow({
  icon: Icon,
  iconClass,
  title,
  sub,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  sub: string;
  to: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/60"
      >
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", iconClass)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </Link>
    </li>
  );
}

export default function Dashboard() {
  const date = todayStr();
  const overview = useQuery(api.dashboard.overview, { date });

  if (overview === undefined) {
    return (
      <AppShell title="Dashboard">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const {
    today,
    activeStudents,
    totalStudents,
    perClass,
    recentAbsents,
    trend,
    teacherCount,
    teacherToday,
    feeMonth,
    birthdays,
    monthBirthdays,
    teacherDiaryPending,
    diariesToday,
  } = overview;

  const chartData = trend.map((point) => ({
    date: `${formatWeekday(point.date)} ${point.date.slice(8)}`,
    rate: point.rate,
    marked: point.marked,
  }));

  const notifications: {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    title: string;
    sub: string;
    to: string;
  }[] = [];
  if (feeMonth.dueCount > 0) {
    notifications.push({
      key: "fees",
      icon: Wallet,
      iconClass: "bg-red-100 text-red-600",
      title: `${feeMonth.dueCount} student${feeMonth.dueCount === 1 ? "" : "s"} with pending fees this month`,
      sub: `${formatPkr(feeMonth.outstanding)} outstanding`,
      to: "/fees",
    });
  }
  if (today.absent + today.late > 0) {
    notifications.push({
      key: "absent",
      icon: UserX,
      iconClass: "bg-red-100 text-red-600",
      title: `${today.absent} absent · ${today.late} late today`,
      sub: "Tap to review attendance",
      to: "/attendance",
    });
  }
  if (birthdays.length > 0) {
    notifications.push({
      key: "birthdays",
      icon: Cake,
      iconClass: "bg-amber-100 text-amber-600",
      title: `${birthdays.length} birthday${birthdays.length === 1 ? "" : "s"} in the next 7 days`,
      sub: "Send an early wish",
      to: "/students",
    });
  }
  if (teacherDiaryPending > 0) {
    notifications.push({
      key: "teacher-diary",
      icon: BookOpen,
      iconClass: "bg-blue-100 text-blue-600",
      title: `${teacherDiaryPending} teacher${teacherDiaryPending === 1 ? "" : "s"} haven't submitted this week's diary`,
      sub: "Open the weekly diary",
      to: "/diary",
    });
  }
  if (diariesToday === 0) {
    notifications.push({
      key: "diary-today",
      icon: ClipboardCheck,
      iconClass: "bg-slate-100 text-slate-600",
      title: "No daily diary entries yet today",
      sub: "Open the diary and record today's work",
      to: "/diary",
    });
  }
  if (teacherToday.total > 0 && teacherToday.present < teacherToday.total) {
    notifications.push({
      key: "teacher-attendance",
      icon: BookUser,
      iconClass: "bg-orange-100 text-orange-600",
      title: `${teacherToday.total - teacherToday.present} of ${teacherToday.total} teachers not marked present today`,
      sub: "Check staff attendance",
      to: "/teachers",
    });
  }

  const quickStats: { label: string; value: string | number }[] = [
    { label: "Late arrivals today", value: today.late },
    { label: "Absent today", value: today.absent },
    {
      label: "Teachers on duty",
      value: teacherToday.total > 0 ? `${teacherToday.present}/${teacherToday.total}` : "—",
    },
    { label: "Weekly diary pending", value: teacherDiaryPending },
    { label: "Fees outstanding this month", value: formatPkr(feeMonth.outstanding) },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="flex flex-col gap-6">
        {/* Quick actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {formatDate(date)} · {formatWeekday(date)}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Good morning, office</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="cursor-pointer">
              <Link to="/attendance">
                <ClipboardCheck className="size-4" />
                Mark attendance
              </Link>
            </Button>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/students">
                <PlusCircle className="size-4" />
                Add student
              </Link>
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Active students"
            value={activeStudents}
            sub={`${totalStudents} total on record`}
            icon={Users}
          />
          <StatCard
            label="Present today"
            value={today.present}
            sub={`${today.marked} marked of ${activeStudents}`}
            icon={CalendarCheck2}
            tone="success"
          />
          <StatCard
            label="Absent today"
            value={today.absent}
            sub={`${today.late} late · ${today.leave} on leave`}
            icon={UserX}
            tone="danger"
          />
          <StatCard
            label="Present rate"
            value={`${today.presentRate}%`}
            sub="of active students"
            icon={Clock3}
            tone="warning"
          />
        </div>

        {/* Staff & fees summary */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Teachers today"
            value={
              teacherToday.total > 0
                ? `${teacherToday.present}/${teacherToday.total}`
                : "—"
            }
            sub={`${teacherCount} active on staff`}
            icon={BookUser}
          />
          <StatCard
            label="Fees collected this month"
            value={formatPkr(feeMonth.collected)}
            sub={`${formatPkr(feeMonth.outstanding)} outstanding`}
            icon={Wallet}
            tone="success"
          />
          <StatCard
            label="Fees due this month"
            value={feeMonth.dueCount}
            sub={feeMonth.expected > 0 ? `${formatPkr(feeMonth.expected)} expected` : "No monthly fees set"}
            icon={Wallet}
            tone="danger"
          />
          <StatCard
            label="Collection rate"
            value={
              feeMonth.expected > 0
                ? `${Math.round((feeMonth.collected / feeMonth.expected) * 1000) / 10}%`
                : "—"
            }
            sub="of monthly fees"
            icon={Clock3}
            tone="warning"
          />
        </div>

        {/* Birthdays This Month */}
        {monthBirthdays.length > 0 && (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cake className="size-4 text-pink-500" />
                Birthdays This Month
                <Badge variant="secondary" className="ml-auto">
                  {monthBirthdays.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                All students &amp; staff born in {new Date().toLocaleString("default", { month: "long" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {monthBirthdays.map((b) => {
                  const dayNum = b.birthDate ? Number(b.birthDate.split("-")[2]) : null;
                  const waLink = whatsappLink(b.phone, BIRTHDAY_MESSAGE);
                  return (
                    <li
                      key={b.studentId}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700 text-sm font-bold">
                        {dayNum ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-semibold">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.subtitle}
                          {b.daysUntil === 0 && (
                            <span className="ml-1 font-medium text-primary">· Today!</span>
                          )}
                          {b.daysUntil > 0 && (
                            <span className="ml-1 text-muted-foreground">· in {b.daysUntil}d</span>
                          )}
                          {b.daysUntil < 0 && (
                            <span className="ml-1 text-muted-foreground">· passed</span>
                          )}
                        </p>
                      </div>
                      {b.daysUntil === 0 && waLink ? (
                        <Button asChild variant="outline" size="sm" className="shrink-0 cursor-pointer">
                          <a href={waLink} target="_blank" rel="noreferrer">
                            <Send className="size-3.5" />
                          </a>
                        </Button>
                      ) : b.daysUntil === 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">No contact</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Notifications + birthdays + quick stats */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Notifications */}
          <Card className="shadow-none lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="size-4 text-amber-500" />
                Notifications
              </CardTitle>
              <CardDescription>Things that need your attention today</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CalendarCheck2 className="size-6" />
                  </div>
                  <p className="text-sm font-medium">All caught up</p>
                  <p className="text-xs text-muted-foreground">
                    Nothing needs attention right now — nice work!
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {notifications.map((item) => {
                    const { key, ...props } = item;
                    return <NotificationRow key={key} {...props} />;
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Birthdays this week */}
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cake className="size-4 text-amber-500" />
                  Birthdays This Week
                </CardTitle>
                <CardDescription>Students &amp; staff in the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {birthdays.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No birthdays this week.
                    <br />
                    <span className="text-xs">
                      Add a date of birth on a student&apos;s or teacher&apos;s profile to see
                      reminders here.
                    </span>
                  </p>
                ) : (
                  <ul className="divide-y">
                    {birthdays.map((birthday) => {
                      const link = whatsappLink(birthday.phone, BIRTHDAY_MESSAGE);
                      return (
                        <li key={birthday.studentId} className="flex items-center gap-3 py-2.5">
                          <Avatar className="size-10">
                            <AvatarFallback
                              className={cn(
                                "text-xs font-semibold",
                                birthday.kind === "teacher"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-primary/15 text-primary",
                              )}
                            >
                              {initials(birthday.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 leading-tight">
                            <p className="truncate text-sm font-semibold">{birthday.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {birthday.subtitle}
                              <span
                                className={cn(
                                  "ml-1 font-medium",
                                  birthday.daysUntil === 0 ? "text-primary" : "",
                                )}
                              >
                                {birthday.daysUntil === 0 ? "· Today!" : `· in ${birthday.daysUntil} day${birthday.daysUntil === 1 ? "" : "s"}`}
                              </span>
                            </p>
                          </div>
                          {link ? (
                            <Button asChild variant="outline" size="sm" className="shrink-0 cursor-pointer">
                              <a href={link} target="_blank" rel="noreferrer">
                                <Send className="size-3.5" />
                                Send wish
                              </a>
                            </Button>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              No contact
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {quickStats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className="font-semibold">{stat.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trend chart */}
          <Card className="shadow-none lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attendance trend</CardTitle>
              <CardDescription>Present rate over the last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e4e0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#8a8f98" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8a8f98" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "Present rate"]}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#ea580c"
                      strokeWidth={2.5}
                      fill="url(#rateFill)"
                      dot={{ r: 2.5, fill: "#ea580c", strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Per-class rates */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Present rate by class</CardTitle>
              <CardDescription>Today, among active students</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {perClass.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No students enrolled yet.
                  <br />
                  <Link to="/classes" className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    Set up classes <ArrowRight className="size-3" />
                  </Link>
                </p>
              )}
              {perClass.map((cls) => (
                <div key={cls.classId}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {cls.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {cls.present}/{cls.total}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        cls.rate >= 90
                          ? "text-emerald-600"
                          : cls.rate >= 70
                            ? "text-amber-600"
                            : "text-red-600",
                      )}
                    >
                      {cls.rate}%
                    </span>
                  </div>
                  <Progress
                    value={cls.rate}
                    className={cn(
                      "h-2 bg-secondary",
                      cls.rate >= 90
                        ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                        : cls.rate >= 70
                          ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                          : "[&_[data-slot=progress-indicator]]:bg-red-500",
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent absentees */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Absent or late today</CardTitle>
            <CardDescription>
              {recentAbsents.length === 0
                ? "No absences recorded yet today."
                : `${recentAbsents.length} student${recentAbsents.length > 1 ? "s" : ""} to follow up on`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentAbsents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CalendarCheck2 className="size-6" />
                </div>
                <p className="text-sm font-medium">All clear so far</p>
                <p className="text-xs text-muted-foreground">
                  Mark today&apos;s attendance to see the day&apos;s absent and late lists.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentAbsents.map((student) => (
                  <li
                    key={student.studentId}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-semibold">{student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.className} · {student.section || "—"} · Roll {student.rollNumber || "—"}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0",
                        student.status === "absent"
                          ? "bg-red-100 text-red-700 hover:bg-red-100"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-100",
                      )}
                    >
                      {student.status === "absent" ? "Absent" : "Late"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
