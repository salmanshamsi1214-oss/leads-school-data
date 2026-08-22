import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { todayStr, formatDate, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Cake,
  CalendarDays,
  Gift,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";

/** wa.me link for a Pakistani phone number, if it can be parsed. */
function whatsappLink(phone: string, message: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  if (!digits.startsWith("92")) digits = `92${digits}`;
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const birthdayWish =
  "Happy Birthday! 🎂 Wishing you a wonderful year ahead — Leads School System, Zeenat Campus";

type BirthdayEntry = {
  studentId: string;
  kind: "student" | "teacher";
  name: string;
  subtitle: string;
  className: string;
  section: string;
  rollNumber: string;
  phone: string;
  birthDate: string;
  daysUntil: number;
};

export default function Birthdays() {
  const date = todayStr();
  const overview = useQuery(api.dashboard.overview, { date });

  if (overview === undefined) {
    return (
      <AppShell title="Birthdays">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const { birthdays, monthBirthdays } = overview;

  // Today's birthdays (daysUntil === 0)
  const todayBirthdays = birthdays.filter(
    (b: BirthdayEntry) => b.daysUntil === 0,
  );

  // Upcoming in next 7 days (daysUntil > 0)
  const upcomingBirthdays = birthdays.filter(
    (b: BirthdayEntry) => b.daysUntil > 0,
  );

  // All month birthdays (already includes past dates)
  const monthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <AppShell title="Birthdays">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Birthdays</h2>
            <p className="text-sm text-muted-foreground">
              Automated birthday wishes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {monthBirthdays.length > 0 && (
              <Badge variant="secondary" className="bg-pink-100 text-pink-700">
                <Cake className="mr-1 size-3" />
                {monthBirthdays.length} this month
              </Badge>
            )}
          </div>
        </div>

        {/* Reminder banner */}
        {upcomingBirthdays.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="mr-1.5">🔔</span>
            <strong>Reminder:</strong> {upcomingBirthdays.length} student
            {upcomingBirthdays.length === 1 ? "" : "s"} have a birthday coming
            up in the next 7 days. Send an early heads-up so parents can plan
            ahead.
          </div>
        )}

        {/* Main grid — Today + Upcoming */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Today */}
          <Card className="shadow-none lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-orange-500" />
                Today — {formatWeekday(date)}, {formatDate(date)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayBirthdays.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                    <Gift className="size-7" />
                  </div>
                  <p className="text-base font-semibold">No birthdays today</p>
                  <p className="text-sm text-muted-foreground">
                    No students or staff members are celebrating today.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {todayBirthdays.map((b: BirthdayEntry) => {
                    const link = whatsappLink(b.phone, birthdayWish);
                    return (
                      <div
                        key={b.studentId}
                        className="flex items-center gap-3 rounded-xl border bg-orange-50/50 px-4 py-3"
                      >
                        <Avatar className="size-11">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-bold",
                              b.kind === "teacher"
                                ? "bg-orange-200 text-orange-800"
                                : "bg-primary/15 text-primary",
                            )}
                          >
                            {initials(b.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {b.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {b.subtitle}
                          </p>
                        </div>
                        {link ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="shrink-0 cursor-pointer border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
                          >
                            <a href={link} target="_blank" rel="noreferrer">
                              <Send className="mr-1 size-3" />
                              Send Wish
                            </a>
                          </Button>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            No contact
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coming Up — Next 7 Days */}
          <Card className="shadow-none lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-blue-500" />
                Coming Up — Next 7 Days
              </CardTitle>
              <CardDescription>
                Get ahead of it with an early reminder
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingBirthdays.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                    <CalendarDays className="size-6" />
                  </div>
                  <p className="text-sm font-semibold">
                    No upcoming birthdays
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No birthdays in the next 7 days.
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-1.5 text-[11px] font-bold uppercase text-muted-foreground">
                    <span>Student</span>
                    <span>Class</span>
                    <span>When</span>
                    <span />
                  </div>
                  {upcomingBirthdays.map((b: BirthdayEntry) => {
                    const link = whatsappLink(b.phone, birthdayWish);
                    return (
                      <div
                        key={b.studentId}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 hover:bg-accent/40"
                      >
                        <span className="truncate text-sm font-semibold">
                          {b.name}
                        </span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {b.subtitle.split("·")[0]?.trim()}
                        </span>
                        <Badge
                          className={cn(
                            "shrink-0 text-[10px] font-bold",
                            b.daysUntil <= 3
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-100",
                          )}
                        >
                          in {b.daysUntil} day
                          {b.daysUntil === 1 ? "" : "s"}
                        </Badge>
                        {link ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="shrink-0 cursor-pointer text-xs"
                          >
                            <a href={link} target="_blank" rel="noreferrer">
                              <Send className="mr-1 size-3" />
                              Send Reminder
                            </a>
                          </Button>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            No contact
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Birthdays This Month — Full Table */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="size-4 text-pink-500" />
              Birthdays This Month
            </CardTitle>
            <CardDescription>Full month view</CardDescription>
          </CardHeader>
          <CardContent>
            {monthBirthdays.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-pink-100 text-pink-500">
                  <CalendarDays className="size-6" />
                </div>
                <p className="text-sm font-semibold">
                  No birthdays in {monthName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Add birth dates to student or staff profiles to see them here.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 px-3 py-1.5 text-[11px] font-bold uppercase text-muted-foreground">
                  <span>Student</span>
                  <span>Class</span>
                  <span>Date</span>
                  <span />
                </div>
                {monthBirthdays.map((b: BirthdayEntry) => {
                  const dayNum = b.birthDate
                    ? Number(b.birthDate.split("-")[2])
                    : null;
                  const dateStr = dayNum
                    ? `${monthName} ${dayNum}`
                    : "—";
                  const link = whatsappLink(b.phone, birthdayWish);
                  return (
                    <div
                      key={b.studentId}
                      className={cn(
                        "grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5",
                        b.daysUntil === 0
                          ? "bg-orange-50"
                          : "hover:bg-accent/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-[10px] font-bold",
                              b.kind === "teacher"
                                ? "bg-orange-200 text-orange-800"
                                : "bg-pink-100 text-pink-700",
                            )}
                          >
                            {initials(b.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {b.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {b.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {b.subtitle.split("·")[0]?.trim()}
                      </span>
                      <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                        {dateStr}
                        {b.daysUntil === 0 && (
                          <span className="ml-1.5 text-xs font-bold text-orange-600">
                            Today!
                          </span>
                        )}
                        {b.daysUntil > 0 && b.daysUntil <= 7 && (
                          <span className="ml-1.5 text-[10px] font-bold text-amber-600">
                            in {b.daysUntil}d
                          </span>
                        )}
                      </span>
                      {b.daysUntil === 0 && link ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="shrink-0 cursor-pointer text-xs"
                        >
                          <a href={link} target="_blank" rel="noreferrer">
                            <Send className="mr-1 size-3" />
                            Send Reminder
                          </a>
                        </Button>
                      ) : b.daysUntil === 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          No contact
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
