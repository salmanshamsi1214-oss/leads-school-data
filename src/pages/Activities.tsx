import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Calendar, Trophy, Users, MapPin, Clock, CheckCircle2, XCircle, Megaphone } from "lucide-react";
import { formatDate, todayStr } from "@/lib/format";
import { toast } from "sonner";

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  sports: { label: "Sports", color: "bg-blue-100 text-blue-700", icon: Trophy },
  cultural: { label: "Cultural", color: "bg-purple-100 text-purple-700", icon: Calendar },
  academic: { label: "Academic", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  competition: { label: "Competition", color: "bg-amber-100 text-amber-700", icon: Trophy },
  workshop: { label: "Workshop", color: "bg-cyan-100 text-cyan-700", icon: Calendar },
  field_trip: { label: "Field Trip", color: "bg-orange-100 text-orange-700", icon: MapPin },
  assembly: { label: "Assembly", color: "bg-gray-100 text-gray-700", icon: Megaphone },
  other: { label: "Other", color: "bg-slate-100 text-slate-700", icon: Calendar },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  upcoming: { label: "Upcoming", color: "bg-blue-100 text-blue-700", icon: Clock },
  ongoing: { label: "Ongoing", color: "bg-amber-100 text-amber-700", icon: Calendar },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle },
};

