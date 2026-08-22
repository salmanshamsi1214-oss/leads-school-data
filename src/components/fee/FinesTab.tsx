import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatPkr, todayStr } from "@/lib/format";
import type { FeeMethod } from "@/convex/schema";
import { Plus, DollarSign, ShieldOff, CreditCard, AlertTriangle, Search } from "lucide-react";

export function FinesTab({ period }: { period: string }) {
  const fines = useQuery(api.feeManagement.listFines, { period });
  const students = useQuery(api.students.list, { status: "active" }) ?? [];
  const addFine = useMutation(api.feeManagement.addFine);
  const payFine = useMutation(api.feeManagement.payFine);
  const waiveFine = useMutation(api.feeManagement.waiveFine);

  const [addDialog, setAddDialog] = useState(false);
  const [payDialog, setPayDialog] = useState<any>(null);
  const [waiveDialog, setWaiveDialog] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    studentId: "" as string,
    label: "",
    amount: "",
    dueDate: "",
    reason: "",
  });
  const [payForm, setPayForm] = useState({ amount: "", method: "cash" as FeeMethod, date: todayStr(), remarks: "" });
  const [waiveReason, setWaiveReason] = useState("");

  const [searchText, setSearchText] = useState("");
  const filtered = fines?.filter((f) => {
    if (filter !== "all" && f.status !== filter) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      return f.studentName.toLowerCase().includes(q) || f.label.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];
  const pendingTotal = fines?.filter((f) => f.status === "pending").reduce((s, f) => s + f.amount - (f.paidAmount ?? 0), 0) ?? 0;

  const handleAdd = async () => {
    if (!form.studentId || !form.label.trim() || !Number(form.amount)) {
      toast.error("Student, label and amount are required.");
      return;
    }
    setSaving(true);
    try {
      await addFine({
        studentId: form.studentId as Id<"students">,
        period,
        label: form.label,
        amount: Number(form.amount),
        dueDate: form.dueDate || undefined,
        reason: form.reason || undefined,
      });
      toast.success("Fine added.");
      setAddDialog(false);
      setForm({ studentId: "", label: "", amount: "", dueDate: "", reason: "" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async () => {
    if (!payDialog) return;
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount."); return; }
    setSaving(true);
    try {
      const result = await payFine({
        fineId: payDialog._id,
        amount: amt,
        method: payForm.method,
        date: payForm.date,
        remarks: payForm.remarks || undefined,
      });
      toast.success(`Fine payment recorded. Status: ${result.status}`);
      setPayDialog(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleWaive = async () => {
    if (!waiveDialog || !waiveReason.trim()) { toast.error("Reason required to waive."); return; }
    setSaving(true);
    try {
      await waiveFine({ fineId: waiveDialog._id, reason: waiveReason });
      toast.success("Fine waived.");
      setWaiveDialog(null);
      setWaiveReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "pending", "paid", "waived"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="h-7 text-xs capitalize">
              {f}{filter === f && filtered.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4">{filtered.length}</Badge>}
            </Button>
          ))}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingTotal > 0 && (
            <span className="text-xs text-red-600 font-semibold">Pending: {formatPkr(pendingTotal)}</span>
          )}
          <Button size="sm" onClick={() => setAddDialog(true)}>
            <Plus className="size-3.5 mr-1" /> Add Fine
          </Button>
        </div>
      </div>

      {!fines ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <DollarSign className="size-10 mx-auto mb-3 opacity-30" />
          <p>No fines {filter !== "all" ? `with status "${filter}"` : ""} for this period.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Student</TableHead>
              <TableHead>Fine</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((f) => {
                const outstanding = f.amount - (f.paidAmount ?? 0);
                return (
                  <TableRow key={f._id}>
                    <TableCell>
                      <p className="font-medium text-sm">{f.studentName}</p>
                      <p className="text-[10px] text-muted-foreground">Roll {f.rollNumber} · {f.className}</p>
                    </TableCell>
                    <TableCell className="text-sm">{f.label}{f.reason && <p className="text-[10px] text-muted-foreground">{f.reason}</p>}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatPkr(f.amount)}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">{f.paidAmount ? formatPkr(f.paidAmount) : "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${f.status === "paid" ? "bg-emerald-100 text-emerald-700" : f.status === "waived" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{f.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.dueDate ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {f.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] text-emerald-600" onClick={() => { setPayDialog(f); setPayForm({ amount: String(outstanding), method: "cash", date: todayStr(), remarks: "" }); }}>
                            <CreditCard className="size-3 mr-1" /> Pay
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600" onClick={() => { setWaiveDialog(f); setWaiveReason(""); }}>
                            <ShieldOff className="size-3 mr-1" /> Waive
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Fine Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Fine</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Student</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map((s) => <SelectItem key={s._id} value={s._id}>{s.name} ({s.rollNumber})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Fine Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Late fee, Library fine" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Amount (Rs.)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional" className="h-8 text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? "Saving..." : "Add Fine"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Fine Dialog */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pay Fine — {payDialog?.studentName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/50 p-2 rounded text-xs">
              Fine: {payDialog?.label} · Total: {formatPkr(payDialog?.amount ?? 0)} · Already paid: {formatPkr(payDialog?.paidAmount ?? 0)}
            </div>
            <div><Label className="text-xs">Amount</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Method</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v as FeeMethod })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Remarks</Label><Input value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} className="h-8 text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button size="sm" onClick={handlePay} disabled={saving}>{saving ? "Saving..." : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Fine Dialog */}
      <Dialog open={!!waiveDialog} onOpenChange={() => setWaiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-blue-600" /> Waive Fine</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Waiving fine for <strong>{waiveDialog?.studentName}</strong> — {waiveDialog?.label} ({formatPkr(waiveDialog?.amount ?? 0)})</p>
            <div><Label className="text-xs">Reason (required)</Label><Input value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} placeholder="Why is this fine being waived?" className="h-8 text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWaiveDialog(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleWaive} disabled={saving || !waiveReason.trim()}>{saving ? "Saving..." : "Waive Fine"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
