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
import { Plus, Pencil, Trash2, Phone, MessageSquare, Calendar, UserRound } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type InquiryStatus = "new" | "contacted" | "follow_up" | "enrolled" | "closed";
type InquirySource = "walk_in" | "phone" | "whatsapp" | "referral" | "social_media" | "other";

const STATUS_LABELS: Record<InquiryStatus, string> = { new: "New", contacted: "Contacted", follow_up: "Follow-up", enrolled: "Enrolled", closed: "Closed" };
const STATUS_COLORS: Record<InquiryStatus, string> = { new: "bg-blue-100 text-blue-700", contacted: "bg-amber-100 text-amber-700", follow_up: "bg-orange-100 text-orange-700", enrolled: "bg-emerald-100 text-emerald-700", closed: "bg-gray-100 text-gray-700" };
const SOURCE_LABELS: Record<InquirySource, string> = { walk_in: "Walk-in", phone: "Phone", whatsapp: "WhatsApp", referral: "Referral", social_media: "Social Media", other: "Other" };

function InquiryForm({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const create = useMutation(api.inquiries.create);
  const update = useMutation(api.inquiries.update);
  const [form, setForm] = useState({
    studentName: initial?.studentName ?? "",
    fatherName: initial?.fatherName ?? "",
    phone: initial?.phone ?? "",
    classInterested: initial?.classInterested ?? "",
    source: (initial?.source ?? "walk_in") as InquirySource,
    status: (initial?.status ?? "new") as InquiryStatus,
    nextFollowUp: initial?.nextFollowUp ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.studentName.trim()) return toast.error("Student name is required");
    if (!form.phone.trim()) return toast.error("Phone number is required");
    setSaving(true);
    try {
      if (initial) {
        await update({ id: initial._id, ...form });
        toast.success("Inquiry updated");
      } else {
        await create(form);
        toast.success("Inquiry created");
      }
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit Inquiry" : "New Admission Inquiry"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Student Name *</Label>
            <Input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Student name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Father's Name</Label><Input value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="03XX-XXXXXXX" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Class Interested</Label><Input value={form.classInterested} onChange={(e) => setForm({ ...form, classInterested: e.target.value })} placeholder="e.g. 1st, Nursery" /></div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as InquirySource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {initial && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InquiryStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Follow-up Date</Label><Input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} /></div>
            </div>
          )}
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : initial ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdmissionInquiry() {
  const inquiries = useQuery(api.inquiries.list, {});
  const removeInquiry = useMutation(api.inquiries.remove);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = inquiries?.filter((i) => statusFilter === "all" || i.status === statusFilter) ?? [];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await removeInquiry({ id: deleteTarget._id }); toast.success("Deleted"); } catch (e: any) { toast.error(e.message); }
    setDeleteTarget(null);
  };

  return (
    <AppShell title="Admission Inquiry">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} inquiry{filtered.length === 1 ? "" : "ies"} in view</p>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4 mr-1" /> New Inquiry</Button>
          </div>
        </div>

        {inquiries === undefined ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><UserRound className="size-10 mx-auto mb-3 opacity-30" /><p className="font-medium">No inquiries yet</p><p className="text-sm mt-1">Click "New Inquiry" to log a prospective student</p></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Student</TableHead><TableHead>Phone</TableHead><TableHead>Class</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Follow-up</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((inq) => (
                  <TableRow key={inq._id}>
                    <TableCell><div><p className="font-medium">{inq.studentName}</p>{inq.fatherName && <p className="text-xs text-muted-foreground">Father: {inq.fatherName}</p>}</div></TableCell>
                    <TableCell className="text-xs">{inq.phone}</TableCell>
                    <TableCell className="text-xs">{inq.classInterested || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[inq.source]}</Badge></TableCell>
                    <TableCell><Badge className={`text-[10px] ${STATUS_COLORS[inq.status]}`}>{STATUS_LABELS[inq.status]}</Badge></TableCell>
                    <TableCell className="text-xs">{inq.nextFollowUp ? formatDate(inq.nextFollowUp) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(inq); setFormOpen(true); }}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteTarget(inq)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <InquiryForm open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditing(null); } }} initial={editing} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete inquiry?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the inquiry for "{deleteTarget?.studentName}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
