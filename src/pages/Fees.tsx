import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Download,
  Landmark,
  Loader2,
  MessageSquare,
  Pencil,
  Percent,
  Plus,
  Receipt,
  Trash2,
  Wallet,
  Send,
  BarChart3,
  DollarSign,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { FeeMethod, FeePeriod } from "@/convex/schema";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { exportCsv, formatDate, formatPkr, todayStr } from "@/lib/format";
import { FEE_METHOD_LABELS, FEE_PERIOD_LABELS } from "@/lib/fees";
import { cn } from "@/lib/utils";
import { FinesTab } from "@/components/fee/FinesTab";
import { DefaulterTab } from "@/components/fee/DefaulterTab";
import { DailyClosingTab } from "@/components/fee/DailyClosingTab";
import { CollectionReportTab } from "@/components/fee/CollectionReportTab";
import { LedgerTab } from "@/components/fee/LedgerTab";

type StructureRow = Doc<"feeStructures"> & { className: string };
type DueRow = {
  studentId: Id<"students">;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
  baseMonthly: number;
  adjustment: number;
  monthly: number;
  paidAmount: number;
  balance: number;
  receiptNo: string | null;
  paymentId: Id<"feePayments"> | null;
  paidDate: string | null;
};

type AssignmentRow = Doc<"feeAssignments"> & {
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
};

function currentMonth(): string {
  return todayStr().slice(0, 7);
}

