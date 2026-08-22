import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  MessageSquare,
  PartyPopper,
  PhoneOff,
  ScanLine,
  Search,
  Send,
  Settings2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatWeekday, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";

const ESCALATION_STYLES: Record<string, string> = {
  warning: "bg-sky-100 text-sky-800 border-sky-200",
  alert: "bg-amber-100 text-amber-800 border-amber-200",
  meeting: "bg-rose-100 text-rose-800 border-rose-200",
  none: "bg-transparent text-muted-foreground border-transparent",
};

const ESCALATION_RULES = [
  { threshold: 3, label: "3 late arrivals", level: "Warning", className: "bg-sky-100 text-sky-800" },
  { threshold: 5, label: "5 late arrivals", level: "Parent + Principal Alert", className: "bg-amber-100 text-amber-800" },
  { threshold: 8, label: "8 late arrivals", level: "Meeting Request", className: "bg-rose-100 text-rose-800" },
];

type LateRow = {
  studentId: Id<"students">;
  name: string;
  rollNumber: string;
  section: string;
  className: string;
  arrivalTime: string | null;
  lateByMinutes: number | null;
  remarks: string;
  thisMonth: number;
  escalation: { level: string; label: string };
  phone: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** "08:48" -> "8:48 AM" */
function timeLabel(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/* ---------------- Log arrival dialog ---------------- */

function LogArrivalDialog({
  student,
  date,
  onOpenChange,
}: {
  student: (ReturnType<typeof studentsShape>[number] & { className: string }) | null;
  date: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [arrival, setArrival] = useState(nowTime());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const markAttendance = useMutation(api.attendance.mark);

  const handleSave = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await markAttendance({
        studentId: student._id,
        date,
        status: "late",
        arrivalTime: arrival,
        remarks: reason.trim() || undefined,
      });
      toast.success(
        `${student.name} logged at ${timeLabel(arrival)} — ${student.className} · Section ${student.section}.`,
        { description: "Marked as late; the Late Comers list updates automatically." },
      );
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not log the arrival.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={student !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log arrival</DialogTitle>
          <DialogDescription>
            {student ? `${student.name} · Roll ${student.rollNumber} · ${student.className} · Section ${student.section}` : ""}{" "}
            for {formatDate(date)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="log-arrival-time">Arrival time *</Label>
            <Input
              id="log-arrival-time"
              type="time"
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="log-arrival-reason">Reason (optional)</Label>
            <Input
              id="log-arrival-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Traffic, bus late, overslept…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="cursor-pointer" onClick={handleSave} disabled={saving || !arrival}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {saving ? "Logging…" : "Log arrival"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Local type helper so LogArrivalDialog's prop reads cleanly.
type StudentDoc = { _id: Id<"students">; name: string; rollNumber: string; section: string; className: string; phone?: string };
function studentsShape() {
  return [] as StudentDoc[];
}

/* ---------------- Page ---------------- */

export default function LateComers() {
  const [date, setDate] = useState(todayStr());
  const late = useQuery(api.attendance.lateComers, { date });
  const settings = useQuery(api.settings.get);
  const allStudents = useQuery(api.students.list, { status: "active" }) ?? [];

  // ---- Log-arrival search ----
  const [query, setQuery] = useState("");
  const [logging, setLogging] = useState<StudentDoc | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateTime, setGateTime] = useState("");

  // ---- Text action ----
  const sendLateAlert = useAction(api.sms.sendLateAlert);
  const [sendingTo, setSendingTo] = useState<Id<"students"> | null>(null);

  const setLateGateTime = useMutation(api.settings.setLateGateTime);
  const [savingGate, setSavingGate] = useState(false);

  const gate = settings?.lateGateTime ?? "08:00";

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allStudents
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, allStudents]);

  const openLogDialog = (student: StudentDoc) => {
    setLogging(student);
    setQuery("");
  };

  const handleQueryKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && matches.length > 0) {
      event.preventDefault();
      openLogDialog(matches[0]);
    }
  };

  const handleSendAlert = async (row: LateRow, channel: "whatsapp" | "sms") => {
    if (sendingTo !== null) return;
    setSendingTo(row.studentId);
    try {
      const result = await sendLateAlert({ studentId: row.studentId, date, channel });
      if (result.success) {
        toast.success(
          `${channel === "whatsapp" ? "WhatsApp" : "SMS"} sent to ${row.name}'s parent.`,
          { description: result.to ? `To ${result.to}` : undefined },
        );
      } else {
        toast.error(`Could not send to ${row.name}'s parent.`, {
          description: result.message,
        });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send the alert.");
    } finally {
      setSendingTo(null);
    }
  };

  const handleSaveGate = async () => {
    setSavingGate(true);
    try {
      await setLateGateTime({ time: gateTime });
      toast(`Gate time updated to ${timeLabel(gateTime)}.`, {
        description: "Arrivals after this time count as late.",
      });
      setGateOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update the gate time.");
    } finally {
      setSavingGate(false);
    }
  };

  const unconfigured = (late ?? []).some((row) => row.phone && false); // placeholder, replaced below

  return (
    <AppShell title="Late Comers">
      <div className="flex flex-col gap-5">
        {/* Banner */}
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Late Arrivals — {formatWeekday(date)}, {formatDate(date)}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlarmClock className="size-3.5" />
                Auto-detected after {timeLabel(gate)} gate time
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="grid gap-1.5">
                <label htmlFor="late-date" className="text-xs font-medium text-muted-foreground">
                  Date
                </label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="late-date"
                    type="date"
                    value={date}
                    max={todayStr()}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 sm:w-44"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setGateTime(gate);
                  setGateOpen(true);
                }}
                title="Change the time after which arrivals count as late"
              >
                <Settings2 className="size-4" />
                Gate time
              </Button>
              <Button className="cursor-pointer" onClick={() => setLogging({} as StudentDoc)}>
                <UserPlus className="size-4" />
                Log arrival
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleQueryKeyDown}
              placeholder="Scan student barcode / ID card or type admission no, then press Enter"
              className="pl-9"
              aria-label="Find a student to log their arrival"
            />
            {query.trim() !== "" && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-card shadow-lg">
                {matches.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No students found.</p>
                ) : (
                  <ul className="divide-y">
                    {matches.map((student) => (
                      <li key={student._id}>
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                          onClick={() => openLogDialog(student)}
                        >
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">
                              {initials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-semibold">{student.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              Roll {student.rollNumber} · {student.className} · Section {student.section}
                            </span>
                          </span>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                            {student.phone || "No phone"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {late === undefined || settings === undefined ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : late.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <PartyPopper className="size-6" />
            </div>
            <p className="text-sm font-semibold">No late comers 🎉</p>
            <p className="text-xs text-muted-foreground">
              Every student arrived before {timeLabel(gate)} on {formatDate(date)}.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {late.length} late arrival{late.length === 1 ? "" : "s"} after {timeLabel(gate)} —{" "}
                {late.filter((row) => row.thisMonth >= 5).length} at or above the Parent + Principal
                Alert level this month.
              </p>

              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Arrival</TableHead>
                      <TableHead>Late by</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>This month</TableHead>
                      <TableHead>Escalation</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {late.map((row) => (
                      <TableRow key={row.studentId}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-8 shrink-0">
                              <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">
                                {initials(row.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="leading-tight">
                              <p className="font-semibold">{row.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Roll {row.rollNumber} · {row.className} · {row.section}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.arrivalTime ? timeLabel(row.arrivalTime) : "—"}
                        </TableCell>
                        <TableCell>
                          {row.lateByMinutes !== null ? (
                            <span className="font-semibold text-red-600">
                              {row.lateByMinutes} min
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-44">
                          {row.remarks ? (
                            <span className="text-xs text-muted-foreground">{row.remarks}</span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground/60">
                              Not given
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{row.thisMonth}</span>
                        </TableCell>
                        <TableCell>
                          {row.escalation.level === "none" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                ESCALATION_STYLES[row.escalation.level],
                              )}
                            >
                              {row.escalation.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {row.phone ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="cursor-pointer"
                                    disabled={sendingTo !== null}
                                  >
                                    {sendingTo === row.studentId ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <Send className="size-3.5" />
                                    )}
                                    Text
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={sendingTo !== null}
                                    onClick={() => handleSendAlert(row, "whatsapp")}
                                  >
                                    <MessageCircle className="size-4" />
                                    WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={sendingTo !== null}
                                    onClick={() => handleSendAlert(row, "sms")}
                                  >
                                    <MessageSquare className="size-4" />
                                    SMS
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <PhoneOff className="size-3.5" />
                                No phone on file
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {late.map((row) => (
                  <li key={row.studentId} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="size-9 shrink-0">
                          <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">
                            {initials(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-sm font-semibold">{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Roll {row.rollNumber} · {row.className} · {row.section}
                          </p>
                        </div>
                      </div>
                      {row.escalation.level !== "none" && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            ESCALATION_STYLES[row.escalation.level],
                          )}
                        >
                          {row.escalation.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-secondary/50 px-2 py-2">
                        <p className="text-xs font-semibold">
                          {row.arrivalTime ? timeLabel(row.arrivalTime) : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Arrival</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 px-2 py-2">
                        <p className="text-xs font-semibold text-red-600">
                          {row.lateByMinutes !== null ? `${row.lateByMinutes} min` : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Late by</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 px-2 py-2">
                        <p className="text-xs font-semibold">{row.thisMonth}</p>
                        <p className="text-[10px] text-muted-foreground">This month</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.remarks || (
                        <span className="italic text-muted-foreground/60">Reason not given</span>
                      )}
                    </p>
                    {row.phone ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 cursor-pointer"
                          disabled={sendingTo !== null}
                          onClick={() => handleSendAlert(row, "whatsapp")}
                        >
                          {sendingTo === row.studentId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="size-3.5" />
                          )}
                          Text WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 cursor-pointer"
                          disabled={sendingTo !== null}
                          onClick={() => handleSendAlert(row, "sms")}
                        >
                          <MessageSquare className="size-3.5" />
                          SMS
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <PhoneOff className="size-3.5" />
                        No phone on file
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Escalation rules */}
            <aside className="h-fit rounded-xl border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4 text-primary" />
                Escalation Rules
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on late arrivals in the current month.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {ESCALATION_RULES.map((rule) => (
                  <li
                    key={rule.threshold}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <span className="text-xs font-medium">{rule.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        rule.className,
                      )}
                    >
                      {rule.level}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                Students reaching a level show the matching badge on their row so the office can
                follow up with parents and the principal.
              </p>
            </aside>
          </div>
        )}

        {/* Twilio config hint */}
        {late !== undefined && late.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <AlarmClock className="mt-0.5 size-4 shrink-0" />
            <span>
              The <strong>Text</strong> button sends the parent an instant{" "}
              <strong>WhatsApp or SMS</strong> message about today&apos;s late arrival. It needs
              Twilio configured (<code className="font-mono">TWILIO_ACCOUNT_SID</code>,{" "}
              <code className="font-mono">TWILIO_AUTH_TOKEN</code>,{" "}
              <code className="font-mono">TWILIO_PHONE_NUMBER</code> in the project Keys tab).
              Attendance saves also queue alerts automatically for Absent / Late / Leave with a
              reason.
            </span>
          </div>
        )}
      </div>

      {/* Log arrival dialog */}
      {logging && (
        <LogArrivalDialog
          student={logging}
          date={date}
          onOpenChange={(open) => {
            if (!open) setLogging(null);
          }}
        />
      )}

      {/* Gate time dialog */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gate time</DialogTitle>
            <DialogDescription>
              Arrivals after this time are counted as late. Applies to every class.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="gate-time">Time</Label>
            <Input
              id="gate-time"
              type="time"
              value={gateTime}
              onChange={(e) => setGateTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setGateOpen(false)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleSaveGate} disabled={savingGate || !gateTime}>
              {savingGate && <Loader2 className="size-4 animate-spin" />}
              Save gate time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
