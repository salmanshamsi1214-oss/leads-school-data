import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { STATUS_META, statusLabel } from "@/lib/attendance";
import { exportCsv, formatDate, monthRange, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils"

export function StudentProfileDialog({
  student,
  className,
  open,
  onOpenChange,
}: {
  student: Doc<"students">;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const now = new Date();
  const { from, to } = monthRange(now.getFullYear(), now.getMonth() + 1);
  const setPhoto = useMutation(api.students.setPhoto);
  const history = useQuery(api.attendance.studentMonthly, {
    studentId: student._id,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const handlePhotoUploaded = async (url: string) => {
    await setPhoto({ id: student._id, photoUrl: url });
  };

  const totals = history?.totals;
  const marked = totals
    ? totals.present + totals.absent + totals.late + totals.leave
    : 0;
  const rate = totals && marked > 0 ? Math.round((totals.present / marked) * 100) : 0;

  const handleExport = () => {
    if (!history) return;
    exportCsv(
      `attendance-${student.rollNumber}-${from}.csv`,
      history.records.map((record) => ({
        date: record.date,
        status: statusLabel(record.status),
        name: student.name,
        rollNumber: student.rollNumber,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{student.name}</DialogTitle>
          <DialogDescription>
            Roll {student.rollNumber} · {className} · Section {student.section}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Student Photo */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-24">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="w-24 h-24 rounded-lg object-cover border"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg border bg-muted/30 flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground/40">
                    {student.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Student Photo</p>
              <FileUpload
                bucket="student-photos"
                path={`students/${student.rollNumber}/photo.jpg`}
                currentUrl={student.photoUrl}
                onUploaded={handlePhotoUploaded}
                compact
                label="Upload Photo"
                accept="image/jpeg,image/png,image/webp"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Father&apos;s name</p>
              <p className="mt-0.5 font-medium">{student.fatherName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="mt-0.5 font-medium">
                <Badge
                  className={cn(
                    student.status === "active"
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                  )}
                >
                  {student.status === "active" ? "Active" : "Left"}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Admission date</p>
              <p className="mt-0.5 font-medium">
                {student.admissionDate ? formatDate(student.admissionDate) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date of birth</p>
              <p className="mt-0.5 font-medium">
                {student.birthDate ? formatDate(student.birthDate) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contact</p>
              <p className="mt-0.5 font-medium">{student.phone || "—"}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold tracking-tight">
                  Attendance — {formatDate(from)} to {formatDate(to)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {marked} day(s) marked · {rate}% present
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={handleExport}
                disabled={!history || history.records.length === 0}
              >
                <Download className="size-4" />
                CSV
              </Button>
            </div>

            {history === undefined ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : totals && marked > 0 ? (
              <>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(
                    (status) => (
                      <div key={status} className="rounded-md bg-secondary/60 px-2 py-1.5 text-center">
                        <p className="text-sm font-bold">
                          {totals[status]}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {STATUS_META[status].label}
                        </p>
                      </div>
                    ),
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {history.records.map((record) => (
                    <li
                      key={record.date}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-medium">{formatDate(record.date)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          STATUS_META[record.status as keyof typeof STATUS_META].chip,
                        )}
                      >
                        {statusLabel(record.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No attendance marked for this student in {formatDate(todayStr()).slice(-12)} yet.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
