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
import { Download, BarChart3 } from "lucide-react";

function currentMonth() { return todayStr().slice(0, 7); }

export function CollectionReportTab() {
  const [period, setPeriod] = useState(currentMonth());
  const data = useQuery(api.feeManagement.classCollectionReport, { period });

  const handleExport = () => {
    if (!data?.length) return;
    exportCsv(`collection-report-${period}.csv`, data.map((r) => ({
      class: r.className, students: r.studentCount, baseMonthly: r.baseMonthly,
      expected: r.totalExpected, collected: r.totalCollected, fines: r.totalFines,
      outstanding: r.outstanding, rate: `${r.collectionRate}%`, paid: r.paidCount, due: r.dueCount,
    })));
  };

  const totalExpected = data?.reduce((s, r) => s + r.totalExpected, 0) ?? 0;
  const totalCollected = data?.reduce((s, r) => s + r.totalCollected, 0) ?? 0;
  const totalFines = data?.reduce((s, r) => s + r.totalFines, 0) ?? 0;
  const overallRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1"><Label className="text-[10px]">Period</Label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value || currentMonth())} className="h-8 text-xs w-40" />
        </div>
        {data?.length ? (
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="size-3.5 mr-1" /> Export CSV</Button>
        ) : null}
      </div>

      {data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatPkr(totalExpected)}</p>
            <p className="text-xs text-muted-foreground">Total Expected</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{formatPkr(totalCollected)}</p>
            <p className="text-xs text-muted-foreground">Total Collected</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{formatPkr(totalExpected - totalCollected + totalFines)}</p>
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
          </CardContent></Card>
          <Card className="shadow-none"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{overallRate}%</p>
            <p className="text-xs text-muted-foreground">Overall Rate</p>
          </CardContent></Card>
        </div>
      )}

      {!data ? <div className="text-center py-8 text-muted-foreground">Loading...</div>
        : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="size-10 mx-auto mb-3 opacity-30" />
            <p>No collection data for {period}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Class</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Fines</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead className="text-center">Paid/Due</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.classId}>
                    <TableCell className="font-medium text-sm">{r.className}</TableCell>
                    <TableCell className="text-center text-xs">{r.studentCount}</TableCell>
                    <TableCell className="text-right text-xs">{formatPkr(r.totalExpected)}</TableCell>
                    <TableCell className="text-right text-xs text-emerald-600 font-medium">{formatPkr(r.totalCollected)}</TableCell>
                    <TableCell className="text-right text-xs text-amber-600">{r.totalFines > 0 ? formatPkr(r.totalFines) : "—"}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-red-600">{r.outstanding > 0 ? formatPkr(r.outstanding) : "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.collectionRate >= 80 ? "default" : r.collectionRate >= 50 ? "outline" : "destructive"} className="text-[10px]">
                        {r.collectionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{r.paidCount}/{r.paidCount + r.dueCount}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-center text-xs">{data.reduce((s, r) => s + r.studentCount, 0)}</TableCell>
                  <TableCell className="text-right text-xs">{formatPkr(totalExpected)}</TableCell>
                  <TableCell className="text-right text-xs text-emerald-600">{formatPkr(totalCollected)}</TableCell>
                  <TableCell className="text-right text-xs text-amber-600">{formatPkr(totalFines)}</TableCell>
                  <TableCell className="text-right text-xs text-red-600">{formatPkr(totalExpected - totalCollected + totalFines)}</TableCell>
                  <TableCell className="text-center"><Badge className="text-[10px]">{overallRate}%</Badge></TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
