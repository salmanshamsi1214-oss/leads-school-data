import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, FileCheck, Eye, CheckCircle2, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700", icon: FileCheck },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  reviewed: { label: "Reviewed", color: "bg-emerald-100 text-emerald-700", icon: Eye },
  returned: { label: "Returned", color: "bg-amber-100 text-amber-700", icon: RotateCcw },
};

const TYPE_LABELS: Record<string, string> = { written: "Written", practical: "Practical", project: "Project", presentation: "Presentation", other: "Other" };

function SubmissionForm({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const students = useQuery(api.students.list, { status: "active" }) ?? [];
  const createSubmission = useMutation(api.activitySubmissions.create);
  const [studentId, setStudentId] = useState<Id<"students"> | "">(initial?.studentId ?? "");
  const [activityTitle, setActivityTitle] = useState(initial?.activityTitle ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [submissionType, setSubmissionType] = useState<"written" | "practical" | "project" | "presentation" | "other">((initial?.submissionType as any) ?? "written");
  const [totalMarks, setTotalMarks] = useState(initial?.totalMarks?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!studentId) return toast.error("Select a student");
    if (!activityTitle.trim()) return toast.error("Activity title is required");
    setSaving(true);
    try {
      await createSubmission({ studentId, activityTitle: activityTitle.trim(), subject: subject.trim() || undefined, description: description.trim() || undefined, submissionType, totalMarks: totalMarks ? parseInt(totalMarks) : undefined });
      toast.success("Activity created");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Activity Submission</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Student *</Label><Select value={studentId} onValueChange={(v) => setStudentId(v as Id<"students">)}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} ({s.rollNumber})</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Activity Title *</Label><Input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="e.g. Science Fair Presentation" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Science" /></div>
            <div className="space-y-1.5"><Label>Type</Label><Select value={submissionType} onValueChange={(v) => setSubmissionType(v as typeof submissionType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Activity details..." rows={3} /></div>
          <div className="space-y-1.5"><Label>Total Marks</Label><Input type="number" min={0} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} placeholder="Optional" className="w-32" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving ? "Creating..." : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ submission, open, onOpenChange }: { submission: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const review = useMutation(api.activitySubmissions.review);
  const [status, setStatus] = useState<"submitted" | "reviewed" | "returned">(submission.status === "pending" ? "submitted" : submission.status);
  const [marksObtained, setMarksObtained] = useState(submission.marksObtained?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [saving, setSaving] = useState(false);

  const handleReview = async () => {
    setSaving(true);
    try {
      await review({ id: submission._id, status, marksObtained: marksObtained ? parseInt(marksObtained) : undefined, feedback: feedback.trim() || undefined });
      toast.success("Submission reviewed");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Review — {submission.activityTitle}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p><span className="font-semibold">Student:</span> {submission.studentName}</p>
            <p><span className="font-semibold">Type:</span> {TYPE_LABELS[submission.submissionType]}</p>
            {submission.description && <p className="mt-1 text-muted-foreground">{submission.description}</p>}
          </div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="returned">Returned for revision</SelectItem>
          </SelectContent></Select></div>
          {submission.totalMarks && (
            <div className="space-y-1.5"><Label>Marks (out of {submission.totalMarks})</Label><Input type="number" min={0} max={submission.totalMarks} value={marksObtained} onChange={(e) => setMarksObtained(e.target.value)} className="w-32" /></div>
          )}
          <div className="space-y-1.5"><Label>Feedback</Label><Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write feedback for the student..." rows={3} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleReview} disabled={saving}>{saving ? "Saving..." : "Save Review"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivitySubmissions() {
  const submissions = useQuery(api.activitySubmissions.list, {});
  const removeSubmission = useMutation(api.activitySubmissions.remove);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [tab, setTab] = useState("pending");

  const filtered = submissions?.filter((s) => tab === "all" || s.status === tab) ?? [];
  const counts = submissions ? { pending: submissions.filter((s) => s.status === "pending").length, submitted: submissions.filter((s) => s.status === "submitted").length, reviewed: submissions.filter((s) => s.status === "reviewed").length, returned: submissions.filter((s) => s.status === "returned").length } : { pending: 0, submitted: 0, reviewed: 0, returned: 0 };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await removeSubmission({ id: deleteTarget._id }); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
    setDeleteTarget(null);
  };

  return (
    <AppShell title="Activity Submissions">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} submission{filtered.length === 1 ? "" : "s"} in view</p>
          <Button onClick={() => setFormOpen(true)}><Plus className="size-4 mr-1" /> New Activity</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="submitted">Submitted ({counts.submitted})</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed ({counts.reviewed})</TabsTrigger>
            <TabsTrigger value="returned">Returned ({counts.returned})</TabsTrigger>
            <TabsTrigger value="all">All ({submissions?.length ?? 0})</TabsTrigger>
          </TabsList>
        </Tabs>

        {!submissions ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><FileCheck className="size-10 mx-auto mb-3 opacity-30" /><p className="font-medium">No {tab === "all" ? "" : tab} submissions</p></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Student</TableHead><TableHead>Activity</TableHead><TableHead>Type</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead><TableHead>Marks</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell><p className="font-medium">{s.studentName}</p><p className="text-xs text-muted-foreground">Roll {s.rollNumber}</p></TableCell>
                    <TableCell><p className="font-medium text-sm">{s.activityTitle}</p>{s.subject && <p className="text-xs text-muted-foreground">{s.subject}</p>}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{TYPE_LABELS[s.submissionType]}</Badge></TableCell>
                    <TableCell className="text-xs">{s.className} — {s.section}</TableCell>
                    <TableCell><Badge className={`text-[10px] ${STATUS_CONFIG[s.status]?.color}`}>{STATUS_CONFIG[s.status]?.label}</Badge></TableCell>
                    <TableCell className="text-xs">{s.marksObtained != null && s.totalMarks ? `${s.marksObtained}/${s.totalMarks}` : "—"}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setReviewTarget(s)}><Eye className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="size-3.5" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <SubmissionForm open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false); }} />
      {reviewTarget && <ReviewDialog submission={reviewTarget} open={!!reviewTarget} onOpenChange={(v) => { if (!v) setReviewTarget(null); }} />}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete submission?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
