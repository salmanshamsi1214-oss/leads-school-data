import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardCheck,
  Loader2,
  MessageSquareText,
  Send,
  UserRoundPlus,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
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
import { STATUS_META, STATUS_ORDER } from "@/lib/attendance";
import { formatDate, todayStr } from "@/lib/format";
import { whatsappLink } from "@/lib/school";
import { cn } from "@/lib/utils";

/** Statuses that must carry a written reason. */
const REASON_STATUSES: AttendanceStatus[] = ["absent", "late", "leave"];

const REASON_PLACEHOLDERS: Partial<Record<AttendanceStatus, string>> = {
  absent: "e.g. sick, family trip…",
  late: "e.g. bus late, traffic jam…",
  leave: "e.g. annual leave, medical…",
};

/** Current local time as HH:MM (24h) — the default arrival time for late marks. */
function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function StatusToggle({
  value,
  onChange,
  compact = false,
}: {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Attendance status"
      className="flex shrink-0 gap-1 rounded-lg border bg-secondary/50 p-1"
    >
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            title={meta.label}
            aria-label={meta.label}
            aria-pressed={active}
            onClick={() => onChange(status)}
            className={cn(
              "flex items-center justify-center rounded-md px-2 text-xs font-bold transition-colors sm:px-3 sm:py-1",
              compact ? "h-9 w-9" : "h-10",
              active ? meta.solid : "text-muted-foreground hover:bg-background",
            )}
          >
            {compact ? meta.short : (
              <>
                <span className="sm:hidden">{meta.short}</span>
                <span className="hidden sm:inline">{meta.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function Attendance() {
  const classes = useQuery(api.classes.list) ?? [];
  const [date, setDate] = useState(todayStr());
  const [classId, setClassId] = useState<string>("");
  const [section, setSection] = useState<string>("all");

  const students = useQuery(
    api.students.list,
    classId
      ? {
          classId: classId as never,
          section: section === "all" ? undefined : section,
          status: "active",
        }
      : "skip",
  );
  const savedRecords = useQuery(
    api.attendance.byDate,
    date ? { date } : "skip",
  );

  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [arrivalMap, setArrivalMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const saveAll = useMutation(api.attendance.markAll);
  const alerts = useQuery(api.attendance.alertsByDate, { date });
  const sendAlerts = useMutation(api.attendance.sendAlerts);
  const [sendingAlerts, setSendingAlerts] = useState(false);

  // Sync the working status + reason maps whenever the roster or saved records
  // change, so previously saved reasons reappear when revisiting a date. This
  // uses React's documented "adjust state during render" pattern — no effect,
  // no cascading renders, and unsaved edits survive background refetches.
  const [lastSyncKey, setLastSyncKey] = useState<string>("");
  const syncKey = useMemo(() => {
    if (!students || !savedRecords) return "";
    return students.map((s) => s._id).join("|") + "||" + JSON.stringify(savedRecords);
  }, [students, savedRecords]);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (students && savedRecords) {
      const next: Record<string, AttendanceStatus> = {};
      const nextRemarks: Record<string, string> = {};
      const nextArrival: Record<string, string> = {};
      for (const student of students) {
        next[student._id] =
          (savedRecords[student._id]?.status as AttendanceStatus | undefined) ?? "present";
        nextRemarks[student._id] = savedRecords[student._id]?.remarks ?? "";
        nextArrival[student._id] = savedRecords[student._id]?.arrivalTime ?? "";
      }
      setStatusMap(next);
      setRemarksMap(nextRemarks);
      setArrivalMap(nextArrival);
    }
  }

  const selectedClass = classes.find((cls) => cls._id === classId);
  const sectionOptions = selectedClass?.sections ?? [];

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };
    for (const status of Object.values(statusMap)) {
      result[status] += 1;
    }
    return result;
  }, [statusMap]);

  const isDirty = useMemo(() => {
    if (!students || !savedRecords) return false;
    return students.some((student) => {
      const saved = savedRecords[student._id];
      return (
        (saved?.status as AttendanceStatus | undefined) !== statusMap[student._id] ||
        (saved?.remarks ?? "") !== (remarksMap[student._id] ?? "") ||
        (saved?.arrivalTime ?? "") !== (arrivalMap[student._id] ?? "")
      );
    });
  }, [students, savedRecords, statusMap, remarksMap, arrivalMap]);

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
    if (status === "present") {
      setRemarksMap((prev) => ({ ...prev, [studentId]: "" }));
      setArrivalMap((prev) => ({ ...prev, [studentId]: "" }));
    } else if (status === "late") {
      // Default the arrival time to now; staff can adjust it.
      setArrivalMap((prev) => ({ ...prev, [studentId]: prev[studentId] || nowTime() }));
    }
  };

  const setArrival = (studentId: string, arrival: string) => {
    setArrivalMap((prev) => ({ ...prev, [studentId]: arrival }));
  };

  const setRemarks = (studentId: string, remarks: string) => {
    setRemarksMap((prev) => ({ ...prev, [studentId]: remarks }));
  };

  // Absent / leave / late students must carry a reason before saving.
  const missingReasons = useMemo(() => {
    if (!students) return [];
    return students.filter((student) => {
      const status = statusMap[student._id] ?? "present";
      return (
        REASON_STATUSES.includes(status) &&
        (remarksMap[student._id] ?? "").trim().length === 0
      );
    });
  }, [students, statusMap, remarksMap]);

  const markAllPresent = () => {
    if (!students) return;
    setStatusMap(
      Object.fromEntries(students.map((student) => [student._id, "present" as AttendanceStatus])),
    );
    setRemarksMap({});
    setArrivalMap({});
  };

  const handleSave = async () => {
    if (!students || students.length === 0) return;
    setSaving(true);
    try {
      const entries = students.map((student) => {
        const status = statusMap[student._id] ?? "present";
        const entry: {
          studentId: typeof student._id;
          status: AttendanceStatus;
          arrivalTime?: string;
          remarks?: string;
        } = { studentId: student._id, status };
        if (status === "late" && (arrivalMap[student._id] ?? "").trim()) {
          entry.arrivalTime = (arrivalMap[student._id] ?? "").trim();
        }
        if (status !== "present") {
          entry.remarks = (remarksMap[student._id] ?? "").trim();
        }
        return entry;
      });
      await saveAll({ date, entries });
      const alertCount = counts.absent + counts.late + counts.leave;
      toast(`Attendance saved for ${selectedClass?.name ?? ""} · ${formatDate(date)}.`, {
        description:
          `${counts.present} present · ${counts.absent} absent · ${counts.late} late · ${counts.leave} leave` +
          (alertCount > 0
            ? ` — WhatsApp alert${alertCount === 1 ? "" : "s"} queued for ${alertCount} parent${alertCount === 1 ? "" : "s"}`
            : ""),
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const rosterReady = students !== undefined && savedRecords !== undefined;

  const alertRows = alerts ?? [];
  // Students currently marked with a status that triggers a parent alert.
  const alertableCount = counts.absent + counts.late + counts.leave;
  const unconfigured = alertRows.some(
    (row) => row.state === "failed" && row.error === "unconfigured",
  );

  const handleSendAlerts = async () => {
    setSendingAlerts(true);
    try {
      const queued = await sendAlerts({ date, channel: "whatsapp" });
      toast(
        queued > 0
          ? `${queued} WhatsApp alert${queued === 1 ? "" : "s"} queued for ${formatDate(date)}.`
          : `No new alerts to send for ${formatDate(date)} — parents already notified.`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send alerts.");
    } finally {
      setSendingAlerts(false);
    }
  };

  const alertStateChip = (row: {
    state: string;
    error?: string;
  }): { label: string; className: string; title?: string } => {
    if (row.state === "sent") {
      return { label: "Sent ✓", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (row.state === "sending") {
      return { label: "Sending…", className: "bg-amber-100 text-amber-800 border-amber-200" };
    }
    if (row.error === "no_phone") {
      return { label: "No phone", className: "bg-slate-100 text-slate-600 border-slate-300" };
    }
    if (row.error === "unconfigured") {
      return { label: "Not configured", className: "bg-red-100 text-red-800 border-red-200" };
    }
    return {
      label: "Failed",
      className: "bg-red-100 text-red-800 border-red-200",
      title: row.error,
    };
  };

  return (
    <AppShell title="Mark Attendance">
      <div className="flex flex-col gap-5">
        {/* Controls */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <label htmlFor="attendance-date" className="text-xs font-medium text-muted-foreground">
              Date
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="attendance-date"
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="attendance-class" className="text-xs font-medium text-muted-foreground">
              Class
            </label>
            <Select
              value={classId}
              onValueChange={(value) => {
                setClassId(value);
                setSection("all");
              }}
            >
              <SelectTrigger id="attendance-class">
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
            <label htmlFor="attendance-section" className="text-xs font-medium text-muted-foreground">
              Section
            </label>
            <Select value={section} onValueChange={setSection} disabled={!selectedClass}>
              <SelectTrigger id="attendance-section">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sectionOptions.map((sectionName) => (
                  <SelectItem key={sectionName} value={sectionName}>
                    Section {sectionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer"
              onClick={markAllPresent}
              disabled={!rosterReady || (students?.length ?? 0) === 0}
            >
              <Check className="size-4" />
              Mark all present
            </Button>
          </div>
        </div>

        {/* Status summary bar */}
        {rosterReady && students !== undefined && students.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
            <span className="font-semibold">
              {students.length} student{students.length === 1 ? "" : "s"}
            </span>
            <span className="text-muted-foreground">·</span>
            {STATUS_ORDER.map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", STATUS_META[status].dot)} />
                <span className="font-medium">
                  {counts[status]} {STATUS_META[status].label.toLowerCase()}
                </span>
              </span>
            ))}
            {isDirty && (
              <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Unsaved changes
              </span>
            )}
          </div>
        )}

        {/* Missing reasons warning */}
        {rosterReady && missingReasons.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              {missingReasons.length} student{missingReasons.length === 1 ? "" : "s"}{" "}
              {missingReasons.length === 1 ? "needs" : "need"} a reason — Absent, Late
              and Leave entries require one before saving.
            </span>
          </div>
        )}

        {/* Roster */}
        {!classId ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">Choose a class to begin</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a class and section, then mark each student&apos;s status for {formatDate(date)}.
              </p>
            </div>
          </div>
        ) : !rosterReady ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRoundPlus className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No active students here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedClass?.name} has no active students in this view.
              </p>
            </div>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/students">Add students</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border">
              <ul className="divide-y">
                {students.map((student, index) => {
                  const status = statusMap[student._id] ?? "present";
                  const needsReason = REASON_STATUSES.includes(status);
                  const reasonMissing =
                    needsReason && (remarksMap[student._id] ?? "").trim().length === 0;
                  return (
                    <li key={student._id} className="flex flex-col gap-3 bg-card px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-sm font-semibold">{student.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Roll {student.rollNumber}
                              {student.section ? ` · Section ${student.section}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end sm:justify-start">
                          <div className="flex items-center gap-2">
                            <StatusToggle
                              value={status}
                              onChange={(nextStatus) => setStatus(student._id, nextStatus)}
                            />
                            {status !== "present" && student.phone && (
                              <a
                                href={whatsappLink(
                                  student.phone,
                                  [
                                    `LEADS School System - Zeenat Campus`,
                                    `Attendance - ${formatDate(date)}`,
                                    `${student.name} (Roll ${student.rollNumber || "-"})`,
                                    `${selectedClass?.name ?? ""} - Section ${student.section}`,
                                    `Status: ${STATUS_META[status].label}`,
                                    (remarksMap[student._id] ?? "") ? `Reason: ${remarksMap[student._id]}` : "",
                                    `Office: 0332-6241440`,
                                  ].filter(Boolean).join("\n"),
                                ) ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
                                title={`Send WhatsApp to ${student.name}`}
                              >
                                <MessageSquareText className="size-3" />
                                WA
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {needsReason && (
                        <div className="flex flex-col gap-2 pl-9 sm:flex-row sm:items-center">
                          <span className="hidden w-24 shrink-0 text-xs font-medium text-muted-foreground sm:block">
                            {STATUS_META[status].label} reason
                          </span>
                          <div className="flex flex-1 items-center gap-2">
                            <Input
                              value={remarksMap[student._id] ?? ""}
                              onChange={(e) => setRemarks(student._id, e.target.value)}
                              placeholder={REASON_PLACEHOLDERS[status]}
                              aria-label={`${STATUS_META[status].label} reason for ${student.name}`}
                              aria-invalid={reasonMissing}
                              className={cn("h-9", reasonMissing && "border-red-400")}
                            />
                            {reasonMissing && (
                              <span className="shrink-0 text-xs font-medium text-red-500">
                                Required
                              </span>
                            )}
                          </div>
                          {status === "late" && (
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                                Arrival
                              </span>
                              <Input
                                type="time"
                                value={arrivalMap[student._id] ?? ""}
                                onChange={(e) => setArrival(student._id, e.target.value)}
                                aria-label={`Arrival time for ${student.name}`}
                                className="h-9 w-32"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="sticky bottom-4 z-10 flex justify-end">
              <Button
                size="lg"
                className="cursor-pointer shadow-lg"
                onClick={handleSave}
                disabled={saving || !isDirty || missingReasons.length > 0}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {saving ? "Saving…" : isDirty ? "Save attendance" : "Saved ✓"}
              </Button>
            </div>
          </>
        )}

        {/* Parent WhatsApp alerts */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <MessageSquareText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Parent WhatsApp alerts</h2>
            {alertRows.length > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {alertRows.length}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {alertableCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {alertableCount} will be notified on save
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={handleSendAlerts}
                disabled={sendingAlerts || alertableCount === 0}
              >
                {sendingAlerts ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {sendingAlerts ? "Sending…" : "Send now"}
              </Button>
              {students && students.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    const nonPresent = students.filter((s) => {
                      const st = statusMap[s._id] ?? "present";
                      return st !== "present" && s.phone;
                    });
                    if (nonPresent.length === 0) {
                      toast("No absent/late/leave students with phone numbers.");
                      return;
                    }
                    for (const s of nonPresent) {
                      const st = statusMap[s._id] ?? "present";
                      const msg = [
                        `LEADS School System - Zeenat Campus`,
                        `Attendance - ${formatDate(date)}`,
                        `${s.name} (Roll ${s.rollNumber || "-"})`,
                        `${selectedClass?.name ?? ""} - Section ${s.section}`,
                        `Status: ${STATUS_META[st].label}`,
                        (remarksMap[s._id] ?? "") ? `Reason: ${remarksMap[s._id]}` : "",
                        `Office: 0332-6241440`,
                      ].filter(Boolean).join("\n");
                      const link = whatsappLink(s.phone ?? "", msg);
                      if (link) window.open(link, "_blank");
                    }
                  }}
                  disabled={alertableCount === 0}
                >
                  <MessageSquareText className="size-3.5" />
                  WhatsApp All ({alertableCount})
                </Button>
              )}
            </div>
          </div>

          {alerts === undefined ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : alertRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {alertableCount === 0
                ? "No alerts for " +
                  formatDate(date) +
                  " — Absent, Late and Leave students automatically get a WhatsApp message (with the reason) when attendance is saved."
                : "Alerts appear here after you save attendance or press “Send now”."}
            </p>
          ) : (
            <ul className="divide-y">
              {alertRows.map((row) => {
                const chip = alertStateChip(row);
                return (
                  <li
                    key={`${row.studentId}-${date}`}
                    className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-semibold">{row.studentName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            STATUS_META[row.status].chip,
                          )}
                        >
                          {STATUS_META[row.status].label}
                        </span>
                        <span className="truncate italic">“{row.remarks}”</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">{row.channel}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          chip.className,
                        )}
                        title={chip.title}
                      >
                        {chip.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {unconfigured && (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              <strong>Twilio is not configured yet.</strong> Add{" "}
              <code className="font-mono">TWILIO_ACCOUNT_SID</code>,{" "}
              <code className="font-mono">TWILIO_AUTH_TOKEN</code> and{" "}
              <code className="font-mono">TWILIO_PHONE_NUMBER</code> in the project{" "}
              Keys tab, then press “Send now” — messages go out over WhatsApp (or
              SMS) to the phone numbers on student records.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
