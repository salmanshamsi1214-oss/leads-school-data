import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  CalendarDays,
  Plus,
  X,
  Printer,
  Copy,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const COMMON_SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Social Studies",
  "Islamiyat",
  "Computer",
  "Physical Education",
  "General Knowledge",
  "Art",
  "Break",
];

const SUBJECT_COLORS: Record<string, string> = {
  English: "bg-blue-100 border-blue-300 text-blue-800",
  Urdu: "bg-green-100 border-green-300 text-green-800",
  Mathematics: "bg-purple-100 border-purple-300 text-purple-800",
  Science: "bg-orange-100 border-orange-300 text-orange-800",
  "Social Studies": "bg-yellow-100 border-yellow-300 text-yellow-800",
  Islamiyat: "bg-emerald-100 border-emerald-300 text-emerald-800",
  Computer: "bg-cyan-100 border-cyan-300 text-cyan-800",
  "Physical Education": "bg-red-100 border-red-300 text-red-800",
  "General Knowledge": "bg-pink-100 border-pink-300 text-pink-800",
  Art: "bg-violet-100 border-violet-300 text-violet-800",
  Break: "bg-slate-100 border-slate-300 text-slate-500",
};

function getSubjectColor(subject: string): string {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  // Generate a consistent color from the subject name
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `bg-[hsl(${hue},40%,92%)] border-[hsl(${hue},35%,75%)] text-[hsl(${hue},40%,25%)]`;
}

interface PeriodEntry {
  subject: string;
  teacherId?: string;
  startTime: string;
  endTime: string;
}

