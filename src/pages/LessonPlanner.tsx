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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, BookOpen, CheckCircle2, Clock, RefreshCw, CalendarDays,
  Printer, Download, Loader2, ChevronLeft, ChevronRight, LayoutGrid, List,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { todayStr } from "@/lib/format";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planned: { label: "Planned", color: "bg-blue-100 text-blue-700" },
  taught: { label: "Taught", color: "bg-emerald-100 text-emerald-700" },
  revised: { label: "Revised", color: "bg-amber-100 text-amber-700" },
};

const SUBJECTS = ["English", "Urdu", "Mathematics", "Science", "Social Studies", "Islamiyat", "Computer", "General Knowledge", "PE"];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ═══════════════════════════════════════════════════════════════ */
/*                        LESSON PLAN FORM                        */
/* ═══════════════════════════════════════════════════════════════ */

function LessonPlanForm({ open, onClose, initial, defaultDate }: {
  open: boolean;
  onClose: () => void;
  initial?: any;
  defaultDate?: string;
}) {
  const classes = useQuery(api.classes.list) ?? [];
  const createPlan = useMutation(api.lessonPlanner.create);
  const updatePlan = useMutation(api.lessonPlanner.update);

  const [classId, setClassId] = useState<Id<"classes"> | "">(initial?.classId ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [objectives, setObjectives] = useState(initial?.objectives ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayStr());
  const [periodNo, setPeriodNo] = useState(initial?.periodNo ?? "");
  const [lessonChapter, setLessonChapter] = useState(initial?.lessonChapter ?? "");
  const [teachingMethod, setTeachingMethod] = useState(initial?.teachingMethod ?? "");
  const [introduction, setIntroduction] = useState(initial?.introduction ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [classActivity, setClassActivity] = useState(initial?.classActivity ?? "");
  const [groupActivity, setGroupActivity] = useState(initial?.groupActivity ?? "");
  const [studentPractice, setStudentPractice] = useState(initial?.studentPractice ?? "");
  const [assessmentMethod, setAssessmentMethod] = useState(initial?.assessmentMethod ?? "");
  const [homework, setHomework] = useState(initial?.homework ?? "");
  const [resources, setResources] = useState(initial?.resources ?? "");
  const [differentiatedLearning, setDifferentiatedLearning] = useState(initial?.differentiatedLearning ?? "");
  const [extensionActivity, setExtensionActivity] = useState(initial?.extensionActivity ?? "");
  const [timingStarter, setTimingStarter] = useState(initial?.timingStarter ?? "");
  const [timingPresentation, setTimingPresentation] = useState(initial?.timingPresentation ?? "");
  const [timingPractice, setTimingPractice] = useState(initial?.timingPractice ?? "");
  const [timingAssessment, setTimingAssessment] = useState(initial?.timingAssessment ?? "");
  const [timingHomework, setTimingHomework] = useState(initial?.timingHomework ?? "");
  const [status, setStatus] = useState<"planned" | "taught" | "revised">(initial?.status ?? "planned");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);

  const handleSubmit = async () => {
    if (!topic.trim()) return toast.error("Topic is required");
    if (!date) return toast.error("Date is required");
    setSaving(true);
    try {
      const args = {
        classId: classId as Id<"classes">, section: section.trim().toUpperCase(), subject, topic: topic.trim(),
        objectives: objectives.trim(), date, status,
        periodNo: periodNo ? Number(periodNo) : undefined,
        lessonChapter: lessonChapter.trim() || undefined,
        teachingMethod: teachingMethod.trim() || undefined,
        introduction: introduction.trim() || undefined,
        explanation: explanation.trim() || undefined,
        classActivity: classActivity.trim() || undefined,
        groupActivity: groupActivity.trim() || undefined,
        studentPractice: studentPractice.trim() || undefined,
        assessmentMethod: assessmentMethod.trim() || undefined,
        homework: homework.trim() || undefined,
        resources: resources.trim() || undefined,
        differentiatedLearning: differentiatedLearning.trim() || undefined,
        extensionActivity: extensionActivity.trim() || undefined,
        timingStarter: timingStarter ? Number(timingStarter) : undefined,
        timingPresentation: timingPresentation ? Number(timingPresentation) : undefined,
        timingPractice: timingPractice ? Number(timingPractice) : undefined,
        timingAssessment: timingAssessment ? Number(timingAssessment) : undefined,
        timingHomework: timingHomework ? Number(timingHomework) : undefined,
      };
      if (initial) { await updatePlan({ id: initial._id, ...args }); toast.success("Plan updated"); }
      else { await createPlan(args); toast.success("Plan created"); }
      onClose();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{initial ? "Edit Lesson Plan" : "New Lesson Plan"}</h2>
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Class *</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Section *</Label>
              <Select value={section} onValueChange={setSection} disabled={!classId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Subject *</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label className="text-xs">Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Period No.</Label>
              <Input type="number" value={periodNo} onChange={(e) => setPeriodNo(e.target.value)} className="h-8 text-xs" min={1} max={10} placeholder="1, 2, 3..." /></div>
            <div className="space-y-1.5"><Label className="text-xs">Lesson / Chapter</Label>
              <Input value={lessonChapter} onChange={(e) => setLessonChapter(e.target.value)} className="h-8 text-xs" placeholder="Chapter 5" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Teaching Method</Label>
              <Select value={teachingMethod} onValueChange={setTeachingMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{["Lecture", "Discussion", "Activity Based", "Group Work", "Project Based", "Demonstration", "ICT Based", "Mixed"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>

          {/* Topic & Objectives */}
          <div className="space-y-1.5"><Label className="text-xs">Topic *</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic title" className="text-xs" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Learning Objectives *</Label>
            <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="What students will learn..." rows={2} className="text-xs" /></div>

          {/* Lesson Flow */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">LESSON FLOW</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Introduction / Starter</Label>
              <Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="Recap, hook, starter activity..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Explanation / Presentation</Label>
              <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="New concept explanation..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Class Activity</Label>
              <Textarea value={classActivity} onChange={(e) => setClassActivity(e.target.value)} placeholder="In-class activities..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Group / Pair Activity</Label>
              <Textarea value={groupActivity} onChange={(e) => setGroupActivity(e.target.value)} placeholder="Group work..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Student Practice</Label>
              <Textarea value={studentPractice} onChange={(e) => setStudentPractice(e.target.value)} placeholder="Individual practice..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Assessment Method</Label>
              <Textarea value={assessmentMethod} onChange={(e) => setAssessmentMethod(e.target.value)} placeholder="How to assess..." rows={2} className="text-xs" /></div>
          </div>

          {/* Timing */}
          <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">LESSON TIMING (minutes)</div>
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1"><Label className="text-[10px]">Starter</Label><Input type="number" value={timingStarter} onChange={(e) => setTimingStarter(e.target.value)} className="h-7 text-xs" min={0} placeholder="5" /></div>
            <div className="space-y-1"><Label className="text-[10px]">Presentation</Label><Input type="number" value={timingPresentation} onChange={(e) => setTimingPresentation(e.target.value)} className="h-7 text-xs" min={0} placeholder="15" /></div>
            <div className="space-y-1"><Label className="text-[10px]">Practice</Label><Input type="number" value={timingPractice} onChange={(e) => setTimingPractice(e.target.value)} className="h-7 text-xs" min={0} placeholder="15" /></div>
            <div className="space-y-1"><Label className="text-[10px]">Assessment</Label><Input type="number" value={timingAssessment} onChange={(e) => setTimingAssessment(e.target.value)} className="h-7 text-xs" min={0} placeholder="5" /></div>
            <div className="space-y-1"><Label className="text-[10px]">Homework</Label><Input type="number" value={timingHomework} onChange={(e) => setTimingHomework(e.target.value)} className="h-7 text-xs" min={0} placeholder="3" /></div>
          </div>

          {/* Resources & Differentiation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Resources / Teaching Aids</Label>
              <Input value={resources} onChange={(e) => setResources(e.target.value)} placeholder="Books, board, charts..." className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Homework</Label>
              <Textarea value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="Homework assignment..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Differentiated Learning (Weak Students)</Label>
              <Textarea value={differentiatedLearning} onChange={(e) => setDifferentiatedLearning(e.target.value)} placeholder="Support for struggling students..." rows={2} className="text-xs" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Extension Activity (Advanced Students)</Label>
              <Textarea value={extensionActivity} onChange={(e) => setExtensionActivity(e.target.value)} placeholder="Extra challenges..." rows={2} className="text-xs" /></div>
          </div>

          {initial && (
            <>
              <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">STATUS</div>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving} className="btn-3d">
            {saving ? "Saving..." : initial ? "Update Plan" : "Create Plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                        WEEKLY PLANNER VIEW                     */
/* ═══════════════════════════════════════════════════════════════ */

function WeeklyPlanner() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [subject, setSubject] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    const d = getMonday(new Date());
    return d.toISOString().slice(0, 10);
  });

  const weeklyData = useQuery(
    api.lessonPlanner.weeklyPlans,
    classId ? { classId: classId as Id<"classes">, subject: subject || undefined, weekStart } : "skip"
  );

  const navigateWeek = (dir: number) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1"><Label className="text-[10px]">Class</Label>
          <Select value={classId} onValueChange={(v) => setClassId(v as Id<"classes">)}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label className="text-[10px]">Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Subjects</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select></div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => navigateWeek(-1)}><ChevronLeft className="size-4" /></Button>
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="h-8 text-xs w-36" />
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={() => navigateWeek(1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {!weeklyData ? <div className="text-center py-8 text-muted-foreground">Select a class to view the weekly planner</div> : (
        <div className="grid gap-3 sm:grid-cols-7">
          {weeklyData.map((day) => (
            <Card key={day.date} className={`card-3d ${day.date === todayStr() ? "ring-2 ring-primary" : ""}`}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-bold text-center">{day.day.slice(0, 3)}</CardTitle>
                <p className="text-[10px] text-center text-muted-foreground">{formatDate(day.date)}</p>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {day.plans.length === 0 ? (
                  <p className="text-[10px] text-center text-muted-foreground py-2">No plans</p>
                ) : day.plans.map((plan: any) => (
                  <div key={plan._id} className="bg-orange-50/50 border border-orange-200 rounded p-2">
                    {plan.periodNo && <Badge variant="outline" className="text-[9px] mb-1">P{plan.periodNo}</Badge>}
                    <p className="text-[10px] font-semibold leading-tight truncate">{plan.topic}</p>
                    <p className="text-[9px] text-muted-foreground">{plan.subject}</p>
                    <Badge className={`text-[9px] mt-1 ${STATUS_CONFIG[plan.status]?.color}`}>{STATUS_CONFIG[plan.status]?.label}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                     ALL PLANS LIST VIEW                        */
/* ═══════════════════════════════════════════════════════════════ */

function AllPlansList({ onEdit }: { onEdit: (plan: any) => void }) {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [subject, setSubject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deletePlan = useMutation(api.lessonPlanner.remove);

  const plans = useQuery(
    api.lessonPlanner.list,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  ) ?? [];

  const filtered = useMemo(() => {
    let result = plans;
    if (subject) result = result.filter((p) => p.subject === subject);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.topic.toLowerCase().includes(q) || p.subject.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [plans, subject, searchQuery]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c._id, c.name])), [classes]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1"><Label className="text-[10px]">Class</Label>
          <Select value={classId} onValueChange={(v) => setClassId(v as Id<"classes">)}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label className="text-[10px]">Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">All</SelectItem>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1 flex-1 min-w-48"><Label className="text-[10px]">Search</Label>
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search topic..." className="h-8 text-xs" /></div>
      </div>

      <div className="space-y-2">
        {filtered.map((plan) => (
          <Card key={plan._id} className="card-3d">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[9px] ${STATUS_CONFIG[plan.status]?.color}`}>{STATUS_CONFIG[plan.status]?.label}</Badge>
                  {plan.periodNo && <Badge variant="outline" className="text-[9px]">Period {plan.periodNo}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{plan.date}</span>
                </div>
                <p className="text-sm font-semibold mt-1 truncate">{plan.topic}</p>
                <p className="text-[10px] text-muted-foreground">{plan.subject} · {classMap.get(plan.classId) ?? "—"} {plan.section}</p>
                {plan.objectives && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{plan.objectives}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(plan)}><Pencil className="size-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={async () => { await deletePlan({ id: plan._id }); toast.success("Deleted"); }}><Trash2 className="size-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground"><BookOpen className="size-10 mx-auto mb-3 opacity-30" /><p>No lesson plans found</p></div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                          DASHBOARD                             */
/* ═══════════════════════════════════════════════════════════════ */

function PlannerDashboard() {
  const classes = useQuery(api.classes.list) ?? [];
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [subject, setSubject] = useState("");

  const dashStats = useQuery(
    api.lessonPlanner.stats,
    classId ? { classId: classId as Id<"classes">, subject: subject || undefined } : "skip"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1"><Label className="text-[10px]">Class</Label>
          <Select value={classId} onValueChange={(v) => setClassId(v as Id<"classes">)}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="space-y-1"><Label className="text-[10px]">Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent><SelectItem value="_all">All</SelectItem>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></div>
      </div>

      {dashStats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="card-3d"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{dashStats.totalPlanned}</p>
            <p className="text-xs text-muted-foreground">Total Planned</p>
          </CardContent></Card>
          <Card className="card-3d"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{dashStats.completedLessons}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent></Card>
          <Card className="card-3d"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{dashStats.pendingLessons}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent></Card>
          <Card className="card-3d"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{dashStats.completionPct}%</p>
            <p className="text-xs text-muted-foreground">Completion</p>
          </CardContent></Card>
          <Card className="card-3d"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{dashStats.homeworkAssigned}</p>
            <p className="text-xs text-muted-foreground">Homework Assigned</p>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                         MAIN PAGE                              */
/* ═══════════════════════════════════════════════════════════════ */

export default function LessonPlanner() {
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);

  return (
    <AppShell title="Lesson Planner">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">Plan lessons daily and weekly with timing, activities, and reflection</p>
          <Button size="sm" className="btn-3d cursor-pointer" onClick={() => { setEditPlan(null); setShowForm(true); }}>
            <Plus className="size-3.5 mr-1" /> New Lesson Plan
          </Button>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="dashboard" className="gap-1.5"><LayoutGrid className="size-3.5" /> Dashboard</TabsTrigger>
            <TabsTrigger value="weekly" className="gap-1.5"><CalendarDays className="size-3.5" /> Weekly View</TabsTrigger>
            <TabsTrigger value="all" className="gap-1.5"><List className="size-3.5" /> All Plans</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><PlannerDashboard /></TabsContent>
          <TabsContent value="weekly"><WeeklyPlanner /></TabsContent>
          <TabsContent value="all"><AllPlansList onEdit={(p) => { setEditPlan(p); setShowForm(true); }} /></TabsContent>
        </Tabs>
      </div>

      <LessonPlanForm open={showForm} onClose={() => { setShowForm(false); setEditPlan(null); }} initial={editPlan} />
    </AppShell>
  );
}
