import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { OFFICE_ROLES } from "@/lib/roles";
import { formatDate, toIsoDate, todayStr } from "@/lib/format";

/** Monday of the week containing the given ISO date. */
function mondayOf(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
}

function addDays(iso: string, n: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + n);
  return toIsoDate(date);
}

type WeeklySubject = { subject: string; work: string };

const COMMON_SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Social Studies",
  "Islamiyat",
  "Computer",
];

/** Builds the WhatsApp message text for a weekly diary entry. */
function weeklyDiaryMessage(entry: {
  className: string;
  section: string;
  weekStart: string;
  weekEnd: string;
  entries?: WeeklySubject[];
}): string {
  const lines = [
    `📚 Weekly Diary · ${entry.className} · Section ${entry.section}`,
    `Week of ${formatDate(entry.weekStart)} – ${formatDate(entry.weekEnd)}`,
    "",
    ...(entry.entries ?? []).map(
      (subject) => `${subject.subject.toUpperCase()}:\n${subject.work}`,
    ),
  ];
  return lines.join("\n");
}

/** Sends a weekly diary page to the class's parents over WhatsApp. */
function WeeklyWhatsAppButton({
  entry,
}: {
  entry: {
    className: string;
    classId: Id<"classes">;
    section: string;
    weekStart: string;
    weekEnd: string;
    entries?: WeeklySubject[];
  };
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendMessage = useMutation(api.messages.send);

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendMessage({
        body: weeklyDiaryMessage(entry),
        channel: "whatsapp",
        scope: { type: "class", classId: entry.classId, section: entry.section },
      });
      toast(
        `Diary sent — ${result.recipientCount} parent${
          result.recipientCount === 1 ? "" : "s"
        } will receive it on WhatsApp${
          result.noPhoneCount > 0
            ? ` (${result.noPhoneCount} student${result.noPhoneCount === 1 ? "" : "s"} without a phone number)`
            : ""
        }.`,
      );
      setOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send the diary.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Send className="size-4" />
        <span className="hidden sm:inline">WhatsApp</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this week&apos;s diary to parents?</AlertDialogTitle>
            <AlertDialogDescription>
              Parents of {entry.className} · Section {entry.section} will receive the full
              week&apos;s assignments on WhatsApp. Track delivery in the Messages module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={sending}
              onClick={async (event) => {
                event.preventDefault();
                await handleSend();
              }}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Sending…" : "Send to parents"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EntryMeta({ updatedAt }: { updatedAt: number }) {
  const label = useMemo(() => {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [updatedAt]);
  return <span className="text-xs text-muted-foreground">Updated {label}</span>;
}

function DeleteEntryButton({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 cursor-pointer text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        <span className="hidden sm:inline">Delete</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {label} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async (event) => {
                event.preventDefault();
                setDeleting(true);
                try {
                  await onConfirm();
                  toast("Diary entry deleted.");
                  setOpen(false);
                } catch (error) {
                  toast(error instanceof Error ? error.message : "Could not delete entry.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Diary() {
  const { user } = useAuth();
  const isOffice = user?.role !== undefined && OFFICE_ROLES.includes(user.role);
  const classes = useQuery(api.classes.list) ?? [];

  // ---- Daily tab state ----
  const [dailyDate, setDailyDate] = useState(todayStr());
  const [dailyClass, setDailyClass] = useState<string>("");
  const [dailySection, setDailySection] = useState<string>("");
  const [dailyForm, setDailyForm] = useState({
    editingId: "",
    summary: "",
    homework: "",
  });
  const [savingDaily, setSavingDaily] = useState(false);
  const saveDaily = useMutation(api.diary.dailySave);
  const removeDaily = useMutation(api.diary.dailyRemove);

  const dailyEntries = useQuery(
    api.diary.dailyList,
    dailyDate ? { from: dailyDate, to: dailyDate } : "skip",
  );

  // The existing entry for the selected class/section/date, if any.
  const existingDaily = useMemo(() => {
    if (!dailyEntries || !dailyClass || !dailySection) return undefined;
    return dailyEntries.find(
      (entry) =>
        entry.classId === dailyClass &&
        entry.section === dailySection &&
        entry.date === dailyDate,
    );
  }, [dailyEntries, dailyClass, dailySection, dailyDate]);

  // Keep the form bound to the current entry using React's documented
  // "adjust state during render" pattern (no effect): whenever the form isn't
  // bound to the entry for the selected class/section/date, reset or prefill
  // it. The list query arrives asynchronously, so this also picks up an
  // existing entry right after the target changes.
  const existingDailyId = existingDaily?._id ?? "";
  if (dailyForm.editingId !== existingDailyId) {
    setDailyForm(
      existingDaily
        ? {
            editingId: existingDaily._id,
            summary: existingDaily.summary,
            homework: existingDaily.homework ?? "",
          }
        : { editingId: "", summary: "", homework: "" },
    );
  }

  const selectedDailyClass = classes.find((cls) => cls._id === dailyClass);
  const dailySections = selectedDailyClass?.sections ?? [];

  const handleDailyClassChange = (value: string) => {
    setDailyClass(value);
    const cls = classes.find((c) => c._id === value);
    setDailySection(cls?.sections[0] ?? "");
  };

  const handleSaveDaily = async () => {
    if (!dailyClass || !dailySection || !dailyDate) return;
    setSavingDaily(true);
    try {
      await saveDaily({
        id: dailyForm.editingId
          ? (dailyForm.editingId as Id<"dailyDiary">)
          : undefined,
        classId: dailyClass as never,
        section: dailySection,
        date: dailyDate,
        summary: dailyForm.summary,
        homework: dailyForm.homework,
      });
      toast(
        `Daily diary saved · ${selectedDailyClass?.name}${dailySection ? `-${dailySection}` : ""} · ${formatDate(dailyDate)}`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the diary entry.");
    } finally {
      setSavingDaily(false);
    }
  };

  // ---- Weekly tab state ----
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayStr()));
  const [weeklyClass, setWeeklyClass] = useState<string>("");
  const [weeklySection, setWeeklySection] = useState<string>("");
  const [weeklyForm, setWeeklyForm] = useState<{
    editingId: string;
    entries: WeeklySubject[];
    summary: string;
    nextWeek: string;
  }>({ editingId: "", entries: [], summary: "", nextWeek: "" });
  const [savingWeekly, setSavingWeekly] = useState(false);
  const saveWeekly = useMutation(api.diary.weeklySave);
  const removeWeekly = useMutation(api.diary.weeklyRemove);

  const weeklyEntries = useQuery(api.diary.weeklyList, {
    from: weekStart,
    to: weekStart,
  });

  const existingWeekly = useMemo(() => {
    if (!weeklyEntries || !weeklyClass || !weeklySection) return undefined;
    return weeklyEntries.find(
      (entry) =>
        entry.classId === weeklyClass &&
        entry.section === weeklySection &&
        entry.weekStart === weekStart,
    );
  }, [weeklyEntries, weeklyClass, weeklySection, weekStart]);

  const existingWeeklyId = existingWeekly?._id ?? "";
  if (weeklyForm.editingId !== existingWeeklyId) {
    setWeeklyForm(
      existingWeekly
        ? {
            editingId: existingWeekly._id,
            entries: (existingWeekly.entries ?? []).map((entry) => ({
              subject: entry.subject,
              work: entry.work,
            })),
            summary: existingWeekly.summary ?? "",
            nextWeek: existingWeekly.nextWeek ?? "",
          }
        : { editingId: "", entries: [], summary: "", nextWeek: "" },
    );
  }

  const selectedWeeklyClass = classes.find((cls) => cls._id === weeklyClass);
  const weeklySections = selectedWeeklyClass?.sections ?? [];
  const weekEnd = weekStart ? addDays(weekStart, 6) : "";

  const handleWeeklyClassChange = (value: string) => {
    setWeeklyClass(value);
    const cls = classes.find((c) => c._id === value);
    setWeeklySection(cls?.sections[0] ?? "");
  };

  const handleSaveWeekly = async () => {
    if (!weeklyClass || !weeklySection || !weekStart || !weekEnd) return;
    const entries = weeklyForm.entries
      .map((entry) => ({ subject: entry.subject.trim(), work: entry.work.trim() }))
      .filter((entry) => entry.subject !== "" && entry.work !== "");
    if (entries.length === 0) {
      toast("Add at least one subject with work assigned.");
      return;
    }
    setSavingWeekly(true);
    try {
      await saveWeekly({
        id: weeklyForm.editingId
          ? (weeklyForm.editingId as Id<"weeklyDiary">)
          : undefined,
        classId: weeklyClass as never,
        section: weeklySection,
        weekStart,
        weekEnd,
        entries,
        summary: weeklyForm.summary,
        nextWeek: weeklyForm.nextWeek,
      });
      toast(
        `Weekly diary saved · ${selectedWeeklyClass?.name}${weeklySection ? `-${weeklySection}` : ""} · ${formatDate(weekStart)}–${formatDate(weekEnd)}`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the diary entry.");
    } finally {
      setSavingWeekly(false);
    }
  };

  const updateWeeklyEntry = (index: number, patch: Partial<WeeklySubject>) => {
    setWeeklyForm((prev) => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    }));
  };

  const removeWeeklyEntry = (index: number) => {
    setWeeklyForm((prev) => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index),
    }));
  };

  const addWeeklySubject = (subject = "") => {
    setWeeklyForm((prev) => ({
      ...prev,
      entries: [...prev.entries, { subject, work: "" }],
    }));
  };

  return (
    <AppShell title="Diary">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <BookOpen className="size-4 shrink-0 text-primary" />
          Record what was taught and homework given — one daily diary per class per day, and a
          weekly summary per class.
        </div>

        <Tabs defaultValue="daily">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="daily">Daily Diary</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Diary</TabsTrigger>
          </TabsList>

          {/* ============================ DAILY ============================ */}
          <TabsContent value="daily" className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="daily-date">Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="daily-date"
                    type="date"
                    value={dailyDate}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="daily-class">Class</Label>
                <Select value={dailyClass} onValueChange={handleDailyClassChange}>
                  <SelectTrigger id="daily-class">
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
                <Label htmlFor="daily-section">Section</Label>
                <Select
                  value={dailySection}
                  onValueChange={setDailySection}
                  disabled={!selectedDailyClass}
                >
                  <SelectTrigger id="daily-section">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {dailySections.map((section) => (
                      <SelectItem key={section} value={section}>
                        Section {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!dailyClass ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BookOpen className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Choose a class to write the diary</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick a class and section, then note the day&apos;s work and homework.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Entry form */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        {selectedDailyClass?.name}
                        {dailySection ? ` · Section ${dailySection}` : ""}
                      </Badge>
                      <Badge variant="outline">{formatDate(dailyDate)}</Badge>
                      {existingDaily && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          Editing existing entry
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="daily-summary">Today&apos;s work</Label>
                      <Textarea
                        id="daily-summary"
                        rows={3}
                        placeholder="Subjects covered, activities, and anything notable from the day…"
                        value={dailyForm.summary}
                        onChange={(e) =>
                          setDailyForm((prev) => ({ ...prev, summary: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="daily-homework">Homework</Label>
                      <Textarea
                        id="daily-homework"
                        rows={2}
                        placeholder="Homework given to students (optional)…"
                        value={dailyForm.homework}
                        onChange={(e) =>
                          setDailyForm((prev) => ({ ...prev, homework: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="cursor-pointer"
                        onClick={handleSaveDaily}
                        disabled={savingDaily || dailyForm.summary.trim() === ""}
                      >
                        {savingDaily ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        {savingDaily ? "Saving…" : existingDaily ? "Update entry" : "Save entry"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Entries for the date */}
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Entries · {formatDate(dailyDate)}</h2>
                  <span className="text-xs text-muted-foreground">
                    {dailyEntries === undefined
                      ? ""
                      : `${dailyEntries.length} class${dailyEntries.length === 1 ? "" : "es"}`}
                  </span>
                </div>
                {dailyEntries === undefined ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : dailyEntries.length === 0 ? (
                  <div className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
                    No diary entries for this date yet.
                  </div>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-xl border">
                    {dailyEntries.map((entry) => (
                      <li key={entry._id} className="flex flex-col gap-2 bg-card px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                              {entry.className}
                              {entry.section ? ` · Section ${entry.section}` : ""}
                            </Badge>
                            <EntryMeta updatedAt={entry.updatedAt} />
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 cursor-pointer"
                              onClick={() => {
                                setDailyClass(entry.classId);
                                setDailySection(entry.section);
                                setDailyForm({
                                  editingId: entry._id,
                                  summary: entry.summary,
                                  homework: entry.homework ?? "",
                                });
                              }}
                            >
                              <Pencil className="size-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <DeleteEntryButton
                              label={`${entry.className}-${entry.section} diary for ${formatDate(entry.date)}`}
                              onConfirm={async () => {
                                await removeDaily({ id: entry._id });
                              }}
                            />
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{entry.summary}</p>
                        {entry.homework && (
                          <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                            <span className="font-semibold">Homework: </span>
                            <span className="whitespace-pre-wrap">{entry.homework}</span>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </TabsContent>

          {/* ============================ WEEKLY ============================ */}
          <TabsContent value="weekly" className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="weekly-start">Week starting</Label>
                <div className="relative">
                  <CalendarRange className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="weekly-start"
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="weekly-class">Class</Label>
                <Select value={weeklyClass} onValueChange={handleWeeklyClassChange}>
                  <SelectTrigger id="weekly-class">
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
                <Label htmlFor="weekly-section">Section</Label>
                <Select
                  value={weeklySection}
                  onValueChange={setWeeklySection}
                  disabled={!selectedWeeklyClass}
                >
                  <SelectTrigger id="weekly-section">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeklySections.map((section) => (
                      <SelectItem key={section} value={section}>
                        Section {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!weeklyClass ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BookOpen className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Choose a class for the weekly diary</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Summarize the week&apos;s work and plan ahead for the next week.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                      {selectedWeeklyClass?.name}
                      {weeklySection ? ` · Section ${weeklySection}` : ""}
                    </Badge>
                    <Badge variant="outline">
                      {weekStart && weekEnd
                        ? `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
                        : ""}
                    </Badge>
                    {existingWeekly && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                        Editing existing entry
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label>Subjects &amp; work for the week</Label>
                      {weeklyForm.entries.map((entry, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row"
                        >
                          <div className="grid gap-1.5 sm:w-44">
                            <Input
                              value={entry.subject}
                              placeholder="Subject"
                              onChange={(e) =>
                                updateWeeklyEntry(index, { subject: e.target.value })
                              }
                              aria-label={`Subject ${index + 1}`}
                            />
                          </div>
                          <div className="grid flex-1 gap-1.5">
                            <Input
                              value={entry.work}
                              placeholder="Work assigned this week…"
                              onChange={(e) =>
                                updateWeeklyEntry(index, { work: e.target.value })
                              }
                              aria-label={`Work for subject ${index + 1}`}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${entry.subject || "subject"}`}
                            onClick={() => removeWeeklyEntry(index)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => addWeeklySubject()}
                        >
                          <Plus className="size-3.5" /> Add subject
                        </Button>
                        <span className="px-1 text-xs text-muted-foreground">or</span>
                        {COMMON_SUBJECTS.filter(
                          (subject) =>
                            !weeklyForm.entries.some(
                              (entry) =>
                                entry.subject.trim().toLowerCase() === subject.toLowerCase(),
                            ),
                        ).map((subject) => (
                          <Button
                            key={subject}
                            variant="ghost"
                            size="sm"
                            className="h-7 cursor-pointer rounded-full border text-xs text-muted-foreground"
                            onClick={() => addWeeklySubject(subject)}
                          >
                            {subject}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="weekly-summary">Notes (optional)</Label>
                      <Textarea
                        id="weekly-summary"
                        rows={2}
                        placeholder="Anything else worth noting for the week…"
                        value={weeklyForm.summary}
                        onChange={(e) =>
                          setWeeklyForm((prev) => ({ ...prev, summary: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="weekly-next">Next week&apos;s plan (optional)</Label>
                      <Textarea
                        id="weekly-next"
                        rows={2}
                        placeholder="What will be covered next week…"
                        value={weeklyForm.nextWeek}
                        onChange={(e) =>
                          setWeeklyForm((prev) => ({ ...prev, nextWeek: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="cursor-pointer"
                        onClick={handleSaveWeekly}
                        disabled={
                          savingWeekly ||
                          !weeklyForm.entries.some(
                            (entry) =>
                              entry.subject.trim() !== "" && entry.work.trim() !== "",
                          )
                        }
                      >
                        {savingWeekly ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Plus className="size-4" />
                        )}
                        {savingWeekly ? "Saving…" : existingWeekly ? "Update entry" : "Save entry"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    Weekly entries · {weekStart ? formatDate(weekStart) : ""}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {weeklyEntries === undefined
                      ? ""
                      : `${weeklyEntries.length} class${weeklyEntries.length === 1 ? "" : "es"}`}
                  </span>
                </div>
                {weeklyEntries === undefined ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : weeklyEntries.length === 0 ? (
                  <div className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
                    No weekly diary entries for this week yet.
                  </div>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-xl border">
                    {weeklyEntries.map((entry) => {
                      const subjects = entry.entries ?? [];
                      return (
                        <li key={entry._id} className="flex flex-col gap-2 bg-card px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                                {entry.className}
                                {entry.section ? ` · Section ${entry.section}` : ""}
                              </Badge>
                              <Badge variant="outline">
                                {formatDate(entry.weekStart)} – {formatDate(entry.weekEnd)}
                              </Badge>
                              {subjects.length > 0 && (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                  {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                                </Badge>
                              )}
                              <EntryMeta updatedAt={entry.updatedAt} />
                            </div>
                            <div className="flex items-center gap-1">
                              {isOffice && (
                                <WeeklyWhatsAppButton
                                  entry={{
                                    className: entry.className,
                                    classId: entry.classId,
                                    section: entry.section,
                                    weekStart: entry.weekStart,
                                    weekEnd: entry.weekEnd,
                                    entries: subjects,
                                  }}
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 cursor-pointer"
                                onClick={() => {
                                  setWeeklyClass(entry.classId);
                                  setWeeklySection(entry.section);
                                  setWeekStart(entry.weekStart);
                                  setWeeklyForm({
                                    editingId: entry._id,
                                    entries: subjects.map((subject) => ({
                                      subject: subject.subject,
                                      work: subject.work,
                                    })),
                                    summary: entry.summary ?? "",
                                    nextWeek: entry.nextWeek ?? "",
                                  });
                                }}
                              >
                                <Pencil className="size-4" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <DeleteEntryButton
                                label={`${entry.className}-${entry.section} weekly diary`}
                                onConfirm={async () => {
                                  await removeWeekly({ id: entry._id });
                                }}
                              />
                            </div>
                          </div>
                          {subjects.length > 0 ? (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {subjects.map((subject, index) => (
                                <div
                                  key={index}
                                  className="rounded-lg bg-secondary/40 px-3 py-2.5"
                                >
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                                    {subject.subject}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">
                                    {subject.work}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            entry.summary && (
                              <p className="whitespace-pre-wrap text-sm">{entry.summary}</p>
                            )
                          )}
                          {entry.summary && subjects.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-semibold text-foreground">Notes: </span>
                              <span className="whitespace-pre-wrap">{entry.summary}</span>
                            </p>
                          )}
                          {entry.nextWeek && (
                            <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                              <span className="font-semibold">Next week: </span>
                              <span className="whitespace-pre-wrap">{entry.nextWeek}</span>
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
