import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Archive,
  BookUser,
  CalendarDays,
  Check,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_META, STATUS_ORDER } from "@/lib/attendance";
import type { AttendanceStatus } from "@/convex/schema";
import { formatDate, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";

type TeacherRow = Doc<"teachers"> & { className: string };

type TeacherForm = {
  name: string;
  phone: string;
  cnic: string;
  email: string;
  qualification: string;
  subject: string;
  designation: string;
  classId: string;
  joiningDate: string;
  birthDate: string;
  salary: string;
};

const EMPTY_FORM: TeacherForm = {
  name: "",
  phone: "",
  cnic: "",
  email: "",
  qualification: "",
  subject: "",
  designation: "",
  classId: "none",
  joiningDate: "",
  birthDate: "",
  salary: "",
};

function TeacherFormDialog({
  open,
  onOpenChange,
  classes,
  teacher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: Doc<"classes">[];
  teacher: TeacherRow | null;
}) {
  const [form, setForm] = useState<TeacherForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const createTeacher = useMutation(api.teachers.create);
  const updateTeacher = useMutation(api.teachers.update);

  useEffect(() => {
    if (!open) return;
    setForm(
      teacher
        ? {
            name: teacher.name,
            phone: teacher.phone ?? "",
            cnic: teacher.cnic ?? "",
            email: teacher.email ?? "",
            qualification: teacher.qualification ?? "",
            subject: teacher.subject ?? "",
            designation: teacher.designation ?? "",
            classId: teacher.classId ?? "none",
            joiningDate: teacher.joiningDate ?? "",
            birthDate: teacher.birthDate ?? "",
            salary: teacher.salary !== undefined ? String(teacher.salary) : "",
          }
        : EMPTY_FORM,
    );
  }, [open, teacher]);

  const set = (key: keyof TeacherForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast("Teacher name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        cnic: form.cnic || undefined,
        email: form.email || undefined,
        qualification: form.qualification || undefined,
        subject: form.subject || undefined,
        designation: form.designation || undefined,
        classId: form.classId === "none" ? undefined : (form.classId as never),
        joiningDate: form.joiningDate || undefined,
        birthDate: form.birthDate || undefined,
        salary: form.salary === "" ? undefined : Number(form.salary),
      };
      if (teacher) {
        await updateTeacher({ id: teacher._id, ...payload });
        toast(`${form.name.trim()} updated.`);
      } else {
        await createTeacher(payload);
        toast(`${form.name.trim()} added to staff.`);
      }
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save teacher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{teacher ? "Edit teacher" : "Add teacher"}</DialogTitle>
          <DialogDescription>
            Staff profile used for the teachers register and daily attendance.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="teacher-name">Full name *</Label>
            <Input
              id="teacher-name"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Miss Ayesha Khan"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-subject">Subject</Label>
              <Input
                id="teacher-subject"
                value={form.subject}
                onChange={(e) => set("subject")(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-designation">Designation</Label>
              <Input
                id="teacher-designation"
                value={form.designation}
                onChange={(e) => set("designation")(e.target.value)}
                placeholder="e.g. Class Teacher"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-class">Class teacher of</Label>
              <Select value={form.classId} onValueChange={set("classId")}>
                <SelectTrigger id="teacher-class">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-qualification">Qualification</Label>
              <Input
                id="teacher-qualification"
                value={form.qualification}
                onChange={(e) => set("qualification")(e.target.value)}
                placeholder="e.g. M.Sc, B.Ed"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-phone">Phone</Label>
              <Input
                id="teacher-phone"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="0300-1234567"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-cnic">CNIC</Label>
              <Input
                id="teacher-cnic"
                value={form.cnic}
                onChange={(e) => set("cnic")(e.target.value)}
                placeholder="00000-0000000-0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-joining">Joining date</Label>
              <Input
                id="teacher-joining"
                type="date"
                value={form.joiningDate}
                onChange={(e) => set("joiningDate")(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-birth">Date of birth</Label>
              <Input
                id="teacher-birth"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-salary">Monthly salary (Rs)</Label>
              <Input
                id="teacher-salary"
                type="number"
                min={0}
                value={form.salary}
                onChange={(e) => set("salary")(e.target.value)}
                placeholder="e.g. 35000"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="teacher-email">Email</Label>
              <Input
                id="teacher-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="name@school.edu.pk"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="cursor-pointer" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {teacher ? "Save changes" : "Add teacher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Teachers() {
  const classes = useQuery(api.classes.list) ?? [];
  const [status, setStatus] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [archiving, setArchiving] = useState<TeacherRow | null>(null);
  const setTeacherStatus = useMutation(api.teachers.setStatus);

  const teachers = useQuery(api.teachers.list, {
    status: status === "all" ? undefined : (status as "active" | "left"),
    search: search || undefined,
  });

  // ---- Teacher attendance tab state ----
  const [attDate, setAttDate] = useState(todayStr());
  const savedTeacherRecords = useQuery(
    api.teachers.attendanceByDate,
    attDate ? { date: attDate } : "skip",
  );
  const [teacherStatusMap, setTeacherStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const saveTeacherAttendance = useMutation(api.teachers.markAll);

  useEffect(() => {
    if (!teachers || !savedTeacherRecords) return;
    const next: Record<string, AttendanceStatus> = {};
    for (const teacher of teachers) {
      next[teacher._id] =
        (savedTeacherRecords[teacher._id]?.status as AttendanceStatus | undefined) ?? "present";
    }
    setTeacherStatusMap(next);
  }, [teachers, savedTeacherRecords]);

  const activeTeachers = useMemo(
    () => (teachers ?? []).filter((t) => t.status === "active"),
    [teachers],
  );

  const teacherCounts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };
    for (const status of Object.values(teacherStatusMap)) {
      result[status] += 1;
    }
    return result;
  }, [teacherStatusMap]);

  const attendanceDirty = useMemo(() => {
    if (!activeTeachers.length || !savedTeacherRecords) return false;
    return activeTeachers.some((teacher) => {
      const saved = savedTeacherRecords[teacher._id]?.status;
      return (saved as AttendanceStatus | undefined) !== teacherStatusMap[teacher._id];
    });
  }, [activeTeachers, savedTeacherRecords, teacherStatusMap]);

  const handleSaveTeacherAttendance = async () => {
    if (activeTeachers.length === 0) return;
    setSavingAttendance(true);
    try {
      const entries = activeTeachers.map((teacher) => ({
        teacherId: teacher._id,
        status: teacherStatusMap[teacher._id] ?? "present",
      }));
      await saveTeacherAttendance({ date: attDate, entries });
      toast(`Teacher attendance saved for ${formatDate(attDate)}.`, {
        description: `${teacherCounts.present} present · ${teacherCounts.absent} absent · ${teacherCounts.late} late`,
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save teacher attendance.");
    } finally {
      setSavingAttendance(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiving) return;
    try {
      await setTeacherStatus({
        id: archiving._id,
        status: archiving.status === "active" ? "left" : "active",
      });
      toast(
        archiving.status === "active"
          ? `${archiving.name} marked as left.`
          : `${archiving.name} re-activated.`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update the teacher.");
    } finally {
      setArchiving(null);
    }
  };

  const filtered = teachers ?? [];
  const attendanceReady = activeTeachers.length > 0 && savedTeacherRecords !== undefined;

  return (
    <AppShell title="Teachers">
      <Tabs defaultValue="teachers" className="flex flex-col gap-5">
        <TabsList className="w-fit">
          <TabsTrigger value="teachers" className="gap-2">
            <BookUser className="size-4" /> Teachers ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <CalendarDays className="size-4" /> Daily attendance
          </TabsTrigger>
        </TabsList>

        {/* ---------- Teachers list ---------- */}
        <TabsContent value="teachers" className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {filtered.length} teacher{filtered.length === 1 ? "" : "s"} on record
              </p>
              <Button
                className="cursor-pointer"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" /> Add teacher
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, subject, phone…"
                  className="pl-9"
                  aria-label="Search teachers"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No teachers found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {search ? "Try a different search." : "Add your first teacher to the staff register."}
                </p>
              </div>
              <Button className="cursor-pointer" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="size-4" /> Add teacher
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Class teacher of</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((teacher) => (
                      <TableRow key={teacher._id}>
                        <TableCell>
                          <p className="font-semibold">{teacher.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {teacher.designation || "Teacher"}
                            {teacher.qualification ? ` · ${teacher.qualification}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>{teacher.subject || "—"}</TableCell>
                        <TableCell>{teacher.className}</TableCell>
                        <TableCell className="text-muted-foreground">{teacher.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              teacher.status === "active"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                            )}
                          >
                            {teacher.status === "active" ? "Active" : "Left"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="cursor-pointer"
                              aria-label={`Edit ${teacher.name}`}
                              onClick={() => { setEditing(teacher); setFormOpen(true); }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "cursor-pointer",
                                teacher.status === "active"
                                  ? "text-red-600 hover:text-red-600"
                                  : "text-emerald-600 hover:text-emerald-600",
                              )}
                              aria-label={teacher.status === "active" ? `Mark ${teacher.name} as left` : `Re-activate ${teacher.name}`}
                              onClick={() => setArchiving(teacher)}
                            >
                              {teacher.status === "active" ? (
                                <Archive className="size-4" />
                              ) : (
                                <RotateCcw className="size-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {filtered.map((teacher) => (
                  <li key={teacher._id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{teacher.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {teacher.subject || "General"} · Class teacher of {teacher.className}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {teacher.phone || "No phone on record"}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0",
                          teacher.status === "active"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                        )}
                      >
                        {teacher.status === "active" ? "Active" : "Left"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 cursor-pointer" onClick={() => { setEditing(teacher); setFormOpen(true); }}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 cursor-pointer",
                          teacher.status === "active" ? "text-red-600" : "text-emerald-600",
                        )}
                        onClick={() => setArchiving(teacher)}
                      >
                        {teacher.status === "active" ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                        {teacher.status === "active" ? "Mark left" : "Re-activate"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        {/* ---------- Teacher attendance ---------- */}
        <TabsContent value="attendance" className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-1.5 sm:w-64">
              <Label htmlFor="teacher-att-date" className="text-xs font-medium text-muted-foreground">
                Date
              </Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="teacher-att-date"
                  type="date"
                  value={attDate}
                  max={todayStr()}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {activeTeachers.length} active teacher{activeTeachers.length === 1 ? "" : "s"} ·
              marking for {formatDate(attDate)}
            </p>
          </div>

          {activeTeachers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No active teachers</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add teachers on the Teachers tab before marking staff attendance.
                </p>
              </div>
            </div>
          ) : !attendanceReady ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
                <span className="font-semibold">{activeTeachers.length} teachers</span>
                <span className="text-muted-foreground">·</span>
                {STATUS_ORDER.map((status) => (
                  <span key={status} className="flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", STATUS_META[status].dot)} />
                    <span className="font-medium">
                      {teacherCounts[status]} {STATUS_META[status].label.toLowerCase()}
                    </span>
                  </span>
                ))}
                {attendanceDirty && (
                  <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Unsaved changes
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border">
                <ul className="divide-y">
                  {activeTeachers.map((teacher, index) => (
                    <li
                      key={teacher._id}
                      className="flex flex-col gap-3 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-sm font-semibold">{teacher.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {teacher.subject || "General"}
                            {teacher.className !== "—" ? ` · Class teacher of ${teacher.className}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end sm:justify-start">
                        <div role="group" aria-label="Teacher attendance status" className="flex shrink-0 gap-1 rounded-lg border bg-secondary/50 p-1">
                          {STATUS_ORDER.map((status) => {
                            const meta = STATUS_META[status];
                            const active = teacherStatusMap[teacher._id] === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                title={meta.label}
                                aria-label={meta.label}
                                aria-pressed={active}
                                onClick={() =>
                                  setTeacherStatusMap((prev) => ({ ...prev, [teacher._id]: status }))
                                }
                                className={cn(
                                  "flex h-9 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors sm:px-3",
                                  active ? meta.solid : "text-muted-foreground hover:bg-background",
                                )}
                              >
                                <span className="sm:hidden">{meta.short}</span>
                                <span className="hidden sm:inline">{meta.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sticky bottom-4 z-10 flex justify-end">
                <Button
                  size="lg"
                  className="cursor-pointer shadow-lg"
                  onClick={handleSaveTeacherAttendance}
                  disabled={savingAttendance || !attendanceDirty}
                >
                  {savingAttendance ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {savingAttendance ? "Saving…" : attendanceDirty ? "Save attendance" : "Saved ✓"}
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TeacherFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classes={classes}
        teacher={editing}
      />
      <AlertDialog open={archiving !== null} onOpenChange={(open) => { if (!open) setArchiving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              {archiving?.status === "active" ? "Mark teacher as left?" : "Re-activate teacher?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiving?.status === "active"
                ? `${archiving?.name} will no longer appear in teacher attendance lists. Their history is kept.`
                : `${archiving?.name} will appear in attendance lists again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={confirmArchive}>
              {archiving?.status === "active" ? "Mark as left" : "Re-activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
