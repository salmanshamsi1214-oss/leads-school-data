import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Pencil,
  Trash2,
  FileText,
  Award,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/*                                TYPES                                        */
/* -------------------------------------------------------------------------- */

type ExamType = "monthly" | "midterm" | "final" | "weekly" | "other";

interface ExamSubject {
  name: string;
  maxMarks: number;
}

interface Exam {
  _id: Id<"exams">;
  title: string;
  type: ExamType;
  classId: Id<"classes">;
  section: string;
  date: string;
  totalMarks: number;
  subjects: ExamSubject[];
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  className: string;
  createdByName: string;
  resultCount: number;
}

interface StudentRow {
  _id: Id<"students">;
  name: string;
  rollNumber: string;
  classId: Id<"classes">;
  section: string;
  className: string;
  status: string;
}

/* -------------------------------------------------------------------------- */
/*                              CONSTANTS                                       */
/* -------------------------------------------------------------------------- */

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  monthly: "Monthly",
  midterm: "Mid-Term",
  final: "Final",
  weekly: "Weekly Test",
  other: "Other",
};

const EXAM_TYPE_COLORS: Record<ExamType, string> = {
  weekly: "bg-blue-100 text-blue-700",
  monthly: "bg-orange-100 text-orange-700",
  midterm: "bg-amber-100 text-amber-700",
  final: "bg-red-100 text-red-700",
  other: "bg-gray-100 text-gray-700",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 text-emerald-700",
  A: "bg-emerald-100 text-emerald-600",
  "B+": "bg-blue-100 text-blue-700",
  B: "bg-blue-100 text-blue-600",
  C: "bg-amber-100 text-amber-700",
  D: "bg-orange-100 text-orange-700",
  F: "bg-red-100 text-red-700",
};

function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

const COMMON_SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Social Studies",
  "Islamiyat",
  "Computer",
  "General Knowledge",
  "Physical Education",
];

/* -------------------------------------------------------------------------- */
/*                            CREATE / EDIT EXAM DIALOG                        */
/* -------------------------------------------------------------------------- */

