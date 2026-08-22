import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatPkr, formatDate, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "salary", label: "Salary" },
  { value: "utilities", label: "Utilities" },
  { value: "maintenance", label: "Maintenance" },
  { value: "supplies", label: "Supplies" },
  { value: "transport", label: "Transport" },
  { value: "events", label: "Events" },
  { value: "technology", label: "Technology" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  salary: "bg-red-100 text-red-700",
  utilities: "bg-blue-100 text-blue-700",
  maintenance: "bg-orange-100 text-orange-700",
  supplies: "bg-green-100 text-green-700",
  transport: "bg-purple-100 text-purple-700",
  events: "bg-yellow-100 text-yellow-700",
  technology: "bg-cyan-100 text-cyan-700",
  other: "bg-slate-100 text-slate-700",
};

export default function Expenses() {
  const [category, setCategory] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Id<"expenses"> | null>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [expCategory, setExpCategory] = useState("utilities");
  const [date, setDate] = useState(todayStr());
  const [paidMethod, setPaidMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const expenses = useQuery(api.expenses.list, {
    category: category === "all" ? undefined : category,
  });
  const summary = useQuery(api.expenses.summary, {});
  const createExpense = useMutation(api.expenses.create);
  const removeExpense = useMutation(api.expenses.remove);

  const handleCreate = async () => {
    if (!title.trim()) return toast.error("Title is required.");
    if (amount <= 0) return toast.error("Amount must be positive.");
    setSubmitting(true);
    try {
      await createExpense({
        title: title.trim(),
        amount,
        category: expCategory as never,
        date,
        paidMethod: paidMethod as never,
        notes: notes || undefined,
      });
      toast.success("Expense recorded");
      setFormOpen(false);
      setTitle("");
      setAmount(0);
      setNotes("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await removeExpense({ id: deleting });
      toast.success("Deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell title="Expenses">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {expenses?.length ?? 0} expense{(expenses?.length ?? 0) === 1 ? "" : "s"} recorded
          </p>
          <Button onClick={() => setFormOpen(true)} className="cursor-pointer">
            <Plus className="mr-1 size-4" />
            Add Expense
          </Button>
        </div>

        {summary && summary.byCategory.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.byCategory.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <Badge className={cn(CATEGORY_COLORS[cat.category] ?? "bg-slate-100 text-slate-700")}>
                  {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                </Badge>
                <span className="font-bold">{formatPkr(cat.total)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {expenses === undefined ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
            <p className="text-sm font-semibold">No expenses recorded</p>
            <Button className="cursor-pointer" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 size-4" /> Add first expense
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell>{formatDate(e.date)}</TableCell>
                    <TableCell>
                      <p className="font-semibold">{e.title}</p>
                      {e.notes && (
                        <p className="text-xs text-muted-foreground">{e.notes}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(CATEGORY_COLORS[e.category])}>
                        {e.category.charAt(0).toUpperCase() + e.category.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">{formatPkr(e.amount)}</TableCell>
                    <TableCell className="capitalize">{e.paidMethod}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 cursor-pointer text-red-500"
                        onClick={() => setDeleting(e._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Electricity bill"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Amount (PKR)</Label>
                <Input
                  type="number"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={expCategory} onValueChange={setExpCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Payment method</Label>
                <Select value={paidMethod} onValueChange={setPaidMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button className="cursor-pointer" onClick={handleCreate} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Delete expense?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
