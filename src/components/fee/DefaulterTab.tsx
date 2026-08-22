import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPkr, todayStr, exportCsv } from "@/lib/format";
import { AlertTriangle, Download, Users } from "lucide-react";
import { Send } from "lucide-react";
import { useAction } from "convex/react";
import { toast } from "sonner";

function currentMonth() { return todayStr().slice(0, 7); }

export function DefaulterTab() {
  const [asOfMonth, setAsOfMonth] = useState(currentMonth());
  const [months, setMonths] = useState(6);
  const data = useQuery(api.feeManagement.defaulterReport, { asOfMonth, months });
  const sendFeeReminder = useAction(api.sms.sendFeeReminder);
  const [sending, setSending] = useState<string | null>(null);

  const handleExport = () => {
    if (!data?.rows.length) return;
    exportCsv(`defaulters-${asOfMonth}.csv`, data.rows.map((r) => ({
      name: r.name, roll: r.rollNumber, class: `${r.className}-${r.section}`,
      monthly: r.monthly, totalDue: r.totalDue, totalPaid: r.totalPaid,
      totalFines: r.totalFines, outstanding: r.totalOutstanding, monthsOwed: r.monthsOwed,
    })));
    toast.success("Exported defaulters CSV");
  };

  const handleReminder = async (r: any) => {
    setSending(r.studentId);
    try {
      const res = await sendFeeReminder({
        studentId: r.studentId, channel: "whatsapp", period: asOfMonth,
        totalAmount: r.monthly, paidAmount: r.totalPaid, balance: r.totalOutstanding,
      });
      if (res.success) toast.success(`Reminder sent for ${r.name}`);
      else toast.error(res.message || "Failed to send");
    } catch { toast.error("Failed"); }
    finally { setSending(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1"><Label className="text-[10px]">As of Month</Label><Input type="month" value={asOfMonth} onChange={(e) => setAsOfMonth(e.target.value || currentMonth())} className="h-8 text-xs w-40" /></div>
        <div className="space-y-1"><Label className="text-[10px]">Months Back</Label><Input type="number" min={1} max={12} value={months} onChange={(e) => setMonths(Number(e.target.value) || 6)} className="h-8 text-xs w-20" /></div>
        {data?.rows.length ? (
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="size-3.5 mr-1" /> Export CSV</Button>
        ) : null}
      </div>

      {data?.summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{data.summary.totalDefaulters}</p>
            <p className="text-xs text-muted-foreground">Defaulters</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{formatPkr(data.summary.totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{formatPkr(data.summary.totalFines)}</p>
            <p className="text-xs text-muted-foreground">Unpaid Fines</p>
          </CardContent></Card>
        </div>
      )}

      {!data ? <div className="text-center py-8 text-muted-foreground">Loading...</div>
        : data.rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 text-emerald-500 opacity-50" />
            <p className="font-medium text-emerald-600">No defaulters found!</p>
            <p className="text-xs mt-1">All students have paid their dues for the last {months} months.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Fines</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-center">Months</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell><p className="font-medium text-sm">{r.name}</p><p className="text-[10px] text-muted-foreground">Roll {r.rollNumber}</p></TableCell>
                    <TableCell className="text-xs">{r.className} — {r.section}</TableCell>
                    <TableCell className="text-right text-xs">{formatPkr(r.monthly)}</TableCell>
                    <TableCell className="text-right text-xs text-emerald-600">{formatPkr(r.totalPaid)}</TableCell>
                    <TableCell className="text-right text-xs text-amber-600">{r.totalFines > 0 ? formatPkr(r.totalFines) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-red-600">{formatPkr(r.totalOutstanding)}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{r.monthsOwed}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-emerald-600" onClick={() => handleReminder(r)} disabled={sending === r.studentId}>
                        <Send className="size-3" /> Remind
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
