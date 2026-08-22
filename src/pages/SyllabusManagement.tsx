import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Printer,
  Download,
  Loader2,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";

const TERMS = [
  { value: "1st_term", label: "1st Term (Apr–Jun)" },
  { value: "2nd_term", label: "2nd Term (Jul–Oct)" },
  { value: "final_term", label: "Final Term (Nov–Mar)" },
] as const;

const TYPES = [
  { value: "written", label: "Written" },
  { value: "oral", label: "Oral" },
  { value: "practical", label: "Practical" },
] as const;

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  not_started: {
    label: "Not Started",
    color: "bg-gray-100 text-gray-600",
    icon: <Clock className="size-3" />,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-700",
    icon: <AlertTriangle className="size-3" />,
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-100 text-emerald-700",
    icon: <CheckCircle2 className="size-3" />,
  },
};

const SUBJECTS = [
  "English",
  "Urdu",
  "Mathematics",
  "Science",
  "Social Studies",
  "Islamiyat",
  "Computer",
  "General Knowledge",
  "PE",
];

/* ═══════════════════════════════════════════════════════════════ */
/*                     SYLLABUS ENTRY FORM                        */
/* ═══════════════════════════════════════════════════════════════ */

function SyllabusForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: any;
}) {
  const classes = useQuery(api.classes.list) ?? [];
  const createEntry = useMutation(api.syllabus.create);
  const updateEntry = useMutation(api.syllabus.update);

  const [classId, setClassId] = useState<Id<"classes"> | "">(
    initial?.classId ?? ""
  );
  const [section, setSection] = useState(initial?.section ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [term, setTerm] = useState(initial?.term ?? "1st_term");
  const [bookName, setBookName] = useState(initial?.bookName ?? "");
  const [chapterNo, setChapterNo] = useState(initial?.chapterNo ?? "");
  const [chapterName, setChapterName] = useState(initial?.chapterName ?? "");
  const [topics, setTopics] = useState(initial?.topics ?? "");
  const [subTopics, setSubTopics] = useState(initial?.subTopics ?? "");
  const [pagesFrom, setPagesFrom] = useState(initial?.pagesFrom ?? "");
  const [pagesTo, setPagesTo] = useState(initial?.pagesTo ?? "");
  const [syllabusType, setSyllabusType] = useState(initial?.syllabusType ?? "written");
  const [learningObjectives, setLearningObjectives] = useState(initial?.learningObjectives ?? "");
  const [writtenWork, setWrittenWork] = useState(initial?.writtenWork ?? "");
  const [oralWork, setOralWork] = useState(initial?.oralWork ?? "");
  const [practicalWork, setPracticalWork] = useState(initial?.practicalWork ?? "");
  const [homework, setHomework] = useState(initial?.homework ?? "");
  const [classActivity, setClassActivity] = useState(initial?.classActivity ?? "");
  const [assessment, setAssessment] = useState(initial?.assessment ?? "");
  const [teachingAids, setTeachingAids] = useState(initial?.teachingAids ?? "");
  const [totalLessons, setTotalLessons] = useState(initial?.totalLessons ?? 5);
  const [completedLessons, setCompletedLessons] = useState(initial?.completedLessons ?? 0);
  const [status, setStatus] = useState(initial?.status ?? "not_started");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [expectedEndDate, setExpectedEndDate] = useState(initial?.expectedEndDate ?? "");
  const [revisionRequired, setRevisionRequired] = useState(initial?.revisionRequired ?? false);
  const [revisionCompleted, setRevisionCompleted] = useState(initial?.revisionCompleted ?? false);
  const [testTaken, setTestTaken] = useState(initial?.testTaken ?? false);
  const [weakAreas, setWeakAreas] = useState(initial?.weakAreas ?? "");
  const [teacherRemarks, setTeacherRemarks] = useState(initial?.teacherRemarks ?? "");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);

  const handleSubmit = async () => {
    if (!chapterNo.trim()) return toast.error("Chapter No is required");
    if (!chapterName.trim()) return toast.error("Chapter Name is required");
    if (!topics.trim()) return toast.error("Topics are required");
    setSaving(true);
    try {
      if (initial) {
        await updateEntry({
          id: initial._id,
          chapterName: chapterName.trim(),
          topics: topics.trim(),
          subTopics: subTopics.trim() || undefined,
          pagesFrom: pagesFrom ? Number(pagesFrom) : undefined,
          pagesTo: pagesTo ? Number(pagesTo) : undefined,
          totalLessons: Number(totalLessons) || 5,
          completedLessons: Number(completedLessons) || 0,
          status: status as any,
          startDate: startDate || undefined,
          expectedEndDate: expectedEndDate || undefined,
          actualEndDate: status === "completed" ? new Date().toISOString().slice(0, 10) : undefined,
          revisionRequired,
          revisionCompleted,
          testTaken,
          weakAreas: weakAreas.trim() || undefined,
          teacherRemarks: teacherRemarks.trim() || undefined,
          writtenWork: writtenWork.trim() || undefined,
          oralWork: oralWork.trim() || undefined,
          practicalWork: practicalWork.trim() || undefined,
          homework: homework.trim() || undefined,
          classActivity: classActivity.trim() || undefined,
          assessment: assessment.trim() || undefined,
          teachingAids: teachingAids.trim() || undefined,
          learningObjectives: learningObjectives.trim() || undefined,
        });
        toast.success("Syllabus entry updated");
      } else {
        await createEntry({
          classId: classId as Id<"classes">,
          section: section.trim().toUpperCase(),
          subject,
          term: term as any,
          bookName: bookName.trim() || undefined,
          chapterNo: chapterNo.trim(),
          chapterName: chapterName.trim(),
          topics: topics.trim(),
          subTopics: subTopics.trim() || undefined,
          pagesFrom: pagesFrom ? Number(pagesFrom) : undefined,
          pagesTo: pagesTo ? Number(pagesTo) : undefined,
          syllabusType: syllabusType as any,
          learningObjectives: learningObjectives.trim() || undefined,
          writtenWork: writtenWork.trim() || undefined,
          oralWork: oralWork.trim() || undefined,
          practicalWork: practicalWork.trim() || undefined,
          homework: homework.trim() || undefined,
          classActivity: classActivity.trim() || undefined,
          assessment: assessment.trim() || undefined,
          teachingAids: teachingAids.trim() || undefined,
          totalLessons: Number(totalLessons) || 5,
          completedLessons: Number(completedLessons) || 0,
          startDate: startDate || undefined,
          expectedEndDate: expectedEndDate || undefined,
          status: status as any,
        });
        toast.success("Syllabus entry created");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">
          {initial ? "Edit Syllabus Entry" : "New Syllabus Entry"}
        </h2>
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">
            BASIC INFORMATION
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Class *</Label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v as Id<"classes">);
                  setSection("");
                }}
                disabled={!!initial}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
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
            <div className="space-y-1.5">
              <Label className="text-xs">Section *</Label>
              <Select
                value={section}
                onValueChange={setSection}
                disabled={!classId || !!initial}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
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
            <div className="space-y-1.5">
              <Label className="text-xs">Subject *</Label>
              <Select
                value={subject}
                onValueChange={setSubject}
                disabled={!!initial}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Term *</Label>
              <Select
                value={term}
                onValueChange={setTerm}
                disabled={!!initial}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Book Name</Label>
              <Input
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                className="h-8 text-xs"
                placeholder="Textbook name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Syllabus Type</Label>
              <Select value={syllabusType} onValueChange={setSyllabusType} disabled={!!initial}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Syllabus Details */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">
            SYLLABUS DETAILS
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Chapter No *</Label>
              <Input
                value={chapterNo}
                onChange={(e) => setChapterNo(e.target.value)}
                className="h-8 text-xs"
                placeholder="1, 2, 3..."
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Chapter / Lesson Name *</Label>
              <Input
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                className="h-8 text-xs"
                placeholder="Chapter title"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Topics *</Label>
            <Textarea
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="List all topics in this chapter..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sub-Topics</Label>
              <Input
                value={subTopics}
                onChange={(e) => setSubTopics(e.target.value)}
                className="h-8 text-xs"
                placeholder="Optional sub-topics"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pages From</Label>
              <Input
                type="number"
                value={pagesFrom}
                onChange={(e) => setPagesFrom(e.target.value)}
                className="h-8 text-xs"
                placeholder="Page"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pages To</Label>
              <Input
                type="number"
                value={pagesTo}
                onChange={(e) => setPagesTo(e.target.value)}
                className="h-8 text-xs"
                placeholder="Page"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Learning Objectives</Label>
            <Textarea
              value={learningObjectives}
              onChange={(e) => setLearningObjectives(e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="What students will learn..."
            />
          </div>

          {/* Work Details */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">
            WORK ASSIGNMENTS
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Written Work</Label>
              <Textarea
                value={writtenWork}
                onChange={(e) => setWrittenWork(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Written assignments..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Oral Work</Label>
              <Textarea
                value={oralWork}
                onChange={(e) => setOralWork(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Oral exercises..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Practical Work</Label>
              <Textarea
                value={practicalWork}
                onChange={(e) => setPracticalWork(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Practical/labs..."
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Homework</Label>
              <Textarea
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Homework tasks..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Class Activity</Label>
              <Textarea
                value={classActivity}
                onChange={(e) => setClassActivity(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="In-class activities..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assessment</Label>
              <Textarea
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Test/assessment plan..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Teaching Aids</Label>
            <Input
              value={teachingAids}
              onChange={(e) => setTeachingAids(e.target.value)}
              className="h-8 text-xs"
              placeholder="Charts, models, digital resources..."
            />
          </div>

          {/* Progress Tracking */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">
            PROGRESS TRACKING
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Total Lessons</Label>
              <Input
                type="number"
                value={totalLessons}
                onChange={(e) => setTotalLessons(Number(e.target.value))}
                className="h-8 text-xs"
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Completed Lessons</Label>
              <Input
                type="number"
                value={completedLessons}
                onChange={(e) => setCompletedLessons(Number(e.target.value))}
                className="h-8 text-xs"
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expected End</Label>
              <Input
                type="date"
                value={expectedEndDate}
                onChange={(e) => setExpectedEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Exam Preparation */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">
            EXAM PREPARATION
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={revisionRequired}
                onChange={(e) => setRevisionRequired(e.target.checked)}
                className="rounded"
              />
              Revision Required
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={revisionCompleted}
                onChange={(e) => setRevisionCompleted(e.target.checked)}
                className="rounded"
              />
              Revision Completed
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={testTaken}
                onChange={(e) => setTestTaken(e.target.checked)}
                className="rounded"
              />
              Test Taken
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Weak Areas</Label>
              <Textarea
                value={weakAreas}
                onChange={(e) => setWeakAreas(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Topics students struggled with..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teacher Remarks</Label>
              <Textarea
                value={teacherRemarks}
                onChange={(e) => setTeacherRemarks(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-3d"
          >
            {saving ? "Saving..." : initial ? "Update Entry" : "Create Entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                      DASHBOARD VIEW                            */
/* ═══════════════════════════════════════════════════════════════ */

function SyllabusDashboard() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState<"1st_term" | "2nd_term" | "final_term">("1st_term");

  const stats = useQuery(
    api.syllabus.progressStats,
    classId
      ? { classId: classId as Id<"classes">, subject: subject || "English", term }
      : "skip"
  );

  const allSyllabus = useQuery(api.syllabus.list, {}) ?? [];

  // Summary stats across all entries
  const globalStats = useMemo(() => {
    const total = allSyllabus.length;
    const completed = allSyllabus.filter((s) => s.status === "completed").length;
    const inProgress = allSyllabus.filter((s) => s.status === "in_progress").length;
    const notStarted = allSyllabus.filter((s) => s.status === "not_started").length;
    const totalLessons = allSyllabus.reduce((sum, s) => sum + s.totalLessons, 0);
    const completedLessons = allSyllabus.reduce((sum, s) => sum + s.completedLessons, 0);
    return { total, completed, inProgress, notStarted, totalLessons, completedLessons, completionPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0 };
  }, [allSyllabus]);

  return (
    <div className="space-y-4">
      {/* Global Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="card-3d">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-primary">{globalStats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Chapters</p>
          </CardContent>
        </Card>
        <Card className="card-3d">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{globalStats.completed}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="card-3d">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{globalStats.inProgress}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="card-3d">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-gray-500">{globalStats.notStarted}</p>
            <p className="text-[10px] text-muted-foreground">Not Started</p>
          </CardContent>
        </Card>
        <Card className="card-3d">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold">{globalStats.completionPct}%</p>
            <p className="text-[10px] text-muted-foreground">Overall Completion</p>
          </CardContent>
        </Card>
        <Card className="card-3d">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-orange-600">{globalStats.completedLessons}/{globalStats.totalLessons}</p>
            <p className="text-[10px] text-muted-foreground">Lessons Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Per Class/Subject/Term Progress */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-[10px]">Class</Label>
          <Select value={classId} onValueChange={(v) => setClassId(v as Id<"classes">)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Term</Label>
          <Select value={term} onValueChange={(v) => setTerm(v as typeof term)}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stats && (
        <Card className="card-3d">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {subject || "All Subjects"} — {TERMS.find((t) => t.value === term)?.label}
              </h3>
              <Badge className="text-xs">{stats.completionPct}% Complete</Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
              <div><p className="font-bold text-lg">{stats.totalChapters}</p><p className="text-muted-foreground">Chapters</p></div>
              <div><p className="font-bold text-lg text-emerald-600">{stats.completedChapters}</p><p className="text-muted-foreground">Completed</p></div>
              <div><p className="font-bold text-lg text-blue-600">{stats.inProgressChapters}</p><p className="text-muted-foreground">In Progress</p></div>
              <div><p className="font-bold text-lg text-gray-500">{stats.notStartedChapters}</p><p className="text-muted-foreground">Not Started</p></div>
              <div><p className="font-bold text-lg">{stats.completedLessons}/{stats.totalLessons}</p><p className="text-muted-foreground">Lessons</p></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                    ALL ENTRIES LIST VIEW                       */
/* ═══════════════════════════════════════════════════════════════ */

function AllEntries({ onEdit }: { onEdit: (entry: any) => void }) {
  const classes = useQuery(api.classes.list) ?? [];
  const allSyllabus = useQuery(api.syllabus.list, {}) ?? [];
  const deleteEntry = useMutation(api.syllabus.remove);

  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const classMap = useMemo(() => new Map(classes.map((c) => [c._id, c.name])), [classes]);

  const filtered = useMemo(() => {
    let result = allSyllabus;
    if (classId) result = result.filter((s) => s.classId === classId);
    if (subject) result = result.filter((s) => s.subject === subject);
    if (term) result = result.filter((s) => s.term === term);
    if (statusFilter) result = result.filter((s) => s.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.chapterName.toLowerCase().includes(q) ||
          s.topics.toLowerCase().includes(q) ||
          s.chapterNo.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSyllabus, classId, subject, term, statusFilter, searchQuery]);

  const handleDelete = async (id: Id<"syllabus">) => {
    await deleteEntry({ id });
    toast.success("Entry deleted");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-[10px]">Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Subjects</SelectItem>
              {SUBJECTS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Term</Label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Terms</SelectItem>
              {TERMS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-48">
          <Label className="text-[10px]">Search</Label>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chapter, topic..."
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 font-semibold">Ch.</th>
              <th className="text-left p-2 font-semibold">Chapter</th>
              <th className="text-left p-2 font-semibold">Class</th>
              <th className="text-left p-2 font-semibold">Subject</th>
              <th className="text-left p-2 font-semibold">Term</th>
              <th className="text-left p-2 font-semibold">Type</th>
              <th className="text-center p-2 font-semibold">Progress</th>
              <th className="text-left p-2 font-semibold">Status</th>
              <th className="text-right p-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const pct = entry.totalLessons > 0 ? Math.round((entry.completedLessons / entry.totalLessons) * 100) : 0;
              const sc = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.not_started;
              return (
                <tr key={entry._id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2 font-mono">{entry.chapterNo}</td>
                  <td className="p-2 font-semibold max-w-48 truncate">{entry.chapterName}</td>
                  <td className="p-2">{classMap.get(entry.classId) ?? "—"} {entry.section}</td>
                  <td className="p-2">{entry.subject}</td>
                  <td className="p-2">{TERMS.find((t) => t.value === entry.term)?.label.split(" ")[0] ?? entry.term}</td>
                  <td className="p-2 capitalize">{entry.syllabusType}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <Badge className={`text-[9px] ${sc.color}`}>{sc.label}</Badge>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(entry)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(entry._id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted-foreground">
                  <BookOpen className="size-10 mx-auto mb-2 opacity-30" />
                  <p>No syllabus entries found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                         MAIN PAGE                              */
/* ═══════════════════════════════════════════════════════════════ */

export default function SyllabusManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);

  return (
    <AppShell title="Syllabus Management">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            Track syllabus progress by class, subject, and term with exam preparation
          </p>
          <Button
            size="sm"
            className="btn-3d cursor-pointer"
            onClick={() => {
              setEditEntry(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5 mr-1" /> New Entry
          </Button>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <BarChart3 className="size-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="entries" className="gap-1.5">
              <BookOpen className="size-3.5" /> All Entries
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <SyllabusDashboard />
          </TabsContent>
          <TabsContent value="entries">
            <AllEntries
              onEdit={(e) => {
                setEditEntry(e);
                setShowForm(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SyllabusForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditEntry(null);
        }}
        initial={editEntry}
      />
    </AppShell>
  );
}