function getCurrentDayIndex(): number {
  const day = new Date().getDay();
  // JS: 0=Sun, 1=Mon, ... 6=Sat. We use 0=Mon, ... 6=Sun
  return day === 0 ? 6 : day - 1;
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function Timetable() {
  const classes = useQuery(api.classes.list) ?? [];
  const teachers = useQuery(api.timetable.byTeacher) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const timetableData = useQuery(
    api.timetable.get,
    classId && section
      ? { classId, section: section.trim().toUpperCase() }
      : "skip",
  );
  const saveTimetable = useMutation(api.timetable.save);
  const copyTimetable = useMutation(api.timetable.copy);

  const [schedule, setSchedule] = useState<Record<number, PeriodEntry[]>>({});
  const [periodCount, setPeriodCount] = useState(8);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("grid");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFromClass, setCopyFromClass] = useState("");
  const [copyFromSection, setCopyFromSection] = useState("");
  const [copyToClass, setCopyToClass] = useState("");
  const [copyToSection, setCopyToSection] = useState("");

  const selectedClass = classes.find((c) => c._id === classId);
  const copyFromClassObj = classes.find((c) => c._id === copyFromClass);
  const copyToClassObj = classes.find((c) => c._id === copyToClass);

  const currentDay = getCurrentDayIndex();
  const currentTime = getCurrentTime();

  // Initialize schedule from saved data
  useEffect(() => {
    if (timetableData && timetableData.length > 0 && !loaded) {
      const maxPeriod = Math.max(...timetableData.map((t) => t.period), 8);
      const newSchedule: Record<number, PeriodEntry[]> = {};
      for (let day = 0; day < 7; day++) {
        newSchedule[day] = Array(maxPeriod)
          .fill(null)
          .map(() => ({
            subject: "",
            startTime: "",
            endTime: "",
          }));
      }
      for (const t of timetableData) {
        if (newSchedule[t.day] && newSchedule[t.day][t.period - 1]) {
          newSchedule[t.day][t.period - 1] = {
            subject: t.subject,
            teacherId: (t as { teacherId?: string }).teacherId ?? undefined,
            startTime: t.startTime,
            endTime: t.endTime,
          };
        }
      }
      setSchedule(newSchedule);
      setPeriodCount(maxPeriod);
      setLoaded(true);
    } else if (
      classId &&
      section &&
      !loaded &&
      timetableData?.length === 0
    ) {
      const newSchedule: Record<number, PeriodEntry[]> = {};
      for (let day = 0; day < 7; day++) {
        newSchedule[day] = Array(periodCount)
          .fill(null)
          .map(() => ({
            subject: "",
            startTime: "",
            endTime: "",
          }));
      }
      setSchedule(newSchedule);
      setLoaded(true);
    }
  }, [timetableData, classId, section, loaded, periodCount]);

  const updateCell = (
    day: number,
    period: number,
    field: keyof PeriodEntry,
    value: string,
  ) => {
    setSchedule((prev) => {
      const newSchedule = { ...prev };
      const dayPeriods = [
        ...(newSchedule[day] ||
          Array(periodCount)
            .fill(null)
            .map(() => ({
              subject: "",
              startTime: "",
              endTime: "",
            }))),
      ];
      dayPeriods[period] = { ...dayPeriods[period], [field]: value };
      newSchedule[day] = dayPeriods;
      return newSchedule;
    });
  };

  const handleSave = async () => {
    if (!classId || !section) return toast.error("Select class and section");
    const entries: Array<{
      day: number;
      period: number;
      subject: string;
      teacherId?: Id<"teachers">;
      startTime: string;
      endTime: string;
    }> = [];
    for (let day = 0; day < 7; day++) {
      const periods = schedule[day] || [];
      for (let p = 0; p < periods.length; p++) {
        if (periods[p]?.subject.trim()) {
          entries.push({
            day,
            period: p + 1,
            subject: periods[p].subject.trim(),
            teacherId: periods[p].teacherId as
              | Id<"teachers">
              | undefined,
            startTime: periods[p].startTime,
            endTime: periods[p].endTime,
          });
        }
      }
    }
    setSaving(true);
    try {
      await saveTimetable({
        classId,
        section: section.trim().toUpperCase(),
        entries,
      });
      toast.success("Timetable saved");
      setLoaded(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!copyFromClass || !copyFromSection || !copyToClass || !copyToSection)
      return toast.error("Select all fields");
    try {
      const count = await copyTimetable({
        fromClassId: copyFromClass as Id<"classes">,
        fromSection: copyFromSection,
        toClassId: copyToClass as Id<"classes">,
        toSection: copyToSection,
      });
      toast.success(`Copied ${count} periods`);
      setCopyOpen(false);
      setLoaded(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const style = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 13px; color: #666; margin: 0 0 12px; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 6px 4px; text-align: center; font-weight: 600; }
        td { border: 1px solid #d1d5db; padding: 4px; text-align: center; vertical-align: top; }
        .subject { font-weight: 600; font-size: 10px; }
        .teacher { font-size: 9px; color: #666; }
        .time { font-size: 8px; color: #999; }
        .today { background: #fff7ed; }
        @media print { @page { landscape; margin: 0.5cm; } }
      </style>
    `;
    let html = `<html><head><title>Timetable — ${selectedClass?.name ?? ""} ${section}</title>${style}</head><body>`;
    html += `<h1>LEADS School System — Zeenat Campus</h1>`;
    html += `<h2>${selectedClass?.name ?? ""} · Section ${section} — Weekly Timetable</h2>`;
    html += "<table><thead><tr><th>Period</th>";
    DAYS.forEach((d, i) => {
      html += `<th${i === currentDay ? ' style="background:#ffedd5"' : ""}>${d}</th>`;
    });
    html += "</tr></thead><tbody>";
    for (let p = 0; p < periodCount; p++) {
      html += `<tr><td style="font-weight:600">P${p + 1}</td>`;
      for (let d = 0; d < 7; d++) {
        const cell = schedule[d]?.[p];
        const isToday = d === currentDay;
        html += `<td${isToday ? ' class="today"' : ""}>`;
        if (cell?.subject) {
          html += `<div class="subject">${cell.subject}</div>`;
          if (cell.teacherId) {
            const t = teachers.find(
              (t) => t.teacherId === cell.teacherId,
            );
            if (t) html += `<div class="teacher">${t.name}</div>`;
          }
          if (cell.startTime && cell.endTime) {
            html += `<div class="time">${cell.startTime}–${cell.endTime}</div>`;
          }
        }
        html += "</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table></body></html>";
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // Detect current period
  const currentPeriod = useMemo(() => {
    if (!classId || !section) return null;
    const todaySchedule = schedule[currentDay];
    if (!todaySchedule) return null;
    for (let p = 0; p < todaySchedule.length; p++) {
      const cell = todaySchedule[p];
      if (cell?.startTime && cell?.endTime && cell?.subject) {
        if (currentTime >= cell.startTime && currentTime <= cell.endTime) {
          return { period: p + 1, subject: cell.subject };
        }
      }
    }
    return null;
  }, [schedule, currentDay, currentTime, classId, section]);

  return (
    <AppShell title="Timetable">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Create and manage weekly class schedules
            </p>
            {currentPeriod && (
              <Badge className="mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <Clock className="mr-1 size-3" />
                Now: P{currentPeriod.period} — {currentPeriod.subject}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setCopyOpen(true)}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={handlePrint}
              disabled={!classId || !section}
            >
              <Printer className="size-3.5" />
              Print
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="grid" className="cursor-pointer">
              <CalendarDays className="mr-1 size-3.5" />
              Class Timetable
            </TabsTrigger>
            <TabsTrigger value="teachers" className="cursor-pointer">
              <Users className="mr-1 size-3.5" />
              Teacher Schedules
            </TabsTrigger>
          </TabsList>

          {/* CLASS TIMETABLE TAB */}
          <TabsContent value="grid" className="mt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label>Class</Label>
                  <Select
                    value={classId}
                    onValueChange={(v) => {
                      setClassId(v as Id<"classes">);
                      setSection("");
                      setLoaded(false);
                      setSchedule({});
                    }}
                  >
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
                <div className="flex-1 space-y-1.5">
                  <Label>Section</Label>
                  <Select
                    value={section}
                    onValueChange={(v) => {
                      setSection(v);
                      setLoaded(false);
                      setSchedule({});
                    }}
                    disabled={!classId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClass?.sections.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newSchedule = { ...schedule };
                    for (let day = 0; day < 7; day++)
                      newSchedule[day] = [
                        ...(newSchedule[day] || []),
                        {
                          subject: "",
                          startTime: "",
                          endTime: "",
                        },
                      ];
                    setSchedule(newSchedule);
                    setPeriodCount((p) => p + 1);
                  }}
                >
                  <Plus className="mr-1 size-3.5" /> Period
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !classId || !section}
                >
                  <Save className="mr-1 size-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            {!classId || !section ? (
              <div className="py-16 text-center text-muted-foreground">
                <CalendarDays className="mx-auto mb-3 size-10 opacity-30" />
                <p className="font-medium">
                  Select class and section to view the timetable
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-16 px-2 py-2.5 text-left font-semibold text-muted-foreground">
                        Period
                      </th>
                      {DAYS.map((d, i) => (
                        <th
                          key={d}
                          className={cn(
                            "min-w-[130px] px-2 py-2.5 text-center font-semibold",
                            i === currentDay &&
                              "bg-orange-50 text-orange-700",
                          )}
                        >
                          <div>{d.slice(0, 3)}</div>
                          {i === currentDay && (
                            <div className="text-[10px] font-normal text-orange-500">
                              Today
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: periodCount }).map((_, pIdx) => (
                      <tr key={pIdx} className="border-b last:border-0">
                        <td className="px-2 py-2 font-bold text-muted-foreground">
                          P{pIdx + 1}
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          const cell = schedule[dayIdx]?.[pIdx] || {
                            subject: "",
                            startTime: "",
                            endTime: "",
                          };
                          const isToday = dayIdx === currentDay;
                          return (
                            <td
                              key={dayIdx}
                              className={cn(
                                "border-l p-1",
                                isToday && "bg-orange-50/50",
                              )}
                            >
                              <div className="flex flex-col gap-0.5">
                                <Select
                                  value={cell.subject || "__empty__"}
                                  onValueChange={(v) =>
                                    updateCell(
                                      dayIdx,
                                      pIdx,
                                      "subject",
                                      v === "__empty__" ? "" : v,
                                    )
                                  }
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "h-7 text-[10px] font-medium",
                                      cell.subject &&
                                        getSubjectColor(cell.subject),
                                    )}
                                  >
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__empty__">
                                      —
                                    </SelectItem>
                                    {COMMON_SUBJECTS.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {s}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex gap-0.5">
                                  <Input
                                    type="time"
                                    value={cell.startTime}
                                    onChange={(e) =>
                                      updateCell(
                                        dayIdx,
                                        pIdx,
                                        "startTime",
                                        e.target.value,
                                      )
                                    }
                                    className="h-5 px-1 text-[8px]"
                                  />
                                  <Input
                                    type="time"
                                    value={cell.endTime}
                                    onChange={(e) =>
                                      updateCell(
                                        dayIdx,
                                        pIdx,
                                        "endTime",
                                        e.target.value,
                                      )
                                    }
                                    className="h-5 px-1 text-[8px]"
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* TEACHER SCHEDULES TAB */}
          <TabsContent value="teachers" className="mt-4">
            {teachers.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 size-10 opacity-30" />
                <p className="font-medium">No teacher schedules yet</p>
                <p className="mt-1 text-xs">
                  Assign teachers to timetable periods to see their schedules
                  here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {teachers.map((t) => (
                  <div
                    key={t.teacherId}
                    className="rounded-xl border p-4"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                        {t.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.subject}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {t.schedule.length === 0 ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          No periods assigned
                        </p>
                      ) : (
                        t.schedule.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-1.5 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-muted-foreground">
                                {s.day.slice(0, 3)} P{s.period}
                              </span>
                              <span className="font-medium">
                                {s.subject}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {s.className} {s.section}
                              </span>
                              {s.startTime && s.endTime && (
                                <span className="text-muted-foreground">
                                  {s.startTime}–{s.endTime}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Copy dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="size-4" />
              Copy Timetable
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                From
              </p>
              <div className="flex gap-2">
                <Select
                  value={copyFromClass}
                  onValueChange={(v) => {
                    setCopyFromClass(v);
                    setCopyFromSection("");
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={copyFromSection}
                  onValueChange={setCopyFromSection}
                  disabled={!copyFromClass}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {copyFromClassObj?.sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                To
              </p>
              <div className="flex gap-2">
                <Select
                  value={copyToClass}
                  onValueChange={(v) => {
                    setCopyToClass(v);
                    setCopyToSection("");
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={copyToSection}
                  onValueChange={setCopyToSection}
                  disabled={!copyToClass}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {copyToClassObj?.sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setCopyOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleCopy}
              disabled={
                !copyFromClass ||
                !copyFromSection ||
                !copyToClass ||
                !copyToSection
              }
            >
              <Copy className="mr-1 size-3.5" />
              Copy Timetable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