function ExamFormDialog({
  open,
  onOpenChange,
  initial,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Exam;
  classes: Array<{ _id: Id<"classes">; name: string; sections: string[] }>;
}) {
  const createExam = useMutation(api.exams.create);
  const updateExam = useMutation(api.exams.update);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<ExamType>(initial?.type ?? "monthly");
  const [classId, setClassId] = useState<Id<"classes"> | "">(initial?.classId ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [subjects, setSubjects] = useState<ExamSubject[]>(
    initial?.subjects ?? [{ name: "", maxMarks: 100 }],
  );
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);
  const totalMarks = subjects.reduce((sum, s) => sum + (s.maxMarks || 0), 0);

  const addSubject = (name = "", maxMarks = 100) => {
    setSubjects((prev) => [...prev, { name, maxMarks }]);
  };

  const removeSubject = (idx: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSubject = (idx: number, field: keyof ExamSubject, value: string | number) => {
    setSubjects((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Enter exam title");
    if (!classId) return toast.error("Select a class");
    if (!section) return toast.error("Select a section");
    if (subjects.length === 0) return toast.error("Add at least one subject");
    if (subjects.some((s) => !s.name.trim())) return toast.error("All subjects need a name");

    setSaving(true);
    try {
      if (initial) {
        await updateExam({
          id: initial._id,
          title: title.trim(),
          type,
          classId,
          section,
          date,
          totalMarks,
          subjects: subjects.map((s) => ({ name: s.name.trim(), maxMarks: s.maxMarks })),
        });
        toast.success("Exam updated");
      } else {
        await createExam({
          title: title.trim(),
          type,
          classId,
          section,
          date,
          totalMarks,
          subjects: subjects.map((s) => ({ name: s.name.trim(), maxMarks: s.maxMarks })),
        });
        toast.success("Exam created");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Exam" : "New Exam"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Exam Title</Label>
            <Input
              placeholder="e.g. Mid-Term Exam 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ExamType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXAM_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection} disabled={!classId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {selectedClass?.sections.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subjects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subjects</Label>
              <span className="text-xs text-muted-foreground">Total: {totalMarks} marks</span>
            </div>
            {subjects.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Subject name"
                  value={s.name}
                  onChange={(e) => updateSubject(i, "name", e.target.value)}
                  className="flex-1"
                  list="common-subjects"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={s.maxMarks || ""}
                  onChange={(e) => updateSubject(i, "maxMarks", parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => removeSubject(i)}
                  disabled={subjects.length <= 1}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <datalist id="common-subjects">
              {COMMON_SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Button variant="outline" size="sm" onClick={() => addSubject()}>
              <Plus className="size-3.5 mr-1" /> Add Subject
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : initial ? "Update" : "Create Exam"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                               MARK ENTRY VIEW                               */
/* -------------------------------------------------------------------------- */

function MarkEntryView({
  exam,
  classes,
  onDone,
}: {
  exam: Exam;
  classes: Array<{ _id: Id<"classes">; name: string; sections: string[] }>;
  onDone: () => void;
}) {
  const students = useQuery(api.students.list, {
    classId: exam.classId,
    section: exam.section,
    status: "active",
  }) as StudentRow[] | undefined;

  const existingResults = useQuery(api.exams.getResults, { examId: exam._id });
  const saveResults = useMutation(api.exams.saveResults);

  // Build initial marks state from existing results
  const existingMap = useMemo(() => {
    if (!existingResults?.results) return new Map();
    const map = new Map<string, any[]>();
    for (const r of existingResults.results) {
      map.set(r.studentId, r.marks);
    }
    return map;
  }, [existingResults]);

  const [marks, setMarks] = useState<Record<string, Record<number, number>>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const getObtained = (studentId: string, subjectIdx: number): number => {
    // Check unsaved first, then existing
    if (marks[studentId]?.[subjectIdx] !== undefined) return marks[studentId][subjectIdx];
    const existing = existingMap.get(studentId);
    if (existing?.[subjectIdx]) return existing[subjectIdx].obtained;
    return 0;
  };

  const setObtained = (studentId: string, subjectIdx: number, value: number) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [subjectIdx]: value },
    }));
  };

  const handleSave = async () => {
    if (!students || students.length === 0) return toast.error("No students found");

    const results = students.map((student) => {
      const subjectMarks = exam.subjects.map((subj, i) => ({
        subject: subj.name,
        obtained: getObtained(student._id, i),
        maxMarks: subj.maxMarks,
      }));
      const totalObtained = subjectMarks.reduce((sum, m) => sum + m.obtained, 0);
      const percentage = exam.totalMarks > 0 ? Math.round((totalObtained / exam.totalMarks) * 1000) / 10 : 0;
      return {
        studentId: student._id,
        marks: subjectMarks,
        totalObtained,
        percentage,
        grade: gradeFor(percentage),
        remarks: remarks[student._id] || undefined,
      };
    });

    setSaving(true);
    try {
      const saved = await saveResults({ examId: exam._id, results });
      toast.success(`Saved results for ${saved} students`);
      setShowResults(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!students) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading students...</div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No students found in {exam.className} - {exam.section}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">
            {exam.title} — {exam.className} {exam.section}
          </h3>
          <p className="text-sm text-muted-foreground">
            {exam.subjects.length} subjects · Total {exam.totalMarks} marks
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onDone}>
          Back to Exams
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Roll</TableHead>
              {exam.subjects.map((s, i) => (
                <TableHead key={i} className="text-center">
                  <div>{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">/{s.maxMarks}</div>
                </TableHead>
              ))}
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-center">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student, idx) => {
              const subjectMarks = exam.subjects.map((_, i) => getObtained(student._id, i));
              const total = subjectMarks.reduce((a, b) => a + b, 0);
              const pct = exam.totalMarks > 0 ? Math.round((total / exam.totalMarks) * 1000) / 10 : 0;
              const grade = gradeFor(pct);
              return (
                <TableRow key={student._id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.rollNumber}</TableCell>
                  {exam.subjects.map((subj, i) => (
                    <TableCell key={i} className="text-center p-1">
                      <Input
                        type="number"
                        min={0}
                        max={subj.maxMarks}
                        value={getObtained(student._id, i) || ""}
                        onChange={(e) =>
                          setObtained(student._id, i, Math.min(subj.maxMarks, Math.max(0, parseInt(e.target.value) || 0)))
                        }
                        className="w-16 h-8 text-center text-xs mx-auto"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold">{total}</TableCell>
                  <TableCell className="text-center font-medium">{pct}%</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-xs ${GRADE_COLORS[grade] ?? "bg-gray-100 text-gray-700"}`}>
                      {grade}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Results"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            RESULTS VIEW                                      */
/* -------------------------------------------------------------------------- */

function ResultsView({
  exam,
  classes,
}: {
  exam: Exam;
  classes: Array<{ _id: Id<"classes">; name: string; sections: string[] }>;
}) {
  const resultsData = useQuery(api.exams.getResults, { examId: exam._id });
  const [showReportFor, setShowReportFor] = useState<Id<"students"> | null>(null);

  if (!resultsData) {
    return <div className="text-center py-12 text-muted-foreground">Loading results...</div>;
  }

  const { results, stats } = resultsData;

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No results entered for this exam yet. Go to Mark Entry to enter marks.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalStudents}</p>
            <p className="text-xs text-muted-foreground">Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.average}%</p>
            <p className="text-xs text-muted-foreground">Average</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.highest}%</p>
            <p className="text-xs text-muted-foreground">Highest</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.passRate}%</p>
            <p className="text-xs text-muted-foreground">Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead className="text-center">Marks</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-center">Grade</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r, idx) => (
              <TableRow key={r._id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                <TableCell className="font-semibold text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">{r.studentName}</TableCell>
                <TableCell className="text-muted-foreground">{r.rollNumber}</TableCell>
                <TableCell className="text-center">{r.totalObtained}/{exam.totalMarks}</TableCell>
                <TableCell className="text-center font-medium">{r.percentage}%</TableCell>
                <TableCell className="text-center">
                  <Badge className={`text-xs ${GRADE_COLORS[r.grade] ?? ""}`}>{r.grade}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowReportFor(r.studentId)}
                  >
                    <FileText className="size-3 mr-1" /> Report
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Progress Report Dialog */}
      {showReportFor && (
        <ProgressReportDialog
          studentId={showReportFor}
          open={!!showReportFor}
          onOpenChange={(v) => { if (!v) setShowReportFor(null); }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        PROGRESS REPORT DIALOG                                */
/* -------------------------------------------------------------------------- */

function ProgressReportDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: Id<"students">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const data = useQuery(api.exams.progressReport, { studentId });

  if (!data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="text-center py-8 text-muted-foreground">Loading progress report...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const { student, report, overall } = data;

  const handlePrint = () => {
    const printContent = document.getElementById("progress-report-print");
    if (!printContent) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Progress Report — ${student.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; }
        .header { text-align: center; border-bottom: 3px solid #f97316; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 20px; color: #f97316; }
        .header h2 { font-size: 14px; font-weight: 600; margin-top: 2px; }
        .header p { font-size: 11px; color: #666; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px; margin-bottom: 16px; }
        .info span { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
        th { background: #f97316; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #fef3e2; }
        .grade-a { color: #059669; font-weight: 700; }
        .grade-f { color: #dc2626; font-weight: 700; }
        .footer { text-align: center; font-size: 10px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 8px; }
        .overall { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; gap: 24px; justify-content: center; }
        .overall .stat { text-align: center; }
        .overall .stat .val { font-size: 20px; font-weight: 700; color: #f97316; }
        .overall .stat .lbl { font-size: 10px; color: #666; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <div class="header">
        <h1>LEADS SCHOOL SYSTEM</h1>
        <h2>Zeenat Campus — Progress Report</h2>
        <p>Kangan Road, Near Jalbani Petrol Pump, Dera Ghazi Khan · 0332-6241440</p>
      </div>
      <div class="info">
        <div><span>Student:</span> ${student.name}</div>
        <div><span>Father's Name:</span> ${student.fatherName}</div>
        <div><span>Roll No:</span> ${student.rollNumber}</div>
        <div><span>Class:</span> ${student.className} — ${student.section}</div>
      </div>
      <div class="overall">
        <div class="stat"><div class="val">${overall.examsTaken}</div><div class="lbl">Exams Taken</div></div>
        <div class="stat"><div class="val">${overall.averagePercentage}%</div><div class="lbl">Average</div></div>
        <div class="stat"><div class="val">${overall.overallGrade}</div><div class="lbl">Overall Grade</div></div>
      </div>
      <table>
        <thead><tr><th>Exam</th><th>Date</th>${report[0]?.subjects.map((s: any) => `<th>${s.subject}<br><small>/${s.maxMarks}</small></th>`).join("") ?? ""}<th>Total</th><th>%</th><th>Grade</th></tr></thead>
        <tbody>
        ${report.map((r: any) => `<tr><td style="text-align:left">${r.examTitle}</td><td>${r.examDate}</td>${r.subjects.map((s: any) => `<td>${s.obtained}</td>`).join("")}<td><b>${r.totalObtained}/${r.totalMax}</b></td><td>${r.percentage}%</td><td class="${r.grade.startsWith("A") ? "grade-a" : r.grade === "F" ? "grade-f" : ""}">${r.grade}</td></tr>`).join("")}
        </tbody>
      </table>
      ${report.length === 0 ? '<p style="text-align:center;color:#999;">No exam results recorded yet.</p>' : ""}
      <div class="footer">LEADS SCHOOL SYSTEM — Zeenat Campus · Generated on ${new Date().toLocaleDateString("en-GB")}</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Progress Report — {student.name}</span>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="size-3.5 mr-1" /> Print
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div id="progress-report-print">
          {/* Header */}
          <div className="text-center border-b-2 border-primary pb-3 mb-4">
            <h2 className="text-base font-bold text-primary">LEADS SCHOOL SYSTEM</h2>
            <p className="text-xs text-muted-foreground">Zeenat Campus — Progress Report</p>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-muted/30 p-3 rounded-lg">
            <div><span className="font-semibold">Student:</span> {student.name}</div>
            <div><span className="font-semibold">Father:</span> {student.fatherName}</div>
            <div><span className="font-semibold">Roll No:</span> {student.rollNumber}</div>
            <div><span className="font-semibold">Class:</span> {student.className} — {student.section}</div>
          </div>

          {/* Overall Stats */}
          <div className="flex justify-center gap-8 mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{overall.examsTaken}</p>
              <p className="text-[10px] text-muted-foreground">Exams Taken</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{overall.averagePercentage}%</p>
              <p className="text-[10px] text-muted-foreground">Average</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{overall.overallGrade}</p>
              <p className="text-[10px] text-muted-foreground">Overall Grade</p>
            </div>
          </div>

          {/* Exam-wise table */}
          {report.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <TableRow className="bg-primary text-white">
                    <TableHead className="text-white text-xs">Exam</TableHead>
                    <TableHead className="text-white text-xs">Date</TableHead>
                    {report[0]?.subjects.map((s: any, i: number) => (
                      <TableHead key={i} className="text-white text-xs text-center">
                        {s.subject}<br />
                        <span className="font-normal opacity-75">/{s.maxMarks}</span>
                      </TableHead>
                    ))}
                    <TableHead className="text-white text-xs text-center">Total</TableHead>
                    <TableHead className="text-white text-xs text-center">%</TableHead>
                    <TableHead className="text-white text-xs text-center">Grade</TableHead>
                  </TableRow>
                </thead>
                <TableBody>
                  {report.map((r: any, idx: number) => (
                    <TableRow key={idx} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="font-medium text-left text-xs">{r.examTitle}</TableCell>
                      <TableCell className="text-xs">{r.examDate}</TableCell>
                      {r.subjects.map((s: any, i: number) => (
                        <TableCell key={i} className="text-center text-xs">{s.obtained}</TableCell>
                      ))}
                      <TableCell className="text-center font-semibold text-xs">{r.totalObtained}/{r.totalMax}</TableCell>
                      <TableCell className="text-center font-medium text-xs">{r.percentage}%</TableCell>
                      <TableCell className="text-center text-xs">
                        <Badge className={`text-[10px] ${GRADE_COLORS[r.grade] ?? ""}`}>{r.grade}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No exam results recorded yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                               EXAM LIST VIEW                                */
/* -------------------------------------------------------------------------- */

function ExamListView({
  classes,
  onEditExam,
  onStartMarkEntry,
  onViewResults,
}: {
  classes: Array<{ _id: Id<"classes">; name: string; sections: string[] }>;
  onEditExam: (exam: Exam) => void;
  onStartMarkEntry: (exam: Exam) => void;
  onViewResults: (exam: Exam) => void;
}) {
  const exams = useQuery(api.exams.list, {});
  const removeExam = useMutation(api.exams.remove);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeExam({ id: deleteTarget._id });
      toast.success("Exam deleted");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setDeleting(false);
    }
  };

  if (!exams) {
    return <div className="text-center py-12 text-muted-foreground">Loading exams...</div>;
  }

  if (exams.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="size-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No exams created yet</p>
        <p className="text-sm mt-1">Click "New Exam" to create your first exam or test</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <Card key={exam._id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-sm">{exam.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {exam.className} — {exam.section}
                  </p>
                </div>
                <Badge className={`text-[10px] ${EXAM_TYPE_COLORS[exam.type]}`}>
                  {EXAM_TYPE_LABELS[exam.type]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span>{formatDate(exam.date)}</span>
                <span>·</span>
                <span>{exam.totalMarks} marks</span>
                <span>·</span>
                <span>{exam.subjects.length} subjects</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {exam.subjects.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {s.name} ({s.maxMarks})
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {exam.resultCount > 0 ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-3" /> {exam.resultCount} results
                    </span>
                  ) : (
                    "No results yet"
                  )}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onStartMarkEntry(exam)}>
                    <Pencil className="size-3 mr-1" /> Marks
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onViewResults(exam)}>
                    <Award className="size-3 mr-1" /> Results
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEditExam(exam)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={() => setDeleteTarget(exam)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This will also delete all {deleteTarget?.resultCount ?? 0} student results for this exam. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN PAGE                                       */
/* -------------------------------------------------------------------------- */

export default function Exams() {
  const classes = useQuery(api.classes.list, {});
  const [createOpen, setCreateOpen] = useState(false);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [markEntryExam, setMarkEntryExam] = useState<Exam | null>(null);
  const [resultsExam, setResultsExam] = useState<Exam | null>(null);

  const classList = useMemo(() => classes ?? [], [classes]);

  return (
    <AppShell title="Exams & Results">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Create exams, enter marks, view results and generate progress reports
            </p>
          </div>
          {activeTab === "list" && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4 mr-1.5" /> New Exam
            </Button>
          )}
        </div>

        {/* Content */}
        {markEntryExam ? (
          <MarkEntryView
            exam={markEntryExam}
            classes={classList}
            onDone={() => setMarkEntryExam(null)}
          />
        ) : resultsExam ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setResultsExam(null)}>
                ← Back
              </Button>
              <h3 className="font-semibold">{resultsExam.title} — Results</h3>
            </div>
            <ResultsView exam={resultsExam} classes={classList} />
          </div>
        ) : (
          <ExamListView
            classes={classList}
            onEditExam={(e) => setEditExam(e)}
            onStartMarkEntry={(e) => setMarkEntryExam(e)}
            onViewResults={(e) => setResultsExam(e)}
          />
        )}
      </div>

      {/* Create/Edit dialog */}
      <ExamFormDialog
        open={createOpen || !!editExam}
        onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditExam(null); } }}
        initial={editExam ?? undefined}
        classes={classList}
      />
    </AppShell>
  );
}