/* ─────────── EVENT FORM DIALOG ─────────── */
function EventForm({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const classes = useQuery(api.classes.list) ?? [];
  const createActivity = useMutation(api.activities.create);
  const updateActivity = useMutation(api.activities.update);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<"sports" | "cultural" | "academic" | "competition" | "workshop" | "field_trip" | "assembly" | "other">((initial?.type as any) ?? "sports");
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [organizer, setOrganizer] = useState(initial?.organizer ?? "");
  const [status, setStatus] = useState<"upcoming" | "ongoing" | "completed" | "cancelled">((initial?.status as any) ?? "upcoming");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Activity title is required");
    setSaving(true);
    try {
      const args = { title: title.trim(), description: description.trim() || undefined, type, date, endDate: endDate || undefined, location: location.trim() || undefined, organizer: organizer.trim() || undefined, status };
      if (initial) { await updateActivity({ id: initial._id, ...args }); toast.success("Activity updated"); }
      else { await createActivity(args); toast.success("Activity created"); }
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Activity" : "New Activity"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual Sports Day" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Activity details..." rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Type</Label><Select value={type} onValueChange={(v) => setType(v as typeof type)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Start Date *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. School Ground" /></div>
            <div className="space-y-1.5"><Label>Organizer</Label><Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="e.g. Sports Dept." /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : initial ? "Update" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── PARTICIPANTS DIALOG ─────────── */
function ParticipantsDialog({ activity, open, onOpenChange }: { activity: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const fullActivity = useQuery(api.activities.get, { id: activity._id });
  const students = useQuery(api.students.list, { status: "active" }) ?? [];
  const addParticipants = useMutation(api.activities.addParticipants);
  const removeParticipant = useMutation(api.activities.removeParticipant);

  const [selectedStudent, setSelectedStudent] = useState<Id<"students"> | "">("");
  const [role, setRole] = useState("");
  const [result, setResult] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedStudent) return toast.error("Select a student");
    setAdding(true);
    try {
      await addParticipants({ activityId: activity._id, entries: [{ studentId: selectedStudent, role: role.trim() || undefined, result: result.trim() || undefined }] });
      toast.success("Participant added");
      setSelectedStudent(""); setRole(""); setResult("");
    } catch (e: any) { toast.error(e.message); }
    finally { setAdding(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Participants — {activity.title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2 items-end">
            <div className="col-span-2 space-y-1"><Label>Student</Label><Select value={selectedStudent} onValueChange={(v) => setSelectedStudent(v as Id<"students">)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Participant" className="h-9 text-xs" /></div>
            <Button onClick={handleAdd} disabled={adding} className="h-9">{adding ? "..." : "Add"}</Button>
          </div>
          {!fullActivity ? <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div> : fullActivity.participants.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground text-sm">No participants yet</p>
          ) : (
            <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Roll</TableHead><TableHead>Role</TableHead><TableHead>Result</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>{fullActivity.participants.map((p: any) => (
                <TableRow key={p._id}><TableCell className="font-medium text-sm">{p.studentName}</TableCell><TableCell className="text-xs">{p.rollNumber}</TableCell><TableCell className="text-xs">{p.role || "—"}</TableCell><TableCell className="text-xs">{p.result || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={async () => { try { await removeParticipant({ id: p._id }); } catch { /* */ } }}><Trash2 className="size-3" /></Button></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── MAIN PAGE ─────────── */
export default function Activities() {
  const activities = useQuery(api.activities.list, {});
  const removeActivity = useMutation(api.activities.remove);
  const updateStatus = useMutation(api.activities.updateStatus);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [participantsTarget, setParticipantsTarget] = useState<any>(null);
  const [tab, setTab] = useState("all");

  const filtered = activities?.filter((a) => tab === "all" || a.status === tab) ?? [];
  const counts = activities ? { upcoming: activities.filter((a) => a.status === "upcoming").length, ongoing: activities.filter((a) => a.status === "ongoing").length, completed: activities.filter((a) => a.status === "completed").length, cancelled: activities.filter((a) => a.status === "cancelled").length } : { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await removeActivity({ id: deleteTarget._id }); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
    setDeleteTarget(null);
  };

  return (
    <AppShell title="Activities">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} activit{filtered.length === 1 ? "y" : "ies"} in view</p>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4 mr-1" /> New Activity</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({activities?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({counts.upcoming})</TabsTrigger>
            <TabsTrigger value="ongoing">Ongoing ({counts.ongoing})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
          </TabsList>
        </Tabs>

        {!activities ? <div className="text-center py-12 text-muted-foreground">Loading...</div> : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Calendar className="size-10 mx-auto mb-3 opacity-30" /><p className="font-medium">No activities yet</p><p className="text-sm mt-1">Click "New Activity" to add an event</p></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((act) => {
              const TConf = TYPE_CONFIG[act.type] ?? TYPE_CONFIG.other;
              const SConf = STATUS_CONFIG[act.status] ?? STATUS_CONFIG.upcoming;
              const TIcon = TConf.icon;
              const SIcon = SConf.icon;
              return (
                <Card key={act._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center"><TIcon className="size-4 text-primary" /></div>
                        <div>
                          <h3 className="font-semibold text-sm">{act.title}</h3>
                          <p className="text-xs text-muted-foreground">{act.classNames}</p>
                        </div>
                      </div>
                      <Badge className={`text-[10px] ${SConf.color}`}><SIcon className="size-3 mr-1" />{SConf.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(act.date)}</span>
                      {act.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{act.location}</span>}
                    </div>
                    {act.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{act.description}</p>}
                    <Badge variant="outline" className={`text-[10px] mb-3 ${TConf.color}`}>{TConf.label}</Badge>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-1">
                        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "cancelled").map(([k, v]) => (
                          <Button key={k} variant={act.status === k ? "default" : "ghost"} size="sm" className="h-6 px-2 text-[10px]"
                            onClick={async () => { try { await updateStatus({ id: act._id, status: k as any }); } catch { /* */ } }}>
                            {v.label}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => setParticipantsTarget(act)}><Users className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditing(act); setFormOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => setDeleteTarget(act)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <EventForm open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditing(null); } }} initial={editing} />
      {participantsTarget && <ParticipantsDialog activity={participantsTarget} open={!!participantsTarget} onOpenChange={(v) => { if (!v) setParticipantsTarget(null); }} />}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete activity?</AlertDialogTitle><AlertDialogDescription>This will delete the activity and all participant records.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