export default function Fees() {
  const [month, setMonth] = useState(currentMonth());

  const navigateMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const dueList = useQuery(api.fees.dueList, { period: month });
  const structures = useQuery(api.fees.structures) ?? [];
  const collections = useQuery(api.fees.collections, { period: month });

  // ---- Structure dialogs ----
  const [structureDialog, setStructureDialog] = useState(false);
  const [editingStructure, setEditingStructure] = useState<StructureRow | null>(null);
  const [deletingStructure, setDeletingStructure] = useState<StructureRow | null>(null);
  const [structureForm, setStructureForm] = useState({
    classId: "",
    label: "",
    amount: "",
    period: "monthly" as FeePeriod,
  });
  const [savingStructure, setSavingStructure] = useState(false);
  const classes = useQuery(api.classes.list) ?? [];
  const saveStructure = useMutation(api.fees.saveStructure);
  const deleteStructure = useMutation(api.fees.deleteStructure);

  // ---- Payment dialog ----
  const [paying, setPaying] = useState<DueRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash" as FeeMethod,
    date: todayStr(),
    remarks: "",
    send: "none" as "none" | "sms" | "whatsapp",
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const recordPayment = useMutation(api.fees.recordPayment);
  const deletePayment = useMutation(api.fees.deletePayment);
  const sendReceiptCopy = useAction(api.sms.sendReceiptCopy);
  const sendFeeReminder = useAction(api.sms.sendFeeReminder);
  const sendFineAlert = useAction(api.sms.sendFineAlert);
  const navigate = useNavigate();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // ---- Search & Filter state ----
  const [dueSearch, setDueSearch] = useState("");
  const [dueClassFilter, setDueClassFilter] = useState("all");
  const [dueStatusFilter, setDueStatusFilter] = useState("all");
  const [colSearch, setColSearch] = useState("");
  const [colMethodFilter, setColMethodFilter] = useState("all");
  const refundPayment = useMutation(api.feeManagement.refundPayment);
  const [refunding, setRefunding] = useState<null | { id: Id<"feePayments">; receiptNo: string; amount: number }>(null);
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);

  // ---- Fee assignment dialog ----
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRow | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<AssignmentRow | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    studentId: "",
    label: "",
    amount: "",
  });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const assignments = useQuery(api.fees.assignments) ?? [];
  const activeStudents = useQuery(api.students.list, { status: "active" }) ?? [];
  const saveAssignment = useMutation(api.fees.saveAssignment);
  const deleteAssignment = useMutation(api.fees.deleteAssignment);
  const [deletingPayment, setDeletingPayment] = useState<Doc<"feePayments"> | null>(null);

  useEffect(() => {
    if (structureDialog && !editingStructure && structureForm.classId === "" && classes.length > 0) {
      setStructureForm((prev) => ({ ...prev, classId: classes[0]._id }));
    }
  }, [structureDialog, editingStructure, structureForm.classId, classes]);

  const openStructureDialog = (structure: StructureRow | null) => {
    setEditingStructure(structure);
    if (structure) {
      setStructureForm({
        classId: structure.classId,
        label: structure.label,
        amount: String(structure.amount),
        period: structure.period,
      });
    } else {
      setStructureForm({
        classId: classes[0]?._id ?? "",
        label: "",
        amount: "",
        period: "monthly",
      });
    }
    setStructureDialog(true);
  };

  const openAssignmentDialog = (assignment: AssignmentRow | null) => {
    setEditingAssignment(assignment);
    setAssignmentForm(
      assignment
        ? {
            studentId: assignment.studentId,
            label: assignment.label,
            amount: String(assignment.amount),
          }
        : { studentId: activeStudents[0]?._id ?? "", label: "", amount: "" },
    );
    setAssignmentDialog(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignmentForm.studentId) {
      toast("Choose a student.");
      return;
    }
    const amount = Number(assignmentForm.amount);
    if (!assignmentForm.label.trim() || !Number.isFinite(amount) || amount === 0) {
      toast("A label and a non-zero amount are required.");
      return;
    }
    setSavingAssignment(true);
    try {
      await saveAssignment({
        id: editingAssignment?._id,
        studentId: assignmentForm.studentId as never,
        label: assignmentForm.label,
        amount,
      });
      toast(editingAssignment ? "Fee assignment updated." : "Fee assignment added.");
      setAssignmentDialog(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save fee assignment.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const confirmDeleteAssignment = async () => {
    if (!deletingAssignment) return;
    try {
      await deleteAssignment({ id: deletingAssignment._id });
      toast("Fee assignment removed.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete fee assignment.");
    } finally {
      setDeletingAssignment(null);
    }
  };

  const openPayDialog = (row: DueRow) => {
    setPaying(row);
    setPaymentForm({
      amount: String(row.balance),
      method: "cash",
      date: todayStr(),
      remarks: "",
      send: "none",
    });
  };

  const handleSaveStructure = async () => {
    if (!structureForm.classId) {
      toast("Choose a class.");
      return;
    }
    const amount = Number(structureForm.amount);
    if (!structureForm.label.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast("A label and a positive amount are required.");
      return;
    }
    setSavingStructure(true);
    try {
      await saveStructure({
        id: editingStructure?._id,
        classId: structureForm.classId as never,
        label: structureForm.label,
        amount,
        period: structureForm.period,
      });
      toast(editingStructure ? "Fee structure updated." : "Fee structure added.");
      setStructureDialog(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save fee structure.");
    } finally {
      setSavingStructure(false);
    }
  };

  const confirmDeleteStructure = async () => {
    if (!deletingStructure) return;
    try {
      await deleteStructure({ id: deletingStructure._id });
      toast("Fee structure removed.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete fee structure.");
    } finally {
      setDeletingStructure(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!paying) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Enter a valid amount.");
      return;
    }
    setSavingPayment(true);
    try {
      const { id: paymentId, receiptNo } = await recordPayment({
        studentId: paying.studentId,
        period: month,
        amount,
        method: paymentForm.method,
        date: paymentForm.date,
        remarks: paymentForm.remarks || undefined,
      });
      toast.success(`Payment recorded for ${paying.name}.`, {
        description: `Receipt ${receiptNo} · ${formatPkr(amount)}`,
        action: {
          label: "Open receipt",
          onClick: () => navigate(`/receipts/${paymentId}`),
        },
      });
      setPaying(null);

      // Optionally send a copy of the receipt to the guardian's phone.
      if (paymentForm.send !== "none") {
        const channel = paymentForm.send;
        try {
          const sendResult = await sendReceiptCopy({ paymentId, channel });
          if (sendResult.success) {
            toast.success(`Receipt ${receiptNo} sent by ${channel === "sms" ? "SMS" : "WhatsApp"}.`, {
              description: sendResult.to ? `To ${sendResult.to}` : undefined,
            });
          } else {
            toast.error(`Receipt saved, but could not send by ${channel === "sms" ? "SMS" : "WhatsApp"}.`, {
              description: sendResult.message,
            });
          }
        } catch (error) {
          toast.error("Receipt saved, but sending the copy failed.", {
            description: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const confirmDeletePayment = async () => {
    if (!deletingPayment) return;
    try {
      const receiptNo = await deletePayment({ id: deletingPayment._id });
      toast(`Payment ${receiptNo} removed (correction).`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete payment.");
    } finally {
      setDeletingPayment(null);
    }
  };

  const handleSendReminder = async (row: DueRow) => {
    setSendingReminder(row.studentId);
    try {
      const result = await sendFeeReminder({
        studentId: row.studentId,
        channel: "whatsapp",
        period: month,
        totalAmount: row.monthly,
        paidAmount: row.paidAmount,
        balance: row.balance,
      });
      if (result.success) {
        toast.success(`Fee reminder sent to guardian of ${row.name}`);
      } else {
        toast.error(result.message || "Could not send reminder");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reminder");
    } finally {
      setSendingReminder(null);
    }
  };

  const handleSendFineAlert = async (row: DueRow) => {
    setSendingReminder(row.studentId);
    try {
      const result = await sendFineAlert({
        studentId: row.studentId,
        channel: "whatsapp",
        period: month,
        totalAmount: row.monthly,
        paidAmount: row.paidAmount,
        balance: row.balance,
        fineAmount: 0,
        daysOverdue: 0,
      });
      if (result.success) {
        toast.success(`Fine alert sent to guardian of ${row.name}`);
      } else {
        toast.error(result.message || "Could not send alert");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send alert");
    } finally {
      setSendingReminder(null);
    }
  };

  const handleExportCollections = () => {
    if (filteredCollections.length === 0) return;
    exportCsv(
      `collections-${month}.csv`,
      filteredCollections.map((p) => ({
        receiptNo: p.receiptNo,
        date: p.date,
        student: p.studentName,
        rollNumber: p.rollNumber,
        className: p.className,
        amount: p.amount,
        method: FEE_METHOD_LABELS[p.method],
        remarks: p.remarks ?? "",
        receivedBy: p.receivedByName,
      })),
    );
  };

  const dueRows = useMemo(() => dueList?.rows ?? [], [dueList]);
  const summary = dueList?.summary ?? null;

  // ---- Filtered due rows ----
  const filteredDueRows = useMemo(() => {
    let rows = dueRows;
    if (dueSearch.trim()) {
      const q = dueSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q),
      );
    }
    if (dueClassFilter !== "all") {
      rows = rows.filter((r) => r.className === dueClassFilter);
    }
    if (dueStatusFilter === "paid") {
      rows = rows.filter((r) => r.balance <= 0);
    } else if (dueStatusFilter === "due") {
      rows = rows.filter((r) => r.balance > 0);
    }
    return rows;
  }, [dueRows, dueSearch, dueClassFilter, dueStatusFilter]);

  // ---- Filtered collections ----
  const filteredCollections = useMemo(() => {
    let rows = collections ?? [];
    if (colSearch.trim()) {
      const q = colSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.receiptNo.toLowerCase().includes(q) ||
          r.rollNumber.toLowerCase().includes(q),
      );
    }
    if (colMethodFilter !== "all") {
      rows = rows.filter((r) => r.method === colMethodFilter);
    }
    return rows;
  }, [collections, colSearch, colMethodFilter]);

  // ---- Unique class names for filter dropdown ----
  const classNames = useMemo(
    () => [...new Set(dueRows.map((r) => r.className))].sort(),
    [dueRows],
  );

  const handleRefund = async () => {
    if (!refunding || !refundReason.trim()) {
      toast.error("Provide a refund reason.");
      return;
    }
    setProcessingRefund(true);
    try {
      await refundPayment({
        paymentId: refunding.id,
        reason: refundReason.trim(),
      });
      toast.success(`Refund processed for ${refunding.receiptNo}`, {
        description: formatPkr(refunding.amount),
      });
      setRefunding(null);
      setRefundReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund failed.");
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <AppShell title="Fee Management">
      <Tabs defaultValue="dues" className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-fit">
            <TabsTrigger value="dues" className="gap-2">
              <Wallet className="size-4" /> Due list
            </TabsTrigger>
            <TabsTrigger value="structures" className="gap-2">
              <Landmark className="size-4" /> Fee structures
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <Percent className="size-4" /> Assignments
            </TabsTrigger>
            <TabsTrigger value="collections" className="gap-2">
              <Receipt className="size-4" /> Collections
            </TabsTrigger>
            <TabsTrigger value="fines" className="gap-2">
              <AlertTriangle className="size-4" /> Fines
            </TabsTrigger>
            <TabsTrigger value="defaulters" className="gap-2">
              <DollarSign className="size-4" /> Defaulters
            </TabsTrigger>
            <TabsTrigger value="closing" className="gap-2">
              <CalendarDays className="size-4" /> Daily Closing
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="size-4" /> Reports
            </TabsTrigger>
            <TabsTrigger value="ledger" className="gap-2">
              <Receipt className="size-4" /> Ledger
            </TabsTrigger>
          </TabsList>
          <div className="grid gap-1.5 sm:w-auto">
            <Label htmlFor="fee-month" className="text-xs font-medium text-muted-foreground">
              Month
            </Label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8 cursor-pointer" onClick={() => navigateMonth(-1)} title="Previous month">
                ‹
              </Button>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fee-month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value || currentMonth())}
                  className="w-40 pl-9"
                />
              </div>
              <Button variant="outline" size="icon" className="size-8 cursor-pointer" onClick={() => navigateMonth(1)} title="Next month">
                ›
              </Button>
            </div>
          </div>
        </div>

        {/* ---------- Due list ---------- */}
        <TabsContent value="dues" className="flex flex-col gap-5">
          {summary === null ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : summary.totalCount === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No monthly fees set up yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a monthly fee structure for each class on the Fee structures tab — the
                  due list is generated from active students automatically.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Search & Filter Bar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or roll number..."
                    value={dueSearch}
                    onChange={(e) => setDueSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select value={dueClassFilter} onValueChange={setDueClassFilter}>
                  <SelectTrigger className="h-8 w-full text-xs sm:w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {classNames.map((cn) => (
                      <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dueStatusFilter} onValueChange={setDueStatusFilter}>
                  <SelectTrigger className="h-8 w-full text-xs sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="due">Due only</SelectItem>
                    <SelectItem value="paid">Paid only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-none">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground">Expected for {month}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{formatPkr(summary.expected)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{summary.totalCount} students liable</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground">Collected</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600">{formatPkr(summary.collected)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{summary.paidCount} paid</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-red-600">{formatPkr(summary.outstanding)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{summary.dueCount} students still due</p>
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground">Collection rate</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{summary.rate}%</p>
                    <Progress
                      value={summary.rate}
                      className="mt-2 h-2 bg-secondary [&_[data-slot=progress-indicator]]:bg-orange-500"
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Monthly fee</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDueRows.map((row) => (
                      <TableRow key={row.studentId} className={cn(row.balance <= 0 && "bg-emerald-50/50")}>
                        <TableCell>
                          <p className="font-semibold">{row.name}</p>
                          <p className="text-xs text-muted-foreground">Roll {row.rollNumber}</p>
                        </TableCell>
                        <TableCell>
                          {row.className}
                          <span className="text-muted-foreground"> · {row.section}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPkr(row.monthly)}
                          {row.adjustment !== 0 && (
                            <p className="text-[10px] font-normal text-muted-foreground">
                              {row.baseMonthly > 0 && <>Base {formatPkr(row.baseMonthly)} · </>}
                              {row.adjustment < 0 ? "concession" : "extra"}{" "}
                              {formatPkr(Math.abs(row.adjustment))}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.paidAmount > 0 ? (
                            <span className="font-semibold text-emerald-600">{formatPkr(row.paidAmount)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.balance > 0 ? (
                            <span className="font-semibold text-red-600">{formatPkr(row.balance)}</span>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {row.balance > 0 ? (
                              <>
                                <Button size="sm" className="cursor-pointer" onClick={() => openPayDialog(row)}>
                                  <Banknote className="size-3.5" /> Collect
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleSendReminder(row)}
                                  disabled={sendingReminder === row.studentId}
                                  title="Send fee reminder via WhatsApp"
                                >
                                  {sendingReminder === row.studentId ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Send className="size-3.5" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => handleSendFineAlert(row)}
                                  disabled={sendingReminder === row.studentId}
                                  title="Send overdue fine alert via WhatsApp"
                                >
                                  <MessageSquare className="size-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Link
                                to={`/receipts/${row.paymentId}`}
                                className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                                title="Open receipt"
                              >
                                {row.receiptNo}
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile due cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {filteredDueRows.map((row) => (
                  <li key={row.studentId} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{row.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Roll {row.rollNumber} · {row.className} · Section {row.section}
                        </p>
                      </div>
                      {row.balance <= 0 ? (
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>
                      ) : (
                        <span className="shrink-0 text-sm font-bold text-red-600">{formatPkr(row.balance)}</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Monthly {formatPkr(row.monthly)}
                        {row.adjustment !== 0 && (
                          <span>
                            {" "}
                            · {row.adjustment < 0 ? "concession" : "extra"}{" "}
                            {formatPkr(Math.abs(row.adjustment))}
                          </span>
                        )}
                      </span>
                      {row.paidAmount > 0 && row.paymentId && (
                        <Link
                          to={`/receipts/${row.paymentId}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Paid {formatPkr(row.paidAmount)} · {row.receiptNo}
                        </Link>
                      )}
                    </div>
                    {row.balance > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        <Button size="sm" className="w-full cursor-pointer" onClick={() => openPayDialog(row)}>
                          <Banknote className="size-3.5" /> Collect fee
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 cursor-pointer text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => handleSendReminder(row)}
                            disabled={sendingReminder === row.studentId}
                          >
                            {sendingReminder === row.studentId ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                            WhatsApp Reminder
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleSendFineAlert(row)}
                            disabled={sendingReminder === row.studentId}
                          >
                            <MessageSquare className="size-3.5" />
                            Fine Alert
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>

        {/* ---------- Fee structures ---------- */}
        <TabsContent value="structures" className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {structures.length} structure{structures.length === 1 ? "" : "s"} defined
            </p>
            <Button className="cursor-pointer" onClick={() => openStructureDialog(null)}>
              <Plus className="size-4" /> Add structure
            </Button>
          </div>
          {structures.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Landmark className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No fee structures yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Define what each class pays — e.g. monthly tuition of Rs 4,000 for Nursery.
                </p>
              </div>
              <Button className="cursor-pointer" onClick={() => openStructureDialog(null)}>
                <Plus className="size-4" /> Add structure
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structures.map((structure) => (
                    <TableRow key={structure._id}>
                      <TableCell className="font-medium">{structure.className}</TableCell>
                      <TableCell>{structure.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {FEE_PERIOD_LABELS[structure.period]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatPkr(structure.amount)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`Edit ${structure.label}`}
                            onClick={() => openStructureDialog(structure)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer text-red-600 hover:text-red-600"
                            aria-label={`Delete ${structure.label}`}
                            onClick={() => setDeletingStructure(structure)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------- Fee assignments ---------- */}
        <TabsContent value="assignments" className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {assignments.length} assignment{assignments.length === 1 ? "" : "s"} — per-student
              concessions (negative) or extra charges (positive)
            </p>
            <Button className="cursor-pointer" onClick={() => openAssignmentDialog(null)}>
              <Plus className="size-4" /> Add assignment
            </Button>
          </div>
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Percent className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No fee assignments yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apply a concession (sibling discount, scholarship) or an extra charge
                  (transport) to individual students. Adjustments change their monthly due.
                </p>
              </div>
              <Button className="cursor-pointer" onClick={() => openAssignmentDialog(null)}>
                <Plus className="size-4" /> Add assignment
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Adjustment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment._id}>
                      <TableCell>
                        <p className="font-semibold">{assignment.studentName}</p>
                        <p className="text-xs text-muted-foreground">Roll {assignment.rollNumber}</p>
                      </TableCell>
                      <TableCell>
                        {assignment.className}
                        <span className="text-muted-foreground"> · {assignment.section}</span>
                      </TableCell>
                      <TableCell>{assignment.label}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {assignment.amount < 0 ? (
                          <span className="text-red-600">
                            −{formatPkr(Math.abs(assignment.amount))}
                          </span>
                        ) : (
                          <span className="text-primary">+{formatPkr(assignment.amount)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            aria-label={`Edit ${assignment.label}`}
                            onClick={() => openAssignmentDialog(assignment)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer text-red-600 hover:text-red-600"
                            aria-label={`Delete ${assignment.label}`}
                            onClick={() => setDeletingAssignment(assignment)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------- Collections ---------- */}
        <TabsContent value="collections" className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {collections === undefined
                ? "Loading…"
                : `${filteredCollections.length} payment${filteredCollections.length === 1 ? "" : "s"} recorded for ${month}`}
            </p>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={handleExportCollections}
              disabled={(filteredCollections?.length ?? 0) === 0}
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, receipt number..."
                value={colSearch}
                onChange={(e) => setColSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={colMethodFilter} onValueChange={setColMethodFilter}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-40"><SelectValue placeholder="Payment method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="easypaisa">Easypaisa</SelectItem>
                <SelectItem value="jazzcash">JazzCash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {collections === undefined ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Receipt className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No collections yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Payments recorded for {month} will appear here with their receipt numbers.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollections.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>
                        <Link
                          to={`/receipts/${payment._id}`}
                          className="font-mono text-xs font-medium text-primary underline-offset-2 hover:underline"
                          title="Open receipt"
                        >
                          {payment.receiptNo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(payment.date)}</TableCell>
                      <TableCell>
                        <p className="font-semibold">{payment.studentName}</p>
                        <p className="text-xs text-muted-foreground">Roll {payment.rollNumber}</p>
                      </TableCell>
                      <TableCell>{payment.className}</TableCell>
                      <TableCell className="text-muted-foreground">{FEE_METHOD_LABELS[payment.method]}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPkr(payment.amount)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer text-amber-600 hover:text-amber-600"
                            title="Refund this payment"
                            onClick={() => setRefunding({ id: payment._id, receiptNo: payment.receiptNo, amount: payment.amount })}
                          >
                            <Receipt className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer text-red-600 hover:text-red-600"
                            aria-label={`Delete ${payment.receiptNo}`}
                            onClick={() => setDeletingPayment(payment)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------- Fines ---------- */}
        <TabsContent value="fines">
          <FinesTab period={month} />
        </TabsContent>

        {/* ---------- Defaulters ---------- */}
        <TabsContent value="defaulters">
          <DefaulterTab />
        </TabsContent>

        {/* ---------- Daily Closing ---------- */}
        <TabsContent value="closing">
          <DailyClosingTab />
        </TabsContent>

        {/* ---------- Reports ---------- */}
        <TabsContent value="reports">
          <CollectionReportTab />
        </TabsContent>

        {/* ---------- Ledger ---------- */}
        <TabsContent value="ledger">
          <LedgerTab />
        </TabsContent>
      </Tabs>

      {/* Structure dialog */}
      <Dialog open={structureDialog} onOpenChange={setStructureDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStructure ? "Edit fee structure" : "Add fee structure"}</DialogTitle>
            <DialogDescription>
              Define what a class owes. Monthly structures drive the due list; annual and
              admission fees are recorded for reference.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="fee-class">Class *</Label>
              <Select
                value={structureForm.classId}
                onValueChange={(value) => setStructureForm((prev) => ({ ...prev, classId: value }))}
              >
                <SelectTrigger id="fee-class">
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fee-label">Label *</Label>
              <Input
                id="fee-label"
                value={structureForm.label}
                onChange={(e) => setStructureForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Monthly tuition"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="fee-amount">Amount (Rs) *</Label>
                <Input
                  id="fee-amount"
                  type="number"
                  min={0}
                  value={structureForm.amount}
                  onChange={(e) => setStructureForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="e.g. 4000"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fee-period">Period</Label>
                <Select
                  value={structureForm.period}
                  onValueChange={(value) => setStructureForm((prev) => ({ ...prev, period: value as FeePeriod }))}
                >
                  <SelectTrigger id="fee-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FEE_PERIOD_LABELS) as FeePeriod[]).map((period) => (
                      <SelectItem key={period} value={period}>
                        {FEE_PERIOD_LABELS[period]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setStructureDialog(false)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleSaveStructure} disabled={savingStructure}>
              {savingStructure && <Loader2 className="size-4 animate-spin" />}
              {editingStructure ? "Save changes" : "Add structure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={paying !== null} onOpenChange={(open) => { if (!open) setPaying(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect fee — {paying?.name}</DialogTitle>
            <DialogDescription>
              Roll {paying?.rollNumber} · {paying?.className} · Section {paying?.section} · for {month}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pay-amount">Amount (Rs) *</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min={0}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pay-method">Method</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, method: value as FeeMethod }))}
                >
                  <SelectTrigger id="pay-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FEE_METHOD_LABELS) as FeeMethod[]).map((method) => (
                      <SelectItem key={method} value={method}>
                        {FEE_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentForm.date}
                max={todayStr()}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-remarks">Remarks</Label>
              <Input
                id="pay-remarks"
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional note"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-send">Send receipt copy</Label>
              <Select
                value={paymentForm.send}
                onValueChange={(value) =>
                  setPaymentForm((prev) => ({ ...prev, send: value as "none" | "sms" | "whatsapp" }))
                }
              >
                <SelectTrigger id="pay-send">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don&apos;t send</SelectItem>
                  <SelectItem value="sms">SMS to guardian</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp to guardian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment && <Loader2 className="size-4 animate-spin" />}
              <Receipt className="size-4" /> Record &amp; issue receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete structure confirm */}
      <AlertDialog open={deletingStructure !== null} onOpenChange={(open) => { if (!open) setDeletingStructure(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Delete fee structure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStructure?.label} ({formatPkr(deletingStructure?.amount ?? 0)}) for{" "}
              {deletingStructure?.className} will be removed. Existing payments are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer bg-red-600 hover:bg-red-700" onClick={confirmDeleteStructure}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignment dialog */}
      <Dialog open={assignmentDialog} onOpenChange={setAssignmentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? "Edit fee assignment" : "Add fee assignment"}</DialogTitle>
            <DialogDescription>
              Adjust one student&apos;s monthly fee. Negative amounts give a concession
              (discount); positive amounts add an extra charge such as transport.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="assign-student">Student *</Label>
              <Select
                value={assignmentForm.studentId}
                onValueChange={(value) =>
                  setAssignmentForm((prev) => ({ ...prev, studentId: value }))
                }
              >
                <SelectTrigger id="assign-student">
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {activeStudents.map((student) => (
                    <SelectItem key={student._id} value={student._id}>
                      {student.name} — Roll {student.rollNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assign-label">Label *</Label>
              <Input
                id="assign-label"
                value={assignmentForm.label}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Sibling concession, Scholarship, Transport"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assign-amount">Amount (Rs) *</Label>
              <Input
                id="assign-amount"
                type="number"
                value={assignmentForm.amount}
                onChange={(e) => setAssignmentForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g. -500 for concession, 400 for transport"
              />
              <p className="text-xs text-muted-foreground">
                Use a minus sign (−500) for a concession; a positive number (400) adds to the fee.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setAssignmentDialog(false)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleSaveAssignment} disabled={savingAssignment}>
              {savingAssignment && <Loader2 className="size-4 animate-spin" />}
              {editingAssignment ? "Save changes" : "Add assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete assignment confirm */}
      <AlertDialog
        open={deletingAssignment !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingAssignment(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Remove fee assignment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingAssignment?.label} ({formatPkr(deletingAssignment?.amount ?? 0)}) for{" "}
              {deletingAssignment?.studentName} will be removed and their monthly due recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-red-600 hover:bg-red-700"
              onClick={confirmDeleteAssignment}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete payment confirm */}
      <AlertDialog open={deletingPayment !== null} onOpenChange={(open) => { if (!open) setDeletingPayment(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Delete payment {deletingPayment?.receiptNo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatPkr(deletingPayment?.amount ?? 0)} for {deletingPayment?.studentId ? "this student" : ""} on{" "}
              {deletingPayment ? formatDate(deletingPayment.date) : ""} will be removed from the register.
              Use this only to correct mistakes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer bg-red-600 hover:bg-red-700" onClick={confirmDeletePayment}>
              Delete payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Refund Dialog */}
      <Dialog open={!!refunding} onOpenChange={(v) => { if (!v) { setRefunding(null); setRefundReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refund Payment</DialogTitle>
            <DialogDescription>
              This will delete receipt {refunding?.receiptNo} and refund {refunding ? formatPkr(refunding.amount) : ""}.
              The student&apos;s balance will be recalculated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="refund-reason">Reason for refund *</Label>
              <Input
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Duplicate payment, parent request..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => { setRefunding(null); setRefundReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" className="cursor-pointer" onClick={handleRefund} disabled={processingRefund || !refundReason.trim()}>
              {processingRefund ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
