import type { AttendanceStatus } from "@/convex/schema";

export const STATUS_ORDER: AttendanceStatus[] = ["present", "absent", "late", "leave"];

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; chip: string; solid: string; dot: string }
> = {
  present: {
    label: "Present",
    short: "P",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    solid: "bg-emerald-600 text-white border-emerald-600",
    dot: "bg-emerald-500",
  },
  absent: {
    label: "Absent",
    short: "A",
    chip: "bg-red-100 text-red-800 border-red-200",
    solid: "bg-red-600 text-white border-red-600",
    dot: "bg-red-500",
  },
  late: {
    label: "Late",
    short: "L",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    solid: "bg-amber-500 text-white border-amber-500",
    dot: "bg-amber-500",
  },
  leave: {
    label: "Leave",
    short: "E",
    chip: "bg-slate-200 text-slate-700 border-slate-300",
    solid: "bg-slate-600 text-white border-slate-600",
    dot: "bg-slate-400",
  },
};

export const statusLabel = (status: string): string =>
  STATUS_META[status as AttendanceStatus]?.label ?? status;
