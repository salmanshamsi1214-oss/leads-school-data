import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, Pencil, ClipboardList, Award, BarChart3, Download,
  Filter, Eye, TrendingUp, TrendingDown, Users, BookOpen, Printer,
  X,
} from "lucide-react";
import { formatDate, todayStr } from "@/lib/format";
import { toast } from "sonner";

const COMMON_SUBJECTS = ["English", "Urdu", "Mathematics", "Science", "Social Studies", "Islamiyat", "Computer", "General Knowledge", "Quran"];

/* ─────────── CREATE TEST DIALOG ─────────── */
function TestForm({ open, onOpenChange, type }: { open: boolean; onOpenChange: (v: boolean) => void; type: "daily" | "weekly" }) {
  const classes = useQuery(api.classes.list) ?? [];
  const createDaily = useMutation(api.dailyTests.create);
  const createWeekly = useMutation(api.weeklyTests.create);
  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [totalMarks, setTotalMarks] = useState(20);
  const [saving, setSaving] = useState(false);
  const selectedClass = classes.find((c) => c._id === classId);

  const handleSave = async () => {
    const finalSubject = subject === "__custom__" ? customSubject.trim() : subject;
    if (!classId || !section || !finalSubject) return toast.error("Fill class, section, subject");
    if (totalMarks <= 0) return toast.error("Total marks must be positive");
    setSaving(true);
    try {
      const args = { classId, section: section.trim().toUpperCase(), subject: finalSubject, title: title.trim() || undefined, date, totalMarks };
      if (type === "daily") await createDaily(args); else await createWeekly(args);
      toast.success(`${type === "daily" ? "Daily" : "Weekly"} test created`);
      setClassId(""); setSection(""); setSubject(""); setCustomSubject(""); setTitle(""); setTotalMarks(20); setDate(todayStr());
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New {type === "daily" ? "Daily" : "Weekly"} Test</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${type === "daily" ? "Chapter 3 Quiz" : "Week 5 Test"}`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection} disabled={!classId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {COMMON_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="__custom__">Custom Subject...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {subject === "__custom__" && (
              <div className="space-y-1.5">
                <Label>Custom Subject</Label>
                <Input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Enter subject name" />
              </div>
            )}
            <div className="space-y-1.5"><Label>Total Marks</Label><Input type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(parseInt(e.target.value) || 0)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── MARK ENTRY DIALOG ─────────── */
function MarkEntryDialog({ testId, type, open, onOpenChange }: { testId: Id<"dailyTests"> | Id<"weeklyTests">; type: "daily" | "weekly"; open: boolean; onOpenChange: (v: boolean) => void }) {
  const dailyTest = useQuery(api.dailyTests.getMarks, type === "daily" ? { testId: testId as Id<"dailyTests"> } : "skip");
  const weeklyTest = useQuery(api.weeklyTests.getMarks, type === "weekly" ? { testId: testId as Id<"weeklyTests"> } : "skip");
  const saveDaily = useMutation(api.dailyTests.saveMarks);
  const saveWeekly = useMutation(api.weeklyTests.saveMarks);

  const marks = type === "daily" ? dailyTest : weeklyTest;
  const [localMarks, setLocalMarks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const getMark = (studentId: string) => {
    if (localMarks[studentId] !== undefined) return localMarks[studentId];
    const existing = marks?.find((m) => m.studentId === studentId);
    return existing?.obtained ?? 0;
  };

  const handleSave = async () => {
    if (!marks) return;
    setSaving(true);
    try {
      const payload = marks.map((m) => ({ studentId: m.studentId, obtained: getMark(m.studentId) }));
      if (type === "daily") await saveDaily({ testId: testId as Id<"dailyTests">, marks: payload });
      else await saveWeekly({ testId: testId as Id<"weeklyTests">, marks: payload });
      toast.success("Marks saved");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Enter Marks</DialogTitle></DialogHeader>
        {!marks ? <div className="text-center py-6 text-muted-foreground">Loading...</div> : (
          <>
            <div className="overflow-x-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead className="text-center">Marks Obtained</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marks.map((m, i) => (
                    <TableRow key={m.studentId}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{m.studentName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{m.rollNumber}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number" min={0}
                          value={getMark(m.studentId)}
                          onChange={(e) => setLocalMarks((prev) => ({ ...prev, [m.studentId]: parseInt(e.target.value) || 0 }))}
                          className="w-20 h-8 text-center text-xs mx-auto"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Marks"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── TEST DETAIL VIEW DIALOG ─────────── */
function TestDetailDialog({ testId, type, open, onOpenChange }: { testId: Id<"dailyTests"> | Id<"weeklyTests">; type: "daily" | "weekly"; open: boolean; onOpenChange: (v: boolean) => void }) {
  const dailyDetail = useQuery(api.dailyTests.getDetail, type === "daily" ? { testId: testId as Id<"dailyTests"> } : "skip");
  const weeklyDetail = useQuery(api.weeklyTests.getDetail, type === "weekly" ? { testId: testId as Id<"weeklyTests"> } : "skip");
  const detail = type === "daily" ? dailyDetail : weeklyDetail;

  const handlePrint = () => {
    if (!detail) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Test Result — ${detail.test.subject}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 15px; color: #1a1a1a; font-size: 11px; }
        .header { text-align: center; border-bottom: 3px solid #ea580c; padding-bottom: 8px; margin-bottom: 10px; }
        .header h1 { font-size: 16px; color: #ea580c; }
        .header h2 { font-size: 12px; font-weight: 600; }
        .header p { font-size: 9px; color: #666; }
        .info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px; margin-bottom: 10px; background: #fff7ed; padding: 8px; border-radius: 4px; border: 1px solid #fed7aa; font-size: 10px; }
        .stats { display: flex; gap: 12px; justify-content: center; margin-bottom: 10px; padding: 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; }
        .stat { text-align: center; }
        .stat .val { font-size: 16px; font-weight: 700; color: #ea580c; }
        .stat .lbl { font-size: 8px; color: #666; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #e2e8f0; padding: 3px 5px; text-align: center; }
        th { background: #ea580c; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #fef3e2; }
        .pass { color: #059669; font-weight: 600; }
        .fail { color: #dc2626; font-weight: 600; }
        .footer { text-align: center; font-size: 8px; color: #999; margin-top: 12px; border-top: 1px solid #eee; padding-top: 5px; }
        @media print { body { padding: 8px; } }
      </style></head><body>
      <div class="header">
        <h1>LEADS SCHOOL SYSTEM — Zeenat Campus</h1>
        <h2>${type === "daily" ? "Daily" : "Weekly"} Test Result — ${detail.test.subject}</h2>
        <p>${detail.className} — ${detail.test.section} · ${formatDate(detail.test.date)}</p>
      </div>
      <div class="info">
        <div><b>Total Marks:</b> ${detail.test.totalMarks}</div>
        <div><b>Students:</b> ${detail.stats.marksEntered}/${detail.stats.totalStudents}</div>
        <div><b>Title:</b> ${detail.test.title || "—"}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="val">${detail.stats.average}%</div><div class="lbl">Average</div></div>
        <div class="stat"><div class="val">${detail.stats.highest}%</div><div class="lbl">Highest</div></div>
        <div class="stat"><div class="val">${detail.stats.lowest}%</div><div class="lbl">Lowest</div></div>
        <div class="stat"><div class="val">${detail.stats.passCount}</div><div class="lbl">Passed</div></div>
        <div class="stat"><div class="val">${detail.stats.failCount}</div><div class="lbl">Failed</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Student</th><th>Roll</th><th>Obtained</th><th>%</th><th>Status</th></tr></thead>
        <tbody>
          ${detail.marks.map((m: any, i: number) => `<tr><td>${i + 1}</td><td style="text-align:left">${m.studentName}</td><td>${m.rollNumber}</td><td>${m.obtained}</td><td>${m.percentage}%</td><td class="${m.percentage >= 33 ? "pass" : "fail"}">${m.percentage >= 33 ? "Pass" : "Fail"}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="footer">LEADS SCHOOL SYSTEM — Zeenat Campus · Generated on ${new Date().toLocaleDateString("en-GB")}</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-4" /> Test Results — {detail?.test?.subject ?? "Loading..."}
          </DialogTitle>
        </DialogHeader>
        {!detail ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Card><CardContent className="p-2 text-center">
                <p className="text-lg font-bold text-primary">{detail.stats.average}%</p>
                <p className="text-[9px] text-muted-foreground uppercase">Average</p>
              </CardContent></Card>
              <Card><CardContent className="p-2 text-center">
                <p className="text-lg font-bold text-emerald-600">{detail.stats.highest}%</p>
                <p className="text-[9px] text-muted-foreground uppercase">Highest</p>
              </CardContent></Card>
              <Card><CardContent className="p-2 text-center">
                <p className="text-lg font-bold text-red-500">{detail.stats.lowest}%</p>
                <p className="text-[9px] text-muted-foreground uppercase">Lowest</p>
              </CardContent></Card>
              <Card><CardContent className="p-2 text-center">
                <p className="text-lg font-bold text-emerald-600">{detail.stats.passCount}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Passed</p>
              </CardContent></Card>
              <Card><CardContent className="p-2 text-center">
                <p className="text-lg font-bold text-red-500">{detail.stats.failCount}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Failed</p>
              </CardContent></Card>
            </div>
            <div className="overflow-x-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead className="text-center">Obtained</TableHead>
                    <TableHead className="text-center">Percentage</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.marks.map((m, i) => (
                    <TableRow key={m.studentId} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{m.studentName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{m.rollNumber}</TableCell>
                      <TableCell className="text-center text-sm font-semibold">{m.obtained}/{detail.test.totalMarks}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={m.percentage >= 33 ? "default" : "destructive"} className="text-[10px]">{m.percentage}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={m.percentage >= 33 ? "default" : "destructive"} className="text-[10px]">
                          {m.percentage >= 33 ? "Pass" : "Fail"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="size-3.5 mr-1" /> Print</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── TEST LIST ─────────── */
function TestList({ type }: { type: "daily" | "weekly" }) {
  const classes = useQuery(api.classes.list) ?? [];
  const dailyTests = useQuery(api.dailyTests.list, {}) ?? [];
  const weeklyTests = useQuery(api.weeklyTests.list, {}) ?? [];
  const dailySubjectStats = useQuery(api.dailyTests.subjectStats, {}) ?? [];
  const weeklySubjectStats = useQuery(api.weeklyTests.subjectStats, {}) ?? [];
  const removeDaily = useMutation(api.dailyTests.remove);
  const removeWeekly = useMutation(api.weeklyTests.remove);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tests: any[] = type === "daily" ? dailyTests : weeklyTests;
  const subjectStats = type === "daily" ? dailySubjectStats : weeklySubjectStats;

  const [createOpen, setCreateOpen] = useState(false);
  const [markTest, setMarkTest] = useState<any>(null);
  const [detailTest, setDetailTest] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const [filterClass, setFilterClass] = useState<string>("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const selectedClass = classes.find((c) => c._id === filterClass);

  const filteredTests = useMemo(() => {
    let result = tests;
    if (filterClass) result = result.filter((t: any) => t.classId === filterClass);
    if (filterSection) result = result.filter((t: any) => t.section === filterSection.toUpperCase());
    if (filterSubject) result = result.filter((t: any) => t.subject === filterSubject);
    return result;
  }, [tests, filterClass, filterSection, filterSubject]);

  const uniqueSubjects = useMemo(() => {
    return [...new Set(tests.map((t: any) => t.subject))].sort();
  }, [tests]);

  const overallStats = useMemo(() => {
    if (filteredTests.length === 0) return null;
    const withMarks = filteredTests.filter((t: any) => t.markCount > 0);
    const avgPct = withMarks.length > 0
      ? withMarks.reduce((s: number, t: any) => s + t.averagePct, 0) / withMarks.length
      : 0;
    const totalMarks = withMarks.reduce((s: number, t: any) => s + t.markCount, 0);
    return {
      totalTests: filteredTests.length,
      avgPct: Math.round(avgPct * 10) / 10,
      totalMarksEntered: totalMarks,
    };
  }, [filteredTests]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (type === "daily") await removeDaily({ id: deleteTarget._id });
      else await removeWeekly({ id: deleteTarget._id });
      toast.success("Deleted");
    } catch (e: any) { toast.error(e.message); }
    setDeleteTarget(null);
  };

  const exportCSV = () => {
    if (filteredTests.length === 0) return;
    const headers = ["Date", "Class", "Section", "Subject", "Title", "Total Marks", "Marks Entered", "Average %", "Highest %", "Lowest %"];
    const rows = filteredTests.map((t: any) => [
      t.date, t.className, t.section, t.subject, t.title || "", t.totalMarks, t.markCount, t.averagePct, t.highestPct ?? "", t.lowestPct ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${type}-tests-report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <>
      {overallStats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{overallStats.totalTests}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total Tests</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{overallStats.avgPct}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">Average</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{overallStats.totalMarksEntered}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Marks Entered</p>
          </CardContent></Card>
        </div>
      )}

      {subjectStats.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4" /> Subject-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {subjectStats.map((s: any) => (
                <div key={s.subject} className="flex items-center justify-between rounded-md border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{s.subject}</p>
                    <p className="text-[10px] text-muted-foreground">{s.testCount} tests · {s.totalEntries} entries</p>
                  </div>
                  <Badge variant={s.averagePct >= 60 ? "default" : s.averagePct >= 33 ? "secondary" : "destructive"} className="text-xs">
                    {s.averagePct}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between mb-3">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="size-3.5 mr-1" /> Filters
          {(filterClass || filterSection || filterSubject) && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4">
              {[filterClass && selectedClass?.name, filterSection, filterSubject].filter(Boolean).length}
            </Badge>
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredTests.length === 0}>
            <Download className="size-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5 mr-1" /> New {type === "daily" ? "Daily" : "Weekly"} Test
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Class</Label>
                <Select value={filterClass} onValueChange={(v) => { setFilterClass(v === "_all" ? "" : v); setFilterSection(""); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Classes</SelectItem>
                    {classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Section</Label>
                <Select value={filterSection || "_all"} onValueChange={(v) => setFilterSection(v === "_all" ? "" : v)} disabled={!filterClass}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Sections</SelectItem>
                    {selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Subject</Label>
                <Select value={filterSubject || "_all"} onValueChange={(v) => setFilterSubject(v === "_all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Subjects</SelectItem>
                    {uniqueSubjects.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(filterClass || filterSection || filterSubject) && (
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setFilterClass(""); setFilterSection(""); setFilterSubject(""); }}>
                <X className="size-3 mr-1" /> Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {filteredTests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="size-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {type === "daily" ? "daily" : "weekly"} tests{(filterClass || filterSection || filterSubject) ? " match filters" : " yet"}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTests.map((t: any) => (
            <Card key={t._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{t.title || `${t.subject} Test`}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.className} — {t.section} · {t.subject}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.totalMarks} marks</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{formatDate(t.date)}</p>
                {t.markCount > 0 && (
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{t.markCount} marks entered</span>
                      <span className="font-semibold">Avg {t.averagePct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.averagePct >= 60 ? "bg-emerald-500" : t.averagePct >= 33 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(t.averagePct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><TrendingDown className="size-2.5" /> {t.lowestPct ?? 0}%</span>
                      <span className="flex items-center gap-0.5"><TrendingUp className="size-2.5" /> {t.highestPct ?? 0}%</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetailTest(t)}>
                    <Eye className="size-3 mr-1" /> View
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMarkTest(t)}>
                    <Pencil className="size-3 mr-1" /> Marks
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TestForm open={createOpen} onOpenChange={setCreateOpen} type={type} />
      {markTest && <MarkEntryDialog testId={markTest._id} type={type} open={!!markTest} onOpenChange={(v) => { if (!v) setMarkTest(null); }} />}
      {detailTest && <TestDetailDialog testId={detailTest._id} type={type} open={!!detailTest} onOpenChange={(v) => { if (!v) setDetailTest(null); }} />}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete test?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the test and all its marks.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─────────── MAIN PAGE ─────────── */
export default function Tests() {
  return (
    <AppShell title="Tests">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Daily and weekly test tracking with mark entry, subject analysis, and performance reports</p>
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily"><ClipboardList className="size-3.5 mr-1" /> Daily Tests</TabsTrigger>
            <TabsTrigger value="weekly"><BookOpen className="size-3.5 mr-1" /> Weekly Tests</TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><TestList type="daily" /></TabsContent>
          <TabsContent value="weekly"><TestList type="weekly" /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
