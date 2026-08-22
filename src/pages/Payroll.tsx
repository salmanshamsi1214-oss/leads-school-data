import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Pencil,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPkr } from "@/lib/format";
import { cn } from "@/lib/utils";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700 hover:bg-slate-200",
  approved: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};

export default function Payroll() {
  const [month, setMonth] = useState(currentMonth());
  const records = useQuery(api.payroll.list, { month });
  const summary = useQuery(api.payroll.summary, { month });
  const generate = useMutation(api.payroll.generate);
  const updateRecord = useMutation(api.payroll.update);
  const setStatus = useMutation(api.payroll.setStatus);

  const [editing, setEditing] = useState<{
    id: Id<"payrollRecords">;
    allowance: number;
    deduction: number;
    bonus: number;
    remarks: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const count = await generate({ month });
      toast.success(`Generated ${count} salary slips for ${month}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await updateRecord({
        id: editing.id,
        allowance: editing.allowance,
        deduction: editing.deduction,
        bonus: editing.bonus,
        remarks: editing.remarks,
      });
      toast.success("Updated");
      setEditing(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleApprove = async (id: Id<"payrollRecords">) => {
    try {
      await setStatus({ id, status: "approved" });
      toast.success("Approved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleMarkPaid = async (id: Id<"payrollRecords">) => {
    try {
      await setStatus({ id, status: "paid", paidMethod: "cash" });
      toast.success("Marked as paid");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <AppShell title="Payroll">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="cursor-pointer">
            {generating ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Wallet className="mr-1 size-4" />
            )}
            {generating ? "Generating..." : "Generate Payroll"}
          </Button>
        </div>

        {/* Summary cards */}
        {summary && summary.count > 0 && (
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryCard
              label="Total"
              value={formatPkr(summary.total ?? 0)}
              icon={CircleDollarSign}
              tone="default"
            />
            <SummaryCard
              label="Paid"
              value={formatPkr(summary.paid ?? 0)}
              icon={CheckCircle2}
              tone="success"
            />
            <SummaryCard
              label="Approved"
              value={formatPkr(summary.approved ?? 0)}
              icon={FileText}
              tone="default"
            />
            <SummaryCard
              label="Pending"
              value={formatPkr(summary.pending ?? 0)}
              icon={CalendarDays}
              tone="warning"
            />
          </div>
        )}

        {records === undefined ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
            <Wallet className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold">No payroll for this month</p>
            <p className="text-xs text-muted-foreground">
              Click "Generate Payroll" to create salary slips for all active
              teachers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Allow.</TableHead>
                  <TableHead>Ded.</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <p className="font-semibold">{r.teacherName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.teacherSubject}
                      </p>
                    </TableCell>
                    <TableCell>{formatPkr(r.baseSalary)}</TableCell>
                    <TableCell>{formatPkr(r.allowance ?? 0)}</TableCell>
                    <TableCell>{formatPkr(r.deduction ?? 0)}</TableCell>
                    <TableCell>{formatPkr(r.bonus ?? 0)}</TableCell>
                    <TableCell className="font-bold">
                      {formatPkr(r.netPay)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(STATUS_STYLE[r.status])}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 cursor-pointer"
                            onClick={() =>
                              setEditing({
                                id: r._id,
                                allowance: r.allowance ?? 0,
                                deduction: r.deduction ?? 0,
                                bonus: r.bonus ?? 0,
                                remarks: r.remarks ?? "",
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {r.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 cursor-pointer text-blue-600"
                            onClick={() => handleApprove(r._id)}
                          >
                            ✓
                          </Button>
                        )}
                        {r.status !== "paid" && r.status !== "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 cursor-pointer text-emerald-600"
                            onClick={() => handleMarkPaid(r._id)}
                          >
                            $
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Salary Slip</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Allowance</Label>
                <Input
                  type="number"
                  value={editing.allowance}
                  onChange={(e) =>
                    setEditing({ ...editing, allowance: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Deduction</Label>
                <Input
                  type="number"
                  value={editing.deduction}
                  onChange={(e) =>
                    setEditing({ ...editing, deduction: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Bonus</Label>
                <Input
                  type="number"
                  value={editing.bonus}
                  onChange={(e) =>
                    setEditing({ ...editing, bonus: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Remarks</Label>
                <Input
                  value={editing.remarks}
                  onChange={(e) =>
                    setEditing({ ...editing, remarks: e.target.value })
                  }
                  placeholder="Optional notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "success" | "warning";
}) {
  const tones = {
    default: "border-l-slate-300",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
  };
  return (
    <div className={cn("rounded-lg border border-l-4 bg-card p-4", tones[tone])}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
