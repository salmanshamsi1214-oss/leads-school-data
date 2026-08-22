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
import { Plus, Pencil, Trash2, Bot, Cog, Beaker, CheckCircle2, Award } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  planning: { label: "Planning", color: "bg-blue-100 text-blue-700", icon: Cog },
  building: { label: "Building", color: "bg-amber-100 text-amber-700", icon: Beaker },
  testing: { label: "Testing", color: "bg-purple-100 text-purple-700", icon: Cog },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  presented: { label: "Presented", color: "bg-orange-100 text-orange-700", icon: Award },
};

function ProjectForm({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const students = useQuery(api.students.list, { status: "active" }) ?? [];
  const createProject = useMutation(api.robotLab.create);
  const updateProject = useMutation(api.robotLab.update);

  const [studentId, setStudentId] = useState<Id<"students"> | "">(initial?.studentId ?? "");
  const [projectName, setProjectName] = useState(initial?.projectName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"planning" | "building" | "testing" | "completed" | "presented">(initial?.status ?? "planning");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [completionDate, setCompletionDate] = useState(initial?.completionDate ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!initial && !studentId) return toast.error("Select a student");
    if (!projectName.trim()) return toast.error("Project name is required");
    setSaving(true);
    try {
      if (initial) {
        await updateProject({ id: initial._id, projectName: projectName.trim(), description: description.trim() || undefined, status, startDate: startDate || undefined, completionDate: completionDate || undefined, grade: grade.trim() || undefined, remarks: remarks.trim() || undefined });
        toast.success("Project updated");
      } else {
        await createProject({ studentId: studentId as Id<"students">, projectName: projectName.trim(), description: description.trim() || undefined, startDate: startDate || undefined, remarks: remarks.trim() || undefined });
        toast.success("Project created");
      }
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Project" : "New Robotics Project"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {!initial && (
            <div className="space-y-1.5"><Label>Student *</Label><Select value={studentId} onValueChange={(v) => setStudentId(v as Id<"students">)}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} ({s.rollNumber})</SelectItem>)}</SelectContent></Select></div>
          )}
          <div className="space-y-1.5"><Label>Project Name *</Label><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Line Follower Robot" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Project description..." rows={3} /></div>
          {initial && (
            <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            {initial && <div className="space-y-1.5"><Label>Completion Date</Label><Input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} /></div>}
          </div>
          {initial && <div className="space-y-1.5"><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. A+, B, etc." /></div>}
          <div className="space-y-1.5"><Label>Remarks</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : initial ? "Update" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RobotLab() {
  const projects = useQuery(api.robotLab.list, {});
  const removeProject = useMutation(api.robotLab.remove);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = projects?.filter((p) => statusFilter === "all" || p.status === statusFilter) ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await removeProject({ id: deleteTarget._id }); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
    setDeleteTarget(null);
  };

  return (
    <AppShell title="Robotics Lab">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} project{filtered.length === 1 ? "" : "s"} in view</p>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4 mr-1" /> New Project</Button>
          </div>
        </div>

        {!projects ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Bot className="size-10 mx-auto mb-3 opacity-30" /><p className="font-medium">No robotics projects yet</p><p className="text-sm mt-1">Click "New Project" to start tracking a student's robotics work</p></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Student</TableHead><TableHead>Project</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead><TableHead>Start</TableHead><TableHead>Grade</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const StIcon = STATUS_CONFIG[p.status]?.icon ?? Cog;
                  return (
                    <TableRow key={p._id}>
                      <TableCell><div><p className="font-medium">{p.studentName}</p><p className="text-xs text-muted-foreground">Roll {p.rollNumber}</p></div></TableCell>
                      <TableCell><div><p className="font-medium text-sm">{p.projectName}</p>{p.description && <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>}</div></TableCell>
                      <TableCell className="text-xs">{p.className} — {p.section}</TableCell>
                      <TableCell><Badge className={`text-[10px] ${STATUS_CONFIG[p.status]?.color}`}><StIcon className="size-3 mr-1" />{STATUS_CONFIG[p.status]?.label}</Badge></TableCell>
                      <TableCell className="text-xs">{p.startDate ? formatDate(p.startDate) : "—"}</TableCell>
                      <TableCell className="text-xs font-medium">{p.grade || "—"}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="size-3.5" /></Button>
                      </div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <ProjectForm open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditing(null); } }} initial={editing} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
