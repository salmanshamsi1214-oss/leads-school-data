import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function currentDayName(): string {
  const day = new Date().getDay();
  return day === 0 ? "Sunday" : DAYS[day - 1];
}

export default function TeacherApp() {
  const teachers = useQuery(api.teachers.list, {}) ?? [];
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [activeTab, setActiveTab] = useState("schedule");

  // If teacher selected, show their view
  if (selectedTeacher) {
    const teacher = teachers.find((t) => t._id === selectedTeacher);
    if (!teacher) return null;

    return (
      <TeacherView
        teacher={teacher}
        onBack={() => setSelectedTeacher("")}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  }

  // Teacher selector
  return (
    <AppShell title="Teacher View">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Select a teacher to view their schedule, diary, and leave requests.
        </p>
        <div className="divide-y rounded-xl border">
          {teachers.map((t) => (
            <button
              key={t._id}
              onClick={() => setSelectedTeacher(t._id)}
              className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/60"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                {t.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.subject ?? "—"} · {t.designation ?? "Teacher"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function TeacherView({
  teacher,
  onBack,
  activeTab,
  onTabChange,
}: {
  teacher: {
    _id: string;
    name: string;
    subject?: string;
    designation?: string;
    classId?: string;
  };
  onBack: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const timetable = useQuery(api.timetable.byTeacher);
  const todayDiary = useQuery(api.diary.dailyForClass, {
    classId: (teacher.classId ?? "") as never,
    date: todayStr(),
  });
  const weeklyDiary = useQuery(api.diary.weeklyForClass, {
    classId: (teacher.classId ?? "") as never,
  });
  const leaveRequests = useQuery(api.teachers.leaveRequests, {
    teacherId: teacher._id as never,
  });

  const today = currentDayName();

  // Get this teacher's schedule for today
  const todaySchedule =
    timetable
      ?.find((t) => t.teacherId === teacher._id)
      ?.schedule.filter((s) => s.day === today) ?? [];

  const teacherInitials = teacher.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell title={teacher.name}>
      <div className="flex flex-col gap-4 pb-6">
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All teachers
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
            {teacherInitials}
          </div>
          <div>
            <h2 className="text-lg font-bold">{teacher.name}</h2>
            <p className="text-xs text-muted-foreground">
              {teacher.subject ?? "—"} · {teacher.designation ?? "Teacher"}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule" className="cursor-pointer text-xs">
              <Clock className="mr-1 size-3" /> Today
            </TabsTrigger>
            <TabsTrigger value="diary" className="cursor-pointer text-xs">
              <BookOpen className="mr-1 size-3" /> Diary
            </TabsTrigger>
            <TabsTrigger value="leave" className="cursor-pointer text-xs">
              <FileText className="mr-1 size-3" /> Leave
            </TabsTrigger>
          </TabsList>

          {/* TODAY'S SCHEDULE */}
          <TabsContent value="schedule" className="mt-3">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {today}&apos;s Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todaySchedule.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No classes scheduled for today.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {todaySchedule.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">
                          P{s.period}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{s.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.className} {s.section}
                          </p>
                        </div>
                        {s.startTime && s.endTime && (
                          <span className="text-xs text-muted-foreground">
                            {s.startTime}–{s.endTime}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DIARY */}
          <TabsContent value="diary" className="mt-3">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Diary</CardTitle>
              </CardHeader>
              <CardContent>
                {todayDiary === undefined ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : todayDiary ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Topics taught
                      </p>
                      <p className="mt-0.5 text-sm">{todayDiary.summary}</p>
                    </div>
                    {todayDiary.homework && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Homework
                        </p>
                        <p className="mt-0.5 text-sm">{todayDiary.homework}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No diary entry for today yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {weeklyDiary && weeklyDiary.length > 0 && (
              <Card className="mt-3 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Weekly Diary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {weeklyDiary.slice(0, 3).map((w) => (
                    <div
                      key={w._id}
                      className="rounded-lg border p-3"
                    >
                      <p className="text-xs font-semibold">
                        {w.weekStart} to {w.weekEnd}
                      </p>
                      {w.entries && w.entries.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {w.entries.map((e, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              <span className="font-medium">{e.subject}:</span>{" "}
                              {e.work}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* LEAVE */}
          <TabsContent value="leave" className="mt-3">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {!leaveRequests ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leaveRequests.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No leave requests.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {leaveRequests.map((lr) => (
                      <div
                        key={lr._id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-xs font-medium">
                            {formatDate(lr.startDate)} – {formatDate(lr.endDate)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {lr.reason}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            lr.status === "approved"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : lr.status === "rejected"
                                ? "bg-red-100 text-red-700 hover:bg-red-100"
                                : "bg-amber-100 text-amber-700 hover:bg-amber-100",
                          )}
                        >
                          {lr.status.charAt(0).toUpperCase() + lr.status.slice(1)}
                        </Badge>
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
