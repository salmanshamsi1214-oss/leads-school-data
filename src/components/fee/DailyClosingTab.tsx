import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPkr, todayStr, exportCsv } from "@/lib/format";
import { FEE_METHOD_LABELS } from "@/lib/fees";
import { CalendarDays, Download, Receipt } from "lucide-react";

export function DailyClosingTab() {
  const [date, setDate] = useState(todayStr());
  const data = useQuery(api.feeManagement.dailyClosing, { date });

  const handleExport = () => {
    if (!data?.receipts.length) return;
    exportCsv(`closing-${date}.csv`, data.receipts.map((r) => ({
      receipt: r.receiptNo, student: r.studentName, roll: r.rollNumber,
      class: r.className, amount: r.amount, method: r.method, remarks: r.remarks, receivedBy: r.receivedBy,
    })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1"><Label className="text-[10px]">Date</Label>
          <div className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} className="h-8 text-xs pl-9 w-48" />
          </div>
        </div>
        {data?.receipts.length ? (
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="size-3.5 mr-1" /> Export</Button>
        ) : null}
      </div>

      {!data ? <div className="text-center py-8 text-muted-foreground">Loading...</div>
        : data.totalTransactions === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="size-10 mx-auto mb-3 opacity-30" />
            <p>No transactions on {date}.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="shadow-none"><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{formatPkr(data.totalCollected)}</p>
                <p className="text-xs text-muted-foreground">Total Collected</p>
              </CardContent></Card>
              <Card className="shadow-none"><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data.totalTransactions}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </CardContent></Card>
              {Object.entries(data.byMethod).map(([method, amount]) => (
                <Card key={method} className="shadow-none"><CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{formatPkr(amount)}</p>
                  <p className="text-xs text-muted-foreground">{FEE_METHOD_LABELS[method as keyof typeof FEE_METHOD_LABELS] ?? method}</p>
                </CardContent></Card>
              ))}
            </div>

            {/* By Class */}
            {Object.keys(data.byClass).length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50">
                    <TableHead>Class</TableHead><TableHead className="text-right">Receipts</TableHead><TableHead className="text-right">Amount</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(data.byClass).sort((a, b) => a[0].localeCompare(b[0])).map(([cls, info]) => (
                      <TableRow key={cls}>
                        <TableCell className="font-medium text-sm">{cls}</TableCell>
                        <TableCell className="text-right text-xs">{info.count}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{formatPkr(info.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Receipt Details */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Receipt</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead><TableHead>Received By</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.receipts.map((r) => (
                    <TableRow key={r.receiptNo}>
                      <TableCell className="font-mono text-xs">{r.receiptNo}</TableCell>
                      <TableCell><p className="text-sm">{r.studentName}</p><p className="text-[10px] text-muted-foreground">Roll {r.rollNumber}</p></TableCell>
                      <TableCell className="text-xs">{r.className}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{formatPkr(r.amount)}</TableCell>
                      <TableCell className="text-xs capitalize">{FEE_METHOD_LABELS[r.method as keyof typeof FEE_METHOD_LABELS] ?? r.method}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.receivedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
    </div>
  );
}
