import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookCheck, CheckCircle2, XCircle, MinusCircle, Save } from "lucide-react";
import { todayStr } from "@/lib/format";
import { toast } from "sonner";

const STATUS_ICON: Record<string, React.ReactNode> = {
  complete: <CheckCircle2 className="size-4 text-emerald-600" />,
  incomplete: <XCircle className="size-4 text-amber-600" />,
  not_brought: <MinusCircle className="size-4 text-red-500" />,
};

const COMMON_SUBJECTS = ["English", "Urdu", "Mathematics", "Science", "Social Studies", "Islamiyat", "Computer"];

export default function NotebookCheck() {
  const classes = useQuery(api.classes.list) ?? [];
  const students = useQuery(api.students.list, {}) ?? [];
  const existingChecks = useQuery(api.notebookChecks.list, {});
  const saveChecks = useMutation(api.notebookChecks.saveChecks);

  const [classId, setClassId] = useState<Id<"classes"> | "">("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState<Record<string, { pagesExpected: number; pagesCompleted: number; status: "complete" | "incomplete" | "not_brought"; remarks: string }>>({});
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c._id === classId);
  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId && s.section === section && s.status === "active"),
    [students, classId, section],
  );

  // Pre-fill entries from existing checks if available
  const existingMap = useMemo(() => {
    if (!existingChecks) return new Map();
    const map = new Map<string, typeof existingChecks[0]>();
    for (const c of existingChecks) {
      if (c.classId === classId && c.section === section && c.subject === subject && c.date === date) {
        map.set(c.studentId, c);
      }
    }
    return map;
  }, [existingChecks, classId, section, subject, date]);

  const getEntry = (studentId: string) => {
    if (entries[studentId]) return entries[studentId];
    const existing = existingMap.get(studentId);
    if (existing) return { pagesExpected: existing.pagesExpected, pagesCompleted: existing.pagesCompleted, status: existing.status as "complete" | "incomplete" | "not_brought", remarks: existing.remarks ?? "" };
    return { pagesExpected: 20, pagesCompleted: 0, status: "not_brought" as const, remarks: "" };
  };

  const setEntry = (studentId: string, field: string, value: any) => {
    setEntries((prev) => ({ ...prev, [studentId]: { ...getEntry(studentId), [field]: value } }));
  };

  const handleSave = async () => {
    if (!classId || !section || !subject || classStudents.length === 0) {
      return toast.error("Select class, section, subject and ensure students exist");
    }
    setSaving(true);
    try {
      const payload = classStudents.map((s) => {
        const e = getEntry(s._id);
        return { studentId: s._id, ...e };
      });
      await saveChecks({ classId, section, subject, date, entries: payload });
      toast.success(`Saved notebook checks for ${payload.length} students`);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <AppShell title="Notebook Check">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Track notebook completion per student per subject</p>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Select value={classId} onValueChange={(v) => { setClassId(v as Id<"classes">); setSection(""); }}>
            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={section} onValueChange={setSection} disabled={!classId}>
            <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>{selectedClass?.sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>{COMMON_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {!classId || !section || !subject ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookCheck className="size-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select class, section, and subject to begin</p>
          </div>
        ) : classStudents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No active students in this class/section</div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead className="w-12">#</TableHead><TableHead>Student</TableHead><TableHead>Roll</TableHead>
                  <TableHead className="text-center">Pages Expected</TableHead><TableHead className="text-center">Pages Done</TableHead>
                  <TableHead className="text-center">Status</TableHead><TableHead>Remarks</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {classStudents.map((s, idx) => {
                    const e = getEntry(s._id);
                    return (
                      <TableRow key={s._id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{s.rollNumber}</TableCell>
                        <TableCell className="text-center"><Input type="number" min={0} value={e.pagesExpected} onChange={(ev) => setEntry(s._id, "pagesExpected", parseInt(ev.target.value) || 0)} className="w-16 h-8 text-center text-xs mx-auto" /></TableCell>
                        <TableCell className="text-center"><Input type="number" min={0} value={e.pagesCompleted} onChange={(ev) => setEntry(s._id, "pagesCompleted", parseInt(ev.target.value) || 0)} className="w-16 h-8 text-center text-xs mx-auto" /></TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {(["complete", "incomplete", "not_brought"] as const).map((st) => (
                              <Button key={st} variant={e.status === st ? "default" : "outline"} size="sm" className="h-7 px-2 text-[10px]" onClick={() => setEntry(s._id, "status", st)}>
                                {STATUS_ICON[st]} <span className="ml-1 hidden sm:inline">{st === "not_brought" ? "N/A" : st}</span>
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-32"><Input value={e.remarks} onChange={(ev) => setEntry(s._id, "remarks", ev.target.value)} placeholder="Optional" className="h-8 text-xs" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end"><Button onClick={handleSave} disabled={saving}><Save className="size-4 mr-1" />{saving ? "Saving..." : "Save All"}</Button></div>
          </>
        )}
      </div>
    </AppShell>
  );
}
