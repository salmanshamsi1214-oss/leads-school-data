import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  Archive,
  Download,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { StudentFormDialog } from "@/components/student-form-dialog";
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
import { exportCsv } from "@/lib/format";
import { cn } from "@/lib/utils";

type StudentRow = Doc<"students"> & { className: string };

export default function Students() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<string>("all");
  const [section, setSection] = useState<string>("all");
  const [status, setStatus] = useState<string>("active");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"students"> | null>(null);
  const [archiving, setArchiving] = useState<StudentRow | null>(null);
  const setStudentStatus = useMutation(api.students.setStatus);

  const students = useQuery(api.students.list, {
    classId: classId === "all" ? undefined : (classId as never),
    section: section === "all" ? undefined : section,
    status: status === "all" ? undefined : (status as "active" | "left"),
    search: search || undefined,
  });

  const selectedClass = classes.find((cls) => cls._id === classId);
  const sectionOptions = selectedClass?.sections ?? [];

  const handleExport = () => {
    if (!students || students.length === 0) return;
    exportCsv(
      `students-${new Date().toISOString().slice(0, 10)}.csv`,
      students.map((student) => ({
        rollNumber: student.rollNumber,
        name: student.name,
        fatherName: student.fatherName,
        className: student.className,
        section: student.section,
        status: student.status,
        phone: student.phone ?? "",
        admissionDate: student.admissionDate ?? "",
        birthDate: student.birthDate ?? "",
      })),
    );
  };

  const confirmArchive = async () => {
    if (!archiving) return;
    try {
      await setStudentStatus({
        id: archiving._id,
        status: archiving.status === "active" ? "left" : "active",
      });
      toast(
        archiving.status === "active"
          ? `${archiving.name} marked as left.`
          : `${archiving.name} re-activated.`,
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update the student.");
    } finally {
      setArchiving(null);
    }
  };

  const filtered = useMemo(() => students ?? [], [students]);

  return (
    <AppShell title="Students">
      <div className="flex flex-col gap-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {filtered.length} student{filtered.length === 1 ? "" : "s"} in view
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={handleExport}
                disabled={filtered.length === 0}
              >
                <Download className="size-4" />
                Export CSV
              </Button>
              <Button className="cursor-pointer" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="size-4" />
                Add student
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, roll, father…"
                className="pl-9"
                aria-label="Search students"
              />
            </div>
            <Select value={classId} onValueChange={(value) => { setClassId(value); setSection("all"); }}>
              <SelectTrigger aria-label="Filter by class">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls._id} value={cls._id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={section} onValueChange={setSection} disabled={!selectedClass}>
              <SelectTrigger aria-label="Filter by section">
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

        {/* List */}
        {students === undefined ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No students found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search || classId !== "all" || section !== "all"
                  ? "Try changing the filters, or add a new student."
                  : "Add your first student to start taking attendance."}
              </p>
            </div>
            <Button className="cursor-pointer" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="size-4" />
              Add student
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Father&apos;s name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell className="font-mono text-xs">{student.rollNumber}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="cursor-pointer text-left font-semibold hover:text-primary"
                          onClick={() => navigate(`/students/${student._id}`)}
                        >
                          {student.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.fatherName}</TableCell>
                      <TableCell>
                        {student.className}
                        <span className="text-muted-foreground"> · {student.section}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            student.status === "active"
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                          )}
                        >
                          {student.status === "active" ? "Active" : "Left"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`View ${student.name}`}
                            onClick={() => navigate(`/students/${student._id}`)}
                          >
                            <UserRound className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`Edit ${student.name}`}
                            onClick={() => { setEditing(student); setFormOpen(true); }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "cursor-pointer",
                              student.status === "active"
                                ? "text-red-600 hover:text-red-600"
                                : "text-emerald-600 hover:text-emerald-600",
                            )}
                            aria-label={student.status === "active" ? `Archive ${student.name}` : `Re-activate ${student.name}`}
                            onClick={() => setArchiving(student)}
                          >
                            {student.status === "active" ? (
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
              {filtered.map((student) => (
                <li key={student._id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="cursor-pointer text-left font-semibold hover:text-primary"                        onClick={() => navigate(`/students/${student._id}`)}
                        >
                        {student.name}
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Roll {student.rollNumber} · {student.className} · Section {student.section}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Father: {student.fatherName}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0",
                        student.status === "active"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                      )}
                    >
                      {student.status === "active" ? "Active" : "Left"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 cursor-pointer" onClick={() => navigate(`/students/${student._id}`)}>
                      <UserRound className="size-3.5" /> Profile
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 cursor-pointer" onClick={() => { setEditing(student); setFormOpen(true); }}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 cursor-pointer",
                        student.status === "active" ? "text-red-600" : "text-emerald-600",
                      )}
                      onClick={() => setArchiving(student)}
                    >
                      {student.status === "active" ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                      {student.status === "active" ? "Mark left" : "Re-activate"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Dialogs */}
      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classes={classes}
        student={editing}
      />

      <AlertDialog open={archiving !== null} onOpenChange={(open) => { if (!open) setArchiving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              {archiving?.status === "active" ? "Mark student as left?" : "Re-activate student?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiving?.status === "active"
                ? `${archiving?.name} (Roll ${archiving?.rollNumber}) will no longer appear in attendance lists. Their history is kept.`
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
